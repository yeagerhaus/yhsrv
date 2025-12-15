#!/usr/bin/env bun

/**
 * Setup script for yhsrv
 * 
 * This script automates the setup process:
 * - Checks prerequisites (.env file, PostgreSQL, FFmpeg)
 * - Installs dependencies
 * - Creates necessary directories
 * - Initializes database schema
 * - Optionally sets up Docker
 */

import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import { config } from '../src/config/index.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

async function checkPrerequisites() {
  log('\n📋 Checking prerequisites...\n', 'cyan');

  let allGood = true;

  // Check .env file
  if (!existsSync('.env')) {
    error('.env file not found!');
    info('Please create a .env file with your configuration.');
    info('See .env.example for reference.');
    allGood = false;
  } else {
    success('.env file found');
  }

  // Check FFmpeg
  const ffmpegOk = await checkCommand('ffmpeg', ['-version']);
  if (ffmpegOk) {
    success('FFmpeg is installed');
  } else {
    error('FFmpeg not found in PATH');
    info('Please install FFmpeg:');
    info('  macOS: brew install ffmpeg');
    info('  Linux: apt-get install ffmpeg or yum install ffmpeg');
    allGood = false;
  }

  // Check FFprobe
  const ffprobeOk = await checkCommand('ffprobe', ['-version']);
  if (ffprobeOk) {
    success('FFprobe is installed');
  } else {
    error('FFprobe not found in PATH');
    allGood = false;
  }

  // Check PostgreSQL connection
  try {
    const { db } = await import('../src/db/index.js');
    await db.selectFrom('artists').select(db.fn.count('id').as('count')).execute();
    success('PostgreSQL connection successful');
  } catch (err: any) {
    error('Cannot connect to PostgreSQL');
    info(`Error: ${err.message}`);
    info('Please ensure PostgreSQL is running and DATABASE_URL is correct in .env');
    allGood = false;
  }

  // Check music library path
  const musicPath = config.music.rootPath;
  if (existsSync(musicPath)) {
    success(`Music library path exists: ${musicPath}`);
  } else {
    warning(`Music library path not found: ${musicPath}`);
    info('The directory will be created, but make sure your music files are accessible.');
  }

  return allGood;
}

