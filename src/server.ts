import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/index.js';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { registerRoutes } from './api/index.js';
import { initializeYhdlConfig } from './services/sync/yhdl-wrapper.js';
import { scanLibrary } from './services/library/index.js';

const server = Fastify({
  logger: {
    level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

async function start() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized');

    // Initialize yhdl configuration
    initializeYhdlConfig();
    console.log('yhdl configuration initialized');

    // Register CORS
    await server.register(cors, {
      origin: true,
    });

    // Register routes
    await registerRoutes(server);
    console.log('Routes registered');

    // Start server
    const address = await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    console.log(`Server listening on ${address}`);

    // Scan library on startup (non-blocking)
    // Check if we should skip the startup scan (useful for development)
    const skipStartupScan = process.env.SKIP_STARTUP_SCAN === 'true';
    if (!skipStartupScan) {
      console.log('Starting library scan on startup...');
      scanLibrary()
        .then((result) => {
          console.log('Library scan completed:', {
            tracksScanned: result.tracksScanned,
            tracksAdded: result.tracksAdded,
            tracksUpdated: result.tracksUpdated,
            artistsAdded: result.artistsAdded,
            albumsAdded: result.albumsAdded,
            errors: result.errors.length,
          });
          if (result.errors.length > 0) {
            console.warn(`Library scan completed with ${result.errors.length} errors`);
          }
        })
        .catch((error) => {
          console.error('Library scan failed on startup:', error);
          // Don't exit - server should continue running even if scan fails
        });
    } else {
      console.log('Skipping library scan on startup (SKIP_STARTUP_SCAN=true)');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await server.close();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await server.close();
  await closeDatabase();
  process.exit(0);
});

start();

