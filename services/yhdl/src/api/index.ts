// Library operations
export { scanLibrary, extractArtistsFromMetadata, extractArtistsFromFolders, normalizeArtistName } from "../library/scanner.js";
export type { LibraryArtist, ScanOptions } from "../library/types.js";

// Sync operations
export { syncLibrary, checkArtist } from "../sync/sync.js";
export type { SyncOptions, SyncResult } from "../sync/sync.js";

// State management
export { loadState, saveState, updateArtistCheck, getLastCheck, shouldSkipArtist } from "../sync/state.js";
export type { SyncState, ArtistState } from "../sync/types.js";

// Logging
export { loadFailureLog, writeFailureLog, clearFailureLog } from "../sync/logger.js";
export type { SyncSummary, FailureLogEntry } from "../sync/logger.js";

// Download operations
export { Downloader } from "../downloader/downloader.js";
export type { DownloadResult, DownloaderOptions } from "../downloader/types.js";

// Config
export { loadConfig, loadArl, saveArl, clearArl, getEnvPathForDisplay } from "../config.js";
export type { Config } from "../config.js";

// Folder operations
export {
	resolveArtistReleases,
	findOrCreateArtistFolder,
	getExistingReleases,
	matchReleaseToFolder,
	createReleaseFolders,
} from "../folder-resolver.js";
export type { ResolvedRelease, ReleaseType } from "../folder-resolver.js";

// Deezer client
export { Deezer, TrackFormats } from "../deezer/index.js";
export type { DiscographyAlbum, APIArtist, User } from "../deezer/types.js";

