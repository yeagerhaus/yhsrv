import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { randomUUID } from 'crypto';

export interface DeezerSyncResult {
  artistsChecked: number;
  newReleases: number;
  downloadedTracks: number;
  failedTracks: number;
  errors: Array<{ artist: string; error: string }>;
}

// Placeholder for yhdl integration
// This will be implemented once yhdl code is integrated
export async function syncDeezerLibrary(): Promise<DeezerSyncResult> {
  // TODO: Integrate yhdl sync functionality
  // This should:
  // 1. Scan library to discover artists
  // 2. Check Deezer for new releases
  // 3. Download missing releases
  // 4. Update sync state in database

  if (!config.deezer.arl) {
    throw new Error('DEEZER_ARL not configured');
  }

  // Placeholder implementation
  return {
    artistsChecked: 0,
    newReleases: 0,
    downloadedTracks: 0,
    failedTracks: 0,
    errors: [],
  };
}

// Sync specific artist from Deezer
export async function syncDeezerArtist(artistId: string): Promise<DeezerSyncResult> {
  // TODO: Integrate yhdl artist sync
  const artist = await db
    .selectFrom('artists')
    .select(['id', 'name', 'deezer_id'])
    .where('id', '=', artistId)
    .executeTakeFirst();

  if (!artist) {
    throw new Error(`Artist not found: ${artistId}`);
  }

  // Placeholder implementation
  return {
    artistsChecked: 1,
    newReleases: 0,
    downloadedTracks: 0,
    failedTracks: 0,
    errors: [],
  };
}

// Update sync state for Deezer
export async function updateDeezerSyncState(
  artistId: string,
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  const existing = await db
    .selectFrom('sync_state')
    .select('id')
    .where('artist_id', '=', artistId)
    .where('source', '=', 'deezer')
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
        source: 'deezer',
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

