#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline/promises";
import pc from "picocolors";
import { syncLibrary } from "../sync/sync.js";
import { loadConfig, loadArl, saveArl, clearArl } from "../config.js";
import { Deezer, TrackFormats } from "../deezer/index.js";
import ora from "ora";

const program = new Command();

program
	.name("yhdl-sync")
	.description("Sync entire music library - check all artists for new releases")
	.version("1.0.0")
	.option("--full", "Force check all artists (ignore last check time)")
	.option("--artist <name>", "Sync specific artist only")
	.option("--dry-run", "Preview what would be downloaded without actually downloading")
	.option("-c, --concurrency <n>", "Parallel artist checks", "5")
	.option("--since <hours>", "Only check artists not checked in last N hours", "24")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.parse();

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
			return TrackFormats.FLAC;
	}
}

export async function syncCommand() {
	const opts = program.opts<{
		full?: boolean;
		artist?: string;
		dryRun?: boolean;
		concurrency: string;
		since: string;
		bitrate: string;
	}>();

	const config = loadConfig();
	const bitrate = parseBitrate(opts.bitrate);
	const concurrency = parseInt(opts.concurrency, 10) || 5;
	const checkIntervalHours = parseInt(opts.since, 10) || 24;

	// Handle login
	const dz = new Deezer();
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

	// Login with retry logic
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
			clearArl();

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

	// Run sync
	const result = await syncLibrary({
		musicRootPath: config.musicRootPath,
		bitrate,
		concurrency,
		checkIntervalHours,
		fullSync: opts.full || false,
		dryRun: opts.dryRun || false,
		specificArtist: opts.artist,
		statePath: config.syncStatePath,
		errorLogPath: config.errorLogPath,
	});

	// Exit with appropriate code
	process.exit(result.summary.failedTracks > 0 ? 1 : 0);
}

