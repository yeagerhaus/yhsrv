import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { getTrackPath } from './transcoder.js';

export interface SonicAnalysis {
  bpm: number | null;
  key: string | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  tempo: number | null;
  loudness: number | null;
  analysis_json: Record<string, unknown> | null;
}

// Analyze audio file using FFmpeg
export async function analyzeTrack(trackId: string): Promise<SonicAnalysis> {
  const trackPath = await getTrackPath(trackId);

  // Check if analysis already exists
  const existing = await db
    .selectFrom('sonic_analysis')
    .selectAll()
    .where('track_id', '=', trackId)
    .executeTakeFirst();

  if (existing) {
    return {
      bpm: existing.bpm,
      key: existing.key,
      energy: existing.energy,
      danceability: existing.danceability,
      valence: existing.valence,
      tempo: existing.tempo,
      loudness: existing.loudness,
      analysis_json: existing.analysis_json as Record<string, unknown> | null,
    };
  }

  // Perform analysis using FFmpeg
  const analysis = await performFFmpegAnalysis(trackPath);

  // Save to database
  const id = randomUUID();
  await db
    .insertInto('sonic_analysis')
    .values({
      id,
      track_id: trackId,
      bpm: analysis.bpm,
      key: analysis.key,
      energy: analysis.energy,
      danceability: analysis.danceability,
      valence: analysis.valence,
      tempo: analysis.tempo,
      loudness: analysis.loudness,
      analysis_json: analysis.analysis_json,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  return analysis;
}

// Perform audio analysis using FFmpeg
async function performFFmpegAnalysis(filePath: string): Promise<SonicAnalysis> {
  return new Promise((resolve, reject) => {
    const analysis: SonicAnalysis = {
      bpm: null,
      key: null,
      energy: null,
      danceability: null,
      valence: null,
      tempo: null,
      loudness: null,
      analysis_json: null,
    };

    // Get audio statistics
    ffmpeg(filePath)
      .setFfmpegPath(config.ffmpeg.ffmpegPath)
      .setFfprobePath(config.ffmpeg.ffprobePath)
      .ffprobe((err, metadata) => {
        if (err) {
          reject(new Error(`FFprobe analysis failed: ${err.message}`));
          return;
        }

        // Extract basic audio properties
        const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
        if (audioStream) {
          // Extract loudness (dB) from stream tags
          if (audioStream.tags?.REPLAYGAIN_TRACK_GAIN) {
            const gain = parseFloat(audioStream.tags.REPLAYGAIN_TRACK_GAIN);
            analysis.loudness = gain;
          }
        }

        // Use FFmpeg to extract more detailed analysis
        // Note: Full BPM/key detection requires specialized tools like aubio or librosa
        // For now, we'll use a simplified approach with FFmpeg filters
        extractAdvancedMetrics(filePath)
          .then((advanced) => {
            resolve({
              ...analysis,
              ...advanced,
            });
          })
          .catch((error) => {
            // If advanced analysis fails, return basic analysis
            console.warn(`Advanced analysis failed for ${filePath}:`, error);
            resolve(analysis);
          });
      });
  });
}

// Extract advanced metrics using FFmpeg filters
async function extractAdvancedMetrics(filePath: string): Promise<Partial<SonicAnalysis>> {
  return new Promise((resolve, reject) => {
    const metrics: Partial<SonicAnalysis> = {};
    const analysisData: Record<string, unknown> = {};

    // Use FFmpeg to extract audio features
    // This is a simplified implementation - full analysis would require
    // specialized audio analysis libraries or external tools
    ffmpeg(filePath)
      .setFfmpegPath(config.ffmpeg.ffmpegPath)
      .setFfprobePath(config.ffmpeg.ffprobePath)
      .audioFilters([
        'astats=metadata=1:reset=1',
        'aresample=44100',
      ])
      .format('null')
      .on('stderr', (stderrLine) => {
        // Parse FFmpeg output for audio statistics
        // This is a basic implementation - you may want to use
        // specialized libraries like aubio, librosa, or Essentia for better results
        
        // Extract RMS (energy indicator)
        const rmsMatch = stderrLine.match(/RMS level dB:\s*([-\d.]+)/);
        if (rmsMatch) {
          const rms = parseFloat(rmsMatch[1]);
          metrics.energy = Math.max(0, Math.min(1, (rms + 60) / 60)); // Normalize to 0-1
          analysisData.rms = rms;
        }

        // Extract peak level (loudness indicator)
        const peakMatch = stderrLine.match(/Peak level dB:\s*([-\d.]+)/);
        if (peakMatch) {
          metrics.loudness = parseFloat(peakMatch[1]);
          analysisData.peak = metrics.loudness;
        }
      })
      .on('end', () => {
        // Set default values if not extracted
        if (metrics.energy === undefined) {
          metrics.energy = 0.5; // Default energy
        }
        if (metrics.loudness === undefined) {
          metrics.loudness = -12; // Default loudness
        }

        // Estimate danceability based on energy and tempo (simplified)
        if (metrics.energy !== null && metrics.tempo !== null && metrics.tempo !== undefined) {
          const tempo = metrics.tempo;
          metrics.danceability = Math.min(1, (metrics.energy * 0.7) + (tempo > 120 ? 0.3 : 0));
        } else {
          metrics.danceability = metrics.energy || 0.5;
        }

        // Estimate valence (positivity) - simplified
        metrics.valence = metrics.energy || 0.5;

        metrics.analysis_json = analysisData;
        resolve(metrics);
      })
      .on('error', (error) => {
        reject(new Error(`FFmpeg analysis error: ${error.message}`));
      })
      .save('/dev/null'); // Discard output, we only need the analysis
  });
}

// Get analysis for a track
export async function getTrackAnalysis(trackId: string): Promise<SonicAnalysis | null> {
  const analysis = await db
    .selectFrom('sonic_analysis')
    .selectAll()
    .where('track_id', '=', trackId)
    .executeTakeFirst();

  if (!analysis) {
    return null;
  }

  return {
    bpm: analysis.bpm,
    key: analysis.key,
    energy: analysis.energy,
    danceability: analysis.danceability,
    valence: analysis.valence,
    tempo: analysis.tempo,
    loudness: analysis.loudness,
    analysis_json: analysis.analysis_json as Record<string, unknown> | null,
  };
}

// Batch analyze tracks (for background jobs)
export async function analyzeTracksBatch(trackIds: string[]): Promise<void> {
  for (const trackId of trackIds) {
    try {
      await analyzeTrack(trackId);
    } catch (error) {
      console.error(`Failed to analyze track ${trackId}:`, error);
    }
  }
}

