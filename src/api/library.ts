import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { scanLibrary } from '../services/library/index.js';
import { db } from '../db/index.js';

export async function libraryRoutes(fastify: FastifyInstance) {
  // POST /api/library/scan - Trigger library scan
  fastify.post('/library/scan', async (request, reply) => {
    try {
      const result = await scanLibrary();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return reply.code(500).send({
        error: 'Library scan failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/library/stats - Get library statistics
  fastify.get('/library/stats', async (request, reply) => {
    const trackCount = await db
      .selectFrom('tracks')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    const artistCount = await db
      .selectFrom('artists')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    const albumCount = await db
      .selectFrom('albums')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    const totalSize = await db
      .selectFrom('tracks')
      .select(db.fn.sum('file_size').as('total'))
      .executeTakeFirst();

    const formatBreakdown = await db
      .selectFrom('tracks')
      .select(['format', db.fn.count('id').as('count')])
      .groupBy('format')
      .execute();

    return {
      tracks: Number(trackCount?.count || 0),
      artists: Number(artistCount?.count || 0),
      albums: Number(albumCount?.count || 0),
      total_size_bytes: Number(totalSize?.total || 0),
      format_breakdown: formatBreakdown.map((f) => ({
        format: f.format,
        count: Number(f.count),
      })),
    };
  });
}

