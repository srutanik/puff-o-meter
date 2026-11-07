import React, { useState } from 'react';
import {
  Alert, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { BurstBadge, CigaretteArt, WeedLeafArt } from '../components/Art';
import { StickerIcon, type PopGlyphName } from '../components/PopArt';
import { PosterHero } from '../components/PosterHero';
import { MusicBar } from '../components/MusicBar';
import { cloudEnabled } from '../lib/supabase';
import { font, modeColors, palette } from '../theme';
import type { AppActions, AppData, Friend, Goal, Screen, SmokeKind, Task } from '../types';

type Props = { data: AppData; actions: AppActions };
type ModalName = 'task' | 'goal' | 'smoke' | 'friend' | 'auth' | 'profile' | null;

const tabs: { id: Screen; icon: PopGlyphName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'HOME' },
  { id: 'planner', icon: 'plan', label: 'PLAN' },
  { id: 'goals', icon: 'goals', label: 'GOALS' },
  { id: 'friends', icon: 'crew', label: 'CREW' },
  { id: 'settings', icon: 'settings', label: 'SETUP' },
];

function dateKey(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string) {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

function fullDate(key: string) {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function isToday(iso: string) {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === dateKey();
}

function cap(value: number, max: number) { return Math.min(Math.max(value, 0), max); }

function ActionButton({ label, onPress, icon, dark = false, disabled = false, style }: {
  label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap;
  dark?: boolean; disabled?: boolean; style?: any;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      styles.actionButton, dark && styles.actionButtonDark, disabled && { opacity: 0.45 },
      pressed && { transform: [{ scale: 0.985 }] }, style,
    ]}>
      <Text style={[styles.actionButtonText, dark && { color: palette.white }]}>{label}</Text>
      {icon && <Ionicons name={icon} size={18} color={dark ? palette.white : palette.ink} />}
    </Pressable>
  );
}

function SmallLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <Text style={[styles.micro, light && { color: '#FFF7E3' }]}>{children}</Text>;
}

function SectionTitle({ eyebrow, title, right, onRight }: {
  eyebrow?: string; title: string; right?: string; onRight?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View>{eyebrow && <SmallLabel>{eyebrow}</SmallLabel>}<Text style={styles.sectionTitleText}>{title}</Text></View>
      {right && <Pressable onPress={onRight} style={styles.sectionLink}><Text style={styles.sectionLinkText}>{right}</Text><Ionicons name="arrow-forward" size={15} color={palette.ink} /></Pressable>}
    </View>
  );
}

function TaskRow({ task, onToggle, onDelete, compact = false }: {
  task: Task; onToggle: () => void; onDelete?: () => void; compact?: boolean;
}) {
  const done = !!task.completedAt;
  return (
    <View style={[styles.taskRow, compact && { paddingVertical: 11 }]}>
      <Pressable onPress={onToggle} accessibilityLabel={done ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} style={[styles.checkBox, done && styles.checkBoxDone]}>
        {done && <Ionicons name="checkmark" size={17} color={palette.white} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, done && styles.taskDone]} numberOfLines={2}>{task.title}</Text>
        <Text style={styles.taskMeta}>{task.category || 'YOUR TASK'} · +{task.points} PTS</Text>
      </View>
      {onDelete ? <Pressable onPress={onDelete} hitSlop={10}><Ionicons name="close" size={18} color={palette.muted} /></Pressable> : <Ionicons name="arrow-forward" size={16} color={palette.muted} />}
    </View>
  );
}

function EmptyCard({ icon, title, caption, action, onAction }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; caption: string; action?: string; onAction?: () => void;
}) {
  const glyph: PopGlyphName = icon.includes('calendar') ? 'plan' : icon.includes('people') ? 'crew' : 'goals';
  return (
    <View style={styles.emptyCard}>
      <StickerIcon name={glyph} size={62} background={glyph === 'crew' ? palette.mint : palette.yellowLight} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCaption}>{caption}</Text>
      {action && onAction && <Pressable style={styles.miniButton} onPress={onAction}><Text style={styles.miniButtonText}>{action}</Text><Ionicons name="arrow-forward" size={14} color={palette.ink} /></Pressable>}
    </View>
  );
}

export function AppShell({ data, actions }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [modal, setModal] = useState<ModalName>(null);
  const [planDate, setPlanDate] = useState(dateKey(1));
  const [currentDay, setCurrentDay] = useState(dateKey());
  const insets = useSafeAreaInsets();
  const mode = data.settings.mode;
  const colors = modeColors(mode);

  React.useEffect(() => {
    const tick = () => setCurrentDay(dateKey());
    const timer = setInterval(tick, 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const todayTasks = data.tasks.filter(t => t.dueDate === currentDay);
  const doneCount = todayTasks.filter(t => !!t.completedAt).length;
  const todayCigs = data.smokeLogs.filter(l => l.kind === 'cigarette' && isToday(l.createdAt)).length;
  const todayWeed = data.smokeLogs.filter(l => l.kind === 'weed' && isToday(l.createdAt)).length;
  const todayCount = mode === 'weed' ? todayWeed : todayCigs;
  const earnedToday = data.smokeLogs.filter(l => l.kind === mode && !l.bypassed && isToday(l.createdAt)).length;
  const cost = mode === 'weed' ? data.settings.weedCost : data.settings.cigCost;
  const balance = data.points[mode];
  const isWeekend = [0, 6].includes(new Date().getDay());
  const weedLocked = mode === 'weed' && data.settings.weedWeekendOnly && !isWeekend;
  const capReached = mode === 'cigarette' && todayCigs >= data.settings.dailyMax;

  function selectMode(kind: SmokeKind) {
    if (kind === 'weed' && !data.settings.weedEnabled) {
      setScreen('settings');
      return;
    }
    actions.setMode(kind);
    void Haptics.selectionAsync();
  }

  function openTask(date?: string) { if (date) setPlanDate(date); setModal('task'); }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: mode === 'weed' ? palette.mintLight : palette.paper }]} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <Pressable onPress={() => setScreen('home')} style={styles.wordmarkWrap}>
          <View style={styles.wordmarkBolt}><StickerIcon name="meter" size={27} background={colors.light} accent={colors.accent} tilt={-9} /></View>
          <Text style={styles.wordmark}>PUFF-O-<Text style={{ color: colors.accent }}>METER</Text><Text style={styles.wordmarkDot}>.</Text></Text>
        </Pressable>
        <Pressable onPress={() => setScreen('settings')} style={styles.avatar}>
          <Text style={styles.avatarText}>{data.profile.name.trim().charAt(0).toUpperCase() || 'P'}</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {screen === 'home' && <HomeScreen data={data} actions={actions} todayTasks={todayTasks} doneCount={doneCount} todayCount={todayCount} earnedToday={earnedToday} balance={balance} cost={cost} capReached={capReached} weedLocked={weedLocked} selectMode={selectMode} onSmoke={() => setModal('smoke')} onAddTask={() => openTask(dateKey())} onPlan={() => { setPlanDate(dateKey(1)); setScreen('planner'); }} onFriends={() => setScreen('friends')} />}
        {screen === 'planner' && <PlannerScreen data={data} actions={actions} selectedDate={planDate} setSelectedDate={setPlanDate} onAdd={() => openTask(planDate)} />}
        {screen === 'goals' && <GoalsScreen data={data} actions={actions} onAdd={() => setModal('goal')} />}
        {screen === 'friends' && <FriendsScreen data={data} actions={actions} onAdd={() => setModal(data.auth.status === 'signedIn' ? 'friend' : 'auth')} onAuth={() => setModal('auth')} />}
        {screen === 'settings' && <SettingsScreen data={data} actions={actions} onProfile={() => setModal('profile')} onAuth={() => setModal('auth')} selectMode={selectMode} />}
      </View>

      <MusicBar mode={mode} recentMood={data.smokeLogs[data.smokeLogs.length - 1]?.mood || null} />
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) + 3 }]}>
        {tabs.map(tab => {
          const active = screen === tab.id;
          return <Pressable key={tab.id} onPress={() => { setScreen(tab.id); void Haptics.selectionAsync(); }} style={styles.tab} accessibilityLabel={tab.label}>
            <StickerIcon name={tab.icon} size={active ? 43 : 37} background={active ? colors.light : palette.white} color={active ? colors.dark : palette.muted} accent={colors.accent} tilt={active ? -8 : 0} />
            <Text style={[styles.tabText, active && { color: palette.ink }]}>{tab.label}</Text>
          </Pressable>;
        })}
      </View>

      <TaskModal visible={modal === 'task'} onClose={() => setModal(null)} selectedDate={planDate} actions={actions} mode={mode} />
      <GoalModal visible={modal === 'goal'} onClose={() => setModal(null)} actions={actions} mode={mode} />
      <SmokeModal visible={modal === 'smoke'} onClose={() => setModal(null)} actions={actions} mode={mode} balance={balance} cost={cost} capReached={capReached} weedLocked={weedLocked} todayCount={todayCount} dailyMax={data.settings.dailyMax} />
      <FriendModal visible={modal === 'friend'} onClose={() => setModal(null)} actions={actions} mode={mode} />
      <AuthModal visible={modal === 'auth'} onClose={() => setModal(null)} actions={actions} mode={mode} />
      <ProfileModal visible={modal === 'profile'} onClose={() => setModal(null)} actions={actions} mode={mode} profile={data.profile} />
    </SafeAreaView>
  );
}

