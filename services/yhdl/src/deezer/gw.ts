import got from "got";
import type { CookieJar } from "tough-cookie";
import { GWAPIError } from "./errors.js";
import type { APIOptions, DiscographyAlbum, GWTrack } from "./types.js";
import { map_artist_album } from "./utils.js";

export const EMPTY_TRACK_OBJ: Partial<GWTrack> = {
	SNG_ID: 0,
	SNG_TITLE: "",
	DURATION: 0,
	MD5_ORIGIN: "",
	MEDIA_VERSION: 0,
	FILESIZE: 0,
	ALB_TITLE: "",
	ALB_PICTURE: "",
	ART_ID: 0,
	ART_NAME: "",
};

export class GW {
	httpHeaders: Record<string, string>;
	cookieJar: CookieJar;
	api_token: string | null;

	constructor(cookieJar: CookieJar, headers: Record<string, string>) {
		this.httpHeaders = headers;
		this.cookieJar = cookieJar;
		this.api_token = null;
	}

	async api_call(method: string, args: Record<string, unknown> = {}, params: Record<string, unknown> = {}): Promise<unknown> {
		if (!this.api_token && method !== "deezer.getUserData") {
			this.api_token = await this._get_token();
		}

		const p = {
			api_version: "1.0",
			api_token: method === "deezer.getUserData" ? "null" : this.api_token,
			input: "3",
			method,
			...params,
		};

		let result_json: { error: unknown; results: unknown; payload?: { FALLBACK?: Record<string, unknown> } };
		try {
			result_json = await got
				.post("http://www.deezer.com/ajax/gw-light.php", {
					searchParams: p,
					json: args,
					cookieJar: this.cookieJar,
					headers: this.httpHeaders,
					https: { rejectUnauthorized: false },
				})
				.json();
		} catch (e) {
			const error = e as Error & { code?: string };
			console.error("[ERROR] deezer.gw", method, args, error.name, error.message);
			if (["ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENETRESET", "ETIMEDOUT"].includes(error.code || "")) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				return this.api_call(method, args, params);
			}
			throw new GWAPIError(`${method} ${JSON.stringify(args)}:: ${error.name}: ${error.message}`);
		}

		const errorObj = result_json.error as Record<string, unknown> | unknown[];
		if ((Array.isArray(errorObj) && errorObj.length) || Object.keys(errorObj).length) {
			const errorStr = JSON.stringify(result_json.error);
			if (errorStr === '{"GATEWAY_ERROR":"invalid api token"}' || errorStr === '{"VALID_TOKEN_REQUIRED":"Invalid CSRF token"}') {
				this.api_token = await this._get_token();
				return this.api_call(method, args, params);
			}
			if (result_json.payload?.FALLBACK) {
				Object.assign(args, result_json.payload.FALLBACK);
				return this.api_call(method, args, params);
			}
			throw new GWAPIError(errorStr);
		}

		if (!this.api_token && method === "deezer.getUserData") {
			this.api_token = (result_json.results as { checkForm: string }).checkForm;
		}

