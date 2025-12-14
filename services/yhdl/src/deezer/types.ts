// Track format quality levels
export const TrackFormats = {
	FLAC: 9,
	MP3_320: 3,
	MP3_128: 1,
	MP4_RA3: 15,
	MP4_RA2: 14,
	MP4_RA1: 13,
	DEFAULT: 8,
	LOCAL: 0,
} as const;

export interface User {
	id?: number;
	name?: string;
	picture?: string;
	license_token?: string;
	can_stream_hq?: boolean;
	can_stream_lossless?: boolean;
	country?: string;
	language?: string;
	loved_tracks?: number;
}

export interface APIOptions {
	index?: number;
	limit?: number;
	start?: number;
	strict?: boolean;
	order?: string;
}

export const SearchOrder = {
	RANKING: "RANKING",
	TRACK_ASC: "TRACK_ASC",
	TRACK_DESC: "TRACK_DESC",
	ARTIST_ASC: "ARTIST_ASC",
	ARTIST_DESC: "ARTIST_DESC",
	ALBUM_ASC: "ALBUM_ASC",
	ALBUM_DESC: "ALBUM_DESC",
	RATING_ASC: "RATING_ASC",
	RATING_DESC: "RATING_DESC",
	DURATION_ASC: "DURATION_ASC",
	DURATION_DESC: "DURATION_DESC",
};

export interface APIArtist {
	id: number;
	name: string;
	link?: string;
	picture?: string;
	picture_small?: string;
	picture_medium?: string;
	picture_big?: string;
	picture_xl?: string;
	nb_album?: number;
	nb_fan?: number;
	tracklist?: string;
	md5_image?: string;
}

export interface APIAlbum {
	id: string;
	title: string;
	link: string;
	cover: string;
	cover_small: string;
	cover_medium: string;
	cover_big: string;
	cover_xl: string;
	release_date?: string;
	root_artist?: APIArtist;
	nb_tracks?: number;
	nb_disk?: number;
	tracks?: { data?: APITrack[] };
	md5_image?: string;
	md5_origin?: string;
	artist?: APIArtist;
	explicit_lyrics?: boolean;
	contributors?: APIContributor[];
	record_type?: string;
	upc?: string;
	label?: string;
	copyright?: string;
	original_release_date?: string;
	genres?: { data?: { name?: string }[] };
}

export interface APITrack {
	id: number;
	readable: boolean;
	title: string;
	title_short: string;
	title_version: string;
	isrc: string;
	link: string;
	duration: number;
	track_position: number;
	disk_number: number;
	rank: number;
	release_date: string;
	explicit_lyrics: boolean;
	preview: string;
	bpm: number;
	gain: number;
	available_countries: string[];
	alternative?: APITrack;
	contributors?: APIContributor[];
	md5_image: string;
	track_token: string;
	artist: APIArtist;
	album: APIAlbum;
	size?: number;
	lyrics_id?: string;
	lyrics?: string;
	position?: number;
	copyright?: string;
	physical_release_date?: string;
	genres?: string[];
}

export interface APIContributor {
	id: number;
	name: string;
	link: string;
	picture: string;
	picture_small: string;
	picture_medium: string;
	picture_big: string;
	picture_xl: string;
	role: string | null | undefined;
}

export interface EnrichedAPITrack extends Omit<APITrack, "album" | "artist" | "contributors"> {
	type?: string;
	md5_origin?: number;
	filesizes?: Record<string, number | undefined>;
	media_version?: number;
	track_token_expire?: number;
	token?: string;
	user_id?: string;
	lyrics_id?: string;
	physical_release_date?: string;
	fallback_id?: number;
	digital_release_date?: string;
	genre_id?: number;
	copyright?: string;
	lyrics?: string;
	alternative_albums?: unknown;
	album?: EnrichedAPIAlbum;
	artist: EnrichedAPIArtist;
	contributors: EnrichedAPIContributor[];
	song_contributors?: Record<string, unknown>;
}

export interface EnrichedAPIContributor extends APIContributor {
	md5_image: string;
	tracklist: string;
	type: string;
	order: string;
	rank: number;
}