function HomeScreen({ data, actions, todayTasks, doneCount, todayCount, earnedToday, balance, cost, capReached, weedLocked, selectMode, onSmoke, onAddTask, onPlan, onFriends }: {
  data: AppData; actions: AppActions; todayTasks: Task[]; doneCount: number; todayCount: number; earnedToday: number; balance: number; cost: number;
  capReached: boolean; weedLocked: boolean; selectMode: (kind: SmokeKind) => void; onSmoke: () => void; onAddTask: () => void; onPlan: () => void; onFriends: () => void;
}) {
  const mode = data.settings.mode;
  const colors = modeColors(mode);
  const firstName = data.profile.name.trim().split(' ')[0] || 'you';
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
    <View style={styles.helloRow}><View><SmallLabel>{fullDate(dateKey()).toUpperCase()}</SmallLabel><Text style={styles.helloTitle}>HEY, {firstName.toUpperCase()}<Text style={{ color: colors.accent }}>!</Text></Text></View><BurstBadge label="DO YOUR THING" mode={mode === 'weed' ? 'weed' : 'cig'} size={62} /></View>

    <View style={[styles.modeToggle, { borderColor: colors.dark }]}>
      <Pressable onPress={() => selectMode('cigarette')} style={[styles.modeOption, mode === 'cigarette' && { backgroundColor: palette.yellow }]}><CigaretteArt size={28} angle={0} /><Text style={styles.modeText}>CIGS</Text></Pressable>
      <Pressable onPress={() => selectMode('weed')} style={[styles.modeOption, mode === 'weed' && { backgroundColor: palette.mint }]}><Ionicons name="leaf" size={17} color={palette.oliveDark} /><Text style={styles.modeText}>WEED</Text>{!data.settings.weedEnabled && <Ionicons name="lock-closed" size={11} color={palette.muted} />}</Pressable>
    </View>

    <PosterHero mode={mode} points={balance} cost={cost} todayCount={todayCount} earnedToday={earnedToday} dailyMax={data.settings.dailyMax} locked={weedLocked} onBreak={onSmoke} />

    <View style={styles.breathingStrip}><StickerIcon name="heart" size={39} background={colors.light} accent={colors.accent} /><Text style={styles.breathingText}>YOUR PACE. YOUR CALL. <Text style={{ color: colors.accent }}>NO GUILT.</Text></Text></View>

    <SectionTitle eyebrow="SHOW UP, GET POINTS" title="TODAY’S MOVES" right="SEE PLAN" onRight={onPlan} />
    <View style={styles.taskBoard}><View style={styles.taskBoardHeader}><StickerIcon name="check" size={39} background={colors.light} accent={colors.accent} /><Text style={styles.taskBoardCount}>{doneCount} <Text style={{ color: palette.muted }}>/ {todayTasks.length}</Text></Text><Text style={styles.taskBoardCaption}>DONE TODAY</Text><View style={{ flex: 1 }} /><View style={[styles.boardProgress, { backgroundColor: colors.light }]}><Text style={styles.boardProgressText}>{todayTasks.length ? Math.round(doneCount / todayTasks.length * 100) : 0}%</Text></View></View>
      {todayTasks.length ? todayTasks.map(task => <TaskRow key={task.id} task={task} onToggle={() => { actions.toggleTask(task.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} />) : <View style={{ paddingVertical: 23, alignItems: 'center' }}><Text style={styles.emptyInline}>No moves on the board yet.</Text><Text style={styles.emptyInlineSub}>Add one, then earn that first break.</Text></View>}
      <Pressable onPress={onAddTask} style={styles.addInline}><Ionicons name="add-circle" size={21} color={colors.accent} /><Text style={[styles.addInlineText, { color: colors.accent }]}>ADD A MOVE</Text></Pressable>
    </View>

    <Pressable onPress={onPlan} style={[styles.tomorrowCard, { backgroundColor: colors.light }]}><View style={{ flex: 1 }}><SmallLabel>TONIGHT’S LITTLE PLAN</SmallLabel><Text style={styles.tomorrowTitle}>SET UP TOMORROW.</Text><Text style={styles.tomorrowCaption}>Future you can thank present you.</Text></View><StickerIcon name="plan" size={55} background={palette.white} accent={colors.accent} tilt={9} /></Pressable>
    <Pressable onPress={onFriends} style={styles.crewTeaser}><StickerIcon name="crew" size={45} background={palette.yellowLight} /><View style={{ flex: 1 }}><Text style={styles.crewTitle}>BETTER WITH YOUR CREW</Text><Text style={styles.crewCaption}>Tasks vs cigs. A little friendly accountability.</Text></View><Ionicons name="chevron-forward" size={18} color={palette.ink} /></Pressable>
    <Text style={styles.footerNote}>A break is yours to choose. Every task is a little win.</Text>
  </ScrollView>;
}

function PlannerScreen({ data, actions, selectedDate, setSelectedDate, onAdd }: { data: AppData; actions: AppActions; selectedDate: string; setSelectedDate: (date: string) => void; onAdd: () => void }) {
  const days = Array.from({ length: 8 }, (_, i) => dateKey(i));
  const tasks = data.tasks.filter(t => t.dueDate === selectedDate).sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt));
  const colors = modeColors(data.settings.mode);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
    <SmallLabel>PUT THE GOOD STUFF ON THE CALENDAR</SmallLabel><Text style={styles.pageTitle}>MAKE A <Text style={{ color: colors.accent }}>PLAN.</Text></Text><Text style={styles.pageSubtitle}>Tomorrow starts tonight. Or map out the whole week.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller} contentContainerStyle={{ paddingRight: 14 }}>
      {days.map((date, i) => { const selected = selectedDate === date; const count = data.tasks.filter(t => t.dueDate === date).length; return <Pressable key={date} onPress={() => setSelectedDate(date)} style={[styles.dayChip, selected && { backgroundColor: colors.dark, borderColor: colors.dark }]}><Text style={[styles.dayChipName, selected && { color: palette.white }]}>{i === 0 ? 'TODAY' : i === 1 ? 'TMRW' : dayLabel(date)}</Text><Text style={[styles.dayChipNumber, selected && { color: palette.white }]}>{Number(date.slice(-2))}</Text><View style={[styles.dayDot, { backgroundColor: count ? (selected ? colors.light : colors.accent) : 'transparent' }]} /></Pressable>; })}
    </ScrollView>
    <View style={styles.planHeader}><View><SmallLabel>{selectedDate === dateKey(1) ? 'THE NIGHT BEFORE' : 'YOUR SCHEDULE'}</SmallLabel><Text style={styles.planDate}>{fullDate(selectedDate)}</Text></View><View style={[styles.planCount, { backgroundColor: colors.light }]}><Text style={styles.planCountText}>{tasks.length} {tasks.length === 1 ? 'MOVE' : 'MOVES'}</Text></View></View>
    {tasks.length ? <View style={styles.listCard}>{tasks.map(task => <TaskRow key={task.id} task={task} onToggle={() => { actions.toggleTask(task.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} onDelete={() => Alert.alert('Delete this move?', task.title, [{ text: 'Keep it' }, { text: 'Delete', style: 'destructive', onPress: () => actions.deleteTask(task.id) }])} />)}</View> : <EmptyCard icon="calendar-outline" title="THE DAY IS YOURS." caption="Put a few moves on the board. Big or tiny, they all count." />}
    <ActionButton label="ADD A MOVE" icon="add" onPress={onAdd} dark style={{ marginTop: 17 }} />
    <View style={styles.howCard}><StickerIcon name="spark" size={45} background={colors.light} accent={colors.accent} /><View style={{ flex: 1 }}><Text style={styles.howTitle}>HOW POINTS WORK</Text><Text style={styles.howText}>Finish a task, fill your meter. Give the big tasks more points. Your rewards can wait until you’re ready.</Text></View></View>
  </ScrollView>;
}

function GoalsScreen({ data, actions, onAdd }: { data: AppData; actions: AppActions; onAdd: () => void }) {
  const colors = modeColors(data.settings.mode);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
    <SmallLabel>THE BIG PICTURE</SmallLabel><Text style={styles.pageTitle}>CHASE <Text style={{ color: colors.accent }}>SOMETHING.</Text></Text><Text style={styles.pageSubtitle}>A little progress still counts as progress.</Text>
    <View style={[styles.goalsBanner, { backgroundColor: colors.light }]}><View style={{ flex: 1 }}><SmallLabel>KEEP YOUR EYES ON IT</SmallLabel><Text style={styles.goalsBannerTitle}>{data.goals.length ? `${data.goals.filter(g => g.progress >= g.target).length}/${data.goals.length} GOALS HIT` : 'START SOMEWHERE.'}</Text><Text style={styles.goalsBannerCaption}>One tap closer, every time.</Text></View><StickerIcon name="goals" size={65} background={palette.white} accent={colors.accent} tilt={9} /></View>
    <SectionTitle title="YOUR GOALS" eyebrow="LONG GAME, SHORT STEPS" right="NEW GOAL" onRight={onAdd} />
    {data.goals.length ? data.goals.map(goal => <GoalCard key={goal.id} goal={goal} actions={actions} accent={colors.accent} light={colors.light} />) : <EmptyCard icon="flag-outline" title="NO GOALS YET." caption="Pick something you care about and give it a target." action="SET A GOAL" onAction={onAdd} />}
    <ActionButton label="MAKE A NEW GOAL" icon="add" onPress={onAdd} dark style={{ marginTop: 17 }} />
  </ScrollView>;
}

function GoalCard({ goal, actions, accent, light }: { goal: Goal; actions: AppActions; accent: string; light: string }) {
  const pct = cap(goal.progress / Math.max(goal.target, 1), 1);
  return <View style={styles.goalCard}><View style={styles.goalCardTop}><StickerIcon name={pct >= 1 ? 'check' : 'goals'} size={46} background={light} accent={accent} /><View style={{ flex: 1 }}><SmallLabel>{pct >= 1 ? 'YOU DID IT' : goal.dueDate ? `BY ${fullDate(goal.dueDate).toUpperCase()}` : 'KEEP GOING'}</SmallLabel><Text style={styles.goalTitle}>{goal.title}</Text></View><Pressable hitSlop={10} onPress={() => Alert.alert('Delete this goal?', goal.title, [{ text: 'Keep it' }, { text: 'Delete', style: 'destructive', onPress: () => actions.deleteGoal(goal.id) }])}><Ionicons name="ellipsis-horizontal" size={21} color={palette.muted} /></Pressable></View><View style={styles.goalProgressTrack}><View style={[styles.goalProgressFill, { width: `${pct * 100}%`, backgroundColor: accent }]} /></View><View style={styles.goalCardBottom}><Text style={styles.goalNumeral}>{goal.progress}<Text style={{ color: palette.muted }}> / {goal.target} {goal.unit}</Text></Text><Pressable disabled={pct >= 1} onPress={() => { actions.incrementGoal(goal.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={[styles.goalPlus, { backgroundColor: pct >= 1 ? palette.line : light }]}><Ionicons name={pct >= 1 ? 'checkmark' : 'add'} size={20} color={palette.ink} /></Pressable></View></View>;
}

function FriendsScreen({ data, actions, onAdd, onAuth }: { data: AppData; actions: AppActions; onAdd: () => void; onAuth: () => void }) {
  const colors = modeColors(data.settings.mode);
  const accepted = data.friends.filter(f => f.status === 'accepted');
  const incoming = data.friends.filter(f => f.status === 'incoming');
  const outgoing = data.friends.filter(f => f.status === 'outgoing');
  const myTasks = data.tasks.filter(t => t.dueDate === dateKey() && t.completedAt).length;
  const myCigs = data.smokeLogs.filter(l => l.kind === 'cigarette' && isToday(l.createdAt)).length;
  const scoreRow = <View style={styles.scoreRow}><View style={styles.scoreHalf}><Text style={styles.scoreNumber}>{myTasks}</Text><Text style={styles.scoreCaption}>TASKS DONE</Text></View><View style={styles.scoreDivider} /><View style={styles.scoreHalf}><Text style={styles.scoreNumber}>{myCigs}</Text><Text style={styles.scoreCaption}>CIGS TODAY</Text></View></View>;
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
    <SmallLabel>YOUR PEOPLE, EVERYWHERE</SmallLabel><Text style={styles.pageTitle}>THE <Text style={{ color: colors.accent }}>CREW.</Text></Text><Text style={styles.pageSubtitle}>A bit of accountability. A lot of cheering each other on.</Text>
    {data.auth.status !== 'signedIn' ? <><View style={[styles.authBanner, { backgroundColor: colors.light }]}><StickerIcon name="crew" size={66} background={palette.white} accent={colors.accent} tilt={-10} /><Text style={styles.authBannerTitle}>{cloudEnabled ? 'TAKE IT GLOBAL.' : 'CREW IS OFFLINE.'}</Text><Text style={styles.authBannerText}>{cloudEnabled ? 'Sign in to sync your plans and add friends by code.' : 'Friend codes will be available when cloud sync is connected. Your own tracking works right now.'}</Text>{cloudEnabled && <ActionButton label="SIGN IN / CREATE ACCOUNT" icon="arrow-forward" dark onPress={onAuth} />}</View>{scoreRow}{!cloudEnabled && <ActionButton label="SHARE TODAY’S SCORE" icon="share-outline" dark onPress={() => { void Share.share({ message: `My Puff-o-meter score today: ${myTasks} tasks done, ${myCigs} cigs. Your turn?` }); }} style={{ marginTop: 14 }} />}</> : <>
      <View style={[styles.inviteCard, { backgroundColor: colors.dark }]}><SmallLabel light>YOUR FRIEND CODE</SmallLabel><Text style={styles.inviteCode}>{data.profile.friendCode || 'COMING SOON'}</Text><Text style={styles.inviteCaption}>Send this to a friend, anywhere.</Text><View style={{ flexDirection: 'row', gap: 10, marginTop: 17 }}><Pressable onPress={async () => Share.share({ message: `Add me on Puff-o-meter! My friend code is ${data.profile.friendCode}` })} style={styles.inviteShare}><Ionicons name="share-outline" size={17} color={palette.ink} /><Text style={styles.inviteShareText}>SHARE CODE</Text></Pressable><Pressable onPress={onAdd} style={[styles.inviteShare, { backgroundColor: colors.light }]}><Ionicons name="person-add" size={17} color={palette.ink} /><Text style={styles.inviteShareText}>ADD FRIEND</Text></Pressable></View></View>
      {scoreRow}
      {incoming.length > 0 && <><SectionTitle eyebrow="SAY HEY" title="REQUESTS" /><View style={styles.listCard}>{incoming.map(friend => <FriendRow key={friend.id} friend={friend} actions={actions} incoming />)}</View></>}
      <SectionTitle eyebrow="TASKS VS CIGS" title="YOUR PEOPLE" right="REFRESH" onRight={() => actions.refreshFriends()} />
      {accepted.length ? <View style={styles.listCard}>{accepted.map(friend => <FriendRow key={friend.id} friend={friend} actions={actions} />)}</View> : <EmptyCard icon="people-outline" title="BRING A FRIEND." caption="Invite someone to keep the vibes and the wins going." action="ADD A FRIEND" onAction={onAdd} />}
      {outgoing.length > 0 && <><SectionTitle title="PENDING INVITES" /><View style={styles.listCard}>{outgoing.map(friend => <FriendRow key={friend.id} friend={friend} actions={actions} />)}</View></>}
    </>}
  </ScrollView>;
}

function FriendRow({ friend, actions, incoming = false }: { friend: Friend; actions: AppActions; incoming?: boolean }) {
  return <View style={styles.friendRow}><View style={styles.friendAvatar}><Text style={styles.friendAvatarText}>{friend.name.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.friendName}>{friend.name}</Text><Text style={styles.friendHandle}>@{friend.handle} {friend.status === 'outgoing' ? '· INVITE SENT' : ''}</Text>{friend.status === 'accepted' && <View style={styles.friendStats}><Text style={styles.friendStat}>{friend.tasksDoneToday} tasks</Text><Text style={styles.friendStatDot}>·</Text><Text style={styles.friendStat}>{friend.cigarettesToday} cigs</Text></View>}</View>{incoming ? <Pressable onPress={() => actions.acceptFriend(friend.id)} style={styles.acceptButton}><Ionicons name="checkmark" size={19} color={palette.white} /></Pressable> : <Pressable hitSlop={8} onPress={() => Alert.alert('Remove friend?', friend.name, [{ text: 'Keep' }, { text: 'Remove', style: 'destructive', onPress: () => actions.removeFriend(friend.id) }])}><Ionicons name="ellipsis-horizontal" size={19} color={palette.muted} /></Pressable>}</View>;
}

function SettingsScreen({ data, actions, onProfile, onAuth, selectMode }: { data: AppData; actions: AppActions; onProfile: () => void; onAuth: () => void; selectMode: (kind: SmokeKind) => void }) {
  const colors = modeColors(data.settings.mode);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
    <SmallLabel>MAKE IT YOURS</SmallLabel><Text style={styles.pageTitle}>THE <Text style={{ color: colors.accent }}>SETUP.</Text></Text><Text style={styles.pageSubtitle}>A few knobs for your own pace.</Text>
    <Pressable onPress={onProfile} style={styles.profileCard}><View style={[styles.profileAvatar, { backgroundColor: colors.light }]}><Text style={styles.profileAvatarText}>{data.profile.name.charAt(0).toUpperCase() || 'P'}</Text></View><View style={{ flex: 1 }}><Text style={styles.profileName}>{data.profile.name}</Text><Text style={styles.profileHandle}>@{data.profile.handle}</Text></View><Ionicons name="create-outline" size={22} color={palette.ink} /></Pressable>
    <SectionTitle eyebrow="YOUR RULES" title="DAILY VIBE" />
    <View style={styles.settingsCard}><View style={styles.settingRow}><View style={{ flex: 1 }}><Text style={styles.settingTitle}>CIG MAX</Text><Text style={styles.settingHint}>A soft target. You can always go beyond it.</Text></View><View style={styles.stepper}><Pressable onPress={() => actions.setDailyMax(Math.max(1, data.settings.dailyMax - 1))} style={styles.stepperButton}><Ionicons name="remove" size={19} color={palette.ink} /></Pressable><Text style={styles.stepperValue}>{data.settings.dailyMax}</Text><Pressable onPress={() => actions.setDailyMax(Math.min(20, data.settings.dailyMax + 1))} style={styles.stepperButton}><Ionicons name="add" size={19} color={palette.ink} /></Pressable></View></View><View style={styles.settingDivider} /><View style={styles.settingRow}><View style={{ flex: 1 }}><Text style={styles.settingTitle}>CURRENT MODE</Text><Text style={styles.settingHint}>Switch between the two meters.</Text></View><Pressable onPress={() => selectMode(data.settings.mode === 'weed' ? 'cigarette' : 'weed')} style={[styles.settingPill, { backgroundColor: colors.light }]}><Text style={styles.settingPillText}>{data.settings.mode === 'weed' ? 'WEED' : 'CIGS'}</Text><Ionicons name="swap-horizontal" size={15} color={palette.ink} /></Pressable></View></View>
    <SectionTitle eyebrow="OPTIONAL · SLOWER TO EARN" title="DANGER ZONE" />
    <View style={[styles.dangerCard, { backgroundColor: palette.oliveDark }]}><View style={styles.dangerTop}><View style={{ flex: 1 }}><SmallLabel light>THE WEEKEND EDITION</SmallLabel><Text style={styles.dangerTitle}>SLOW BURN.</Text><Text style={styles.dangerCaption}>A separate meter for weed, with a much bigger points target.</Text></View><WeedLeafArt size={73} color={palette.mint} /></View><View style={styles.dangerRow}><View style={{ flex: 1 }}><Text style={styles.dangerSettingTitle}>ENABLE WEED MODE</Text><Text style={styles.dangerSettingHint}>Keep it as an optional space.</Text></View><Switch value={data.settings.weedEnabled} onValueChange={actions.setWeedEnabled} trackColor={{ false: '#7B806E', true: palette.mint }} thumbColor={palette.white} /></View><View style={styles.dangerDivider} /><View style={styles.dangerRow}><View style={{ flex: 1 }}><Text style={styles.dangerSettingTitle}>WEEKENDS ONLY</Text><Text style={styles.dangerSettingHint}>A little wait makes it sweeter.</Text></View><Switch value={data.settings.weedWeekendOnly} disabled={!data.settings.weedEnabled} onValueChange={actions.setWeedWeekendOnly} trackColor={{ false: '#7B806E', true: palette.mint }} thumbColor={palette.white} /></View></View>
    <View style={styles.musicCard}><StickerIcon name="music" size={44} background={palette.yellowLight} /><View style={{ flex: 1 }}><Text style={styles.musicTitle}>SOUNDTRACK YOUR BREAK</Text><Text style={styles.musicCaption}>Pick a mood in the Spotify music bar below.</Text></View><Text style={styles.soonPill}>LIVE</Text></View>
    <SectionTitle title="ACCOUNT" />
    <View style={styles.settingsCard}><Pressable disabled={!cloudEnabled} onPress={data.auth.status === 'signedIn' ? () => actions.signOut() : onAuth} style={styles.accountRow}><Ionicons name={!cloudEnabled ? 'globe-outline' : data.auth.status === 'signedIn' ? 'log-out-outline' : 'log-in-outline'} size={20} color={palette.ink} /><Text style={styles.accountText}>{!cloudEnabled ? 'GLOBAL FRIENDS NOT CONNECTED' : data.auth.status === 'signedIn' ? `SIGNED IN · ${data.auth.email || data.profile.email || ''}` : 'SIGN IN TO ADD GLOBAL FRIENDS'}</Text>{cloudEnabled && <Ionicons name="chevron-forward" size={18} color={palette.muted} />}</Pressable></View>
    <Text style={styles.footerNote}>No shame, no score to prove. Just your day, your choices.</Text>
  </ScrollView>;
}

function Sheet({ visible, onClose, title, eyebrow, children, mode }: { visible: boolean; onClose: () => void; title: string; eyebrow?: string; children: React.ReactNode; mode: SmokeKind }) {
  const colors = modeColors(mode);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetKeyboard}><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View style={{ flex: 1 }}>{eyebrow && <SmallLabel>{eyebrow}</SmallLabel>}<Text style={styles.sheetTitle}>{title}</Text></View><Pressable onPress={onClose} style={[styles.sheetClose, { backgroundColor: colors.light }]}><Ionicons name="close" size={21} color={palette.ink} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>{children}</ScrollView></View></KeyboardAvoidingView></View></Modal>;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'email-address' | 'number-pad'; autoCapitalize?: 'none' | 'sentences' | 'words'; secureTextEntry?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.field} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A7A094" keyboardType={keyboardType} autoCapitalize={autoCapitalize} secureTextEntry={secureTextEntry} returnKeyType="done" /></View>;
}

function TaskModal({ visible, onClose, selectedDate, actions, mode }: { visible: boolean; onClose: () => void; selectedDate: string; actions: AppActions; mode: SmokeKind }) {
  const [title, setTitle] = useState(''); const [points, setPoints] = useState(10); const [category, setCategory] = useState(''); const [date, setDate] = useState(selectedDate);
  const colors = modeColors(mode);
  React.useEffect(() => { if (visible) setDate(selectedDate); }, [visible, selectedDate]);
  async function save() { if (!title.trim()) return Alert.alert('Name the move', 'Give this task a name first.'); try { await actions.addTask({ title: title.trim(), dueDate: date, points, category: category.trim() || undefined }); setTitle(''); setCategory(''); setPoints(10); onClose(); } catch (e) { Alert.alert('Could not save task', String(e)); } }
  return <Sheet visible={visible} onClose={onClose} eyebrow="ONE MOVE AT A TIME" title="ADD A MOVE." mode={mode}><Field label="WHAT’S THE MOVE?" value={title} onChangeText={setTitle} placeholder="e.g. Finish the pitch deck" /><Field label="TAG (OPTIONAL)" value={category} onChangeText={setCategory} placeholder="Work, wellness, life..." /><Text style={styles.fieldLabel}>WHEN?</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>{Array.from({ length: 8 }, (_, i) => dateKey(i)).map(d => <Pressable key={d} onPress={() => setDate(d)} style={[styles.choiceChip, date === d && { backgroundColor: colors.dark }]}><Text style={[styles.choiceText, date === d && { color: palette.white }]}>{d === dateKey() ? 'TODAY' : d === dateKey(1) ? 'TOMORROW' : `${dayLabel(d)} ${Number(d.slice(-2))}`}</Text></Pressable>)}</ScrollView><Text style={styles.fieldLabel}>HOW BIG?</Text><View style={styles.pointsChoices}>{[5, 10, 15, 20].map(p => <Pressable key={p} onPress={() => setPoints(p)} style={[styles.pointChoice, points === p && { backgroundColor: colors.light, borderColor: colors.dark }]}><Text style={styles.pointChoiceNumber}>+{p}</Text><Text style={styles.pointChoiceCaption}>PTS</Text></Pressable>)}</View><ActionButton label="PUT IT ON THE BOARD" icon="arrow-forward" dark onPress={save} style={{ marginTop: 25 }} /></Sheet>;
}

function GoalModal({ visible, onClose, actions, mode }: { visible: boolean; onClose: () => void; actions: AppActions; mode: SmokeKind }) {
  const [title, setTitle] = useState(''); const [target, setTarget] = useState('10'); const [unit, setUnit] = useState('times');
  async function save() { const n = Number(target); if (!title.trim() || !Number.isFinite(n) || n < 1) return Alert.alert('Add a clear goal', 'Give it a name and a target of at least 1.'); try { await actions.addGoal({ title: title.trim(), target: Math.floor(n), unit: unit.trim() || 'times' }); setTitle(''); setTarget('10'); setUnit('times'); onClose(); } catch (e) { Alert.alert('Could not save goal', String(e)); } }
  return <Sheet visible={visible} onClose={onClose} eyebrow="THE LONG GAME" title="NEW GOAL." mode={mode}><Field label="WHAT ARE YOU AIMING FOR?" value={title} onChangeText={setTitle} placeholder="e.g. Read more books" /><View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 0.4 }}><Field label="TARGET" value={target} onChangeText={setTarget} keyboardType="number-pad" placeholder="10" /></View><View style={{ flex: 0.6 }}><Field label="UNIT" value={unit} onChangeText={setUnit} placeholder="books, runs, days..." /></View></View><Text style={styles.helperText}>Tap + on your goal whenever you make progress.</Text><ActionButton label="LET’S DO THIS" icon="arrow-forward" dark onPress={save} style={{ marginTop: 25 }} /></Sheet>;
}

