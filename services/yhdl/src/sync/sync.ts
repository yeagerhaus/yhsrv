import { Deezer, TrackFormats, type DiscographyAlbum } from "../deezer/index.js";
import { Downloader, type DownloadResult } from "../downloader/index.js";
import {
	resolveArtistReleases,
	createReleaseFolders,
	findOrCreateArtistFolder,
	getExistingReleases,
	type ResolvedRelease,
} from "../folder-resolver.js";
import { scanLibrary, normalizeArtistName, type LibraryArtist } from "../library/scanner.js";
import {
	loadState,
	saveState,
	updateArtistCheck,
	updateArtistLastRelease,
	shouldSkipArtist,
	updateLastFullSync,
	type SyncState,
} from "./state.js";
import {
	logSyncStart,
	logArtistCheck,
	logSyncComplete,
	logArtistCheckError,
	logProgress,
	writeFailureLog,
	type SyncSummary,
} from "./logger.js";
import type { Config } from "../config.js";

export interface SyncOptions {
	musicRootPath: string;
	bitrate?: number;
	concurrency?: number;
	checkIntervalHours?: number;
	fullSync?: boolean;
	dryRun?: boolean;
	statePath?: string;
	errorLogPath?: string;
	specificArtist?: string; // If provided, only sync this artist
}

export interface SyncResult {
	summary: SyncSummary;
	artistsChecked: number;
	artistsSkipped: number;
	newReleases: number;
	downloadResults: DownloadResult[];
	errors: Array<{ artist: string; error: string }>;
}

export interface NewRelease {
	release: ResolvedRelease;
	artistName: string;
	artistId: number;
}

/**
 * Check a single artist for new releases
 */
async function checkArtistForNewReleases(
	dz: Deezer,
	artistName: string,
	artistId: number,
	musicRootPath: string
): Promise<{ newReleases: ResolvedRelease[]; error?: string }> {
	try {
		// Get discography from Deezer
		const discography = await dz.gw.get_artist_discography_tabs(artistId, { limit: 100 });
		const allReleases: DiscographyAlbum[] = discography.all || [];

		if (allReleases.length === 0) {
			return { newReleases: [] };
		}

		// Resolve releases and check which ones exist
		const resolved = resolveArtistReleases(musicRootPath, artistName, artistId, allReleases);
		const newReleases = resolved.filter((r) => !r.exists);

		return { newReleases };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { newReleases: [], error: errorMessage };
	}
}

/**
 * Download a single release
 */
async function downloadRelease(
	dz: Deezer,
	release: ResolvedRelease,
	bitrate: number,
	dryRun: boolean
): Promise<DownloadResult[]> {
	if (dryRun) {
		// Return mock results for dry run
		return release.album.nb_tracks
			? Array.from({ length: release.album.nb_tracks }, (_, i) => ({
					success: true,
					trackId: 0,
					trackTitle: `Track ${i + 1}`,
					filePath: `${release.folderPath}/track-${i + 1}`,
				}))
			: [];
	}

	// Create folders
	createReleaseFolders([release]);

	// Download
	const downloader = new Downloader(dz, {
		bitrate,
		downloadPath: release.folderPath,
	});

	return downloader.downloadAlbum(release.album.id, release.album.title);
}

/**
 * Process a batch of artists with concurrency control
 */
async function processArtistsBatch<T, R>(
	items: T[],
	concurrency: number,
	processor: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = [];
	const executing: Promise<void>[] = [];

	for (const item of items) {
		const promise = processor(item).then((result) => {
			results.push(result);
		});

		executing.push(promise);

		if (executing.length >= concurrency) {
			await Promise.race(executing);
			executing.splice(
				executing.findIndex((p) => p === promise),
				1
			);
		}
	}

	await Promise.all(executing);
	return results;
}

/**
 * Find artist ID by name using Deezer search
 */
