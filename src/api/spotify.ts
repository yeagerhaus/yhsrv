import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  generateOAuthState,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  setSpotifyTokens,
  syncTrackMetadata,
  syncArtistMetadata,
  syncArtistTracks,
} from '../services/spotify/index.js';

interface SpotifyParams {
  id: string;
}

interface SpotifyCallbackQuery {
  code: string;
  state: string;
}

// Store OAuth states (in production, use Redis or database)
const oauthStates = new Map<string, { createdAt: number }>();

export async function spotifyRoutes(fastify: FastifyInstance) {
  // GET /api/auth/spotify - Initiate OAuth flow
  fastify.get('/auth/spotify', async (request, reply) => {
    const state = generateOAuthState();
    oauthStates.set(state, { createdAt: Date.now() });

    const authUrl = getAuthorizationUrl(state);
    return { auth_url: authUrl, state };
  });

  // GET /api/auth/spotify/callback - Handle OAuth callback
  fastify.get<{ Querystring: SpotifyCallbackQuery }>(
    '/auth/spotify/callback',
    async (request, reply) => {
      const { code, state } = request.query;

      // Verify state
      const storedState = oauthStates.get(state);
      if (!storedState) {
        return reply.code(400).send({ error: 'Invalid state parameter' });
      }

      // Clean up old states (older than 10 minutes)
      const now = Date.now();
      for (const [s, data] of oauthStates.entries()) {
        if (now - data.createdAt > 600000) {
          oauthStates.delete(s);
        }
      }

      try {
        const tokens = await exchangeCodeForTokens(code);
        setSpotifyTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_at,
        });

        oauthStates.delete(state);

        return {
          success: true,
          message: 'Spotify authentication successful',
        };
      } catch (error) {
        return reply.code(500).send({
          error: 'Authentication failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POST /api/spotify/sync/track/:id - Sync track metadata
  fastify.post<{ Params: { id: string } }>(
    '/spotify/sync/track/:id',
    async (request, reply) => {
      try {
        await syncTrackMetadata(request.params.id);
        return { success: true, message: 'Track metadata synced' };
      } catch (error) {
        return reply.code(500).send({
          error: 'Sync failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POST /api/spotify/sync/artist/:id - Sync artist metadata
  fastify.post<{ Params: SpotifyParams }>(
    '/spotify/sync/artist/:id',
    async (request, reply) => {
      try {
        await syncArtistMetadata(request.params.id);
        return { success: true, message: 'Artist metadata synced' };
      } catch (error) {
        return reply.code(500).send({
          error: 'Sync failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POST /api/spotify/sync/artist/:id/tracks - Sync all tracks for artist
  fastify.post<{ Params: SpotifyParams }>(
    '/spotify/sync/artist/:id/tracks',
    async (request, reply) => {
      try {
        const result = await syncArtistTracks(request.params.id);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        return reply.code(500).send({
          error: 'Sync failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

