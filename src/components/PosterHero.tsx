import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DoodleSpark, PopGlyph } from './PopArt';
import { WeedLeafArt } from './Art';
import { font, palette } from '../theme';
import type { SmokeKind } from '../types';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function CigRow({ index, progress }: { index: number; progress: number }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(value, { toValue: clamp(progress), friction: 8, tension: 55, useNativeDriver: false }).start();
  }, [progress, value]);
  const fillWidth = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return <View style={[styles.cigRow, { transform: [{ rotate: `${index % 2 ? 0.7 : -0.7}deg` }] }]}>
    <Text style={styles.cigRowNumber}>{String(index + 1).padStart(2, '0')}</Text>
    <View style={styles.cigTrack}>
      <Animated.View style={[styles.cigFill, { width: fillWidth }]} />
      <View style={styles.cigStripe} />
      <View style={styles.cigFilter}><View style={styles.cigFilterLine} /><View style={styles.cigFilterLine} /></View>
    </View>
  </View>;
}

function SlowMeter({ progress }: { progress: number }) {
  return <View style={styles.slowMeter}>
    <View style={styles.slowLeaf}><WeedLeafArt size={75} color={palette.oliveDark} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.slowCaption}>THE LONG GAME</Text>
      <View style={styles.slowBlocks}>{Array.from({ length: 8 }, (_, i) => <View key={i} style={styles.slowBlock}><View style={[styles.slowBlockFill, { width: `${clamp(progress * 8 - i) * 100}%` }]} /></View>)}</View>
      <Text style={styles.slowSub}>ONE FIFTH OF EVERY TASK POINT FLOWS HERE</Text>
    </View>
  </View>;
}

