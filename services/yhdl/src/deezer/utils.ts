import type {
	EnrichedAPIContributor,
	EnrichedAPITrack,
	GWTrack,
	DiscographyAlbum,
} from "./types.js";

// Explicit Content Lyrics status values
export const LyricsStatus = {
	NOT_EXPLICIT: 0,
	EXPLICIT: 1,
	UNKNOWN: 2,
	EDITED: 3,
	PARTIALLY_EXPLICIT: 4,
	PARTIALLY_UNKNOWN: 5,
	NO_ADVICE: 6,
	PARTIALLY_NO_ADVICE: 7,
};

export const ReleaseType = ["single", "album", "compile", "ep", "bundle"];
export const RoleID = ["Main", null, null, null, null, "Featured"];

export function is_explicit(explicit_content_lyrics: unknown): boolean {
	return [LyricsStatus.EXPLICIT, LyricsStatus.PARTIALLY_EXPLICIT].includes(
		parseInt(String(explicit_content_lyrics)) || LyricsStatus.UNKNOWN
	);
}

// Maps GW API album from discography to standard format
export function map_artist_album(album: Record<string, unknown>): DiscographyAlbum {
	return {
		id: album.ALB_ID as string,
		title: album.ALB_TITLE as string,
		link: `https://www.deezer.com/album/${album.ALB_ID}`,
		cover: `https://api.deezer.com/album/${album.ALB_ID}/image`,
		cover_small: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/56x56-000000-80-0-0.jpg`,
		cover_medium: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/250x250-000000-80-0-0.jpg`,
		cover_big: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/500x500-000000-80-0-0.jpg`,
		cover_xl: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/1000x1000-000000-80-0-0.jpg`,
		md5_image: album.ALB_PICTURE as string,
		genre_id: album.GENRE_ID as number | undefined,
		release_date: album.PHYSICAL_RELEASE_DATE as string | undefined,
		record_type: ReleaseType[parseInt(album.TYPE as string)] || "unknown",
		tracklist: `https://api.deezer.com/album/${album.ALB_ID}/tracks`,
		explicit_lyrics: is_explicit(album.EXPLICIT_LYRICS),
		nb_tracks: album.NUMBER_TRACK as number,
		nb_disk: album.NUMBER_DISK as number | undefined,
		copyright: album.COPYRIGHT as string | undefined,
		rank: album.RANK as number | undefined,
		digital_release_date: album.DIGITAL_RELEASE_DATE as string | undefined,
		original_release_date: album.ORIGINAL_RELEASE_DATE as string | undefined,
		physical_release_date: album.PHYSICAL_RELEASE_DATE as string | undefined,
		is_official: album.ARTISTS_ALBUMS_IS_OFFICIAL as boolean | undefined,
		artist_role: RoleID[album.ROLE_ID as number] ?? undefined,
	};
}

