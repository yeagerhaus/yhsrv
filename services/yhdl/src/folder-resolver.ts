import fs from "fs";
import path from "path";
import type { DiscographyAlbum } from "./deezer/types.js";

export type ReleaseType = "Album" | "EP" | "Single";

export interface ResolvedRelease {
	album: DiscographyAlbum;
	artistName: string;
	artistId: number;
	folderPath: string;
	releaseType: ReleaseType;
	exists: boolean;
}

/**
 * Find an existing artist folder (case-insensitive) or return the path for a new one
 */
export function findOrCreateArtistFolder(rootPath: string, artistName: string): string {
	// Ensure root exists
	if (!fs.existsSync(rootPath)) {
		fs.mkdirSync(rootPath, { recursive: true });
	}

	const sanitizedName = sanitizeFolderName(artistName);
	const entries = fs.readdirSync(rootPath, { withFileTypes: true });

	// Look for case-insensitive match
	for (const entry of entries) {
		if (entry.isDirectory() && entry.name.toLowerCase() === sanitizedName.toLowerCase()) {
			return path.join(rootPath, entry.name);
		}
	}

	// No match found, return path for new folder
	return path.join(rootPath, sanitizedName);
}

/**
 * Determine release type using Deezer's record_type with fallback to track count
 */
export function determineReleaseType(album: DiscographyAlbum): ReleaseType {
	// 1. Trust Deezer's record_type if present and valid
	const recordType = album.record_type?.toLowerCase();

	if (recordType === "ep") return "EP";
	if (recordType === "single") return "Single";
	if (recordType === "album") return "Album";

	// 2. Fallback to track count heuristic
	const trackCount = album.nb_tracks || 0;

	if (trackCount <= 2) return "Single";
	if (trackCount <= 6) return "EP";
	return "Album";
}

/**
 * Build the release folder path with type suffix
 * Format: "Album Name - Type"
 */
export function resolveReleaseFolder(artistPath: string, album: DiscographyAlbum): string {
	const releaseType = determineReleaseType(album);
	const sanitizedTitle = sanitizeFolderName(album.title);
	const folderName = `${sanitizedTitle} - ${releaseType}`;
	return path.join(artistPath, folderName);
}

/**
 * Check if a release folder already exists (indicating already downloaded)
 */
export function isAlreadyDownloaded(releasePath: string): boolean {
	return fs.existsSync(releasePath);
}

/**
 * Check if an album is a Various Artists / compilation
 * We check if the artist name matches common compilation artist names
 */
export function isVariousArtists(album: DiscographyAlbum, artistName: string): boolean {
	const compilationNames = [
		"various artists",
		"various",
		"va",
		"compilation",
		"soundtrack",
		"ost",
	];

	const lowerArtist = artistName.toLowerCase().trim();

	// Check artist name
	if (compilationNames.includes(lowerArtist)) {
		return true;
	}

	// Check record type
	if (album.record_type === "compile") {
		return true;
	}

	return false;
}

/**
 * Resolve all releases for an artist, determining which need to be downloaded
 */
export function resolveArtistReleases(
	rootPath: string,
	artistName: string,
	artistId: number,
	discography: DiscographyAlbum[]
): ResolvedRelease[] {
	const resolved: ResolvedRelease[] = [];
	const artistPath = findOrCreateArtistFolder(rootPath, artistName);

	for (const album of discography) {
		// Handle Various Artists albums separately
		let targetArtistPath = artistPath;
		let targetArtistName = artistName;

		if (isVariousArtists(album, artistName)) {
			targetArtistPath = findOrCreateArtistFolder(rootPath, "Various Artists");
			targetArtistName = "Various Artists";
		}

		const folderPath = resolveReleaseFolder(targetArtistPath, album);
		const exists = isAlreadyDownloaded(folderPath);

		resolved.push({
			album,
			artistName: targetArtistName,
			artistId,
			folderPath,
			releaseType: determineReleaseType(album),
			exists,
		});
	}

	return resolved;
}

/**
 * Create all necessary folders for releases that need to be downloaded
 */
export function createReleaseFolders(releases: ResolvedRelease[]): void {
	const foldersToCreate = new Set<string>();

	for (const release of releases) {
		if (!release.exists) {
			// Add both artist folder and release folder
			const artistFolder = path.dirname(release.folderPath);
			foldersToCreate.add(artistFolder);
			foldersToCreate.add(release.folderPath);
		}
	}

	for (const folder of foldersToCreate) {
		if (!fs.existsSync(folder)) {
			fs.mkdirSync(folder, { recursive: true });
		}
	}
}

/**
 * Get all existing release folders for an artist
 */
export function getExistingReleases(artistPath: string): string[] {
	if (!fs.existsSync(artistPath)) {
		return [];
	}

	try {
		const entries = fs.readdirSync(artistPath, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}

/**
 * Match a Deezer album to an existing folder using fuzzy matching
 * Returns the matching folder name or null
 */
export function matchReleaseToFolder(
	album: DiscographyAlbum,
	existingFolders: string[]
): string | null {
	const albumTitle = album.title.toLowerCase().trim();
	const albumTitleNormalized = normalizeForMatching(albumTitle);

	// Try exact match first
	for (const folder of existingFolders) {
		const folderNormalized = normalizeForMatching(folder);
		if (folderNormalized === albumTitleNormalized) {
			return folder;
		}
	}

	// Try matching without release type suffix (e.g., "Album Name - Album" matches "Album Name")
	for (const folder of existingFolders) {
		const folderWithoutType = folder.replace(/\s*-\s*(Album|EP|Single)$/i, "").trim();
		const folderNormalized = normalizeForMatching(folderWithoutType);
		if (folderNormalized === albumTitleNormalized) {
			return folder;
		}
	}

	// Try fuzzy match (contains)
	for (const folder of existingFolders) {
		const folderNormalized = normalizeForMatching(folder);
		if (
			folderNormalized.includes(albumTitleNormalized) ||
			albumTitleNormalized.includes(folderNormalized)
		) {
			return folder;
		}
	}

	return null;
}

/**
 * Normalize string for matching (lowercase, remove special chars, normalize spaces)
 */
function normalizeForMatching(str: string): string {
	return str
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Sanitize a string for use as a folder name
 */
function sanitizeFolderName(name: string): string {
	return name
		.replace(/[<>:"/\\|?*]/g, "_") // Replace invalid chars
		.replace(/\s+/g, " ") // Normalize whitespace
		.replace(/\.+$/g, "") // Remove trailing dots
		.trim()
		.slice(0, 200); // Limit length
}

