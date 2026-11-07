import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { StickerIcon } from './PopArt';
import { font, palette } from '../theme';
import type { SmokeKind } from '../types';
import {
  clearSpotifySession, getSpotifyPicks, getSpotifySession, saveSpotifySession,
  spotifyClientId, spotifyDiscovery, spotifyRedirectUri, type SpotifyTrack,
} from '../lib/spotify';

WebBrowser.maybeCompleteAuthSession();

type Mood = 'CHILL' | 'FOCUS' | 'SOCIAL' | 'RESET';
const picks: Record<Mood, { title: string; id: string; line: string }> = {
  CHILL: { title: 'CHILL HITS', id: '37i9dQZF1DX4WYpdgoIcn6', line: 'Easy tracks for a slow minute.' },
  FOCUS: { title: 'DEEP FOCUS', id: '37i9dQZF1DWZeKCadgRdKQ', line: 'A clear head, one track at a time.' },
  SOCIAL: { title: 'FEELGOOD POP', id: '37i9dQZF1DX8ttEdg9VJHO', line: 'Bring the bright energy.' },
  RESET: { title: 'PEACEFUL PIANO', id: '37i9dQZF1DX4sWSpwq3LiO', line: 'A little room to breathe.' },
};
const moods: Mood[] = ['CHILL', 'FOCUS', 'SOCIAL', 'RESET'];

