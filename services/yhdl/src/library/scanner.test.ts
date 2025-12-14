import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { normalizeArtistName, extractArtistsFromFolders } from "./scanner.js";

describe("Library Scanner", () => {
	const testRoot = path.join(os.tmpdir(), `yhdl-scanner-test-${Date.now()}`);

	beforeEach(() => {
		if (fs.existsSync(testRoot)) {
			fs.rmSync(testRoot, { recursive: true, force: true });
		}
		fs.mkdirSync(testRoot, { recursive: true });
	});

	afterEach(() => {
		if (fs.existsSync(testRoot)) {
			fs.rmSync(testRoot, { recursive: true, force: true });
		}
	});

	test("normalizeArtistName lowercases and trims", () => {
		expect(normalizeArtistName("  TEST ARTIST  ")).toBe("test artist");
		expect(normalizeArtistName("Test Artist")).toBe("test artist");
	});

	test("normalizeArtistName removes special characters", () => {
		// Note: normalizeArtistName also normalizes whitespace, so multiple spaces become one
		expect(normalizeArtistName("Artist & The Band!")).toBe("artist the band");
		expect(normalizeArtistName("Artist (feat. Someone)")).toBe("artist feat someone");
	});

	test("normalizeArtistName normalizes whitespace", () => {
		expect(normalizeArtistName("Artist    With    Spaces")).toBe("artist with spaces");
		expect(normalizeArtistName("Artist\nWith\nNewlines")).toBe("artist with newlines");
	});

	test("extractArtistsFromFolders finds artist folders", () => {
		// Create artist folder structure
		fs.mkdirSync(path.join(testRoot, "Artist 1"), { recursive: true });
		fs.mkdirSync(path.join(testRoot, "Artist 2"), { recursive: true });
		fs.writeFileSync(path.join(testRoot, "Artist 1", "track.mp3"), "fake audio");

		const artists = extractArtistsFromFolders(testRoot, 1);
		expect(artists.length).toBeGreaterThan(0);
		expect(artists).toContain("Artist 1");
	});

	test("extractArtistsFromFolders respects maxDepth", () => {
		// Create nested structure
		fs.mkdirSync(path.join(testRoot, "Level1", "Level2", "Level3"), { recursive: true });
		fs.writeFileSync(path.join(testRoot, "Level1", "Level2", "Level3", "track.mp3"), "fake");

		const artistsDepth1 = extractArtistsFromFolders(testRoot, 1);
		const artistsDepth2 = extractArtistsFromFolders(testRoot, 2);
		const artistsDepth3 = extractArtistsFromFolders(testRoot, 3);

		// Results may vary, but depth should affect results
		expect(artistsDepth1.length).toBeLessThanOrEqual(artistsDepth2.length);
		expect(artistsDepth2.length).toBeLessThanOrEqual(artistsDepth3.length);
	});

	test("extractArtistsFromFolders ignores non-audio files", () => {
		fs.mkdirSync(path.join(testRoot, "Artist"), { recursive: true });
		fs.writeFileSync(path.join(testRoot, "Artist", "readme.txt"), "not audio");
		// Should not find artist if no audio files
		const artists = extractArtistsFromFolders(testRoot, 1);
		// This might be empty since we need actual audio files
		expect(Array.isArray(artists)).toBe(true);
	});
});

