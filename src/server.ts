import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/index.js';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { registerRoutes } from './api/index.js';

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

