import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppActions, AppData, Goal, SmokeKind, SmokeLog, Task } from './types';
import {
  addCloudFriend,
  cloudEnabled,
  getCloudFriends,
  getCloudProfile,
  getCloudState,
  publishCloudActivity,
  removeCloudFriend,
  saveCloudState,
  signInWithGoogle as signInWithGoogleAuth,
  supabase,
  updateCloudProfile,
} from './lib/supabase';

const STORAGE_KEY = 'puffearn:local:v1';

export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function initialData(): AppData {
  return {
    updatedAt: '1970-01-01T00:00:00.000Z',
    profile: { name: 'You', handle: 'you', friendCode: 'SIGN IN' },
    settings: {
      mode: 'cigarette', dailyMax: 5, weedEnabled: false, weedWeekendOnly: true,
      cigCost: 100, weedCost: 400,
    },
    tasks: [],
    goals: [],
    friends: [],
    smokeLogs: [],
    points: { cigarette: 0, weed: 0 },
    auth: { status: 'loading' },
    syncing: false,
    error: null,
  };
}

function balance(data: AppData): AppData['points'] {
  const earned = data.tasks.reduce((sum, task) => sum + (task.completedAt ? task.points : 0), 0);
  const spent = data.smokeLogs.reduce((acc, log) => {
    if (!log.bypassed) acc[log.kind] += log.spentPoints;
    return acc;
  }, { cigarette: 0, weed: 0 });
  return {
    cigarette: Math.max(0, earned - spent.cigarette),
    weed: Math.max(0, Math.floor(earned / 5) - spent.weed),
  };
}

