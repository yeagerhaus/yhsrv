import got from "got";
import fs from "fs";
import type { Readable, Writable } from "stream";
import { pipeline as streamPipeline } from "stream/promises";
import { generateBlowfishKey, decryptChunk } from "./crypto.js";

const USER_AGENT_HEADER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36";

export interface DownloadProgress {
	downloaded: number;
	total: number;
	trackId: number;
	trackTitle: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export async function streamTrack(
	writepath: string,
	downloadURL: string,
	trackId: number,
	trackTitle: string,
	onProgress?: ProgressCallback,
	isCancelled?: () => boolean,
	retryCount = 0
): Promise<void> {
	const MAX_RETRIES = 3;
	const TRACK_TIMEOUT = 120000; // 2 minutes max per track
	
	// Wrap entire download in a hard timeout
	const controller = new AbortController();
	const hardTimeout = setTimeout(() => controller.abort(), TRACK_TIMEOUT);
	
	try {
		await streamTrackInternal(writepath, downloadURL, trackId, trackTitle, onProgress, isCancelled, controller.signal);
	} catch (e) {
		const err = e as Error & { code?: string };
		const isRetryable = 
			err.name === "AbortError" ||
			err.message?.includes("aborted") ||
			err.message?.includes("timeout") ||
			err.message?.includes("Timeout") ||
			["ESOCKETTIMEDOUT", "ERR_STREAM_PREMATURE_CLOSE", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND"].includes(err.code || "");
		
		if (isRetryable && retryCount < MAX_RETRIES) {
			const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
			await new Promise((r) => setTimeout(r, delay));
			return streamTrack(writepath, downloadURL, trackId, trackTitle, onProgress, isCancelled, retryCount + 1);
		}
		throw e;
	} finally {
		clearTimeout(hardTimeout);
	}
}

async function streamTrackInternal(
	writepath: string,
	downloadURL: string,
	trackId: number,
	trackTitle: string,
	onProgress?: ProgressCallback,
	isCancelled?: () => boolean,
	signal?: AbortSignal
): Promise<void> {
	const headers = { "User-Agent": USER_AGENT_HEADER };
	let chunkLength = 0;
	let complete = 0;
	const isCryptedStream = downloadURL.includes("/mobile/") || downloadURL.includes("/media/");
	let blowfishKey: string | undefined;
	const outputStream = fs.createWriteStream(writepath);
	let inactivityTimeout: NodeJS.Timeout | null = null;
	let error = "";

	if (isCryptedStream) {
		blowfishKey = generateBlowfishKey(String(trackId));
	}

	async function* decrypter(source: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
		let modifiedStream = Buffer.alloc(0);
		for await (const chunk of source) {
			if (!isCryptedStream) {
				yield chunk;
			} else {
				modifiedStream = Buffer.concat([modifiedStream, chunk]);
				while (modifiedStream.length >= 2048 * 3) {
					let decryptedChunks = Buffer.alloc(0);
					const decryptingChunks = modifiedStream.subarray(0, 2048 * 3);
					modifiedStream = modifiedStream.subarray(2048 * 3);
					if (decryptingChunks.length >= 2048 && blowfishKey) {
						decryptedChunks = decryptChunk(decryptingChunks.subarray(0, 2048), blowfishKey);
						decryptedChunks = Buffer.concat([decryptedChunks, decryptingChunks.subarray(2048)]);
					}
					yield decryptedChunks;
				}
			}
		}
		if (isCryptedStream && blowfishKey) {
			let decryptedChunks = Buffer.alloc(0);
			if (modifiedStream.length >= 2048) {
				decryptedChunks = decryptChunk(modifiedStream.subarray(0, 2048), blowfishKey);
				decryptedChunks = Buffer.concat([decryptedChunks, modifiedStream.subarray(2048)]);
				yield decryptedChunks;
			} else {
				yield modifiedStream;
			}
		}
	}

	async function* depadder(source: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
		let isStart = true;
		for await (let chunk of source) {
			if (isStart && chunk[0] === 0 && chunk.subarray(4, 8).toString() !== "ftyp") {
				let i: number;
				for (i = 0; i < chunk.length; i++) {
					if (chunk[i] !== 0) break;
				}
				chunk = chunk.subarray(i);
			}
			isStart = false;
			yield chunk;
		}
	}

	const request = got.stream(downloadURL, {
		headers,
		https: { rejectUnauthorized: false },
		timeout: {
			lookup: 5000,
			connect: 10000,
			secureConnect: 10000,
			socket: 30000,
			send: 10000,
			response: 20000,
		},
		signal,
	});

	request.on("response", (response) => {
		if (inactivityTimeout) clearTimeout(inactivityTimeout);
		complete = parseInt(response.headers["content-length"] as string) || 0;
		if (complete === 0) {
			error = "DownloadEmpty";
			request.destroy();
		}
	});

	request.on("data", (chunk: Buffer) => {
		if (isCancelled?.()) {
			error = "DownloadCanceled";
			request.destroy();
			return;
		}
		chunkLength += chunk.length;
		if (onProgress && complete > 0) {
			onProgress({
				downloaded: chunkLength,
				total: complete,
				trackId,
				trackTitle,
			});
		}
		// Reset inactivity timer on each chunk
		if (inactivityTimeout) clearTimeout(inactivityTimeout);
		inactivityTimeout = setTimeout(() => {
			error = "DownloadTimeout";
			request.destroy();
		}, 30000); // 30s inactivity timeout
	});

	// Initial timeout for first response
	inactivityTimeout = setTimeout(() => {
		error = "DownloadTimeout";
		request.destroy();
	}, 20000);

	try {
		await streamPipeline(
			request as unknown as Readable,
			decrypter as unknown as (source: Readable) => AsyncIterable<Buffer>,
			depadder as unknown as (source: AsyncIterable<Buffer>) => AsyncIterable<Buffer>,
			outputStream as Writable
		);
	} catch (e) {
		if (inactivityTimeout) clearTimeout(inactivityTimeout);
		if (fs.existsSync(writepath)) fs.unlinkSync(writepath);
		
		const err = e as Error & { code?: string };
		
		// Handle specific error cases
		if (request.destroyed && error === "DownloadEmpty") {
			throw new Error("Download returned empty content");
		}
		if (request.destroyed && error === "DownloadCanceled") {
			throw new Error("Download was canceled");
		}
		
		// Rethrow with context for retry logic in wrapper
		throw err;
	} finally {
		if (inactivityTimeout) clearTimeout(inactivityTimeout);
	}
}

