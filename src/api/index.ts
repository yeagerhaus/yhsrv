import { FastifyInstance } from 'fastify';
import { tracksRoutes } from './tracks.js';
import { artistsRoutes } from './artists.js';
import { albumsRoutes } from './albums.js';
import { streamRoutes } from './stream.js';
import { libraryRoutes } from './library.js';
import { spotifyRoutes } from './spotify.js';
import { syncRoutes } from './sync.js';
import { playlistRoutes } from './playlist.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register all route modules
  await fastify.register(tracksRoutes, { prefix: '/api' });
  await fastify.register(artistsRoutes, { prefix: '/api' });
  await fastify.register(albumsRoutes, { prefix: '/api' });
  await fastify.register(streamRoutes, { prefix: '/api' });
  await fastify.register(libraryRoutes, { prefix: '/api' });
  await fastify.register(spotifyRoutes, { prefix: '/api' });
  await fastify.register(syncRoutes, { prefix: '/api' });
  await fastify.register(playlistRoutes, { prefix: '/api' });
}

