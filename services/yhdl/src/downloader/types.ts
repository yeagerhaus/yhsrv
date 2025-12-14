import type { DiscographyAlbum, EnrichedAPITrack, GWTrack } from "../deezer/types.js";

export interface TrackDownloadInfo {
	id: number;
	title: string;
	artist: string;
	album: string;
	trackNumber: number;
	discNumber: number;
	duration: number;
	isrc: string;
	explicit: boolean;
	md5Origin: number;
	mediaVersion: number;
	trackToken: string;
	albumCover: string;
	releaseDate?: string;
	genre?: string[];
	bpm?: number;
	gain?: number;
	contributors?: string[];
}

export interface AlbumDownloadInfo {
	id: string;
	title: string;
	artist: string;
	artistId: number;
	cover: string;
	coverXl: string;
	releaseDate?: string;
	recordType: string;
	trackCount: number;
	explicit: boolean;
	label?: string;
	genres?: string[];
}

export interface DownloadResult {
	success: boolean;
	trackId: number;
	trackTitle: string;
	filePath?: string;
	error?: string;
}

export interface ReleaseToDownload {
	album: DiscographyAlbum;
	artistName: string;
	artistId: number;
	folderPath: string;
	releaseType: "Album" | "EP" | "Single";
	skipped: boolean;
	skipReason?: string;
}

export function gwTrackToDownloadInfo(track: GWTrack, albumTitle?: string): TrackDownloadInfo {
	return {
		id: track.SNG_ID,
		title: track.SNG_TITLE,
		artist: track.ART_NAME,
		album: albumTitle || track.ALB_TITLE,
		trackNumber: track.TRACK_NUMBER,
		discNumber: track.DISK_NUMBER,
		duration: track.DURATION,
		isrc: track.ISRC,
		explicit: Boolean(track.EXPLICIT_LYRICS),
		md5Origin: track.MD5_ORIGIN,
		mediaVersion: track.MEDIA_VERSION,
		trackToken: track.TRACK_TOKEN,
		albumCover: `https://e-cdns-images.dzcdn.net/images/cover/${track.ALB_PICTURE}/1000x1000-000000-80-0-0.jpg`,
		releaseDate: track.PHYSICAL_RELEASE_DATE,
		bpm: undefined,
		gain: track.GAIN,
	};
}

export function enrichedTrackToDownloadInfo(track: EnrichedAPITrack): TrackDownloadInfo {
	return {
		id: track.id,
		title: track.title,
		artist: track.artist.name,
		album: track.album?.title || "",
		trackNumber: track.track_position,
		discNumber: track.disk_number,
		duration: track.duration,
		isrc: track.isrc,
		explicit: track.explicit_lyrics,
		md5Origin: track.md5_origin || 0,
		mediaVersion: track.media_version || 0,
		trackToken: track.track_token,
		albumCover: track.album?.cover_xl || "",
		releaseDate: track.release_date,
		bpm: track.bpm,
		gain: track.gain,
	};
}

