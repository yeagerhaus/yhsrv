import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';

interface ArtistParams {
  id: string;
}

interface ArtistQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export async function artistsRoutes(fastify: FastifyInstance) {
  // GET /api/artists - List all artists
  fastify.get<{ Querystring: ArtistQuery }>('/artists', async (request, reply) => {
    const page = request.query.page || 1;
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom('artists')
      .select([
        'artists.id',
        'artists.name',
        'artists.spotify_id',
        'artists.deezer_id',
      ])
      .orderBy('artists.name', 'asc')
      .limit(limit)
      .offset(offset);

    if (request.query.search) {
      query = query.where('artists.name', 'ilike', `%${request.query.search}%`);
    }

    const artists = await query.execute();

    // Get album and track counts for each artist
    const artistsWithCounts = await Promise.all(
      artists.map(async (artist) => {
        const albumCount = await db
          .selectFrom('albums')
          .select(db.fn.count('id').as('count'))
          .where('artist_id', '=', artist.id)
          .executeTakeFirst();

        const trackCount = await db
          .selectFrom('tracks')
          .select(db.fn.count('id').as('count'))
          .where('artist_id', '=', artist.id)
          .executeTakeFirst();

        return {
          ...artist,
          album_count: Number(albumCount?.count || 0),
          track_count: Number(trackCount?.count || 0),
        };
      })
    );

    const total = await db
      .selectFrom('artists')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    return {
      artists: artistsWithCounts,
      pagination: {
        page,
        limit,
        total: Number(total?.count || 0),
        totalPages: Math.ceil(Number(total?.count || 0) / limit),
      },
    };
  });

  // GET /api/artists/:id - Get artist with albums
  fastify.get<{ Params: ArtistParams }>('/artists/:id', async (request, reply) => {
    const artist = await db
      .selectFrom('artists')
      .selectAll()
      .where('id', '=', request.params.id)
      .executeTakeFirst();

    if (!artist) {
      return reply.code(404).send({ error: 'Artist not found' });
    }

    const albums = await db
      .selectFrom('albums')
      .select([
        'albums.id',
        'albums.title',
        'albums.release_date',
        'albums.artwork_url',
        'albums.spotify_id',
      ])
      .where('artist_id', '=', request.params.id)
      .orderBy('albums.release_date', 'desc')
      .execute();

    const tracks = await db
      .selectFrom('tracks')
      .select([
        'tracks.id',
        'tracks.title',
        'tracks.duration',
        'tracks.format',
      ])
      .where('artist_id', '=', request.params.id)
      .orderBy('tracks.title', 'asc')
      .execute();

    return {
      ...artist,
      albums,
      tracks,
    };
  });
}