function SmokeModal({ visible, onClose, actions, mode, balance, cost, capReached, weedLocked, todayCount, dailyMax }: { visible: boolean; onClose: () => void; actions: AppActions; mode: SmokeKind; balance: number; cost: number; capReached: boolean; weedLocked: boolean; todayCount: number; dailyMax: number }) {
  const [mood, setMood] = useState('CHILL'); const [busy, setBusy] = useState(false);
  const colors = modeColors(mode); const canSpend = balance >= cost && !capReached && !weedLocked;
  async function log(bypass: boolean) { try { setBusy(true); await actions.logSmoke(mode, bypass, mood); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onClose(); } catch (e) { Alert.alert('Could not log this break', String(e)); } finally { setBusy(false); } }
  return <Sheet visible={visible} onClose={onClose} eyebrow={mode === 'weed' ? 'SLOW BURN MOMENT' : 'YOUR BREAK, YOUR RULES'} title={mode === 'weed' ? 'UNWIND TIME.' : 'LIGHT UP?' } mode={mode}><View style={[styles.smokeGraphic, { backgroundColor: colors.light }]}>{mode === 'weed' ? <WeedLeafArt size={92} color={palette.oliveDark} /> : <CigaretteArt size={180} angle={-12} />}<View><Text style={styles.smokeGraphicBig}>{todayCount}{mode === 'cigarette' ? `/${dailyMax}` : ''}</Text><Text style={styles.smokeGraphicSmall}>{mode === 'weed' ? 'SESSIONS TODAY' : 'CIGS TODAY'}</Text></View></View><Text style={styles.fieldLabel}>WHAT’S THE MOOD?</Text><View style={styles.moodRow}>{['CHILL', 'FOCUS', 'SOCIAL', 'RESET'].map(m => <Pressable key={m} onPress={() => setMood(m)} style={[styles.moodChip, mood === m && { backgroundColor: colors.dark }]}><Text style={[styles.moodText, mood === m && { color: palette.white }]}>{m}</Text></Pressable>)}</View><View style={styles.smokeInfo}><Ionicons name="sparkles-outline" size={18} color={colors.accent} /><Text style={styles.smokeInfoText}>{weedLocked ? 'Weekend mode is on. You can still take a no guilt break today.' : capReached ? 'You hit your soft max. You can still take a no guilt break.' : canSpend ? `This uses ${cost} earned points from your ${mode === 'weed' ? 'weed' : 'cig'} meter.` : `You have ${balance}/${cost} points. You can still choose a no guilt break.`}</Text></View>{canSpend && <ActionButton label={`USE ${cost} POINTS & LOG IT`} icon="arrow-forward" dark disabled={busy} onPress={() => log(false)} />}<Pressable disabled={busy} onPress={() => log(true)} style={styles.bypassButton}><Text style={styles.bypassText}>SKIP THE POINTS. NO GUILT.</Text><Ionicons name="arrow-forward" size={17} color={palette.ink} /></Pressable></Sheet>;
}

