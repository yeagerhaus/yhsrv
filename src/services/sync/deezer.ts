import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { randomUUID } from 'crypto';
import { syncLibrary, type SyncOptions, type SyncResult } from '../../../../services/yhdl/src/index.js';

export interface DeezerSyncResult {
  artistsChecked: number;
  newReleases: number;
  downloadedTracks: number;
  failedTracks: number;
  errors: Array<{ artist: string; error: string }>;
}

// Convert yhdl SyncResult to DeezerSyncResult
function convertSyncResult(result: SyncResult): DeezerSyncResult {
  return {
    artistsChecked: result.artistsChecked || result.summary.checkedArtists || 0,
    newReleases: result.newReleases || result.summary.newReleases || 0,
    downloadedTracks: result.summary.downloadedTracks || 0,
    failedTracks: result.summary.failedTracks || 0,
    errors: result.errors || [],
  };
}

// Sync entire library using yhdl
export async function syncDeezerLibrary(options: Partial<SyncOptions> = {}): Promise<DeezerSyncResult> {
  if (!config.deezer.arl) {
    throw new Error('DEEZER_ARL not configured');
  }

  // Import TrackFormats to get the correct numeric values
  const { TrackFormats } = await import('../../../../services/yhdl/src/deezer/types.js');
  
  // Convert bitrate format if needed - yhdl uses numeric TrackFormats
  let bitrate: number | undefined = options.bitrate as number | undefined;
  if (!bitrate) {
    bitrate = TrackFormats.FLAC; // FLAC default
  } else if (typeof bitrate === 'string') {
    // Convert string format to TrackFormats constant
    bitrate = bitrate === 'flac' ? TrackFormats.FLAC : 
               bitrate === 'mp3' ? TrackFormats.MP3_320 : 
               TrackFormats.MP3_128;
  }

  const syncOptions: SyncOptions = {
    musicRootPath: config.music.rootPath,
    bitrate,
    concurrency: config.deezer.syncConcurrency,
    checkIntervalHours: config.deezer.syncCheckInterval,
    fullSync: false,
    dryRun: false,
    ...options,
    bitrate, // Override with converted value
  };

  const result = await syncLibrary(syncOptions);
  return convertSyncResult(result);
}

// Sync specific artist from Deezer
export async function syncDeezerArtist(artistId: string): Promise<DeezerSyncResult> {
  if (!config.deezer.arl) {
    throw new Error('DEEZER_ARL not configured');
  }

  const artist = await db
    .selectFrom('artists')
    .select(['id', 'name', 'deezer_id'])
    .where('id', '=', artistId)
    .executeTakeFirst();

  if (!artist) {
    throw new Error(`Artist not found: ${artistId}`);
  }

  // Import TrackFormats for FLAC constant
  const { TrackFormats } = await import('../../../../services/yhdl/src/deezer/types.js');
  
  // Sync specific artist using yhdl
  const syncOptions: SyncOptions = {
    musicRootPath: config.music.rootPath,
    bitrate: TrackFormats.FLAC,
    concurrency: 1,
    checkIntervalHours: 0, // Force check
    fullSync: true,
    dryRun: false,
    specificArtist: artist.name,
  };

  try {
    const result = await syncLibrary(syncOptions);
    return convertSyncResult(result);
  } catch (error) {
    // If yhdl is not yet integrated, return placeholder
    if (error instanceof Error && error.message.includes('not yet integrated')) {
      return {
        artistsChecked: 1,
        newReleases: 0,
        downloadedTracks: 0,
        failedTracks: 0,
        errors: [{ artist: artist.name, error: 'yhdl code not yet integrated' }],
      };
    }
    throw error;
  }
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

