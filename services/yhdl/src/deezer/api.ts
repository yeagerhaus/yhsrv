import got from "got";
import type { CookieJar } from "tough-cookie";
import { APIError, DataException, ItemsLimitExceededException } from "./errors.js";
import type { APIAlbum, APIArtist, APIOptions } from "./types.js";

type APIArgs = Record<string | number, string | number>;

export class API {
	httpHeaders: { "User-Agent": string };
	cookieJar: CookieJar;
	access_token: string | null;

	constructor(cookieJar: CookieJar, headers: { "User-Agent": string }) {
		this.httpHeaders = headers;
		this.cookieJar = cookieJar;
		this.access_token = null;
	}

	async call(endpoint: string, args: APIArgs = {}): Promise<unknown> {
		if (this.access_token) args["access_token"] = this.access_token;

		let response: Record<string, unknown>;
		try {
			response = await got
				.get("https://api.deezer.com/" + endpoint, {
					searchParams: args,
					cookieJar: this.cookieJar,
					headers: this.httpHeaders,
					https: { rejectUnauthorized: false },
				})
				.json();
		} catch (e) {
			const error = e as Error & { code?: string };
			console.error("[ERROR] deezer.api", endpoint, args, error.name, error.message);
			if (["ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENETRESET", "ETIMEDOUT"].includes(error.code || "")) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				return this.call(endpoint, args);
			}
			throw new APIError(`${endpoint} ${args}:: ${error.name}: ${error.message}`);
		}

		if (response.error) {
			const error = response.error as { code?: number; message?: string };
			if (error.code) {
				if ([4, 700].includes(error.code)) {
					await new Promise((resolve) => setTimeout(resolve, 5000));
					return this.call(endpoint, args);
				}
				if (error.code === 100) throw new ItemsLimitExceededException(`ItemsLimitExceededException: ${endpoint}`);
				if (error.code === 800) throw new DataException(`DataException: ${endpoint} ${error.message || ""}`);
			}
			throw new APIError(JSON.stringify(response.error));
		}

		return response;
	}

	// ===== Artists =====
	async get_artist(artist_id: string | number): Promise<APIArtist> {
		return this.call(`artist/${artist_id}`) as Promise<APIArtist>;
	}

	async search_artist(query: string, options: APIOptions = {}): Promise<{ data: APIArtist[]; total: number }> {
		const index = options.index || 0;
		const limit = options.limit || 25;
		return this.call("search/artist", { q: query, index, limit }) as Promise<{ data: APIArtist[]; total: number }>;
	}

	// ===== Albums =====
	async get_album(album_id: string | number): Promise<APIAlbum> {
		return this.call(`album/${album_id}`) as Promise<APIAlbum>;
	}

	async get_album_tracks(album_id: string | number, options: APIOptions = {}): Promise<{ data: unknown[] }> {
		const index = options.index || 0;
		const limit = options.limit || -1;
		return this.call(`album/${album_id}/tracks`, { index, limit }) as Promise<{ data: unknown[] }>;
	}

	// ===== Search =====
	async search(query: string, options: APIOptions = {}): Promise<{ data: unknown[]; total: number }> {
		const index = options.index || 0;
		const limit = options.limit || 25;
		return this.call("search", { q: query, index, limit }) as Promise<{ data: unknown[]; total: number }>;
	}

	async advanced_search(filters: { artist?: string; track?: string; album?: string }): Promise<{ data: unknown[] }> {
		let query = "";
		if (filters.artist) query += `artist:"${filters.artist}" `;
		if (filters.album) query += `album:"${filters.album}" `;
		if (filters.track) query += `track:"${filters.track}" `;
		return this.search(query.trim());
	}

	async get_track_id_from_metadata(artist: string, track: string, album: string): Promise<string> {
		artist = artist.replace("–", "-").replace("'", "'");
		track = track.replace("–", "-").replace("'", "'");
		album = album.replace("–", "-").replace("'", "'");

		let resp = await this.advanced_search({ artist, track, album });
		if (resp.data.length) return String((resp.data[0] as { id: number }).id);

		resp = await this.advanced_search({ artist, track });
		if (resp.data.length) return String((resp.data[0] as { id: number }).id);

		return "0";
	}
}

