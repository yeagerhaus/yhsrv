import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import {
	findOrCreateArtistFolder,
	determineReleaseType,
	resolveReleaseFolder,
	isAlreadyDownloaded,
	isVariousArtists,
	getExistingReleases,
	matchReleaseToFolder,
} from "./folder-resolver.js";
import type { DiscographyAlbum } from "./deezer/types.js";

describe("Folder Resolver", () => {
	const testRoot = path.join(os.tmpdir(), `yhdl-test-${Date.now()}`);

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

	test("findOrCreateArtistFolder returns path for new folder", () => {
		const artistPath = findOrCreateArtistFolder(testRoot, "Test Artist");
		// Function returns path but doesn't create it - that's done elsewhere
		expect(artistPath).toContain("Test Artist");
		expect(path.dirname(artistPath)).toBe(testRoot);
	});

	test("findOrCreateArtistFolder finds existing folder case-insensitively", () => {
		const existingPath = path.join(testRoot, "Existing Artist");
		fs.mkdirSync(existingPath, { recursive: true });

		const foundPath = findOrCreateArtistFolder(testRoot, "existing artist");
		expect(foundPath).toBe(existingPath);
	});

	test("determineReleaseType uses record_type when available", () => {
		const album: DiscographyAlbum = {
			id: "1",
			title: "Test Album",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "ep",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		expect(determineReleaseType(album)).toBe("EP");
	});

	test("determineReleaseType falls back to track count", () => {
		const single: DiscographyAlbum = {
			id: "1",
			title: "Single",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 1,
		};

		const ep: DiscographyAlbum = {
			...single,
			title: "EP",
			nb_tracks: 5,
		};

		const album: DiscographyAlbum = {
			...single,
			title: "Album",
			nb_tracks: 12,
		};

		expect(determineReleaseType(single)).toBe("Single");
		expect(determineReleaseType(ep)).toBe("EP");
		expect(determineReleaseType(album)).toBe("Album");
	});

	test("resolveReleaseFolder creates correct folder name with type", () => {
		const artistPath = path.join(testRoot, "Artist");
		const album: DiscographyAlbum = {
			id: "1",
			title: "My Album",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "album",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		const releasePath = resolveReleaseFolder(artistPath, album);
		expect(releasePath).toContain("My Album");
		expect(releasePath).toContain("Album");
	});

	test("isAlreadyDownloaded returns false for non-existent folder", () => {
		const nonExistentPath = path.join(testRoot, "NonExistent", "Release - Album");
		expect(isAlreadyDownloaded(nonExistentPath)).toBe(false);
	});

	test("isAlreadyDownloaded returns true for existing folder", () => {
		const releasePath = path.join(testRoot, "Artist", "Release - Album");
		fs.mkdirSync(releasePath, { recursive: true });
		expect(isAlreadyDownloaded(releasePath)).toBe(true);
	});

	test("isVariousArtists detects Various Artists", () => {
		const album: DiscographyAlbum = {
			id: "1",
			title: "Compilation",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		expect(isVariousArtists(album, "Various Artists")).toBe(true);
		expect(isVariousArtists(album, "various")).toBe(true);
		expect(isVariousArtists(album, "VA")).toBe(true);
		expect(isVariousArtists(album, "Normal Artist")).toBe(false);
	});

	test("isVariousArtists detects compile record type", () => {
		const album: DiscographyAlbum = {
			id: "1",
			title: "Compilation",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "compile",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		expect(isVariousArtists(album, "Any Artist")).toBe(true);
	});

	test("getExistingReleases returns empty array for non-existent artist folder", () => {
		const artistPath = path.join(testRoot, "NonExistent");
		expect(getExistingReleases(artistPath)).toEqual([]);
	});

	test("getExistingReleases returns list of release folders", () => {
		const artistPath = path.join(testRoot, "Artist");
		fs.mkdirSync(artistPath, { recursive: true });
		fs.mkdirSync(path.join(artistPath, "Album 1 - Album"), { recursive: true });
		fs.mkdirSync(path.join(artistPath, "EP 1 - EP"), { recursive: true });
		fs.writeFileSync(path.join(artistPath, "file.txt"), "not a folder");

		const releases = getExistingReleases(artistPath);
		expect(releases).toContain("Album 1 - Album");
		expect(releases).toContain("EP 1 - EP");
		expect(releases).not.toContain("file.txt");
	});

	test("matchReleaseToFolder finds exact match", () => {
		const album: DiscographyAlbum = {
			id: "1",
			title: "My Album",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "album",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		const folders = ["My Album - Album", "Other Album - Album"];
		expect(matchReleaseToFolder(album, folders)).toBe("My Album - Album");
	});

	test("matchReleaseToFolder finds match without type suffix", () => {
		const album: DiscographyAlbum = {
			id: "1",
			title: "My Album",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "album",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		const folders = ["My Album", "Other Album - Album"];
		expect(matchReleaseToFolder(album, folders)).toBe("My Album");
	});

	test("matchReleaseToFolder returns null for no match", () => {
		const album: DiscographyAlbum = {
			id: "1",
			title: "Unknown Album",
			link: "",
			cover: "",
			cover_small: "",
			cover_medium: "",
			cover_big: "",
			cover_xl: "",
			md5_image: "",
			record_type: "album",
			tracklist: "",
			explicit_lyrics: false,
			nb_tracks: 10,
		};

		const folders = ["Other Album - Album"];
		expect(matchReleaseToFolder(album, folders)).toBeNull();
	});
});

