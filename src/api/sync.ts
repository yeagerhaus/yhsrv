import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { syncDeezerLibrary, syncDeezerArtist } from '../services/sync/index.js';

interface SyncParams {
  id: string;
}

export async function syncRoutes(fastify: FastifyInstance) {
  // POST /api/sync/deezer - Trigger Deezer library sync
  fastify.post('/sync/deezer', async (request, reply) => {
    try {
      const result = await syncDeezerLibrary();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return reply.code(500).send({
        error: 'Deezer sync failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/sync/deezer/artist/:id - Sync specific artist from Deezer
  fastify.post<{ Params: SyncParams }>(
    '/sync/deezer/artist/:id',
    async (request, reply) => {
      try {
        const result = await syncDeezerArtist(request.params.id);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        return reply.code(500).send({
          error: 'Deezer sync failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/sync/status - Get sync status
  fastify.get('/sync/status', async (request, reply) => {
    // TODO: Implement sync status endpoint
    return {
      deezer: {
        last_sync: null,
        status: 'not_configured',
      },
      spotify: {
        last_sync: null,
        status: 'not_configured',
      },
    };
  });
}

