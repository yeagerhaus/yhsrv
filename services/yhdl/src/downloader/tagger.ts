import NodeID3 from "node-id3";
import fs from "fs";
import type { TrackDownloadInfo } from "./types.js";

export interface TagOptions {
	title?: boolean;
	artist?: boolean;
	album?: boolean;
	trackNumber?: boolean;
	year?: boolean;
	cover?: boolean;
	isrc?: boolean;
}

const DEFAULT_TAG_OPTIONS: TagOptions = {
	title: true,
	artist: true,
	album: true,
	trackNumber: true,
	year: true,
	cover: true,
	isrc: true,
};

export async function tagTrack(
	filePath: string,
	track: TrackDownloadInfo,
	coverPath?: string,
	options: TagOptions = DEFAULT_TAG_OPTIONS
): Promise<void> {
	const extension = filePath.toLowerCase().split(".").pop() || "";

	if (extension === "mp3") {
		await tagMP3(filePath, track, coverPath, options);
	}
	// FLAC tagging would require metaflac-js2 - files are still playable without embedded metadata
}

async function tagMP3(
	filePath: string,
	track: TrackDownloadInfo,
	coverPath?: string,
	options: TagOptions = DEFAULT_TAG_OPTIONS
): Promise<void> {
	const tags: NodeID3.Tags = {};

	if (options.title && track.title) {
		tags.title = track.title;
	}

	if (options.artist && track.artist) {
		tags.artist = track.artist;
	}

	if (options.album && track.album) {
		tags.album = track.album;
	}

	if (options.trackNumber && track.trackNumber) {
		tags.trackNumber = String(track.trackNumber);
	}

	if (options.year && track.releaseDate) {
		const year = track.releaseDate.split("-")[0];
		if (year) tags.year = year;
	}

	if (options.isrc && track.isrc) {
		tags.ISRC = track.isrc;
	}

	if (options.cover && coverPath && fs.existsSync(coverPath)) {
		try {
			const coverBuffer = fs.readFileSync(coverPath);
			tags.image = {
				mime: "image/jpeg",
				type: { id: 3, name: "front cover" },
				description: "Cover",
				imageBuffer: coverBuffer,
			};
		} catch {
			// Ignore cover errors
		}
	}

	const success = NodeID3.write(tags, filePath);
	if (!success) {
		console.log(`  Warning: Failed to write tags to ${filePath}`);
	}
}

export async function downloadCover(url: string, destPath: string): Promise<boolean> {
	try {
		const got = (await import("got")).default;
		const response = await got(url, {
			responseType: "buffer",
			timeout: { request: 10000 },
		});
		fs.writeFileSync(destPath, response.body);
		return true;
	} catch {
		return false;
	}
}

