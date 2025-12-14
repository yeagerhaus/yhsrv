import axios from 'axios';
import { randomBytes, createHash } from 'crypto';
import { config } from '../../config/index.js';

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Generate state for OAuth flow
export function generateOAuthState(): string {
  return randomBytes(32).toString('hex');
}

// Generate code verifier and challenge for PKCE
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

// Get Spotify OAuth authorization URL
export function getAuthorizationUrl(state: string, codeChallenge?: string): string {
  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: 'code',
    redirect_uri: config.spotify.redirectUri,
    scope: 'user-read-private user-read-email user-library-read',
    state,
  });

  if (codeChallenge) {
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
  }

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier?: string
): Promise<SpotifyTokens> {
  const data = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.spotify.redirectUri,
    client_id: config.spotify.clientId,
    client_secret: config.spotify.clientSecret,
  });

  if (codeVerifier) {
    data.append('code_verifier', codeVerifier);
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      data,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const expiresIn = response.data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: expiresAt,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Spotify token exchange failed: ${error.response?.data?.error_description || error.message}`);
    }
    throw error;
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const data = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.spotify.clientId,
    client_secret: config.spotify.clientSecret,
  });

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      data,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const expiresIn = response.data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken,
      expires_at: expiresAt,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Spotify token refresh failed: ${error.response?.data?.error_description || error.message}`);
    }
    throw error;
  }
}