async function findArtistId(dz: Deezer, artistName: string): Promise<number | null> {
	try {
		const searchResults = await dz.api.search_artist(artistName, { limit: 1 });
		if (searchResults.data && searchResults.data.length > 0) {
			return searchResults.data[0].id;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Main sync function - sync entire library
 */
export async function syncLibrary(options: SyncOptions): Promise<SyncResult> {
	const startTime = Date.now();
	const {
		musicRootPath,
		bitrate = TrackFormats.FLAC,
		concurrency = 5,
		checkIntervalHours = 24,
		fullSync = false,
		dryRun = false,
		specificArtist,
	} = options;

	const statePath = options.statePath || ".yhdl/sync-state.json";
	const errorLogPath = options.errorLogPath || ".yhdl/sync-errors.json";

	// Load state
	const state = loadState(statePath);

	// Initialize Deezer
	const dz = new Deezer();

	// Login (ARL should be in .env)
	const { loadArl } = await import("../config.js");
	const arl = loadArl();
	if (!arl) {
		throw new Error("DEEZER_ARL not found in .env file");
	}

	const loggedIn = await dz.loginViaArl(arl);
	if (!loggedIn) {
		throw new Error("Failed to login to Deezer. Check your ARL token.");
	}

	logSyncStart({
		musicRootPath,
		concurrency,
		fullSync,
	});

	// Scan library or use specific artist
	let libraryArtists: LibraryArtist[];
	if (specificArtist) {
		// Single artist mode
		libraryArtists = [
			{
				name: specificArtist,
				path: findOrCreateArtistFolder(musicRootPath, specificArtist),
				source: "folder",
			},
		];
	} else {
		// Scan entire library
		libraryArtists = await scanLibrary(musicRootPath, {
			includeMetadata: true,
			includeFolders: true,
		});
	}

	const totalArtists = libraryArtists.length;
	let checkedArtists = 0;
	let skippedArtists = 0;
	let newReleasesCount = 0;
	const allDownloadResults: DownloadResult[] = [];
	const errors: Array<{ artist: string; error: string }> = [];

	// Process artists in batches
	const artistResults = await processArtistsBatch(
		libraryArtists,
		concurrency,
		async (libraryArtist) => {
			const normalizedName = normalizeArtistName(libraryArtist.name);

			// Find artist ID
			const artistId = await findArtistId(dz, libraryArtist.name);
			if (!artistId) {
				const error = `Artist not found on Deezer: ${libraryArtist.name}`;
				errors.push({ artist: libraryArtist.name, error });
				logArtistCheckError(libraryArtist.name, error);
				writeFailureLog(errorLogPath, {
					artist: libraryArtist.name,
					error,
					type: "artist_check",
				});
				return;
			}

			// Check if should skip
			if (!fullSync && shouldSkipArtist(state, artistId, checkIntervalHours)) {
				skippedArtists++;
				logArtistCheck(libraryArtist.name, artistId, 0, true);
				return;
			}

			// Check for new releases
			const { newReleases, error } = await checkArtistForNewReleases(
				dz,
				libraryArtist.name,
				artistId,
				musicRootPath
			);

			if (error) {
				errors.push({ artist: libraryArtist.name, error });
				logArtistCheckError(libraryArtist.name, error);
				writeFailureLog(errorLogPath, {
					artist: libraryArtist.name,
					artistId,
					error,
					type: "artist_check",
				});
				return;
			}

			checkedArtists++;
			newReleasesCount += newReleases.length;

			logArtistCheck(libraryArtist.name, artistId, newReleases.length, false);

			// Update state
			updateArtistCheck(state, artistId, libraryArtist.name);

			// Download new releases
			for (const release of newReleases) {
				try {
					const results = await downloadRelease(dz, release, bitrate, dryRun);
					allDownloadResults.push(...results);

					// Log failures
					for (const result of results) {
						if (!result.success && result.error) {
							writeFailureLog(errorLogPath, {
								artist: libraryArtist.name,
								artistId,
								release: release.album.title,
								releaseId: release.album.id,
								error: result.error,
								type: "track_download",
							});
						}
					}

					// Update last release date if successful
					if (release.album.release_date) {
						updateArtistLastRelease(state, artistId, release.album.release_date);
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					errors.push({
						artist: libraryArtist.name,
						error: `Failed to download ${release.album.title}: ${errorMessage}`,
					});
					writeFailureLog(errorLogPath, {
						artist: libraryArtist.name,
						artistId,
						release: release.album.title,
						releaseId: release.album.id,
						error: errorMessage,
						type: "release_download",
					});
				}
			}
		}
	);

	// Update last full sync
	if (!specificArtist) {
		updateLastFullSync(state);
	}

	// Save state
	saveState(statePath, state);

	// Calculate summary
	const successfulDownloads = allDownloadResults.filter((r) => r.success).length;
	const failedDownloads = allDownloadResults.filter((r) => !r.success).length;
	const duration = Date.now() - startTime;

	const summary: SyncSummary = {
		totalArtists,
		checkedArtists,
		skippedArtists,
		newReleases: newReleasesCount,
		downloadedTracks: successfulDownloads,
		failedTracks: failedDownloads,
		duration,
	};

	logSyncComplete(summary);

	return {
		summary,
		artistsChecked: checkedArtists,
		artistsSkipped: skippedArtists,
		newReleases: newReleasesCount,
		downloadResults: allDownloadResults,
		errors,
	};
}

/**
 * Check a single artist (convenience function)
 */
export async function checkArtist(
	dz: Deezer,
	artistName: string,
	artistId: number,
	musicRootPath: string
): Promise<ResolvedRelease[]> {
	const { newReleases } = await checkArtistForNewReleases(dz, artistName, artistId, musicRootPath);
	return newReleases;
}