function FriendModal({ visible, onClose, actions, mode }: { visible: boolean; onClose: () => void; actions: AppActions; mode: SmokeKind }) {
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  async function add() { if (!code.trim()) return Alert.alert('Add a code', 'Enter your friend’s code first.'); try { setBusy(true); await actions.addFriendByCode(code.trim().toUpperCase()); setCode(''); onClose(); Alert.alert('Friend added', 'You can now see each other’s daily counts.'); } catch (e) { Alert.alert('Could not add friend', String(e)); } finally { setBusy(false); } }
  return <Sheet visible={visible} onClose={onClose} eyebrow="GOOD VIBES TRAVEL" title="ADD FRIEND." mode={mode}><Field label="FRIEND CODE" value={code} onChangeText={setCode} autoCapitalize="none" placeholder="e.g. AB12CD34" /><Text style={styles.helperText}>Ask your friend to share their code from the Crew tab.</Text><ActionButton label="ADD FRIEND" icon="arrow-forward" dark disabled={busy} onPress={add} style={{ marginTop: 23 }} /></Sheet>;
}

function AuthModal({ visible, onClose, actions, mode }: { visible: boolean; onClose: () => void; actions: AppActions; mode: SmokeKind }) {
  const [isNew, setIsNew] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  async function google() { try { setBusy(true); const result = await actions.signInWithGoogle(); if (result?.error) return Alert.alert('Google sign-in failed', result.error); if (!result?.cancelled) onClose(); } catch (e) { Alert.alert('Google sign-in failed', String(e)); } finally { setBusy(false); } }
  async function submit() { if (!email.includes('@') || password.length < 6) return Alert.alert('Check your details', 'Use a valid email and a password with at least 6 characters.'); try { setBusy(true); const result = await (isNew ? actions.signUp(email.trim(), password) : actions.signIn(email.trim(), password)); if (result && result.error) return Alert.alert('Could not continue', result.error); onClose(); Alert.alert(isNew ? 'Check your inbox' : 'Welcome back', isNew ? 'Confirm your email if your account asks for it, then sign in.' : 'Your crew is ready.'); } catch (e) { Alert.alert('Could not continue', String(e)); } finally { setBusy(false); } }
  return <Sheet visible={visible} onClose={onClose} eyebrow="SAVE IT. SHARE IT." title={isNew ? 'JOIN THE CREW.' : 'WELCOME BACK.'} mode={mode}><Text style={styles.helperText}>Your tasks, goals, and meters sync to your private cloud account. Friend codes share only daily totals.</Text><ActionButton label="CONTINUE WITH GOOGLE" icon="logo-google" dark disabled={busy} onPress={google} style={{ marginTop: 15, marginBottom: 18 }} /><Text style={styles.fieldLabel}>OR USE EMAIL</Text><Field label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" /><Field label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" /><ActionButton label={isNew ? 'CREATE ACCOUNT' : 'SIGN IN'} icon="arrow-forward" dark disabled={busy} onPress={submit} style={{ marginTop: 12 }} /><Pressable onPress={() => setIsNew(!isNew)} style={styles.switchAuth}><Text style={styles.switchAuthText}>{isNew ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'NEW HERE? CREATE AN ACCOUNT'}</Text></Pressable></Sheet>;
}

