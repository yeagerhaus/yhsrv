#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline/promises";
import fs from "fs";
import pc from "picocolors";
import ora from "ora";
import cliProgress from "cli-progress";
import { Deezer, TrackFormats, type DiscographyAlbum } from "../deezer/index.js";
import { Downloader, type DownloadResult } from "../downloader/index.js";
import { loadConfig, loadArl, saveArl, clearArl, getEnvPathForDisplay } from "../config.js";
import { resolveArtistReleases, createReleaseFolders } from "../folder-resolver.js";

const program = new Command();

program
	.name("yhdl")
	.description("Download artist discographies from Deezer with intelligent folder management")
	.version("1.0.0")
	.argument("<artist>", "Artist name to search and download")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.option("--dry-run", "Preview what would be downloaded without actually downloading")
	.parse();

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function printHeader() {
	console.log();
	console.log(pc.bold(pc.magenta("  ╭─────────────────────────────────╮")));
	console.log(pc.bold(pc.magenta("  │")) + pc.bold(pc.white("    🎵 yhdl • Artist Downloader   ")) + pc.bold(pc.magenta("│")));
	console.log(pc.bold(pc.magenta("  ╰─────────────────────────────────╯")));
	console.log();
}

function printConfig(musicRoot: string, configPath: string) {
	console.log(pc.dim("  ┌─ Config ─────────────────────────────────"));
	console.log(pc.dim("  │ ") + pc.cyan("Music root: ") + pc.white(musicRoot));
	console.log(pc.dim("  │ ") + pc.cyan("Config:     ") + pc.dim(configPath));
	console.log(pc.dim("  └────────────────────────────────────────────"));
	console.log();
}

function printSummary(downloaded: number, skipped: number, failed: number) {
	console.log();
	console.log(pc.bold(pc.white("  ╭─────────────────────────────────╮")));
	console.log(pc.bold(pc.white("  │")) + pc.bold("         📊 Summary               ") + pc.bold(pc.white("│")));
	console.log(pc.bold(pc.white("  ├─────────────────────────────────┤")));
	console.log(pc.bold(pc.white("  │")) + pc.green(` ✓ Downloaded: ${String(downloaded).padStart(4)} tracks       `) + pc.bold(pc.white("│")));
	console.log(pc.bold(pc.white("  │")) + pc.blue(` ○ Skipped:    ${String(skipped).padStart(4)} releases      `) + pc.bold(pc.white("│")));
	if (failed > 0) {
		console.log(pc.bold(pc.white("  │")) + pc.red(` ✗ Failed:     ${String(failed).padStart(4)} tracks        `) + pc.bold(pc.white("│")));
	}
	console.log(pc.bold(pc.white("  ╰─────────────────────────────────╯")));
	console.log();
}

