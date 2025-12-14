import got from "got";
import { Cookie, CookieJar } from "tough-cookie";
import { API } from "./api.js";
import { DeezerError, WrongGeolocation, WrongLicense } from "./errors.js";
import { GW } from "./gw.js";
import type { User } from "./types.js";

export class Deezer {
	loggedIn: boolean;
	httpHeaders: { "User-Agent": string; "Accept-Language"?: string };
	cookieJar: CookieJar;
	currentUser?: User;
	childs: User[];
	selectedAccount: number;
	api: API;
	gw: GW;

	constructor() {
		this.httpHeaders = {
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
		};
		this.cookieJar = new CookieJar();
		this.loggedIn = false;
		this.currentUser = {};
		this.childs = [];
		this.selectedAccount = 0;
		this.api = new API(this.cookieJar, this.httpHeaders);
		this.gw = new GW(this.cookieJar, this.httpHeaders);
	}

	async loginViaArl(arl: string, child: string | number = 0): Promise<boolean> {
		if (child && typeof child === "string") child = parseInt(child);

		// Create cookie
		const cookie_obj = new Cookie({
			key: "arl",
			value: arl.trim(),
			domain: ".deezer.com",
			path: "/",
			httpOnly: true,
		});
		await this.cookieJar.setCookie(cookie_obj.toString(), "https://www.deezer.com");

		const userData = (await this.gw.get_user_data()) as {
			USER: {
				USER_ID: number;
				BLOG_NAME: string;
				USER_PICTURE: string;
				OPTIONS: {
					license_token: string;
					web_hq: boolean;
					mobile_hq: boolean;
					web_lossless: boolean;
					mobile_lossless: boolean;
					license_country: string;
				};
				SETTING: { global: { language: string } };
				LOVEDTRACKS_ID: number;
				MULTI_ACCOUNT: { ENABLED: boolean; IS_SUB_ACCOUNT: boolean };
			};
			checkForm: string;
		};

		// Check if user logged in
		if (!userData || Object.keys(userData).length === 0) return (this.loggedIn = false);
		if (userData.USER.USER_ID === 0) return (this.loggedIn = false);

		await this._postLogin(userData);
		this.changeAccount(child as number);
		this.loggedIn = true;
		return true;
	}

	async _postLogin(userData: {
		USER: {
			USER_ID: number;
			BLOG_NAME: string;
			USER_PICTURE: string;
			OPTIONS: {
				license_token: string;
				web_hq: boolean;
				mobile_hq: boolean;
				web_lossless: boolean;
				mobile_lossless: boolean;
				license_country: string;
			};
			SETTING: { global: { language: string } };
			LOVEDTRACKS_ID: number;
			MULTI_ACCOUNT: { ENABLED: boolean; IS_SUB_ACCOUNT: boolean };
		};
	}): Promise<void> {
		this.childs = [];
		this.childs.push({
			id: userData.USER.USER_ID,
			name: userData.USER.BLOG_NAME,
			picture: userData.USER.USER_PICTURE || "",
			license_token: userData.USER.OPTIONS.license_token,
			can_stream_hq: userData.USER.OPTIONS.web_hq || userData.USER.OPTIONS.mobile_hq,
			can_stream_lossless: userData.USER.OPTIONS.web_lossless || userData.USER.OPTIONS.mobile_lossless,
			country: userData.USER.OPTIONS.license_country,
			language: userData.USER.SETTING.global.language || "",
			loved_tracks: userData.USER.LOVEDTRACKS_ID,
		});
	}

	changeAccount(child_n: number): [User | undefined, number] {
		if (this.childs.length - 1 < child_n) child_n = 0;
		this.currentUser = this.childs[child_n];
		this.selectedAccount = child_n;

		let lang = this.currentUser?.language?.toString().replace(/[^0-9A-Za-z *,-.;=]/g, "");
		if (lang?.slice(2, 1) === "-") {
			lang = lang.slice(0, 5);
		} else {
			lang = lang?.slice(0, 2);
		}
		if (lang) this.httpHeaders["Accept-Language"] = lang;

		return [this.currentUser, this.selectedAccount];
	}

	async get_track_url(track_token: string, format: string): Promise<string | null> {
		const tracks = await this.get_tracks_url([track_token], format);
		if (tracks.length > 0) {
			if (tracks[0] instanceof DeezerError) throw tracks[0];
			return tracks[0] as string;
		}
		return null;
	}

	async get_tracks_url(track_tokens: string[], format: string): Promise<(string | DeezerError | null)[]> {
		if (!Array.isArray(track_tokens)) track_tokens = [track_tokens];
		if (!this.currentUser?.license_token) {
			return [];
		}

		if (
			((format === "FLAC" || format.startsWith("MP4_RA")) && !this.currentUser.can_stream_lossless) ||
			(format === "MP3_320" && !this.currentUser.can_stream_hq)
		) {
			throw new WrongLicense(format);
		}

		let response: { data: { errors?: { code: number; message?: string }[]; media?: { sources: { url: string }[] }[] }[] };
		const result: (DeezerError | string | null)[] = [];

		try {
			response = await got.post("https://media.deezer.com/v1/get_url", {
				headers: {
					...this.httpHeaders,
					"Accept-Encoding": "gzip, deflate",
				},
				cookieJar: this.cookieJar,
				https: { rejectUnauthorized: false },
				decompress: true,
				json: {
					license_token: this.currentUser.license_token,
					media: [{ type: "FULL", formats: [{ cipher: "BF_CBC_STRIPE", format }] }],
					track_tokens,
				},
				responseType: "json",
			}).json();
		} catch {
			return [];
		}

		if (response.data?.length) {
			response.data.forEach((data) => {
				if (data.errors) {
					if (data.errors[0].code === 2002) {
						result.push(new WrongGeolocation(this.currentUser?.country));
					} else {
						result.push(new DeezerError(JSON.stringify(data.errors)));
					}
					return; // Don't also push null
				}
				if (data.media) {
					result.push(data.media[0].sources[0].url);
				} else {
					result.push(null);
				}
			});
		}
		return result;
	}
}

