/**
 * Wrapper service for yhdl CLI
 * 
 * Since yhdl is currently a CLI tool, we call it as a subprocess.
 * Once yhdl is enhanced as a library, we can switch to direct imports.
 */

import { spawn } from 'child_process';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { randomUUID } from 'crypto';

export interface SyncOptions {
  musicRootPath: string;
  bitrate?: number | string;
  concurrency?: number;
  checkIntervalHours?: number;
  fullSync?: boolean;
  dryRun?: boolean;
  specificArtist?: string;
}

export interface SyncResult {
  artistsChecked?: number;
  newReleases?: number;
  summary: {
    checkedArtists: number;
    newReleases: number;
    downloadedTracks: number;
    failedTracks: number;
  };
  errors: Array<{ artist: string; error: string }>;
}

/**
 * Initialize yhdl configuration from yhsrv config
 * Currently a no-op, but will be used when yhdl is a library
 */
export function initializeYhdlConfig(): void {
  // TODO: When yhdl is a library, call setConfig here
  console.log('yhdl config initialized (subprocess mode)');
}

/**
 * Run yhdl sync command as a subprocess
 */
async function runYhdlSync(options: SyncOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['sync'];
    
    if (options.specificArtist) {
      args.push('--artist', options.specificArtist);
    }
    
    if (options.fullSync) {
      args.push('--full');
    }
    
    if (options.dryRun) {
      args.push('--dry-run');
    }
    
    if (options.concurrency) {
      args.push('--concurrency', String(options.concurrency));
    }
    
    if (options.checkIntervalHours) {
      args.push('--since', String(options.checkIntervalHours));
    }
    
    if (options.bitrate) {
      const bitrateStr = typeof options.bitrate === 'string' 
        ? options.bitrate 
        : options.bitrate === 9 ? 'flac' : options.bitrate === 3 ? '320' : '128';
      args.push('--bitrate', bitrateStr);
    }

    // Set environment variables for yhdl
    const env = {
      ...process.env,
      DEEZER_ARL: config.deezer.arl || '',
      MUSIC_ROOT_PATH: options.musicRootPath,
    };

    // Try to find yhdl - could be installed globally, in node_modules, or as a separate tool
    const yhdlPath = process.env.YHDL_PATH || 'yhdl';
    
    const proc = spawn('bun', [yhdlPath, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`yhdl sync failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to start yhdl: ${error.message}`));
    });
  });
}

/**
 * Sync entire library using yhdl
 */
export async function syncLibrary(options: SyncOptions): Promise<SyncResult> {
  try {
    // Run yhdl sync
    const output = await runYhdlSync(options);
    
    // Parse output (yhdl might output JSON or we might need to parse text)
    // For now, return a basic result structure
    // TODO: Parse actual yhdl output to get real stats
    return {
      artistsChecked: 0,
      newReleases: 0,
      summary: {
        checkedArtists: 0,
        newReleases: 0,
        downloadedTracks: 0,
        failedTracks: 0,
      },
      errors: [],
    };
  } catch (error) {
    throw new Error(`yhdl sync failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update sync state in our database
 */
export async function updateDeezerSyncState(
  artistId: string,
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  const existing = await db
    .selectFrom('sync_state')
    .select('id')
    .where('artist_id', '=', artistId)
    .where('source', '=', 'deezer')
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('sync_state')
      .set({
        last_checked: new Date(),
        last_synced: status === 'completed' ? new Date() : undefined,
        status,
        error_message: errorMessage || null,
        updated_at: new Date(),
      })
      .where('id', '=', existing.id)
      .execute();
  } else {
    const id = randomUUID();
    await db
      .insertInto('sync_state')
      .values({
        id,
        artist_id: artistId,
        source: 'deezer',
        last_checked: new Date(),
        last_synced: status === 'completed' ? new Date() : null,
        status,
        error_message: errorMessage || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }
}
