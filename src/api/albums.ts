import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';

interface AlbumParams {
  id: string;
}

interface AlbumQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export async function albumsRoutes(fastify: FastifyInstance) {
  // GET /api/albums - List all albums
  fastify.get<{ Querystring: AlbumQuery }>('/albums', async (request, reply) => {
    const page = request.query.page || 1;
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom('albums')
      .leftJoin('artists', 'albums.artist_id', 'artists.id')
      .select([
        'albums.id',
        'albums.title',
        'albums.release_date',
        'albums.artwork_url',
        'albums.spotify_id',
        'artists.id as artist_id',
        'artists.name as artist_name',
      ])
      .orderBy('albums.release_date', 'desc')
      .limit(limit)
      .offset(offset);

    if (request.query.search) {
      query = query.where('albums.title', 'ilike', `%${request.query.search}%`);
    }

    const albums = await query.execute();

    // Get track counts for each album
    const albumsWithCounts = await Promise.all(
      albums.map(async (album) => {
        const trackCount = await db
          .selectFrom('tracks')
          .select(db.fn.count('id').as('count'))
          .where('album_id', '=', album.id)
          .executeTakeFirst();

        return {
          ...album,
          track_count: Number(trackCount?.count || 0),
        };
      })
    );

    const total = await db
      .selectFrom('albums')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    return {
      albums: albumsWithCounts,
      pagination: {
        page,
        limit,
        total: Number(total?.count || 0),
        totalPages: Math.ceil(Number(total?.count || 0) / limit),
      },
    };
  });

  // GET /api/albums/:id - Get album with tracks
  fastify.get<{ Params: AlbumParams }>('/albums/:id', async (request, reply) => {
    const album = await db
      .selectFrom('albums')
      .leftJoin('artists', 'albums.artist_id', 'artists.id')
      .select([
        'albums.id',
        'albums.title',
        'albums.release_date',
        'albums.artwork_url',
        'albums.spotify_id',
        'artists.id as artist_id',
        'artists.name as artist_name',
      ])
      .where('albums.id', '=', request.params.id)
      .executeTakeFirst();

    if (!album) {
      return reply.code(404).send({ error: 'Album not found' });
    }

    const tracks = await db
      .selectFrom('tracks')
      .select([
        'tracks.id',
        'tracks.title',
        'tracks.duration',
        'tracks.format',
        'tracks.track_number',
        'tracks.disc_number',
      ])
      .where('album_id', '=', request.params.id)
      .orderBy('tracks.disc_number', 'asc')
      .orderBy('tracks.track_number', 'asc')
      .execute();

    return {
      ...album,
      tracks,
    };
  });
}

