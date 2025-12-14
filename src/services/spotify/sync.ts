import { db } from '../../db/index.js';
import { SpotifyClient } from './client.js';
import { randomUUID } from 'crypto';

export interface SyncResult {
  tracksMatched: number;
  tracksUpdated: number;
  artistsUpdated: number;
  albumsUpdated: number;
  errors: Array<{ trackId: string; error: string }>;
}

// Store Spotify tokens (in production, use secure storage)
let spotifyTokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

export function setSpotifyTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}): void {
  spotifyTokens = tokens;
}

export function getSpotifyClient(): SpotifyClient {
  if (!spotifyTokens) {
    throw new Error('Spotify tokens not set. Please authenticate first.');
  }

  return new SpotifyClient(
    spotifyTokens.accessToken,
    spotifyTokens.refreshToken,
    spotifyTokens.expiresAt
  );
}

// Sync track metadata from Spotify
export async function syncTrackMetadata(trackId: string): Promise<void> {
  const track = await db
    .selectFrom('tracks')
    .innerJoin('artists', 'tracks.artist_id', 'artists.id')
    .leftJoin('albums', 'tracks.album_id', 'albums.id')
    .select([
      'tracks.id',
      'tracks.title',
      'artists.name as artist_name',
      'albums.title as album_title',
    ])
    .where('tracks.id', '=', trackId)
    .executeTakeFirst();

  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }

  const client = getSpotifyClient();
  const spotifyTrack = await client.matchTrack(
    track.title,
    track.artist_name || '',
    track.album_title || undefined
  );

  if (!spotifyTrack) {
    throw new Error(`No Spotify match found for track: ${track.title}`);
  }

  // Save Spotify metadata
  const metadataId = randomUUID();
  await db
    .insertInto('spotify_metadata')
    .values({
      id: metadataId,
      track_id: trackId,
      spotify_id: spotifyTrack.id,
      metadata_json: spotifyTrack as unknown as Record<string, unknown>,
      synced_at: new Date(),
      created_at: new Date(),
    })
    .onConflict((oc) => oc
      .column('track_id')
      .doUpdateSet({
        spotify_id: spotifyTrack.id,
        metadata_json: spotifyTrack as unknown as Record<string, unknown>,
        synced_at: new Date(),
      })
    )
    .execute();

  // Update artist with Spotify ID if not set
  const artist = await db
    .selectFrom('artists')
    .select('id')
    .where('name', '=', track.artist_name)
    .executeTakeFirst();

  if (artist && spotifyTrack.artists.length > 0) {
    await db
      .updateTable('artists')
      .set({
        spotify_id: spotifyTrack.artists[0].id,
        updated_at: new Date(),
      })
      .where('id', '=', artist.id)
      .where('spotify_id', 'is', null)
      .execute();
  }

  // Update album with Spotify ID if not set
  if (track.album_title) {
    const album = await db
      .selectFrom('albums')
      .select('id')
      .where('title', '=', track.album_title)
      .executeTakeFirst();

    if (album) {
      await db
        .updateTable('albums')
        .set({
          spotify_id: spotifyTrack.album.id,
          artwork_url: spotifyTrack.album.images[0]?.url || null,
          updated_at: new Date(),
        })
        .where('id', '=', album.id)
        .where('spotify_id', 'is', null)
        .execute();
    }
  }
}

// Sync artist metadata from Spotify
export async function syncArtistMetadata(artistId: string): Promise<void> {
  const artist = await db
    .selectFrom('artists')
    .select(['id', 'name', 'spotify_id'])
    .where('id', '=', artistId)
    .executeTakeFirst();

  if (!artist) {
    throw new Error(`Artist not found: ${artistId}`);
  }

  const client = getSpotifyClient();
  let spotifyArtist;

  if (artist.spotify_id) {
    spotifyArtist = await client.getArtist(artist.spotify_id);
  } else {
    const results = await client.searchArtists(artist.name, 1);
    if (results.length === 0) {
      throw new Error(`No Spotify match found for artist: ${artist.name}`);
    }
    spotifyArtist = results[0];
  }

  // Update artist with Spotify metadata
  await db
    .updateTable('artists')
    .set({
      spotify_id: spotifyArtist.id,
      metadata_json: spotifyArtist as unknown as Record<string, unknown>,
      updated_at: new Date(),
    })
    .where('id', '=', artistId)
    .execute();

  // Update sync state
  await updateSyncState(artistId, 'spotify', 'completed');
}

// Sync all tracks for an artist
export async function syncArtistTracks(artistId: string): Promise<SyncResult> {
  const result: SyncResult = {
    tracksMatched: 0,
    tracksUpdated: 0,
    artistsUpdated: 0,
    albumsUpdated: 0,
    errors: [],
  };

  // Get all tracks for the artist
  const tracks = await db
    .selectFrom('tracks')
    .select('id')
    .where('artist_id', '=', artistId)
    .execute();

  // Sync each track
  for (const track of tracks) {
    try {
      await syncTrackMetadata(track.id);
      result.tracksMatched++;
      result.tracksUpdated++;
    } catch (error) {
      result.errors.push({
        trackId: track.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

// Update sync state
async function updateSyncState(
  artistId: string,
  source: 'spotify' | 'deezer',
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  const existing = await db
    .selectFrom('sync_state')
    .select('id')
    .where('artist_id', '=', artistId)
    .where('source', '=', source)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('sync_state')
      .set({
        last_checked: new Date(),
        last_synced: status === 'completed' ? new Date() : undefined,
        status,
        error_message: errorMessage || null,
        updated_at: new Date(),
      })
      .where('id', '=', existing.id)
      .execute();
  } else {
    const id = randomUUID();
    await db
      .insertInto('sync_state')
      .values({
        id,
        artist_id: artistId,
        source,
        last_checked: new Date(),
        last_synced: status === 'completed' ? new Date() : null,
        status,
        error_message: errorMessage || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }
}