function ProfileModal({ visible, onClose, actions, mode, profile }: { visible: boolean; onClose: () => void; actions: AppActions; mode: SmokeKind; profile: AppData['profile'] }) {
  const [name, setName] = useState(profile.name); const [handle, setHandle] = useState(profile.handle);
  React.useEffect(() => { if (visible) { setName(profile.name); setHandle(profile.handle); } }, [visible, profile.name, profile.handle]);
  async function save() { if (!name.trim() || !handle.trim()) return Alert.alert('Fill both fields', 'Your name and handle help friends find you.'); try { await actions.updateProfile({ name: name.trim(), handle: handle.trim().replace(/^@/, '') }); onClose(); } catch (e) { Alert.alert('Could not update profile', String(e)); } }
  return <Sheet visible={visible} onClose={onClose} eyebrow="THE PERSON BEHIND THE POINTS" title="YOUR PROFILE." mode={mode}><Field label="YOUR NAME" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" /><Field label="HANDLE" value={handle} onChangeText={setHandle} autoCapitalize="none" placeholder="yourhandle" /><ActionButton label="SAVE PROFILE" icon="checkmark" dark onPress={save} style={{ marginTop: 12 }} /></Sheet>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { flex: 1 }, scrollContent: { paddingHorizontal: 20, paddingBottom: 35 },
  appHeader: { height: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 }, wordmarkBolt: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: font.poster, fontSize: 15, letterSpacing: -0.8, color: palette.ink }, wordmarkDot: { color: palette.ink },
  avatar: { width: 35, height: 35, borderRadius: 18, borderWidth: 2, borderColor: palette.ink, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontFamily: font.display, fontSize: 17, fontWeight: '900', color: palette.ink },
  micro: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.3, color: palette.muted },
  helloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 14 }, helloTitle: { fontFamily: font.poster, fontSize: 23, color: palette.ink, letterSpacing: -0.7, marginTop: 3 },
  modeToggle: { height: 50, borderWidth: 2, borderRadius: 14, flexDirection: 'row', overflow: 'hidden', marginBottom: 4, backgroundColor: palette.white }, modeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, modeText: { fontFamily: font.poster, fontSize: 11, letterSpacing: 0.2, color: palette.ink },
  hero: { borderRadius: 24, padding: 19, overflow: 'hidden', borderWidth: 2, borderColor: palette.ink }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroPill: { backgroundColor: '#FFF9E9', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 }, heroPillText: { color: palette.ink, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 }, heroTitle: { fontFamily: font.display, color: palette.white, fontWeight: '900', fontSize: 36, letterSpacing: -1.9, lineHeight: 36, marginTop: 17 },
  heroGraphic: { flexDirection: 'row', alignItems: 'center', marginTop: 5, minHeight: 155 }, heroStat: { fontFamily: font.display, fontSize: 37, fontWeight: '900', color: palette.white, letterSpacing: -2 }, heroStatSmall: { fontSize: 20, color: '#E7DBC6' }, heroStatLabel: { color: '#E7DBC6', fontSize: 9, letterSpacing: 1.1, fontWeight: '900', marginTop: 1 }, meterTrack: { width: '100%', height: 16, borderRadius: 9, borderWidth: 2, borderColor: palette.white, overflow: 'hidden', backgroundColor: '#6D6359', marginTop: 13 }, meterFill: { height: '100%', borderRadius: 9 }, meterTip: { color: '#FFF7E3', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 8 },
  heroBottom: { borderTopWidth: 1, borderTopColor: '#8E8174', paddingTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroCount: { fontFamily: font.display, fontSize: 32, color: palette.white, fontWeight: '900', lineHeight: 35 }, heroCountSlash: { fontSize: 18, color: '#D4C9B8' }, heroButton: { minHeight: 48, paddingHorizontal: 15, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: palette.ink }, heroButtonText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3, color: palette.ink },
  breathingStrip: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 10 }, breathingIcon: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, breathingText: { fontFamily: font.bold, fontSize: 11, color: palette.ink, letterSpacing: 0.1 },
  sectionTitle: { marginTop: 29, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, sectionTitleText: { fontFamily: font.poster, fontSize: 18, letterSpacing: -0.5, color: palette.ink, marginTop: 4 }, sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingBottom: 4 }, sectionLinkText: { fontFamily: font.bold, fontSize: 10, color: palette.ink, letterSpacing: 0.3 },
  taskBoard: { backgroundColor: palette.white, borderRadius: 19, borderWidth: 2, borderColor: palette.ink, overflow: 'hidden', paddingHorizontal: 15 }, taskBoardHeader: { height: 63, alignItems: 'center', flexDirection: 'row', borderBottomWidth: 1, borderColor: palette.line, gap: 8 }, taskBoardCount: { fontFamily: font.display, fontSize: 24, fontWeight: '900', color: palette.ink }, taskBoardCaption: { fontSize: 9, fontWeight: '900', color: palette.muted, letterSpacing: 0.5 }, boardProgress: { width: 48, height: 30, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, boardProgressText: { fontWeight: '900', fontSize: 11, color: palette.ink },
  taskRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 13 }, checkBox: { height: 27, width: 27, borderRadius: 7, borderWidth: 2, borderColor: palette.ink, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center' }, checkBoxDone: { backgroundColor: palette.ink }, taskTitle: { fontSize: 14, fontWeight: '800', color: palette.ink }, taskDone: { textDecorationLine: 'line-through', color: palette.muted }, taskMeta: { marginTop: 4, fontSize: 9, letterSpacing: 1, color: palette.muted, fontWeight: '900' }, addInline: { height: 53, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, addInlineText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }, emptyInline: { fontSize: 14, fontWeight: '900', color: palette.ink }, emptyInlineSub: { fontSize: 11, color: palette.muted, marginTop: 5 },
  tomorrowCard: { marginTop: 18, borderRadius: 18, borderWidth: 2, borderColor: palette.ink, padding: 18, flexDirection: 'row', alignItems: 'center' }, tomorrowTitle: { fontFamily: font.poster, fontSize: 16, letterSpacing: -0.3, color: palette.ink, marginTop: 6 }, tomorrowCaption: { fontFamily: font.body, fontSize: 12, color: palette.ink, marginTop: 4 }, crewTeaser: { marginTop: 13, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'center' }, crewIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.yellowLight, alignItems: 'center', justifyContent: 'center' }, crewTitle: { fontFamily: font.bold, fontSize: 11, color: palette.ink }, crewCaption: { marginTop: 3, fontFamily: font.body, fontSize: 10, color: palette.muted }, footerNote: { marginTop: 24, textAlign: 'center', fontSize: 10, lineHeight: 15, color: palette.muted },
  pageTitle: { fontFamily: font.poster, fontSize: 27, letterSpacing: -0.7, lineHeight: 34, color: palette.ink, marginTop: 5 }, pageSubtitle: { color: palette.muted, fontFamily: font.body, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 300 },
  dayScroller: { marginHorizontal: -20, marginTop: 21, flexGrow: 0, paddingLeft: 20 }, dayChip: { width: 67, height: 87, borderWidth: 1.5, borderColor: palette.line, borderRadius: 15, backgroundColor: palette.white, marginRight: 8, alignItems: 'center', justifyContent: 'center' }, dayChipName: { fontSize: 9, color: palette.muted, fontWeight: '900', letterSpacing: 0.5 }, dayChipNumber: { fontFamily: font.display, fontSize: 26, fontWeight: '900', color: palette.ink, lineHeight: 29, marginTop: 3 }, dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 }, planHeader: { marginTop: 26, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planDate: { fontFamily: font.display, fontSize: 22, color: palette.ink, fontWeight: '900', letterSpacing: -0.9, marginTop: 3 }, planCount: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }, planCountText: { fontSize: 10, color: palette.ink, fontWeight: '900' }, listCard: { backgroundColor: palette.white, borderRadius: 18, borderWidth: 1.5, borderColor: palette.line, paddingHorizontal: 15, overflow: 'hidden' }, actionButton: { minHeight: 51, borderRadius: 13, borderWidth: 2, borderColor: palette.ink, backgroundColor: palette.yellow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 13 }, actionButtonDark: { backgroundColor: palette.ink }, actionButtonText: { fontSize: 12, color: palette.ink, fontWeight: '900', letterSpacing: 0.6 }, howCard: { marginTop: 20, borderWidth: 1.5, borderColor: palette.line, borderRadius: 17, padding: 15, flexDirection: 'row', gap: 11, alignItems: 'flex-start' }, howTitle: { fontSize: 11, fontWeight: '900', color: palette.ink, letterSpacing: 0.5 }, howText: { fontSize: 11, color: palette.muted, lineHeight: 16, marginTop: 4 },
  emptyCard: { borderWidth: 1.5, borderColor: palette.line, backgroundColor: palette.white, borderRadius: 18, padding: 25, alignItems: 'center' }, emptyIcon: { backgroundColor: palette.yellowLight, width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontFamily: font.poster, fontSize: 17, color: palette.ink, marginTop: 14 }, emptyCaption: { textAlign: 'center', fontSize: 12, color: palette.muted, lineHeight: 18, marginTop: 6, maxWidth: 230 }, miniButton: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: palette.yellow, borderWidth: 1.5, borderColor: palette.ink, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9, marginTop: 15 }, miniButtonText: { fontSize: 10, fontWeight: '900', color: palette.ink },
  goalsBanner: { flexDirection: 'row', borderWidth: 2, borderColor: palette.ink, borderRadius: 19, padding: 18, marginTop: 23, alignItems: 'center' }, goalsBannerTitle: { fontFamily: font.poster, fontSize: 18, color: palette.ink, marginTop: 5, letterSpacing: -0.6 }, goalsBannerCaption: { fontSize: 11, color: palette.ink, marginTop: 3 }, goalCard: { marginBottom: 12, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, borderRadius: 18, padding: 16 }, goalCardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, goalIcon: { height: 41, width: 41, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, goalTitle: { fontSize: 15, fontWeight: '900', color: palette.ink, marginTop: 3 }, goalProgressTrack: { height: 10, borderRadius: 5, backgroundColor: palette.line, overflow: 'hidden', marginTop: 19 }, goalProgressFill: { height: '100%', borderRadius: 5 }, goalCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, goalNumeral: { fontSize: 13, fontWeight: '900', color: palette.ink }, goalPlus: { width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  authBanner: { marginTop: 22, padding: 22, borderRadius: 20, borderWidth: 2, borderColor: palette.ink, alignItems: 'center' }, authBannerTitle: { fontFamily: font.poster, fontSize: 20, color: palette.ink, marginTop: 13 }, authBannerText: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: palette.ink, marginVertical: 9 }, inviteCard: { marginTop: 22, borderRadius: 20, padding: 20 }, inviteCode: { fontFamily: font.display, fontSize: 29, color: palette.white, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 }, inviteCaption: { fontSize: 11, color: '#E3DDCE', marginTop: 4 }, inviteShare: { flex: 1, borderRadius: 11, backgroundColor: palette.white, minHeight: 42, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, inviteShareText: { fontSize: 9, fontWeight: '900', color: palette.ink }, scoreRow: { flexDirection: 'row', backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, borderRadius: 17, marginTop: 15, paddingVertical: 17 }, scoreHalf: { flex: 1, alignItems: 'center' }, scoreNumber: { fontFamily: font.poster, color: palette.ink, fontSize: 27 }, scoreCaption: { fontSize: 9, fontWeight: '900', color: palette.muted, letterSpacing: 0.7 }, scoreDivider: { width: 1.5, backgroundColor: palette.line }, friendRow: { minHeight: 78, borderBottomWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 }, friendAvatar: { width: 41, height: 41, borderRadius: 13, backgroundColor: palette.yellow, borderWidth: 1.5, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, friendAvatarText: { fontFamily: font.display, fontSize: 18, color: palette.ink, fontWeight: '900' }, friendName: { fontSize: 13, color: palette.ink, fontWeight: '900' }, friendHandle: { fontSize: 10, color: palette.muted, marginTop: 2 }, friendStats: { flexDirection: 'row', gap: 4, marginTop: 5 }, friendStat: { fontSize: 9, fontWeight: '800', color: palette.ink }, friendStatDot: { fontSize: 9, color: palette.muted }, acceptButton: { width: 33, height: 33, backgroundColor: palette.olive, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  profileCard: { marginTop: 22, borderRadius: 17, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, profileAvatar: { width: 49, height: 49, borderWidth: 2, borderColor: palette.ink, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, profileAvatarText: { fontFamily: font.display, fontSize: 23, color: palette.ink, fontWeight: '900' }, profileName: { fontSize: 15, fontWeight: '900', color: palette.ink }, profileHandle: { fontSize: 11, color: palette.muted, marginTop: 3 }, settingsCard: { backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, borderRadius: 18, paddingHorizontal: 15 }, settingRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10 }, settingTitle: { fontSize: 11, fontWeight: '900', color: palette.ink, letterSpacing: 0.5 }, settingHint: { fontSize: 10, color: palette.muted, marginTop: 4, maxWidth: 190 }, settingDivider: { height: 1, backgroundColor: palette.line }, stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: palette.ink, borderRadius: 10 }, stepperButton: { width: 30, height: 31, alignItems: 'center', justifyContent: 'center' }, stepperValue: { width: 23, textAlign: 'center', fontSize: 14, fontWeight: '900', color: palette.ink }, settingPill: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }, settingPillText: { fontSize: 10, fontWeight: '900', color: palette.ink }, dangerCard: { borderRadius: 19, padding: 18, overflow: 'hidden' }, dangerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, dangerTitle: { fontFamily: font.poster, fontSize: 21, color: palette.white, marginTop: 5 }, dangerCaption: { fontSize: 11, lineHeight: 16, color: '#E9F0D5', marginTop: 4, maxWidth: 225 }, dangerRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center' }, dangerSettingTitle: { fontSize: 11, fontWeight: '900', color: palette.white }, dangerSettingHint: { fontSize: 10, color: '#D5E0C0', marginTop: 4 }, dangerDivider: { height: 1, backgroundColor: '#81906B' }, musicCard: { marginTop: 14, padding: 15, borderWidth: 1.5, borderColor: palette.line, borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }, musicTitle: { fontSize: 11, fontWeight: '900', color: palette.ink }, musicCaption: { fontSize: 10, color: palette.muted, marginTop: 4 }, soonPill: { backgroundColor: palette.yellowLight, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 5, fontSize: 9, fontWeight: '900', color: palette.ink }, accountRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 }, accountText: { flex: 1, fontSize: 10, fontWeight: '900', color: palette.ink },
  tabBar: { flexDirection: 'row', backgroundColor: palette.white, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 7, paddingHorizontal: 7 }, tab: { flex: 1, alignItems: 'center' }, tabIcon: { width: 39, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, tabText: { fontSize: 8, color: palette.muted, fontWeight: '900', letterSpacing: 0.3, marginTop: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,28,24,0.55)' }, sheetKeyboard: { flex: 1, justifyContent: 'flex-end', width: '100%' }, sheet: { maxHeight: '92%', backgroundColor: palette.paper, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 2, borderColor: palette.ink, paddingTop: 9 }, sheetHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: palette.line, alignSelf: 'center', marginBottom: 12 }, sheetHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 15 }, sheetTitle: { fontFamily: font.poster, fontSize: 22, letterSpacing: -0.5, color: palette.ink, marginTop: 3 }, sheetClose: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, sheetBody: { paddingHorizontal: 20, paddingBottom: 20 }, fieldWrap: { marginBottom: 13 }, fieldLabel: { fontSize: 10, fontWeight: '900', color: palette.ink, letterSpacing: 0.8, marginBottom: 8 }, field: { height: 49, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.ink, borderRadius: 11, paddingHorizontal: 13, fontSize: 14, color: palette.ink, fontWeight: '700' }, helperText: { fontSize: 12, lineHeight: 18, color: palette.muted, marginBottom: 17 }, choiceChip: { borderWidth: 1.5, borderColor: palette.line, paddingHorizontal: 13, height: 37, borderRadius: 10, justifyContent: 'center', marginRight: 7, backgroundColor: palette.white }, choiceText: { fontSize: 10, fontWeight: '900', color: palette.ink }, pointsChoices: { flexDirection: 'row', gap: 8 }, pointChoice: { flex: 1, height: 60, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, pointChoiceNumber: { fontFamily: font.display, fontSize: 19, color: palette.ink, fontWeight: '900' }, pointChoiceCaption: { fontSize: 8, color: palette.muted, fontWeight: '900' }, smokeGraphic: { height: 125, borderWidth: 2, borderColor: palette.ink, borderRadius: 16, marginBottom: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden' }, smokeGraphicBig: { fontFamily: font.display, fontSize: 31, color: palette.ink, fontWeight: '900' }, smokeGraphicSmall: { fontSize: 9, color: palette.ink, fontWeight: '900' }, moodRow: { flexDirection: 'row', gap: 7, marginBottom: 17 }, moodChip: { flex: 1, height: 35, borderRadius: 9, borderWidth: 1.5, borderColor: palette.line, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center' }, moodText: { fontSize: 9, fontWeight: '900', color: palette.ink }, smokeInfo: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 17 }, smokeInfoText: { flex: 1, fontSize: 11, lineHeight: 16, color: palette.muted }, bypassButton: { marginTop: 12, minHeight: 48, borderWidth: 1.5, borderColor: palette.ink, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, bypassText: { fontSize: 11, fontWeight: '900', color: palette.ink }, switchAuth: { paddingVertical: 16, alignItems: 'center' }, switchAuthText: { fontSize: 10, fontWeight: '900', color: palette.ink, textDecorationLine: 'underline' },
});