export function PosterHero({ mode, points, cost, todayCount, earnedToday, dailyMax, locked, onBreak }: {
  mode: SmokeKind; points: number; cost: number; todayCount: number; earnedToday: number; dailyMax: number; locked: boolean; onBreak: () => void;
}) {
  const weed = mode === 'weed';
  const progress = clamp(points / cost);
  const maxBars = Math.min(dailyMax, 5);
  return <View style={styles.wrap}>
    <View style={[styles.offset, { backgroundColor: weed ? palette.mint : palette.red }]} />
    <View style={[styles.hero, { backgroundColor: weed ? palette.oliveDark : '#F6C43C' }]}>
      <View style={styles.topline}>
        <Text style={[styles.edition, weed && styles.light]}>THE DAILY DEAL  /  001</Text>
        <View style={[styles.topPill, weed && { backgroundColor: palette.mint }]}><Text style={styles.topPillText}>{weed ? 'SLOW BURN' : `SOFT MAX ${dailyMax}`}</Text></View>
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, weed && styles.light]}>{weed ? 'TAKE IT\nSLOW.' : 'YOUR BREAK\nIS LOADING.'}</Text>
        <View style={styles.titleSpark}><DoodleSpark size={42} color={weed ? palette.mint : palette.red} /></View>
      </View>

      <View style={[styles.meterCard, weed && { backgroundColor: '#E2EDC8' }]}>
        <View style={styles.meterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={styles.pointsNumber}>{points}</Text><Text style={styles.pointsTotal}>/ {cost} PTS</Text>
          </View>
          <View style={[styles.readyPill, { backgroundColor: progress >= 1 ? (weed ? palette.olive : palette.red) : palette.ink }]}>
            <Text style={styles.readyText}>{progress >= 1 ? 'READY!' : `${Math.max(0, cost - points)} TO GO`}</Text>
          </View>
        </View>
        {weed ? <SlowMeter progress={progress} /> : <View style={styles.stack}>
          {Array.from({ length: maxBars }, (_, i) => <CigRow key={i} index={i} progress={i < earnedToday ? 1 : (points - (i - earnedToday) * cost) / cost} />)}
          {dailyMax > 5 && <Text style={styles.extraBars}>+ {dailyMax - 5} MORE IN YOUR DAILY MAX</Text>}
        </View>}
      </View>

      <View style={styles.bottomline}>
        <View style={styles.countBlock}>
          <Text style={[styles.countLabel, weed && styles.light]}>{weed ? 'SESSIONS TODAY' : 'CIGS TODAY'}</Text>
          <Text style={[styles.countNumber, weed && styles.light]}>{todayCount}<Text style={[styles.countDenom, weed && styles.light]}> {weed ? 'TOTAL' : `/ ${dailyMax}`}</Text></Text>
        </View>
        <Pressable onPress={onBreak} accessibilityLabel="Take a break" style={({ pressed }) => [styles.breakButton, { backgroundColor: weed ? palette.mint : palette.red }, pressed && { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } }]}>
          <PopGlyph name={weed ? 'leaf' : 'spark'} size={24} color={weed ? palette.oliveDark : palette.white} accent={weed ? palette.olive : '#F6C43C'} />
          <Text style={[styles.breakText, weed && { color: palette.oliveDark }]}>{locked ? 'WHY WAIT?' : 'TAKE A BREAK'}</Text>
          <Ionicons name="arrow-forward" size={18} color={weed ? palette.oliveDark : palette.white} />
        </Pressable>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, marginBottom: 16, paddingRight: 6, paddingBottom: 7 },
  offset: { position: 'absolute', left: 7, right: 0, top: 7, bottom: 0, borderRadius: 24, borderWidth: 2, borderColor: palette.ink },
  hero: { borderRadius: 24, borderWidth: 2.5, borderColor: palette.ink, padding: 17, overflow: 'hidden' },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  edition: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.1, color: palette.ink },
  light: { color: palette.white },
  topPill: { borderRadius: 30, borderWidth: 1.5, borderColor: palette.ink, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.white, transform: [{ rotate: '3deg' }] },
  topPillText: { fontFamily: font.bold, fontSize: 9, color: palette.ink, letterSpacing: 0.4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, marginBottom: 15 },
  title: { flex: 1, fontFamily: font.poster, fontSize: 28, lineHeight: 34, color: palette.ink, letterSpacing: -0.8 },
  titleSpark: { width: 48, alignItems: 'center', transform: [{ rotate: '13deg' }], marginTop: 12 },
  meterCard: { backgroundColor: '#FFF9E8', borderWidth: 2, borderColor: palette.ink, borderRadius: 18, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 11, transform: [{ rotate: '-1deg' }] },
  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pointsNumber: { fontFamily: font.poster, color: palette.ink, fontSize: 31, lineHeight: 40 },
  pointsTotal: { fontFamily: font.bold, color: palette.ink, fontSize: 11 },
  readyPill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, transform: [{ rotate: '3deg' }] },
  readyText: { fontFamily: font.bold, color: palette.white, fontSize: 9, letterSpacing: 0.4 },
  stack: { gap: 5 },
  cigRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 25 },
  cigRowNumber: { fontFamily: font.poster, color: palette.red, fontSize: 11, width: 21 },
  cigTrack: { height: 22, flex: 1, backgroundColor: palette.white, borderWidth: 2, borderColor: palette.ink, borderRadius: 7, overflow: 'hidden' },
  cigFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#F6C43C' },
  cigStripe: { position: 'absolute', top: 0, bottom: 0, right: 38, width: 2, backgroundColor: '#D5CBB5' },
  cigFilter: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 37, backgroundColor: '#D47A51', borderLeftWidth: 2, borderColor: palette.ink, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  cigFilterLine: { height: '80%', width: 2, backgroundColor: '#B45535' },
  extraBars: { fontFamily: font.bold, fontSize: 9, color: palette.muted, textAlign: 'right', marginTop: 2 },
  slowMeter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 3 },
  slowLeaf: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }] },
  slowCaption: { fontFamily: font.poster, color: palette.oliveDark, fontSize: 12 },
  slowBlocks: { flexDirection: 'row', gap: 3, marginTop: 10 },
  slowBlock: { height: 23, flex: 1, borderRadius: 5, borderWidth: 1.5, borderColor: palette.oliveDark, backgroundColor: '#BFD29B', overflow: 'hidden' },
  slowBlockFill: { height: '100%', backgroundColor: palette.oliveDark },
  slowSub: { fontFamily: font.bold, fontSize: 8, lineHeight: 11, color: palette.oliveDark, marginTop: 9 },
  bottomline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  countBlock: { flex: 1 },
  countLabel: { fontFamily: font.bold, fontSize: 9, color: palette.ink, letterSpacing: 0.8 },
  countNumber: { fontFamily: font.poster, fontSize: 27, lineHeight: 33, color: palette.ink, marginTop: 3 },
  countDenom: { fontFamily: font.bold, fontSize: 11, color: palette.ink },
  breakButton: { minHeight: 50, borderRadius: 14, borderWidth: 2, borderColor: palette.ink, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, shadowColor: palette.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 4 } },
  breakText: { fontFamily: font.bold, fontSize: 11, color: palette.white, letterSpacing: -0.2 },
});
