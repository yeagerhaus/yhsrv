import axios, { AxiosInstance } from 'axios';
import { refreshAccessToken } from './auth.js';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
    release_date: string;
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
  genres: string[];
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  images: Array<{ url: string; height: number; width: number }>;
  release_date: string;
  total_tracks: number;
  external_urls: {
    spotify: string;
  };
}

export class SpotifyClient {
  private client: AxiosInstance;
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;

  constructor(accessToken: string, refreshToken: string, expiresAt: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;

    this.client = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    // Add request interceptor to refresh token if needed
    this.client.interceptors.request.use(async (config) => {
      if (Date.now() >= this.expiresAt - 60000) { // Refresh 1 minute before expiry
        const tokens = await refreshAccessToken(this.refreshToken);
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
        this.expiresAt = tokens.expires_at;
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  // Search for tracks
  async searchTracks(query: string, limit: number = 20): Promise<SpotifyTrack[]> {
    const response = await this.client.get('/search', {
      params: {
        q: query,
        type: 'track',
        limit,
      },
    });

    return response.data.tracks.items;
  }

  // Search for artists
  async searchArtists(query: string, limit: number = 20): Promise<SpotifyArtist[]> {
    const response = await this.client.get('/search', {
      params: {
        q: query,
        type: 'artist',
        limit,
      },
    });

    return response.data.artists.items;
  }

  // Get track by ID
  async getTrack(trackId: string): Promise<SpotifyTrack> {
    const response = await this.client.get(`/tracks/${trackId}`);
    return response.data;
  }

  // Get artist by ID
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    const response = await this.client.get(`/artists/${artistId}`);
    return response.data;
  }

  // Get artist albums
  async getArtistAlbums(artistId: string, limit: number = 50): Promise<SpotifyAlbum[]> {
    const response = await this.client.get(`/artists/${artistId}/albums`, {
      params: {
        limit,
        include_groups: 'album,single,compilation',
      },
    });

    return response.data.items;
  }

  // Get album by ID
  async getAlbum(albumId: string): Promise<SpotifyAlbum> {
    const response = await this.client.get(`/albums/${albumId}`);
    return response.data;
  }

  // Get album tracks
  async getAlbumTracks(albumId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    const response = await this.client.get(`/albums/${albumId}/tracks`, {
      params: {
        limit,
      },
    });

    return response.data.items;
  }

  // Match local track with Spotify
  async matchTrack(title: string, artist: string, album?: string): Promise<SpotifyTrack | null> {
    const query = `track:"${title}" artist:"${artist}"${album ? ` album:"${album}"` : ''}`;
    const results = await this.searchTracks(query, 5);

    if (results.length === 0) {
      return null;
    }

    // Try to find exact match
    const exactMatch = results.find(
      (track) =>
        track.name.toLowerCase() === title.toLowerCase() &&
        track.artists.some((a) => a.name.toLowerCase() === artist.toLowerCase())
    );

    return exactMatch || results[0];
  }
}

