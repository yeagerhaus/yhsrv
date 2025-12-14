import fs from "fs";
import path from "path";
import { type Deezer, TrackFormats, type GWTrack } from "../deezer/index.js";
import { streamTrack, type ProgressCallback } from "./decryption.js";
import { tagTrack, downloadCover } from "./tagger.js";
import { gwTrackToDownloadInfo, type DownloadResult, type TrackDownloadInfo } from "./types.js";
import { generateCryptedStreamURL } from "./crypto.js";

const FORMAT_NAMES: Record<number, string> = {
	[TrackFormats.FLAC]: "FLAC",
	[TrackFormats.MP3_320]: "MP3_320",
	[TrackFormats.MP3_128]: "MP3_128",
};

const FORMAT_CODES: Record<number, string> = {
	[TrackFormats.FLAC]: "9",
	[TrackFormats.MP3_320]: "3",
	[TrackFormats.MP3_128]: "1",
};

const FORMAT_EXTENSIONS: Record<number, string> = {
	[TrackFormats.FLAC]: ".flac",
	[TrackFormats.MP3_320]: ".mp3",
	[TrackFormats.MP3_128]: ".mp3",
};

export interface DownloaderOptions {
	bitrate: number;
	downloadPath: string;
	onProgress?: ProgressCallback;
	onTrackStart?: (track: TrackDownloadInfo, index: number, total: number) => void;
	onTrackComplete?: (result: DownloadResult, index: number, total: number) => void;
}

export class Downloader {
	private dz: Deezer;
	private options: DownloaderOptions;

	constructor(dz: Deezer, options: DownloaderOptions) {
		this.dz = dz;
		this.options = options;
	}

	async downloadAlbum(albumId: string, albumTitle: string): Promise<DownloadResult[]> {
		const results: DownloadResult[] = [];

		// Get album tracks
		const tracks = await this.dz.gw.get_album_tracks(albumId);
		const totalTracks = tracks.length;

		for (let i = 0; i < tracks.length; i++) {
			const gwTrack = tracks[i];
			const trackInfo = gwTrackToDownloadInfo(gwTrack, albumTitle);

			if (this.options.onTrackStart) {
				this.options.onTrackStart(trackInfo, i + 1, totalTracks);
			}

			const result = await this.downloadTrack(gwTrack, albumTitle);
			results.push(result);

			if (this.options.onTrackComplete) {
				this.options.onTrackComplete(result, i + 1, totalTracks);
			}

			// Small delay between tracks to avoid rate limiting
			if (i < tracks.length - 1) {
				await new Promise((r) => setTimeout(r, 100));
			}
		}

		return results;
	}

	async downloadTrack(gwTrack: GWTrack, albumTitle?: string): Promise<DownloadResult> {
		const trackInfo = gwTrackToDownloadInfo(gwTrack, albumTitle);

		try {
			// Get track with full info
			const fullTrack = await this.dz.gw.get_track_with_fallback(gwTrack.SNG_ID);

			let downloadURL: string | null = null;
			let actualBitrate = this.options.bitrate;

			// Try preferred bitrate, fallback if needed
			const bitratesToTry = [this.options.bitrate, TrackFormats.MP3_320, TrackFormats.MP3_128];

			// Method 1: Try the new media API
			for (const bitrate of bitratesToTry) {
				try {
					const format = FORMAT_NAMES[bitrate];
					downloadURL = await this.dz.get_track_url(fullTrack.TRACK_TOKEN, format);
					if (downloadURL) {
						actualBitrate = bitrate;
						break;
					}
				} catch {
					continue;
				}
			}

			// Method 2: Fallback to legacy crypted URL using MD5_ORIGIN
			// MD5_ORIGIN should be a 32-char hex string, not 0 or empty
			const md5 = String(fullTrack.MD5_ORIGIN || "");
			
			if (!downloadURL && md5 && md5.length >= 32 && md5 !== "0") {
				const mediaVersion = String(fullTrack.MEDIA_VERSION || 1);
				const sngId = String(fullTrack.SNG_ID);

				for (const bitrate of bitratesToTry) {
					const formatCode = FORMAT_CODES[bitrate];
					// Check if the track has a filesize for this format (indicates availability)
					const filesizeKey = bitrate === TrackFormats.FLAC ? "FILESIZE_FLAC" :
						bitrate === TrackFormats.MP3_320 ? "FILESIZE_MP3_320" : "FILESIZE_MP3_128";
					const filesize = (fullTrack as Record<string, unknown>)[filesizeKey] as number | undefined;

					if (filesize && filesize > 0) {
						downloadURL = generateCryptedStreamURL(sngId, md5, mediaVersion, formatCode);
						actualBitrate = bitrate;
						break;
					}
				}

				// If no filesize info, try anyway with MP3_128
				if (!downloadURL) {
					const formatCode = FORMAT_CODES[TrackFormats.MP3_128];
					downloadURL = generateCryptedStreamURL(sngId, md5, mediaVersion, formatCode);
					actualBitrate = TrackFormats.MP3_128;
				}
			}

			if (!downloadURL) {
				const md5Info = md5 ? (md5.length >= 32 ? "valid" : `len=${md5.length}`) : "missing";
				const hasToken = fullTrack.TRACK_TOKEN ? "yes" : "no";
				return {
					success: false,
					trackId: trackInfo.id,
					trackTitle: trackInfo.title,
					error: `No URL (MD5: ${md5Info}, token: ${hasToken})`,
				};
			}

			// Build filename
			const safeTitle = sanitizeFilename(trackInfo.title);
			const trackNum = String(trackInfo.trackNumber).padStart(2, "0");
			const actualExtension = FORMAT_EXTENSIONS[actualBitrate] || ".mp3";
			const filename = `${trackNum} - ${safeTitle}${actualExtension}`;
			const filePath = path.join(this.options.downloadPath, filename);

			// Skip if exists
			if (fs.existsSync(filePath)) {
				return {
					success: true,
					trackId: trackInfo.id,
					trackTitle: trackInfo.title,
					filePath,
				};
			}

			// Download the track
			await streamTrack(filePath, downloadURL, trackInfo.id, trackInfo.title, this.options.onProgress);

			// Download cover for tagging
			let coverPath: string | undefined;
			if (trackInfo.albumCover) {
				const coverFile = path.join(this.options.downloadPath, "cover.jpg");
				if (!fs.existsSync(coverFile)) {
					await downloadCover(trackInfo.albumCover, coverFile);
				}
				if (fs.existsSync(coverFile)) {
					coverPath = coverFile;
				}
			}

			// Tag the file
			if (actualExtension === ".mp3") {
				await tagTrack(filePath, trackInfo, coverPath);
			}

			return {
				success: true,
				trackId: trackInfo.id,
				trackTitle: trackInfo.title,
				filePath,
			};
		} catch (e) {
			const error = e as Error;
			return {
				success: false,
				trackId: trackInfo.id,
				trackTitle: trackInfo.title,
				error: error.message,
			};
		}
	}
}

function sanitizeFilename(name: string): string {
	// Remove or replace invalid filename characters
	return name
		.replace(/[<>:"/\\|?*]/g, "_")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200); // Limit length
}

