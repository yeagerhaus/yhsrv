export { transcodeTrack, getStreamableTrack, getTrackPath, type TranscodeOptions, type TranscodeResult } from './transcoder.js';
export { streamTrack, streamFile, parseRange, type Range } from './streamer.js';
export { analyzeTrack, getTrackAnalysis, analyzeTracksBatch, type SonicAnalysis } from './sonic-analysis.js';
export { applyFade, createCrossfade, createPlaylistStream, type FadeOptions, type CrossfadeOptions } from './sweet-fades.js';