export function MusicBar({ mode, recentMood }: { mode: SmokeKind; recentMood: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [mood, setMood] = useState<Mood>('CHILL');
  const [playerError, setPlayerError] = useState(false);
  const [playerActive, setPlayerActive] = useState(false);
  const [spotifyName, setSpotifyName] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const green = mode === 'weed';
  const pick = picks[mood];
  const [authRequest, , promptSpotify] = AuthSession.useAuthRequest({
    clientId: spotifyClientId || 'unconfigured',
    responseType: AuthSession.ResponseType.Code,
    redirectUri: spotifyRedirectUri,
    scopes: ['user-read-private', 'user-top-read'],
    usePKCE: true,
  }, spotifyDiscovery);

  useEffect(() => {
    let live = true;
    getSpotifySession().then(async (session) => {
      if (!session) return;
      const picks = await getSpotifyPicks(session);
      if (live) { setSpotifyName(picks.name); setTopTracks(picks.tracks); }
    }).catch((error) => { if (live) setSpotifyError(error instanceof Error ? error.message : 'Spotify could not reconnect.'); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const next = recentMood?.toUpperCase() as Mood | undefined;
    if (next && next in picks) setMood(next);
  }, [recentMood]);

  function choose(next: Mood) { setMood(next); setPlayerError(false); setPlayerActive(true); }
  function stopOrLoad(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    setPlayerError(false);
    if (playerActive) setPlayerActive(false);
    else { setPlayerActive(true); setExpanded(true); }
  }

  async function connectSpotify() {
    if (!spotifyClientId || !authRequest) {
      setSpotifyError('Spotify login needs a developer client ID.');
      return;
    }
    setSpotifyBusy(true);
    setSpotifyError(null);
    try {
      const result = await promptSpotify();
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success' || !result.params.code || !authRequest.codeVerifier) {
        throw new Error(result.type === 'error' ? result.error?.message || 'Spotify sign-in failed.' : 'Spotify did not return a sign-in code.');
      }
      const token = await AuthSession.exchangeCodeAsync({
        clientId: spotifyClientId,
        code: result.params.code,
        redirectUri: spotifyRedirectUri,
        extraParams: { code_verifier: authRequest.codeVerifier },
      }, spotifyDiscovery);
      const session = await saveSpotifySession(token);
      const personalized = await getSpotifyPicks(session);
      setSpotifyName(personalized.name);
      setTopTracks(personalized.tracks);
    } catch (error) {
      setSpotifyError(error instanceof Error ? error.message : 'Spotify sign-in failed.');
    } finally {
      setSpotifyBusy(false);
    }
  }

  async function disconnectSpotify() {
    await clearSpotifySession();
    setSpotifyName(null);
    setTopTracks([]);
    setSpotifyError(null);
    setPlayerActive(false);
  }

  return <View style={[styles.wrap, { backgroundColor: green ? palette.oliveDark : palette.ink }]}>
    <Pressable accessibilityLabel={expanded ? 'Collapse music bar' : 'Open music bar'} onPress={() => setExpanded(!expanded)} style={styles.top}>
      <StickerIcon name="music" size={37} background={green ? palette.mint : palette.yellow} accent={green ? palette.olive : palette.red} tilt={-8} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>SPOTIFY RECCO · {mood}</Text>
        <Text style={styles.title}>{pick.title}</Text>
      </View>
      <Pressable accessibilityLabel={playerActive ? 'Stop Spotify music' : 'Load Spotify player'} onPress={stopOrLoad} style={styles.stopButton}><Ionicons name={playerActive ? 'stop' : 'play'} size={15} color={palette.white} /></Pressable>
      <View style={[styles.arrow, { backgroundColor: green ? palette.mint : palette.yellow }]}><Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={19} color={palette.ink} /></View>
    </Pressable>
    <View pointerEvents={expanded ? 'auto' : 'none'} style={expanded ? styles.body : styles.hiddenBody}>
      <Text style={styles.line}>{pick.line}</Text>
      <View style={styles.accountRow}>
        <View style={{ flex: 1 }}><Text style={styles.accountEyebrow}>SPOTIFY ACCOUNT</Text><Text style={styles.accountName}>{spotifyName ? `CONNECTED · ${spotifyName}` : spotifyClientId ? 'MAKE IT YOURS' : 'SETUP NEEDED'}</Text></View>
        <Pressable disabled={spotifyBusy} onPress={spotifyName ? disconnectSpotify : connectSpotify} style={styles.accountButton}><Text style={styles.accountButtonText}>{spotifyBusy ? 'WAIT…' : spotifyName ? 'DISCONNECT' : 'LOG IN'}</Text></Pressable>
      </View>
      {!!spotifyError && <Text style={styles.accountError}>{spotifyError}</Text>}
      {!!topTracks.length && <View style={styles.topTracks}><Text style={styles.accountEyebrow}>YOUR HEAVY ROTATION</Text>{topTracks.slice(0, 3).map((track, index) => <Pressable key={track.id} onPress={() => { void Linking.openURL(track.url); }} style={styles.trackRow}><Text style={styles.trackIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={{ flex: 1 }}><Text style={styles.trackName} numberOfLines={1}>{track.name}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text></View><Ionicons name="open-outline" size={15} color={palette.white} /></Pressable>)}</View>}
      <View style={styles.moods}>{moods.map(item => <Pressable key={item} onPress={() => choose(item)} style={[styles.mood, item === mood && { backgroundColor: green ? palette.mint : palette.yellow }]}><Text style={[styles.moodText, item === mood && { color: palette.ink }]}>{item}</Text></Pressable>)}</View>
      <View style={styles.playerFrame}>
        {!playerActive ? <View style={styles.stopped}><Text style={styles.stoppedTitle}>MUSIC STOPPED.</Text><Pressable onPress={() => setPlayerActive(true)} style={styles.loadButton}><Text style={styles.loadText}>LOAD SPOTIFY PLAYER</Text></Pressable></View> : playerError ? <Text style={styles.error}>Spotify player is unavailable. Open the playlist below.</Text> : <WebView
          key={pick.id}
          source={{ uri: `https://open.spotify.com/embed/playlist/${pick.id}` }}
          style={styles.player}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          onError={() => setPlayerError(true)}
        />}
      </View>
      <Pressable onPress={() => { void Linking.openURL(`https://open.spotify.com/playlist/${pick.id}`); }} style={styles.spotifyLink}><Text style={styles.spotifyLinkText}>OPEN PLAYLIST IN SPOTIFY</Text><Ionicons name="open-outline" size={15} color={palette.white} /></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 10, marginBottom: 4, borderRadius: 16, borderWidth: 2, borderColor: palette.ink, overflow: 'hidden' },
  top: { minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontFamily: font.bold, fontSize: 8, letterSpacing: 1.1, color: '#E8DBC5' },
  title: { fontFamily: font.poster, fontSize: 12, color: palette.white, marginTop: 1 },
  stopButton: { width: 29, height: 29, borderRadius: 9, borderWidth: 1, borderColor: '#AFA79B', alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 10, paddingBottom: 9 },
  hiddenBody: { position: 'absolute', left: -1000, top: 0, width: 340, height: 240, opacity: 0, paddingHorizontal: 10 },
  line: { fontFamily: font.body, fontSize: 11, color: '#E8DBC5', marginBottom: 9 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderWidth: 1, borderColor: '#71675D', borderRadius: 10, marginBottom: 9 },
  accountEyebrow: { fontFamily: font.bold, fontSize: 8, letterSpacing: 0.8, color: '#D8C6B3' },
  accountName: { fontFamily: font.bold, fontSize: 10, color: palette.white, marginTop: 2 },
  accountButton: { backgroundColor: palette.yellow, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  accountButtonText: { fontFamily: font.bold, fontSize: 9, color: palette.ink },
  accountError: { fontFamily: font.body, fontSize: 10, color: '#FFD8B5', marginBottom: 8 },
  topTracks: { marginBottom: 10 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#5E564F', paddingVertical: 7 },
  trackIndex: { fontFamily: font.poster, color: palette.yellow, fontSize: 12 },
  trackName: { fontFamily: font.bold, color: palette.white, fontSize: 10 },
  trackArtist: { fontFamily: font.body, color: '#D8C6B3', fontSize: 9 },
  moods: { flexDirection: 'row', gap: 5, marginBottom: 9 },
  mood: { flex: 1, height: 29, borderWidth: 1, borderColor: '#B8B1A3', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moodText: { fontFamily: font.bold, color: palette.white, fontSize: 8 },
  playerFrame: { height: 152, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1D1D1D' },
  player: { flex: 1, backgroundColor: '#1D1D1D' },
  stopped: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stoppedTitle: { fontFamily: font.poster, color: palette.white, fontSize: 15 },
  loadButton: { backgroundColor: palette.yellow, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  loadText: { fontFamily: font.bold, color: palette.ink, fontSize: 10 },
  error: { fontFamily: font.body, color: palette.white, fontSize: 12, textAlign: 'center', marginTop: 55 },
  spotifyLink: { minHeight: 29, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 6 },
  spotifyLinkText: { fontFamily: font.bold, fontSize: 9, letterSpacing: 0.5, color: palette.white },
});