// Maps GW track to enriched API track format
export function mapGwTrackToDeezer(track: GWTrack): EnrichedAPITrack {
	const baseResult: Partial<EnrichedAPITrack> = {
		id: track.SNG_ID,
		readable: true,
		title: track.SNG_TITLE,
		title_short: track.SNG_TITLE,
		isrc: track.ISRC,
		link: `https://www.deezer.com/track/${track.SNG_ID}`,
		duration: track.DURATION,
		available_countries: [],
		contributors: [],
		md5_image: track.ALB_PICTURE,
		artist: {
			id: track.ART_ID,
			name: track.ART_NAME,
			link: `https://www.deezer.com/artist/${track.ART_ID}`,
			picture: `https://www.deezer.com/artist/${track.ART_ID}/image`,
			tracklist: `https://api.deezer.com/artist/${track.ART_ID}/top?limit=50`,
			type: "artist",
		},
		album: {
			id: track.ALB_ID,
			title: track.ALB_TITLE,
			link: `https://www.deezer.com/album/${track.ALB_ID}`,
			cover: `https://api.deezer.com/album/${track.ALB_ID}/image`,
			cover_small: `https://e-cdns-images.dzcdn.net/images/cover/${track.ALB_PICTURE}/56x56-000000-80-0-0.jpg`,
			cover_medium: `https://e-cdns-images.dzcdn.net/images/cover/${track.ALB_PICTURE}/250x250-000000-80-0-0.jpg`,
			cover_big: `https://e-cdns-images.dzcdn.net/images/cover/${track.ALB_PICTURE}/500x500-000000-80-0-0.jpg`,
			cover_xl: `https://e-cdns-images.dzcdn.net/images/cover/${track.ALB_PICTURE}/1000x1000-000000-80-0-0.jpg`,
			md5_image: track.ALB_PICTURE,
			tracklist: `https://api.deezer.com/album/${track.ALB_ID}/tracks`,
			type: "album",
		},
		type: "track",
		md5_origin: track.MD5_ORIGIN,
		filesizes: {
			default: track.FILESIZE,
		},
		media_version: track.MEDIA_VERSION,
		track_token: track.TRACK_TOKEN,
		track_token_expire: track.TRACK_TOKEN_EXPIRE,
	};

	if (track.SNG_ID <= 0) {
		return {
			...baseResult,
			token: track.TOKEN,
			user_id: track.USER_ID,
			filesizes: {
				...baseResult.filesizes,
				mp3_misc: track.FILESIZE_MP3_MISC,
			},
		} as EnrichedAPITrack;
	}

	const titleVersion = (track.VERSION || "").trim();
	const titleShort =
		titleVersion && baseResult.title_short?.includes(titleVersion)
			? baseResult.title_short.replace(titleVersion, "").trim()
			: baseResult.title_short;

	const additionalFields: Partial<EnrichedAPITrack> = {
		title_version: titleVersion,
		title_short: titleShort,
		title: `${titleShort} ${titleVersion}`.trim(),
		track_position: track.TRACK_NUMBER,
		disk_number: track.DISK_NUMBER,
		rank: track.RANK || track.RANK_SNG || 0,
		release_date: track.PHYSICAL_RELEASE_DATE,
		explicit_lyrics: Boolean(track.EXPLICIT_LYRICS),
		preview: track.MEDIA[0]?.HREF || "",
		gain: track.GAIN,
		lyrics_id: track.LYRICS_ID,
		physical_release_date: track.PHYSICAL_RELEASE_DATE,
		song_contributors: track.SNG_CONTRIBUTORS,
	};

	if (track.FALLBACK) {
		additionalFields.fallback_id = track.FALLBACK.SNG_ID;
	}

	if (track.DIGITAL_RELEASE_DATE) {
		additionalFields.digital_release_date = track.DIGITAL_RELEASE_DATE;
	}

	if (track.GENRE_ID) {
		additionalFields.genre_id = track.GENRE_ID;
	}

	if (track.COPYRIGHT) {
		additionalFields.copyright = track.COPYRIGHT;
	}

	if (track.LYRICS) {
		additionalFields.lyrics = track.LYRICS;
	}

	if (track.ALBUM_FALLBACK) {
		additionalFields.alternative_albums = track.ALBUM_FALLBACK;
	}

	const filesizes: Record<string, number | undefined> = {
		...baseResult.filesizes,
		aac_64: track.FILESIZE_AAC_64,
		mp3_64: track.FILESIZE_MP3_64,
		mp3_128: track.FILESIZE_MP3_128,
		mp3_256: track.FILESIZE_MP3_256,
		mp3_320: track.FILESIZE_MP3_320,
		mp4_ra1: track.FILESIZE_MP4_RA1,
		mp4_ra2: track.FILESIZE_MP4_RA2,
		mp4_ra3: track.FILESIZE_MP4_RA3,
		flac: track.FILESIZE_FLAC,
	};

	if (track.ARTISTS) {
		const contributors: EnrichedAPIContributor[] = track.ARTISTS.map((contributor) => ({
			id: contributor.ART_ID,
			name: contributor.ART_NAME,
			link: `https://www.deezer.com/artist/${contributor.ART_ID}`,
			share: `https://www.deezer.com/artist/${contributor.ART_ID}`,
			picture: `https://www.deezer.com/artist/${contributor.ART_ID}/image`,
			picture_small: `https://e-cdns-images.dzcdn.net/images/artist/${contributor.ART_PICTURE}/56x56-000000-80-0-0.jpg`,
			picture_medium: `https://e-cdns-images.dzcdn.net/images/artist/${contributor.ART_PICTURE}/250x250-000000-80-0-0.jpg`,
			picture_big: `https://e-cdns-images.dzcdn.net/images/artist/${contributor.ART_PICTURE}/500x500-000000-80-0-0.jpg`,
			picture_xl: `https://e-cdns-images.dzcdn.net/images/artist/${contributor.ART_PICTURE}/1000x1000-000000-80-0-0.jpg`,
			md5_image: contributor.ART_PICTURE || "",
			tracklist: `https://api.deezer.com/artist/${contributor.ART_ID}/top?limit=50`,
			type: "artist",
			role: RoleID[contributor.ROLE_ID] ?? null,
			order: String(contributor.ARTISTS_SONGS_ORDER || 0),
			rank: contributor.RANK || 0,
		}));

		const mainArtist = contributors.find((c) => c.id === baseResult.artist?.id);
		if (mainArtist && baseResult.artist) {
			baseResult.artist = {
				...baseResult.artist,
				picture_small: mainArtist.picture_small,
				picture_medium: mainArtist.picture_medium,
				picture_big: mainArtist.picture_big,
				picture_xl: mainArtist.picture_xl,
				md5_image: mainArtist.md5_image,
			};
		}

		additionalFields.contributors = contributors;
	}

	return {
		...baseResult,
		...additionalFields,
		filesizes,
	} as EnrichedAPITrack;
}

