import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { syncLibrary, type SyncOptions, type SyncResult, updateDeezerSyncState } from './yhdl-wrapper.js';

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

  // Convert bitrate format if needed
  let bitrate: number | string | undefined = options.bitrate;
  if (!bitrate) {
    bitrate = 'flac'; // FLAC default
  }

  const syncOptions: SyncOptions = {
    musicRootPath: config.music.rootPath,
    concurrency: config.deezer.syncConcurrency,
    checkIntervalHours: config.deezer.syncCheckInterval,
    fullSync: false,
    dryRun: false,
    ...options,
    bitrate, // Use converted value
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

  // Sync specific artist using yhdl
  const syncOptions: SyncOptions = {
    musicRootPath: config.music.rootPath,
    bitrate: 'flac',
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

// Re-export updateDeezerSyncState from wrapper
export { updateDeezerSyncState };

