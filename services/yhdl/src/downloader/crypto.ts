import { createCipheriv, createHash, createDecipheriv, getCiphers } from "crypto";
// @ts-expect-error - CJS module import
import Blowfish from "./blowfish.cjs";

export function _md5(data: string, type: BufferEncoding = "binary"): string {
	const md5sum = createHash("md5");
	md5sum.update(Buffer.from(data, type));
	return md5sum.digest("hex");
}

export function _ecbCrypt(key: string, data: string): string {
	const cipher = createCipheriv("aes-128-ecb", Buffer.from(key), Buffer.from(""));
	cipher.setAutoPadding(false);
	return Buffer.concat([cipher.update(data, "binary"), cipher.final()]).toString("hex").toLowerCase();
}

export function generateBlowfishKey(trackId: string): string {
	const SECRET = "g4el58wc0zvf9na1";
	const idMd5 = _md5(trackId.toString(), "ascii");
	let bfKey = "";
	for (let i = 0; i < 16; i++) {
		bfKey += String.fromCharCode(idMd5.charCodeAt(i) ^ idMd5.charCodeAt(i + 16) ^ SECRET.charCodeAt(i));
	}
	return String(bfKey);
}

export function decryptChunk(chunk: Buffer, blowFishKey: string): Buffer {
	const ciphers = getCiphers();
	// Try native bf-cbc first (faster, but not available in all Node.js builds)
	if (ciphers.includes("bf-cbc")) {
		const cipher = createDecipheriv("bf-cbc", blowFishKey, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
		cipher.setAutoPadding(false);
		return Buffer.concat([cipher.update(chunk), cipher.final()]);
	}
	// Fallback to JS Blowfish implementation
	const BlowfishClass = Blowfish as {
		new (key: string, mode: number, padding: number): {
			setIv(iv: Buffer): void;
			decode(data: Buffer, type: number): Uint8Array;
		};
		MODE: { CBC: number };
		PADDING: { NULL: number };
		TYPE: { UINT8_ARRAY: number };
	};
	const cipher = new BlowfishClass(blowFishKey, BlowfishClass.MODE.CBC, BlowfishClass.PADDING.NULL);
	cipher.setIv(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
	return Buffer.from(cipher.decode(chunk, BlowfishClass.TYPE.UINT8_ARRAY));
}

export function generateStreamPath(sngID: string, md5: string, mediaVersion: string, format: string): string {
	let urlPart = md5 + "¤" + format + "¤" + sngID + "¤" + mediaVersion;
	const md5val = _md5(urlPart);
	let step2 = md5val + "¤" + urlPart + "¤";
	step2 += ".".repeat(16 - (step2.length % 16));
	urlPart = _ecbCrypt("jo6aey6haid2Teih", step2);
	return urlPart;
}

export function generateCryptedStreamURL(sngID: string, md5: string, mediaVersion: string, format: string): string {
	const urlPart = generateStreamPath(sngID, md5, mediaVersion, format);
	// Try different CDN hostnames - the 'e-cdns-proxy' format may be outdated
	return "https://e-cdn-proxy-" + md5[0] + ".dzcdn.net/api/1/" + urlPart;
}

