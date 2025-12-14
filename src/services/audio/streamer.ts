import { createReadStream, statSync } from 'fs';
import { FastifyReply } from 'fastify';
import { getStreamableTrack } from './transcoder.js';

export interface Range {
  start: number;
  end: number;
}

// Parse Range header
export function parseRange(rangeHeader: string, fileSize: number): Range | null {
  if (!rangeHeader) {
    return null;
  }

  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return null;
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

// Stream file with range request support
export async function streamFile(
  filePath: string,
  reply: FastifyReply,
  rangeHeader?: string
): Promise<void> {
  const stats = statSync(filePath);
  const fileSize = stats.size;

  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileSize);
    
    if (range) {
      const chunkSize = range.end - range.start + 1;
      
      reply.code(206); // Partial Content
      reply.header('Content-Range', `bytes ${range.start}-${range.end}/${fileSize}`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Length', chunkSize.toString());
      
      const stream = createReadStream(filePath, {
        start: range.start,
        end: range.end,
      });
      
      return reply.send(stream);
    }
  }

  // Full file stream
  reply.header('Content-Length', fileSize.toString());
  reply.header('Accept-Ranges', 'bytes');
  
  const stream = createReadStream(filePath);
  return reply.send(stream);
}

// Stream track with optional transcoding
export async function streamTrack(
  trackId: string,
  reply: FastifyReply,
  format?: string,
  bitrate?: number,
  rangeHeader?: string
): Promise<void> {
  const { path, contentType } = await getStreamableTrack(trackId, format, bitrate);
  
  reply.header('Content-Type', contentType);
  reply.header('Cache-Control', 'public, max-age=31536000');
  
  await streamFile(path, reply, rangeHeader);
}

