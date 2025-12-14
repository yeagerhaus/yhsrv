import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { analyzeTrack, getTrackAnalysis } from '../services/audio/sonic-analysis.js';

interface TrackParams {
  id: string;
}

interface TrackQuery {
  page?: number;
  limit?: number;
  artist?: string;
  album?: string;
  format?: string;
}

export async function tracksRoutes(fastify: FastifyInstance) {
  // GET /api/tracks - List all tracks
  fastify.get<{ Querystring: TrackQuery }>('/tracks', async (request, reply) => {
    const page = request.query.page || 1;
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom('tracks')
      .leftJoin('artists', 'tracks.artist_id', 'artists.id')
      .leftJoin('albums', 'tracks.album_id', 'albums.id')
      .select([
        'tracks.id',
        'tracks.title',
        'tracks.format',
        'tracks.duration',
        'tracks.file_size',
        'tracks.track_number',
        'tracks.disc_number',
        'artists.id as artist_id',
        'artists.name as artist_name',
        'albums.id as album_id',
        'albums.title as album_title',
        'albums.artwork_url',
      ])
      .orderBy('tracks.title', 'asc')
      .limit(limit)
      .offset(offset);

    if (request.query.artist) {
      query = query.where('artists.name', 'ilike', `%${request.query.artist}%`);
    }

    if (request.query.album) {
      query = query.where('albums.title', 'ilike', `%${request.query.album}%`);
    }

    if (request.query.format) {
      query = query.where('tracks.format', '=', request.query.format);
    }

    const tracks = await query.execute();

    const total = await db
      .selectFrom('tracks')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    return {
      tracks,
      pagination: {
        page,
        limit,
        total: Number(total?.count || 0),
        totalPages: Math.ceil(Number(total?.count || 0) / limit),
      },
    };
  });

  // GET /api/tracks/:id - Get track details
  fastify.get<{ Params: TrackParams }>('/tracks/:id', async (request, reply) => {
    const track = await db
      .selectFrom('tracks')
      .leftJoin('artists', 'tracks.artist_id', 'artists.id')
      .leftJoin('albums', 'tracks.album_id', 'albums.id')
      .select([
        'tracks.id',
        'tracks.title',
        'tracks.path',
        'tracks.format',
        'tracks.duration',
        'tracks.file_size',
        'tracks.track_number',
        'tracks.disc_number',
        'tracks.created_at',
        'artists.id as artist_id',
        'artists.name as artist_name',
        'artists.spotify_id as artist_spotify_id',
        'albums.id as album_id',
        'albums.title as album_title',
        'albums.artwork_url',
        'albums.release_date',
        'albums.spotify_id as album_spotify_id',
      ])
      .where('tracks.id', '=', request.params.id)
      .executeTakeFirst();

    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    return track;
  });

  // GET /api/tracks/:id/analysis - Get sonic analysis
  fastify.get<{ Params: TrackParams }>('/tracks/:id/analysis', async (request, reply) => {
    const analysis = await getTrackAnalysis(request.params.id);

    if (!analysis) {
      // Try to analyze if not exists
      try {
        const newAnalysis = await analyzeTrack(request.params.id);
        return newAnalysis;
      } catch (error) {
        return reply.code(404).send({
          error: 'Analysis not found and could not be generated',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return analysis;
  });
}