function recalc(data: AppData): AppData {
  return { ...data, points: balance(data) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function hydrate(raw: string | null): AppData {
  const defaults = initialData();
  if (!raw) return defaults;
  try {
    const saved = JSON.parse(raw) as Partial<AppData>;
    return recalc({
      ...defaults,
      profile: { ...defaults.profile, ...saved.profile },
      settings: { ...defaults.settings, ...saved.settings },
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      goals: Array.isArray(saved.goals) ? saved.goals : [],
      smokeLogs: Array.isArray(saved.smokeLogs) ? saved.smokeLogs : [],
      updatedAt: saved.updatedAt || ((saved.tasks?.length || saved.goals?.length || saved.smokeLogs?.length) ? new Date().toISOString() : defaults.updatedAt),
    });
  } catch {
    return defaults;
  }
}

export function usePuffStore(): { data: AppData; actions: AppActions } {
  const [data, setData] = useState<AppData>(initialData);
  const [ready, setReady] = useState(false);
  const [cloudReadyUserId, setCloudReadyUserId] = useState<string | null>(null);

  useEffect(() => {
    // Refresh date-derived counts after midnight and when returning to the app.
    const refresh = () => setData((current) => ({ ...current }));
    const interval = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (live) { setData(hydrate(raw)); setReady(true); } })
      .catch(() => { if (live) { setData(initialData()); setReady(true); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const local = {
      profile: data.profile, settings: data.settings, tasks: data.tasks,
      goals: data.goals, smokeLogs: data.smokeLogs,
      updatedAt: data.updatedAt,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(local)).catch(() => {
      setData((current) => ({ ...current, error: 'Could not save on this device.' }));
    });
  }, [ready, data.profile, data.settings, data.tasks, data.goals, data.smokeLogs, data.updatedAt]);

  useEffect(() => {
    if (!ready) return;
    if (!supabase) {
      setData((current) => ({ ...current, auth: { status: 'guest' } }));
      return;
    }
    let live = true;
    let generation = 0;
    const loadUser = async (user: { id: string; email?: string | null } | null) => {
      const request = ++generation;
      if (!live) return;
      if (!user) {
        setCloudReadyUserId(null);
        setData((current) => ({ ...current, auth: { status: 'guest' }, friends: [], profile: { ...current.profile, id: undefined, friendCode: 'SIGN IN' } }));
        return;
      }
      try {
        const [profile, friends, remote] = await Promise.all([
          getCloudProfile(user.id), getCloudFriends(user.id, localDate()), getCloudState(user.id),
        ]);
        if (!live || request !== generation) return;
        setData((current) => ({
          ...current,
          ...(remote && Date.parse(remote.updatedAt) > Date.parse(current.updatedAt) ? {
            settings: { ...current.settings, ...remote.settings },
            tasks: remote.tasks, goals: remote.goals, smokeLogs: remote.smokeLogs,
            updatedAt: remote.updatedAt,
          } : {}),
          profile: profile ? { id: profile.id, name: profile.name, handle: profile.handle, friendCode: profile.friendCode, email: user.email } : current.profile,
          friends: friends.map((friend) => ({
            id: friend.id, name: friend.name, handle: friend.handle, code: friend.friendCode,
            status: 'accepted' as const, tasksDoneToday: friend.tasksDone,
            cigarettesToday: friend.cigarettes, streak: 0,
          })),
          auth: { status: 'signedIn', email: user.email },
          error: null,
        }));
        setCloudReadyUserId(user.id);
      } catch (error) {
        if (live && request === generation) setData((current) => ({ ...current, auth: { status: 'signedIn', email: user.email }, error: errorMessage(error) }));
      }
    };
    supabase.auth.getUser().then(({ data: result }) => loadUser(result.user)).catch((error) => {
      if (live) setData((current) => ({ ...current, auth: { status: 'guest' }, error: errorMessage(error) }));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // A zero-delay task avoids making Supabase calls inside its auth callback.
      setTimeout(() => { void loadUser(session?.user ?? null); }, 0);
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, [ready]);

  useEffect(() => {
    if (!ready || !cloudReadyUserId || data.auth.status !== 'signedIn' || data.profile.id !== cloudReadyUserId) return;
    const state = { settings: data.settings, tasks: data.tasks, goals: data.goals, smokeLogs: data.smokeLogs, updatedAt: data.updatedAt };
    const timer = setTimeout(() => {
      void saveCloudState(cloudReadyUserId, state).catch((error) => {
        setData((current) => ({ ...current, error: errorMessage(error) }));
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, cloudReadyUserId, data.auth.status, data.profile.id, data.settings, data.tasks, data.goals, data.smokeLogs, data.updatedAt]);

  useEffect(() => {
    if (!ready || !cloudReadyUserId || data.auth.status !== 'signedIn') return;
    let live = true;
    const refreshFromCloud = () => {
      void getCloudState(cloudReadyUserId).then((remote) => {
        if (!live || !remote) return;
        setData((current) => {
          if (current.auth.status !== 'signedIn' || current.profile.id !== cloudReadyUserId ||
              Date.parse(remote.updatedAt) <= Date.parse(current.updatedAt)) return current;
          return recalc({
            ...current,
            settings: { ...current.settings, ...remote.settings },
            tasks: remote.tasks,
            goals: remote.goals,
            smokeLogs: remote.smokeLogs,
            updatedAt: remote.updatedAt,
            error: null,
          });
        });
      }).catch((error) => {
        if (live) setData((current) => ({ ...current, error: errorMessage(error) }));
      });
    };
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshFromCloud();
    });
    return () => { live = false; listener.remove(); };
  }, [ready, cloudReadyUserId, data.auth.status]);

  useEffect(() => {
    if (!ready || data.auth.status !== 'signedIn' || !data.profile.id) return;
    const date = localDate();
    const todaysTasks = data.tasks.filter((task) => task.dueDate === date);
    const activity = {
      cigarettes: data.smokeLogs.filter((log) => log.kind === 'cigarette' && localDate(new Date(log.createdAt)) === date).length,
      tasksDone: todaysTasks.filter((task) => Boolean(task.completedAt)).length,
      tasksTotal: todaysTasks.length,
      points: todaysTasks.filter((task) => Boolean(task.completedAt)).reduce((sum, task) => sum + task.points, 0),
    };
    const timer = setTimeout(() => {
      void publishCloudActivity(data.profile.id!, date, activity).catch((error) => {
        setData((current) => ({ ...current, error: errorMessage(error) }));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, data.auth.status, data.profile.id, data.tasks, data.smokeLogs]);

  function update(change: (current: AppData) => AppData) {
    setData((current) => recalc({ ...change(current), updatedAt: new Date().toISOString(), error: null }));
  }

  const actions: AppActions = {
    addTask(input) {
      const title = input.title.trim();
      if (!title || !validDate(input.dueDate)) return;
      const task: Task = {
        id: uid(), title, dueDate: input.dueDate,
        points: Math.max(1, Math.round(input.points)), category: input.category,
        createdAt: new Date().toISOString(), completedAt: null,
      };
      update((current) => ({ ...current, tasks: [...current.tasks, task] }));
    },
    toggleTask(id) {
      update((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id
        ? { ...task, completedAt: task.completedAt ? null : new Date().toISOString() } : task) }));
    },
    deleteTask(id) {
      update((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
    },
    addGoal(input) {
      const title = input.title.trim();
      if (!title) return;
      const goal: Goal = {
        id: uid(), title, target: Math.max(1, Math.round(input.target)), progress: 0,
        unit: input.unit.trim() || 'times', dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
      };
      update((current) => ({ ...current, goals: [...current.goals, goal] }));
    },
    incrementGoal(id, amount = 1) {
      update((current) => ({ ...current, goals: current.goals.map((goal) => goal.id === id
        ? { ...goal, progress: Math.max(0, Math.min(goal.target, goal.progress + amount)) } : goal) }));
    },
    deleteGoal(id) {
      update((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
    },
    logSmoke(kind: SmokeKind, bypass = false, mood) {
      const today = localDate();
      const count = data.smokeLogs.filter((log) => log.kind === kind && localDate(new Date(log.createdAt)) === today).length;
      const isWeekend = [0, 6].includes(new Date().getDay());
      const cost = kind === 'cigarette' ? data.settings.cigCost : data.settings.weedCost;
      let message: string | null = null;
      if (kind === 'weed' && !data.settings.weedEnabled) message = 'Switch on the green zone in Settings first.';
      else if (!bypass && kind === 'weed' && data.settings.weedWeekendOnly && !isWeekend) message = 'The green zone opens on weekends. You can take a no-guilt break anytime.';
      else if (!bypass && kind === 'cigarette' && count >= data.settings.dailyMax) message = 'You reached your daily max. Take a no-guilt break if you choose.';
      else if (!bypass && data.points[kind] < cost) message = `You need ${cost - data.points[kind]} more points for this one.`;
      if (message) {
        setData((current) => ({ ...current, error: message }));
        throw new Error(message);
      }
      const log: SmokeLog = {
        id: uid(), kind, createdAt: new Date().toISOString(),
        spentPoints: bypass ? 0 : cost, bypassed: bypass, mood: mood?.trim() || null,
      };
      update((current) => ({ ...current, smokeLogs: [...current.smokeLogs, log] }));
    },
    setMode(kind) { update((current) => ({ ...current, settings: { ...current.settings, mode: kind } })); },
    setDailyMax(max) { update((current) => ({ ...current, settings: { ...current.settings, dailyMax: Math.min(20, Math.max(1, Math.round(max))) } })); },
    setWeedEnabled(enabled) { update((current) => ({ ...current, settings: { ...current.settings, weedEnabled: enabled, mode: !enabled && current.settings.mode === 'weed' ? 'cigarette' : current.settings.mode } })); },
    setWeedWeekendOnly(enabled) { update((current) => ({ ...current, settings: { ...current.settings, weedWeekendOnly: enabled } })); },
    async updateProfile(input) {
      if (data.profile.id && cloudEnabled) {
        try { await updateCloudProfile(data.profile.id, input); }
        catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); throw error; }
      }
      update((current) => ({ ...current, profile: {
        ...current.profile,
        name: input.name?.trim() || current.profile.name,
        handle: input.handle?.trim().replace(/^@/, '').toLowerCase() || current.profile.handle,
      } }));
    },
    async addFriendByCode(code) {
      try {
        if (data.auth.status !== 'signedIn') throw new Error('Sign in to add global friends.');
        await addCloudFriend(code);
        const friends = await getCloudFriends(data.profile.id!, localDate());
        setData((current) => ({ ...current, friends: friends.map((friend) => ({
          id: friend.id, name: friend.name, handle: friend.handle, code: friend.friendCode,
          status: 'accepted' as const, tasksDoneToday: friend.tasksDone,
          cigarettesToday: friend.cigarettes, streak: 0,
        })), error: null }));
      } catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); throw error; }
    },
    acceptFriend() { /* Codes create mutual friendships immediately. */ },
    async removeFriend(id) {
      try {
        if (!data.profile.id) throw new Error('Sign in to manage friends.');
        await removeCloudFriend(id, data.profile.id);
        setData((current) => ({ ...current, friends: current.friends.filter((friend) => friend.id !== id), error: null }));
      } catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); }
    },
    async refreshFriends() {
      try {
        if (!data.profile.id) return;
        setData((current) => ({ ...current, syncing: true }));
        const friends = await getCloudFriends(data.profile.id, localDate());
        setData((current) => ({ ...current, syncing: false, friends: friends.map((friend) => ({
          id: friend.id, name: friend.name, handle: friend.handle, code: friend.friendCode,
          status: 'accepted' as const, tasksDoneToday: friend.tasksDone,
          cigarettesToday: friend.cigarettes, streak: 0,
        })), error: null }));
      } catch (error) { setData((current) => ({ ...current, syncing: false, error: errorMessage(error) })); }
    },
    async signIn(email, password) {
      if (!supabase) return { error: 'Global friends need Supabase configuration.' };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: error.message } : undefined;
    },
    async signUp(email, password) {
      if (!supabase) return { error: 'Global friends need Supabase configuration.' };
      const { error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { name: data.profile.name === 'You' ? undefined : data.profile.name } },
      });
      return error ? { error: error.message } : undefined;
    },
    async signInWithGoogle() {
      try { const signedIn = await signInWithGoogleAuth(); return signedIn ? undefined : { cancelled: true }; }
      catch (error) { return { error: errorMessage(error) }; }
    },
    async signOut() {
      if (supabase && data.profile.id && cloudReadyUserId === data.profile.id) {
        await saveCloudState(data.profile.id, { settings: data.settings, tasks: data.tasks, goals: data.goals, smokeLogs: data.smokeLogs, updatedAt: data.updatedAt });
      }
      if (supabase) await supabase.auth.signOut();
      setCloudReadyUserId(null);
      setData({ ...initialData(), auth: { status: 'guest' } });
    },
  };

  return { data, actions };
}