function createProgressBar() {
	return new cliProgress.SingleBar({
		format: pc.dim("  │ ") + pc.cyan("{bar}") + pc.dim(" │ ") + pc.white("{percentage}%") + pc.dim(" │ ") + pc.dim("{value}/{total} tracks"),
		barCompleteChar: "█",
		barIncompleteChar: "░",
		hideCursor: true,
		clearOnComplete: false,
		barsize: 25,
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export async function downloadArtist(cmd?: Command) {
	// Use provided command or create/parse our own
	let command: Command;
	if (cmd) {
		command = cmd;
	} else {
		command = getProgram();
		if (!command.args.length) {
			command.parse(process.argv.slice(2));
		}
	}
	
	const artistQuery = command.args[0];
	const opts = command.opts<{ bitrate: string; dryRun?: boolean }>();
	const bitrate = parseBitrate(opts.bitrate);

	printHeader();

	// Load config
	const config = loadConfig();
	printConfig(config.musicRootPath, getEnvPathForDisplay());

	// Initialize Deezer
	const dz = new Deezer();

	// Handle login
	let arl = loadArl();
	if (!arl) {
		console.log(pc.yellow("  ⚠ No ARL found. Please enter your Deezer ARL token."));
		console.log(pc.dim("    (You can find this in your browser cookies at deezer.com)\n"));

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		arl = await rl.question(pc.cyan("  Enter ARL: "));
		rl.close();

		if (!arl || arl.trim().length === 0) {
			console.error(pc.red("\n  ✗ No ARL provided. Exiting."));
			process.exit(1);
		}

		arl = arl.trim();
	}

	// Login with retry logic for expired tokens
	let loggedIn = false;
	let loginAttempts = 0;
	const maxLoginAttempts = 2;

	while (!loggedIn && loginAttempts < maxLoginAttempts) {
		const loginSpinner = ora({
			text: "Logging in to Deezer...",
			prefixText: " ",
			color: "magenta",
		}).start();

		loggedIn = await dz.loginViaArl(arl);

		if (!loggedIn) {
			loginSpinner.fail(pc.red("Login failed. Your ARL token may be expired or invalid."));
			
			// Clear the invalid ARL from .env
			clearArl();
			
			// Prompt for new ARL
			console.log();
			console.log(pc.yellow("  ⚠ Please enter a new Deezer ARL token."));
			console.log(pc.dim("    (You can find this in your browser cookies at deezer.com)\n"));

			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			arl = await rl.question(pc.cyan("  Enter ARL: "));
			rl.close();

			if (!arl || arl.trim().length === 0) {
				console.error(pc.red("\n  ✗ No ARL provided. Exiting."));
				process.exit(1);
			}

			arl = arl.trim();
			loginAttempts++;
		} else {
			loginSpinner.succeed(pc.green(`Logged in as ${pc.bold(dz.currentUser?.name || "Unknown")}`));
			saveArl(arl);
		}
	}

	if (!loggedIn) {
		console.error(pc.red("\n  ✗ Failed to login after multiple attempts. Exiting."));
		process.exit(1);
	}

	// Check subscription
	if (bitrate === TrackFormats.FLAC && !dz.currentUser?.can_stream_lossless) {
		console.log(pc.yellow("  ⚠ Your account doesn't support FLAC. Falling back to MP3 320."));
	}

	// ===== PHASE 1: SEARCH =====
	const searchSpinner = ora({
		text: `Searching for "${pc.bold(artistQuery)}"...`,
		prefixText: " ",
		color: "cyan",
	}).start();

	const searchResults = await dz.api.search_artist(artistQuery, { limit: 5 });

	if (!searchResults.data.length) {
		searchSpinner.fail(pc.red(`No artists found for "${artistQuery}"`));
		process.exit(1);
	}

	const artist = searchResults.data[0];
	searchSpinner.succeed(`Found ${pc.bold(pc.magenta(artist.name))} ${pc.dim(`(ID: ${artist.id})`)}`);

	// ===== PHASE 2: FETCH DISCOGRAPHY =====
	const discogSpinner = ora({
		text: "Fetching discography...",
		prefixText: " ",
		color: "cyan",
	}).start();

	const discography = await dz.gw.get_artist_discography_tabs(artist.id, { limit: 100 });
	const allReleases: DiscographyAlbum[] = discography.all || [];

	if (allReleases.length === 0) {
		discogSpinner.warn(pc.yellow("No releases found for this artist."));
		process.exit(0);
	}

	discogSpinner.succeed(`Found ${pc.bold(pc.cyan(String(allReleases.length)))} releases`);

	// ===== PHASE 3: RESOLVE FOLDERS =====
	const resolveSpinner = ora({
		text: "Analyzing library...",
		prefixText: " ",
		color: "cyan",
	}).start();

	const resolvedReleases = resolveArtistReleases(
		config.musicRootPath,
		artist.name,
		artist.id,
		allReleases
	);

	const existingReleases = resolvedReleases.filter((r) => r.exists);
	const newReleases = resolvedReleases.filter((r) => !r.exists);

	resolveSpinner.succeed(`${pc.green(String(existingReleases.length))} existing, ${pc.cyan(String(newReleases.length))} to download`);

	// Show releases
	console.log();
	console.log(pc.dim("  ┌─ Releases ──────────────────────────────────"));
	for (const release of resolvedReleases) {
		const icon = release.exists ? pc.green("✓") : pc.cyan("→");
		const title = release.exists ? pc.dim(release.album.title) : pc.white(release.album.title);
		const type = pc.dim(`[${release.releaseType}]`);
		const status = release.exists ? pc.dim("exists") : pc.cyan("new");
		console.log(pc.dim("  │ ") + `${icon} ${title} ${type} ${status}`);
	}
	console.log(pc.dim("  └───────────────────────────────────────────────"));

	if (newReleases.length === 0) {
		console.log();
		console.log(pc.green("  ✓ All releases already downloaded!"));
		console.log();
		process.exit(0);
	}

	// Dry run
	if (opts.dryRun) {
		console.log();
		console.log(pc.yellow("  🔍 Dry run mode - no files will be downloaded."));
		console.log();
		for (const release of newReleases) {
			console.log(pc.dim("  │ ") + pc.cyan("📁 ") + pc.white(release.folderPath));
			console.log(pc.dim("  │    ") + pc.dim(`${release.album.nb_tracks} tracks`));
		}
		console.log();
		process.exit(0);
	}

	// ===== PHASE 4: CREATE FOLDERS =====
	createReleaseFolders(newReleases);

	// ===== PHASE 5: DOWNLOAD =====
	console.log();
	console.log(pc.bold(pc.white(`  ⬇ Downloading ${newReleases.length} releases...`)));
	console.log();

	const allResults: DownloadResult[] = [];
	let releaseIndex = 0;

	for (const release of newReleases) {
		releaseIndex++;
		const releaseLabel = `[${releaseIndex}/${newReleases.length}]`;
		console.log(pc.dim("  ┌─") + pc.bold(pc.magenta(` ${releaseLabel} `)) + pc.bold(pc.white(release.album.title)) + pc.dim(` • ${release.releaseType}`));
		console.log(pc.dim("  │ ") + pc.dim(release.folderPath));

		const progressBar = createProgressBar();
		let trackCount = 0;
		const trackErrors: string[] = [];

		const downloader = new Downloader(dz, {
			bitrate,
			downloadPath: release.folderPath,
			onTrackStart: (_track, idx, total) => {
				if (idx === 1) {
					progressBar.start(total, 0);
				}
			},
			onTrackComplete: (result) => {
				trackCount++;
				progressBar.update(trackCount);
				if (!result.success) {
					trackErrors.push(`${result.trackTitle}: ${result.error}`);
				}
			},
		});

		const results = await downloader.downloadAlbum(release.album.id, release.album.title);
		progressBar.stop();

		// Show result
		const successCount = results.filter((r) => r.success).length;
		const failCount = results.filter((r) => !r.success).length;

		if (successCount === 0 && failCount > 0) {
			// All tracks failed - delete the empty folder so it's not skipped next time
			console.log(pc.dim("  │ ") + pc.red(`✗ All ${failCount} tracks failed`));
			for (const err of trackErrors.slice(0, 3)) {
				console.log(pc.dim("  │   ") + pc.red(`✗ ${err}`));
			}
			if (trackErrors.length > 3) {
				console.log(pc.dim("  │   ") + pc.dim(`... and ${trackErrors.length - 3} more errors`));
			}
			// Clean up empty folder
			try {
				fs.rmSync(release.folderPath, { recursive: true, force: true });
				console.log(pc.dim("  │ ") + pc.dim("🗑 Removed empty folder (will retry next run)"));
			} catch {
				// Ignore cleanup errors
			}
		} else if (failCount === 0) {
			console.log(pc.dim("  │ ") + pc.green(`✓ Complete • ${successCount} tracks`));
		} else {
			console.log(pc.dim("  │ ") + pc.yellow(`⚠ ${successCount} downloaded, ${failCount} failed`));
			for (const err of trackErrors.slice(0, 3)) {
				console.log(pc.dim("  │   ") + pc.red(`✗ ${err}`));
			}
			if (trackErrors.length > 3) {
				console.log(pc.dim("  │   ") + pc.dim(`... and ${trackErrors.length - 3} more errors`));
			}
		}
		console.log(pc.dim("  └────────────────────────────────────────────"));
		console.log();

		// Only add results for albums that had at least some success
		// (fully failed albums get cleaned up and should retry)
		if (successCount > 0) {
			allResults.push(...results);
		}
	}

	// ===== PHASE 6: REPORT =====
	const successful = allResults.filter((r) => r.success);
	const failed = allResults.filter((r) => !r.success);

	printSummary(successful.length, existingReleases.length, failed.length);

	if (failed.length > 0) {
		console.log(pc.dim("  Failed tracks:"));
		for (const result of failed.slice(0, 10)) {
			console.log(pc.red(`    ✗ ${result.trackTitle}: `) + pc.dim(result.error || "Unknown error"));
		}
		if (failed.length > 10) {
			console.log(pc.dim(`    ... and ${failed.length - 10} more`));
		}
		console.log();
	}

	process.exit(failed.length > 0 ? 1 : 0);
}

function parseBitrate(bitrate: string): number {
	switch (bitrate.toLowerCase()) {
		case "flac":
			return TrackFormats.FLAC;
		case "320":
		case "mp3_320":
			return TrackFormats.MP3_320;
		case "128":
		case "mp3_128":
			return TrackFormats.MP3_128;
		default:
			console.log(pc.yellow(`  ⚠ Unknown bitrate "${bitrate}", defaulting to FLAC`));
			return TrackFormats.FLAC;
	}
}

