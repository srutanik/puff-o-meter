import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-url-polyfill/auto';
import type { Goal, Settings, SmokeLog, Task } from '../types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

const googleRedirectUri = 'puffometer://auth/callback';

export async function signInWithGoogle(): Promise<boolean> {
  if (!supabase) throw new Error('Cloud login needs a Supabase project.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: googleRedirectUri, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not start.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, googleRedirectUri);
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success') throw new Error('Google sign-in did not finish.');
  const callback = new URL(result.url);
  const authError = callback.searchParams.get('error_description') || callback.searchParams.get('error');
  if (authError) throw new Error(authError);
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Google sign-in returned no code.');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}

export type PersonalCloudState = {
  settings: Settings;
  tasks: Task[];
  goals: Goal[];
  smokeLogs: SmokeLog[];
  updatedAt: string;
};

export async function getCloudState(userId: string): Promise<PersonalCloudState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('user_state')
    .select('state, client_updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const state = data.state as Partial<PersonalCloudState> | null;
  if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.goals) || !Array.isArray(state.smokeLogs) || !state.settings) {
    throw new Error('Cloud data is incomplete. Your local data is safe.');
  }
  return { settings: state.settings, tasks: state.tasks, goals: state.goals, smokeLogs: state.smokeLogs, updatedAt: data.client_updated_at };
}

export async function saveCloudState(userId: string, state: PersonalCloudState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_state').upsert({
    user_id: userId,
    client_updated_at: state.updatedAt,
    state: {
      settings: state.settings,
      tasks: state.tasks,
      goals: state.goals,
      smokeLogs: state.smokeLogs,
    },
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export type CloudFriend = {
  id: string;
  name: string;
  handle: string;
  friendCode: string;
  cigarettes: number;
  tasksDone: number;
  tasksTotal: number;
  points: number;
};

export type CloudProfile = {
  id: string;
  name: string;
  handle: string;
  friendCode: string;
};

export async function getCloudProfile(userId: string): Promise<CloudProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, handle, friend_code')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return { id: data.id, name: data.display_name, handle: data.handle, friendCode: data.friend_code };
}

export async function updateCloudProfile(userId: string, input: { name?: string; handle?: string }): Promise<void> {
  if (!supabase) throw new Error('Connect Supabase to use global friends.');
  const values: Record<string, string> = {};
  if (input.name) values.display_name = input.name.trim();
  if (input.handle) values.handle = input.handle.trim().replace(/^@/, '').toLowerCase();
  const { error } = await supabase.from('profiles').update(values).eq('id', userId);
  if (error) throw error;
}

export async function addCloudFriend(code: string): Promise<void> {
  if (!supabase) throw new Error('Connect Supabase to use global friends.');
  const { error } = await supabase.rpc('add_friend_by_code', { code: code.trim().toUpperCase() });
  if (error) throw error;
}

export async function removeCloudFriend(friendId: string, ownId: string): Promise<void> {
  if (!supabase) throw new Error('Connect Supabase to use global friends.');
  const [userLow, userHigh] = [friendId, ownId].sort();
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_low', userLow)
    .eq('user_high', userHigh);
  if (error) throw error;
}

export async function getCloudFriends(ownId: string, date: string): Promise<CloudFriend[]> {
  if (!supabase) return [];
  const { data: links, error: linkError } = await supabase
    .from('friendships')
    .select('user_low, user_high')
    .or(`user_low.eq.${ownId},user_high.eq.${ownId}`);
  if (linkError) throw linkError;
  const ids = (links ?? []).map((link) => link.user_low === ownId ? link.user_high : link.user_low);
  if (!ids.length) return [];
  const [profilesResult, activityResult] = await Promise.all([
    supabase.from('profiles').select('id, display_name, handle, friend_code').in('id', ids),
    supabase.from('daily_activity').select('user_id, cigarettes, tasks_done, tasks_total, points').in('user_id', ids).eq('local_date', date),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (activityResult.error) throw activityResult.error;
  const activity = new Map((activityResult.data ?? []).map((row) => [row.user_id, row]));
  return (profilesResult.data ?? []).map((profile) => {
    const day = activity.get(profile.id);
    return {
      id: profile.id,
      name: profile.display_name,
      handle: profile.handle,
      friendCode: profile.friend_code,
      cigarettes: day?.cigarettes ?? 0,
      tasksDone: day?.tasks_done ?? 0,
      tasksTotal: day?.tasks_total ?? 0,
      points: day?.points ?? 0,
    };
  }).sort((a, b) => b.tasksDone - a.tasksDone || a.cigarettes - b.cigarettes);
}

export async function publishCloudActivity(
  userId: string,
  date: string,
  activity: { cigarettes: number; tasksDone: number; tasksTotal: number; points: number },
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('daily_activity').upsert({
    user_id: userId,
    local_date: date,
    cigarettes: activity.cigarettes,
    tasks_done: activity.tasksDone,
    tasks_total: activity.tasksTotal,
    points: activity.points,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,local_date' });
  if (error) throw error;
}
