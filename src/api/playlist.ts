import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createPlaylistStream } from '../services/audio/sweet-fades.js';
import { streamFile } from '../services/audio/streamer.js';

interface PlaylistParams {
  id: string;
}

interface PlaylistQuery {
  fade?: boolean;
  duration?: number;
}

interface PlaylistBody {
  track_ids: string[];
  fade?: boolean;
  duration?: number;
}

export async function playlistRoutes(fastify: FastifyInstance) {
  // POST /api/playlist/stream - Create and stream playlist with crossfades
  fastify.post<{ Body: PlaylistBody }>(
    '/playlist/stream',
    async (request, reply) => {
      try {
        const { track_ids, fade = true, duration = 3 } = request.body;

        if (!track_ids || track_ids.length < 2) {
          return reply.code(400).send({
            error: 'Playlist must contain at least 2 tracks',
          });
        }

        if (fade) {
          const playlistPath = await createPlaylistStream(track_ids, duration);
          const rangeHeader = request.headers.range;

          reply.header('Content-Type', 'audio/mpeg');
          reply.header('Cache-Control', 'public, max-age=3600');

          await streamFile(playlistPath, reply, rangeHeader);
        } else {
          // Stream tracks sequentially without crossfades
          // This would require a different implementation
          return reply.code(501).send({
            error: 'Sequential streaming without fades not yet implemented',
          });
        }
      } catch (error) {
        return reply.code(500).send({
          error: 'Playlist streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

