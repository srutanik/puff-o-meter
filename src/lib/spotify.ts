import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

export const spotifyClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim() || '';
export const spotifyRedirectUri = 'puff-o-meter-spotify://callback';
export const spotifyDiscovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const tokenKey = 'puffometer.spotify.token.v1';

export type SpotifySession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artist: string;
  url: string;
};

function toSession(token: AuthSession.TokenResponse, previousRefreshToken?: string): SpotifySession {
  const refreshToken = token.refreshToken || previousRefreshToken;
  if (!refreshToken) throw new Error('Spotify did not return a refresh token. Try connecting again.');
  return {
    accessToken: token.accessToken,
    refreshToken,
    expiresAt: Date.now() + (token.expiresIn || 3600) * 1000,
  };
}

export async function saveSpotifySession(token: AuthSession.TokenResponse): Promise<SpotifySession> {
  const session = toSession(token);
  await SecureStore.setItemAsync(tokenKey, JSON.stringify(session));
  return session;
}

export async function getSpotifySession(): Promise<SpotifySession | null> {
  const raw = await SecureStore.getItemAsync(tokenKey);
  if (!raw) return null;
  let session: SpotifySession;
  try { session = JSON.parse(raw) as SpotifySession; }
  catch { await SecureStore.deleteItemAsync(tokenKey); return null; }
  if (!session.refreshToken || !session.accessToken) {
    await SecureStore.deleteItemAsync(tokenKey);
    return null;
  }
  if (Date.now() < session.expiresAt - 60_000) return session;
  if (!spotifyClientId) return null;
  try {
    const token = await AuthSession.refreshAsync({
      clientId: spotifyClientId,
      refreshToken: session.refreshToken,
    }, spotifyDiscovery);
    session = toSession(token, session.refreshToken);
    await SecureStore.setItemAsync(tokenKey, JSON.stringify(session));
    return session;
  } catch (error) {
    // Spotify refresh tokens expire; reconnecting gets a new one.
    await SecureStore.deleteItemAsync(tokenKey);
    throw error;
  }
}

export async function clearSpotifySession(): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey);
}

async function spotifyGet<T>(session: SpotifySession, path: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) throw new Error(`Spotify request failed (${response.status}). Reconnect and try again.`);
  return response.json() as Promise<T>;
}

export async function getSpotifyPicks(session: SpotifySession): Promise<{ name: string; tracks: SpotifyTrack[] }> {
  const [profile, top] = await Promise.all([
    spotifyGet<{ display_name?: string | null; id: string }>(session, '/me'),
    spotifyGet<{ items: Array<{ id: string; name: string; artists: Array<{ name: string }>; external_urls?: { spotify?: string } }> }>(session, '/me/top/tracks?time_range=short_term&limit=5'),
  ]);
  return {
    name: profile.display_name || profile.id,
    tracks: (top.items || []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    })),
  };
}