export interface EnrichedAPIAlbum extends APIAlbum {
	md5_image?: string;
	tracklist?: string;
	type?: string;
}

export interface EnrichedAPIArtist extends APIArtist {
	md5_image?: string;
	type?: string;
}

export interface GWTrack {
	ALB_ID: string;
	TRACK_TOKEN_EXPIRE: number;
	TOKEN?: string;
	USER_ID?: string;
	FILESIZE_MP3_MISC?: number;
	VERSION?: string;
	TRACK_NUMBER: number;
	DISK_NUMBER: number;
	RANK?: number;
	RANK_SNG?: number;
	PHYSICAL_RELEASE_DATE: string;
	EXPLICIT_LYRICS: number;
	EXPLICIT_TRACK_CONTENT: {
		EXPLICIT_LYRICS_STATUS: number;
		EXPLICIT_COVER_STATUS: number;
	};
	MEDIA: { HREF?: string }[];
	GAIN: number;
	ARTISTS?: GWArtist[];
	LYRICS_ID?: string;
	SNG_CONTRIBUTORS?: Record<string, unknown>;
	FALLBACK?: { SNG_ID: number };
	DIGITAL_RELEASE_DATE?: string;
	GENRE_ID?: number;
	COPYRIGHT?: string;
	LYRICS?: string;
	ALBUM_FALLBACK?: unknown;
	FILESIZE_AAC_64?: number;
	FILESIZE_MP3_64?: number;
	FILESIZE_MP3_128?: number;
	FILESIZE_MP3_256?: number;
	FILESIZE_MP3_320?: number;
	FILESIZE_MP4_RA1?: number;
	FILESIZE_MP4_RA2?: number;
	FILESIZE_MP4_RA3?: number;
	FILESIZE_FLAC?: number;
	TRACK_TOKEN: string;
	SNG_ID: number;
	SNG_TITLE: string;
	DURATION: number;
	MD5_ORIGIN: string;
	MEDIA_VERSION: number;
	FILESIZE: number;
	ALB_TITLE: string;
	ALB_PICTURE: string;
	ART_ID: number;
	ART_NAME: string;
	ISRC: string;
}

export interface GWArtist {
	ART_ID: number;
	ART_NAME: string;
	ART_PICTURE?: string;
	ROLE_ID: number;
	ARTISTS_SONGS_ORDER?: number;
	RANK?: number;
}

export interface GWAlbum {
	ALB_ID: string;
	ALB_TITLE: string;
	ALB_PICTURE: string;
	ART_ID: number;
	ART_NAME: string;
	ARTISTS?: GWArtist[];
	VERSION?: string;
	PHYSICAL_RELEASE_DATE?: string;
	DIGITAL_RELEASE_DATE?: string;
	ORIGINAL_RELEASE_DATE?: string;
	TYPE?: string;
	GENRE_ID?: number;
	NUMBER_TRACK?: number;
	NUMBER_DISK?: number;
	LABEL_NAME?: string;
	COPYRIGHT?: string;
	UPC?: string;
	NB_FAN?: number;
	RANK?: number;
	RANK_ART?: number;
	EXPLICIT_ALBUM_CONTENT: {
		EXPLICIT_LYRICS_STATUS: number;
		EXPLICIT_COVER_STATUS: number;
	};
	AVAILABLE?: boolean;
	ALB_CONTRIBUTORS?: unknown;
	__TYPE__?: string;
}

// Artist discography album from GW API
export interface DiscographyAlbum {
	id: string;
	title: string;
	link: string;
	cover: string;
	cover_small: string;
	cover_medium: string;
	cover_big: string;
	cover_xl: string;
	md5_image: string;
	genre_id?: number;
	release_date?: string;
	record_type: string;
	tracklist: string;
	explicit_lyrics: boolean;
	nb_tracks: number;
	nb_disk?: number;
	copyright?: string;
	rank?: number;
	digital_release_date?: string;
	original_release_date?: string;
	physical_release_date?: string;
	is_official?: boolean;
	artist_role?: string;
}

