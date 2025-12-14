import fs from "fs";
import path from "path";
import NodeID3 from "node-id3";
import type { LibraryArtist, ScanOptions } from "./types.js";

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav", ".wma"]);

/**
 * Normalize artist name for matching (lowercase, trim, remove special chars)
 */
export function normalizeArtistName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s]/g, "")
		.replace(/\s+/g, " ");
}

/**
 * Check if a file is an audio file based on extension
 */
function isAudioFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return AUDIO_EXTENSIONS.has(ext);
}

/**
 * Extract artist names from audio file metadata
 */
export async function extractArtistsFromMetadata(filePath: string): Promise<string[]> {
	try {
		const tags = NodeID3.read(filePath);
		const artists: string[] = [];

		// Primary artist
		if (tags.artist) {
			artists.push(tags.artist);
		}

		// Album artist (often more accurate for compilations)
		if (tags.albumArtist) {
			artists.push(tags.albumArtist);
		}

		// Performer tags (ID3v2.3/2.4)
		if (tags.performerInfo) {
			for (const performer of tags.performerInfo) {
				if (performer.performer && !artists.includes(performer.performer)) {
					artists.push(performer.performer);
				}
			}
		}

		// Remove duplicates and empty strings
		return artists.filter((a) => a && a.trim().length > 0);
	} catch {
		return [];
	}
}

/**
 * Extract artist names from folder structure
 * Assumes structure: root/Artist/Album/...
 */
export function extractArtistsFromFolders(rootPath: string, maxDepth: number = 3): string[] {
	const artists: string[] = [];
	const visited = new Set<string>();

	if (!fs.existsSync(rootPath)) {
		return artists;
	}

	function walkDir(dir: string, depth: number): void {
		if (depth > maxDepth) return;

		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });

			// Check if this directory contains audio files
			const hasAudioFiles = entries.some((entry) => entry.isFile() && isAudioFile(entry.name));

			// If we're at depth 1 and there are audio files, assume this is an artist folder
			if (depth === 1 && hasAudioFiles) {
				const artistName = path.basename(dir);
				const normalized = normalizeArtistName(artistName);
				if (normalized && !visited.has(normalized)) {
					artists.push(artistName);
					visited.add(normalized);
				}
			}

			// Recurse into subdirectories
			for (const entry of entries) {
				if (entry.isDirectory()) {
					walkDir(path.join(dir, entry.name), depth + 1);
				}
			}
		} catch {
			// Ignore permission errors, etc.
		}
	}

	walkDir(rootPath, 0);
	return artists;
}

/**
 * Count audio files in a directory (recursively)
 */
function countAudioFiles(dir: string): number {
	let count = 0;
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isFile() && isAudioFile(fullPath)) {
				count++;
			} else if (entry.isDirectory()) {
				count += countAudioFiles(fullPath);
			}
		}
	} catch {
		// Ignore errors
	}
	return count;
}

/**
 * Scan entire music library to discover all artists
 * Combines metadata and folder-based discovery
 */
export async function scanLibrary(
	rootPath: string,
	options: ScanOptions = {}
): Promise<LibraryArtist[]> {
	const {
		includeMetadata = true,
		includeFolders = true,
		maxDepth = 3,
	} = options;

	const artistMap = new Map<string, LibraryArtist>();

	// Method 1: Extract from folder structure
	if (includeFolders) {
		const folderArtists = extractArtistsFromFolders(rootPath, maxDepth);
		for (const artistName of folderArtists) {
			const normalized = normalizeArtistName(artistName);
			const artistPath = path.join(rootPath, artistName);

			if (!artistMap.has(normalized)) {
				artistMap.set(normalized, {
					name: artistName,
					path: artistPath,
					source: "folder",
				});
			}
		}
	}

	// Method 2: Extract from metadata (more accurate but slower)
	if (includeMetadata) {
		const metadataArtists = await extractArtistsFromMetadataRecursive(rootPath, maxDepth);
		for (const { artistName, filePath } of metadataArtists) {
			const normalized = normalizeArtistName(artistName);
			const existing = artistMap.get(normalized);

			if (!existing) {
				// New artist from metadata
				artistMap.set(normalized, {
					name: artistName,
					path: path.dirname(filePath),
					source: "metadata",
				});
			} else if (existing.source === "folder") {
				// Prefer metadata over folder (more accurate)
				existing.source = "metadata";
				existing.path = path.dirname(filePath);
			}
		}
	}

	// Count files for each artist
	const results: LibraryArtist[] = [];
	for (const artist of artistMap.values()) {
		const fileCount = countAudioFiles(artist.path);
		results.push({
			...artist,
			fileCount: fileCount > 0 ? fileCount : undefined,
		});
	}

	// Sort by name
	return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively scan directory for audio files and extract artist metadata
 */
async function extractArtistsFromMetadataRecursive(
	dir: string,
	maxDepth: number,
	currentDepth = 0
): Promise<Array<{ artistName: string; filePath: string }>> {
	const results: Array<{ artistName: string; filePath: string }> = [];

	if (currentDepth > maxDepth) {
		return results;
	}

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isFile() && isAudioFile(fullPath)) {
				const artists = await extractArtistsFromMetadata(fullPath);
				for (const artist of artists) {
					results.push({ artistName: artist, filePath: fullPath });
				}
			} else if (entry.isDirectory()) {
				const subResults = await extractArtistsFromMetadataRecursive(
					fullPath,
					maxDepth,
					currentDepth + 1
				);
				results.push(...subResults);
			}
		}
	} catch {
		// Ignore errors
	}

	return results;
}