async function checkCommand(cmd: string, args: string[] = []): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function runCommand(cmd: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { 
      stdio: 'inherit',
      cwd: cwd || process.cwd(),
      shell: true,
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function installDependencies() {
  log('\n📦 Installing dependencies...\n', 'cyan');
  
  try {
    info('Running bun install...');
    const ok = await runCommand('bun', ['install']);
    if (ok) {
      success('Dependencies installed');
      return true;
    } else {
      error('Failed to install dependencies');
      return false;
    }
  } catch (err: any) {
    error(`Failed to install dependencies: ${err.message}`);
    return false;
  }
}

async function createDirectories() {
  log('\n📁 Creating necessary directories...\n', 'cyan');

  const directories = [
    './cache/transcodes',
    config.music.rootPath,
  ];

  for (const dir of directories) {
    try {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        success(`Created directory: ${dir}`);
      } else {
        info(`Directory already exists: ${dir}`);
      }
    } catch (err: any) {
      error(`Failed to create directory ${dir}: ${err.message}`);
      return false;
    }
  }

  return true;
}

async function runMigrations() {
  log('\n🗄️  Initializing database schema...\n', 'cyan');

  try {
    info('Running database migrations...');
    const ok = await runCommand('bun', ['run', 'migrate']);
    if (ok) {
      success('Database schema initialized');
      return true;
    } else {
      error('Migration failed');
      return false;
    }
  } catch (err: any) {
    error(`Migration failed: ${err.message}`);
    return false;
  }
}

async function checkDocker() {
  log('\n🐳 Checking Docker setup...\n', 'cyan');

  const dockerOk = await checkCommand('docker', ['--version']);
  if (dockerOk) {
    success('Docker is installed');
    
    const composeOk = await checkCommand('docker-compose', ['--version']);
    if (composeOk) {
      success('Docker Compose is installed');
    } else {
      const composeV2Ok = await checkCommand('docker', ['compose', 'version']);
      if (composeV2Ok) {
        success('Docker Compose (v2) is installed');
      } else {
        warning('Docker Compose not found');
      }
    }
    return true;
  } else {
    warning('Docker not found - skipping Docker setup');
    info('You can set up Docker later if needed');
    return false;
  }
}

/**
 * Extract Cloudflared tunnel URL from logs
 */
async function getCloudflaredUrl(dockerComposeFile: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('docker-compose', ['-f', dockerComposeFile, 'logs', 'cloudflared'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      // Look for the URL pattern in the logs
      // Cloudflared outputs: "https://something.trycloudflare.com"
      const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (urlMatch) {
        resolve(urlMatch[0]);
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => {
      resolve(null);
    });
  });
}

async function setupDocker() {
  log('\n🐳 Setting up Docker containers...\n', 'cyan');

  const dockerComposeFile = 'docker/docker-compose.yml';
  if (!existsSync(dockerComposeFile)) {
    warning('Docker Compose file not found, skipping Docker setup');
    return false;
  }

  try {
    info('Building and starting Docker containers...');
    // Run from project root, docker-compose file is relative to root
    const buildOk = await runCommand('docker-compose', ['-f', dockerComposeFile, 'up', '-d', '--build']);
    if (!buildOk) {
      error('Failed to start Docker containers');
      return false;
    }
    success('Docker containers started');
    
    info('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    info('Running database migrations in container...');
    const migrateOk = await runCommand('docker-compose', ['-f', dockerComposeFile, 'exec', '-T', 'yhsrv', 'bun', 'run', 'migrate']);
    if (migrateOk) {
      success('Database migrations completed in container');
    } else {
      warning('Migration in container may have failed - check logs');
    }
    
    // Try to get Cloudflared URL
    info('Checking for Cloudflared tunnel URL...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give cloudflared time to start
    const tunnelUrl = await getCloudflaredUrl(dockerComposeFile);
    if (tunnelUrl) {
      log('\n🌐 Cloudflared Tunnel URL:', 'cyan');
      log(`   ${tunnelUrl}`, 'bright');
      log('\n   You can access the API at:', 'cyan');
      log(`   ${tunnelUrl}/api/health`, 'green');
      log(`   ${tunnelUrl}/api/library/stats`, 'green');
      log('\n');
    } else {
      warning('Could not find Cloudflared tunnel URL in logs');
      info('Check logs with: docker-compose -f docker/docker-compose.yml logs cloudflared');
    }
    
    return true;
  } catch (err: any) {
    error(`Docker setup failed: ${err.message}`);
    info('You can manually start Docker with:');
    info('  cd docker && docker-compose up -d');
    return false;
  }
}

async function main() {
  log('\n🚀 yhsrv Setup Script\n', 'bright');
  log('='.repeat(50) + '\n', 'cyan');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipDocker = args.includes('--skip-docker');
  const dockerOnly = args.includes('--docker-only');

  if (dockerOnly) {
    const hasDocker = await checkDocker();
    if (hasDocker) {
      await setupDocker();
    }
    return;
  }

  // Check prerequisites
  const prerequisitesOk = await checkPrerequisites();
  if (!prerequisitesOk) {
    error('\n❌ Prerequisites check failed. Please fix the issues above and try again.\n');
    process.exit(1);
  }

  // Install dependencies
  const depsOk = await installDependencies();
  if (!depsOk) {
    error('\n❌ Failed to install dependencies.\n');
    process.exit(1);
  }

  // Create directories
  const dirsOk = await createDirectories();
  if (!dirsOk) {
    error('\n❌ Failed to create directories.\n');
    process.exit(1);
  }

  // Run migrations
  const migrationsOk = await runMigrations();
  if (!migrationsOk) {
    error('\n❌ Database migration failed.\n');
    process.exit(1);
  }

  // Docker setup (optional)
  if (!skipDocker) {
    const hasDocker = await checkDocker();
    if (hasDocker) {
      // Use readline for better input handling
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const response = await new Promise<boolean>((resolve) => {
        rl.question('\n🐳 Set up Docker containers? (y/N): ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (response) {
        await setupDocker();
      } else {
        info('Skipping Docker setup. You can set it up later with:');
        info('  cd docker && docker-compose up -d');
      }
    }
  }

  // Success!
  log('\n' + '='.repeat(50), 'cyan');
  success('\n🎉 Setup complete!\n');
  log('You can now start the server with:', 'cyan');
  log('  bun run dev        # Development mode', 'green');
  log('  bun run build && bun start  # Production mode', 'green');
  log('\nOr if using Docker:', 'cyan');
  log('  cd docker && docker-compose up -d', 'green');
  log('\n');
}

main().catch((err) => {
  error(`\n❌ Setup failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});

