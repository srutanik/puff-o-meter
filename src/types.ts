export type SmokeKind = 'cigarette' | 'weed';
export type Screen = 'home' | 'planner' | 'goals' | 'friends' | 'settings';

export interface Task {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD in the device's local time
  points: number;
  category?: string;
  completedAt?: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  progress: number;
  unit: string;
  dueDate?: string | null;
  createdAt: string;
}

export interface SmokeLog {
  id: string;
  kind: SmokeKind;
  createdAt: string;
  spentPoints: number;
  bypassed: boolean;
  mood?: string | null;
}

export interface Friend {
  id: string;
  name: string;
  handle: string;
  code: string;
  status: 'accepted' | 'incoming' | 'outgoing';
  tasksDoneToday: number;
  cigarettesToday: number;
  streak: number;
}

export interface Profile {
  id?: string;
  name: string;
  handle: string;
  friendCode: string;
  email?: string | null;
}

export interface Settings {
  mode: SmokeKind;
  dailyMax: number;
  weedEnabled: boolean;
  weedWeekendOnly: boolean;
  cigCost: number;
  weedCost: number;
}

export interface AppData {
  updatedAt: string;
  profile: Profile;
  settings: Settings;
  tasks: Task[];
  goals: Goal[];
  friends: Friend[];
  smokeLogs: SmokeLog[];
  points: { cigarette: number; weed: number };
  auth: { status: 'loading' | 'guest' | 'signedIn'; email?: string | null };
  syncing?: boolean;
  error?: string | null;
}

export type AsyncAction = void | Promise<void>;

export interface AppActions {
  addTask: (input: { title: string; dueDate: string; points: number; category?: string }) => AsyncAction;
  toggleTask: (id: string) => AsyncAction;
  deleteTask: (id: string) => AsyncAction;
  addGoal: (input: { title: string; target: number; unit: string; dueDate?: string | null }) => AsyncAction;
  incrementGoal: (id: string, amount?: number) => AsyncAction;
  deleteGoal: (id: string) => AsyncAction;
  logSmoke: (kind: SmokeKind, bypass?: boolean, mood?: string) => AsyncAction;
  setMode: (kind: SmokeKind) => AsyncAction;
  setDailyMax: (max: number) => AsyncAction;
  setWeedEnabled: (enabled: boolean) => AsyncAction;
  setWeedWeekendOnly: (enabled: boolean) => AsyncAction;
  updateProfile: (input: { name?: string; handle?: string }) => AsyncAction;
  addFriendByCode: (code: string) => AsyncAction;
  acceptFriend: (id: string) => AsyncAction;
  removeFriend: (id: string) => AsyncAction;
  refreshFriends: () => AsyncAction;
  signIn: (email: string, password: string) => Promise<{ error?: string } | void>;
  signUp: (email: string, password: string) => Promise<{ error?: string } | void>;
  signInWithGoogle: () => Promise<{ error?: string; cancelled?: boolean } | void>;
  signOut: () => AsyncAction;
}
