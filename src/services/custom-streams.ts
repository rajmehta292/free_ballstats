import type { StreamItem, StreamSource } from '../types/stream.js';
import { buildSvgTeamCrestDataUri } from './multi-sport-analytics-service.js';

class CustomStreamsService {
  private customStreams: Map<string, StreamItem> = new Map();

  constructor() {
    // Add default example custom stream for quick testing
    this.addStream({
      id: 'custom-demo-stream',
      name: 'Custom Stream: Big Buck Bunny (Demo 1080p)',
      category: 'demo',
      league: 'HLS Test Channel',
      stream_key: 'custom-demo-stream',
      match_timestamp: Math.floor(Date.now() / 1000),
      viewers: 120,
      is_external: true,
      thumbnail_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80',
      custom: true,
      sources: [
        {
          quality: 'FHD',
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          live: true,
        },
        {
          quality: 'SD',
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          live: true,
        },
      ],
      team1: { name: 'Free_BallStats', logo: buildSvgTeamCrestDataUri('FBS', '#9146ff', '#00f2fe') },
      team2: { name: 'Broadcast Lab', logo: buildSvgTeamCrestDataUri('LAB', '#0ea5e9', '#10b981') },
    });
  }

  getAll(): StreamItem[] {
    return Array.from(this.customStreams.values());
  }

  getByCategory(category: string): StreamItem[] {
    return this.getAll().filter(s => s.category.toLowerCase() === category.toLowerCase());
  }

  getByKey(streamKey: string): StreamItem | undefined {
    return this.customStreams.get(streamKey);
  }

  addStream(stream: StreamItem): StreamItem {
    stream.custom = true;
    this.customStreams.set(stream.stream_key, stream);
    return stream;
  }

  removeStream(streamKey: string): boolean {
    return this.customStreams.delete(streamKey);
  }
}

export const customStreamsService = new CustomStreamsService();

