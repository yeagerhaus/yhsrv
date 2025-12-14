import fs from "fs";
import path from "path";
import type { DownloadResult } from "../downloader/types.js";

export interface SyncSummary {
	totalArtists: number;
	checkedArtists: number;
	skippedArtists: number;
	newReleases: number;
	downloadedTracks: number;
	failedTracks: number;
	duration: number; // milliseconds
}

export interface FailureLogEntry {
	timestamp: string;
	artist: string;
	artistId?: number;
	release?: string;
	releaseId?: string;
	error: string;
	type: "artist_check" | "release_download" | "track_download";
}

/**
 * Load failure log from file
 */
export function loadFailureLog(logPath: string): FailureLogEntry[] {
	if (!fs.existsSync(logPath)) {
		return [];
	}

	try {
		const content = fs.readFileSync(logPath, "utf-8");
		return JSON.parse(content) as FailureLogEntry[];
	} catch {
		return [];
	}
}

/**
 * Append failure entry to log
 */
export function writeFailureLog(
	logPath: string,
	entry: Omit<FailureLogEntry, "timestamp">
): void {
	const dir = path.dirname(logPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	const fullEntry: FailureLogEntry = {
		...entry,
		timestamp: new Date().toISOString(),
	};

	const existing = loadFailureLog(logPath);
	existing.push(fullEntry);

	// Keep only last 1000 entries to prevent log from growing too large
	const trimmed = existing.slice(-1000);

	try {
		fs.writeFileSync(logPath, JSON.stringify(trimmed, null, 2), "utf-8");
	} catch (error) {
		console.error(`Error writing failure log: ${error}`);
	}
}

/**
 * Clear failure log
 */
export function clearFailureLog(logPath: string): void {
	if (fs.existsSync(logPath)) {
		fs.unlinkSync(logPath);
	}
}

/**
 * Log sync start
 */
export function logSyncStart(options: {
	musicRootPath: string;
	concurrency: number;
	fullSync: boolean;
}): void {
	console.log();
	console.log("═══════════════════════════════════════════════════════════");
	console.log("  Starting Library Sync");
	console.log("═══════════════════════════════════════════════════════════");
	console.log(`  Music Root: ${options.musicRootPath}`);
	console.log(`  Concurrency: ${options.concurrency}`);
	console.log(`  Mode: ${options.fullSync ? "Full Sync" : "Incremental"}`);
	console.log("═══════════════════════════════════════════════════════════");
	console.log();
}

/**
 * Log artist check result
 */
export function logArtistCheck(
	artist: string,
	artistId: number,
	newReleases: number,
	skipped: boolean = false
): void {
	if (skipped) {
		console.log(`  ⏭  ${artist} (ID: ${artistId}) - Skipped (checked recently)`);
	} else if (newReleases === 0) {
		console.log(`  ✓  ${artist} (ID: ${artistId}) - No new releases`);
	} else {
		console.log(`  →  ${artist} (ID: ${artistId}) - ${newReleases} new release(s)`);
	}
}

/**
 * Log download result for a track
 */
export function logDownloadResult(result: DownloadResult): void {
	if (!result.success && result.error) {
		console.log(`    ✗ ${result.trackTitle}: ${result.error}`);
	}
}

/**
 * Log sync complete with summary
 */
export function logSyncComplete(summary: SyncSummary): void {
	const durationSeconds = (summary.duration / 1000).toFixed(1);
	const durationMinutes = (summary.duration / 60000).toFixed(1);

	console.log();
	console.log("═══════════════════════════════════════════════════════════");
	console.log("  Sync Complete");
	console.log("═══════════════════════════════════════════════════════════");
	console.log(`  Artists Checked: ${summary.checkedArtists}`);
	console.log(`  Artists Skipped: ${summary.skippedArtists}`);
	console.log(`  New Releases: ${summary.newReleases}`);
	console.log(`  Tracks Downloaded: ${summary.downloadedTracks}`);
	if (summary.failedTracks > 0) {
		console.log(`  Tracks Failed: ${summary.failedTracks}`);
	}
	console.log(`  Duration: ${durationSeconds}s (${durationMinutes}min)`);
	console.log("═══════════════════════════════════════════════════════════");
	console.log();
}

/**
 * Log error during artist check
 */
export function logArtistCheckError(artist: string, error: string): void {
	console.log(`  ✗ ${artist} - Error: ${error}`);
}

/**
 * Log progress for batch operations
 */
export function logProgress(current: number, total: number, label: string): void {
	const percent = ((current / total) * 100).toFixed(1);
	console.log(`  [${current}/${total}] ${percent}% - ${label}`);
}