		return result_json.results;
	}

	async _get_token(): Promise<string> {
		const token_data = (await this.get_user_data()) as { checkForm: string };
		return token_data.checkForm;
	}

	get_user_data(): Promise<unknown> {
		return this.api_call("deezer.getUserData");
	}

	// ===== Tracks =====
	async getTrack(sng_id: string | number): Promise<GWTrack> {
		return this.api_call("song.getData", { SNG_ID: sng_id }) as Promise<GWTrack>;
	}

	async get_track_page(sng_id: string | number): Promise<{ DATA: GWTrack; LYRICS?: unknown; ISRC?: unknown }> {
		return this.api_call("deezer.pageTrack", { SNG_ID: sng_id }) as Promise<{ DATA: GWTrack; LYRICS?: unknown; ISRC?: unknown }>;
	}

	async get_tracks(sng_ids: (string | number)[]): Promise<GWTrack[]> {
		const body = (await this.api_call("song.getListData", { SNG_IDS: sng_ids })) as { data: GWTrack[] };
		const tracks_array: GWTrack[] = [];
		let errors = 0;
		for (let i = 0; i < sng_ids.length; i++) {
			if (sng_ids[i] !== 0) {
				tracks_array.push(body.data[i - errors]);
			} else {
				errors++;
				tracks_array.push(EMPTY_TRACK_OBJ as GWTrack);
			}
		}
		return tracks_array;
	}

	async get_track_with_fallback(sng_id: string | number): Promise<GWTrack> {
		let body: { DATA: GWTrack; LYRICS?: unknown; ISRC?: unknown } | null = null;
		if (parseInt(String(sng_id)) > 0) {
			try {
				body = await this.get_track_page(sng_id);
			} catch {
				/* ignore */
			}
		}

		if (body) {
			if (body.LYRICS) (body.DATA as Record<string, unknown>).LYRICS = body.LYRICS;
			if (body.ISRC) (body.DATA as Record<string, unknown>).ALBUM_FALLBACK = body.ISRC;
			return body.DATA;
		}
		return this.getTrack(sng_id);
	}

	// ===== Albums =====
	async get_album(alb_id: string | number): Promise<unknown> {
		return this.api_call("album.getData", { ALB_ID: alb_id });
	}

	async get_album_page(alb_id: string | number): Promise<{ DATA: Record<string, unknown>; SONGS: { data: GWTrack[] } }> {
		return this.api_call("deezer.pageAlbum", {
			ALB_ID: alb_id,
			lang: "en",
			header: true,
			tab: 0,
		}) as Promise<{ DATA: Record<string, unknown>; SONGS: { data: GWTrack[] } }>;
	}

	async get_album_tracks(alb_id: string | number): Promise<GWTrack[]> {
		const body = (await this.api_call("song.getListByAlbum", { ALB_ID: alb_id, nb: -1 })) as { data: GWTrack[] };
		return body.data.map((track, idx) => ({ ...track, POSITION: idx })) as unknown as GWTrack[];
	}

	// ===== Artists =====
	async get_artist(art_id: string | number): Promise<unknown> {
		return this.api_call("artist.getData", { ART_ID: art_id });
	}

	async get_artist_discography(art_id: string | number, options: APIOptions = {}): Promise<{ data: unknown[]; total: number }> {
		const index = options.index || 0;
		const limit = options.limit || 25;
		return this.api_call("album.getDiscography", {
			ART_ID: art_id,
			discography_mode: "all",
			nb: limit,
			nb_songs: 0,
			start: index,
		}) as Promise<{ data: unknown[]; total: number }>;
	}

	async get_artist_discography_tabs(art_id: string | number, options: APIOptions = {}): Promise<Record<string, DiscographyAlbum[]>> {
		const limit = options.limit || 100;
		let index = 0;
		let releases: Record<string, unknown>[] = [];
		const result: Record<string, DiscographyAlbum[]> = { all: [], featured: [], more: [] };
		const ids: string[] = [];

		// Get all releases with pagination
		let response: { data: unknown[]; total: number };
		do {
			response = await this.get_artist_discography(art_id, { index, limit });
			releases = releases.concat(response.data as Record<string, unknown>[]);
			index += limit;
		} while (index < response.total);

		for (const release of releases) {
			const albumId = release.ALB_ID as string;
			if (!ids.includes(albumId)) {
				ids.push(albumId);
				const obj = map_artist_album(release);

				const artId = String(art_id);
				const releaseArtId = String(release.ART_ID);
				const roleId = release.ROLE_ID as number;
				const isOfficial = release.ARTISTS_ALBUMS_IS_OFFICIAL as boolean;

				if ((releaseArtId === artId || (releaseArtId !== artId && roleId === 0)) && isOfficial) {
					// Handle all base record types
					if (!result[obj.record_type]) result[obj.record_type] = [];
					result[obj.record_type].push(obj);
					result.all.push(obj);
				} else {
					if (roleId === 5) {
						// Featured albums
						result.featured.push(obj);
					} else if (roleId === 0) {
						// More albums
						result.more.push(obj);
						result.all.push(obj);
					}
				}
			}
		}

		return result;
	}

	async get_artist_top_tracks(art_id: string | number, options: APIOptions = {}): Promise<GWTrack[]> {
		const limit = options.limit || 100;
		const body = (await this.api_call("artist.getTopTrack", { ART_ID: art_id, nb: limit })) as { data: GWTrack[] };
		return body.data.map((track, idx) => ({ ...track, POSITION: idx })) as unknown as GWTrack[];
	}
}

