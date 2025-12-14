import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { streamTrack } from '../services/audio/streamer.js';

interface StreamParams {
  id: string;
}

interface StreamQuery {
  format?: string;
  bitrate?: number;
}

export async function streamRoutes(fastify: FastifyInstance) {
  // GET /api/stream/:id - Stream track
  fastify.get<{ Params: StreamParams; Querystring: StreamQuery }>(
    '/stream/:id',
    async (request, reply) => {
      try {
        const format = request.query.format;
        const bitrate = request.query.bitrate ? parseInt(request.query.bitrate.toString(), 10) : undefined;
        const rangeHeader = request.headers.range;

        await streamTrack(
          request.params.id,
          reply,
          format,
          bitrate,
          rangeHeader
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
        }
        return reply.code(500).send({
          error: 'Streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

