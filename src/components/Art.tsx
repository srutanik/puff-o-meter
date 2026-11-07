import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Mood = 'cig' | 'weed';

const palette = {
  cig: { ink: '#BE2F22', paper: '#FFF9E9', bright: '#F6BD2D', soft: '#F9DE84' },
  weed: { ink: '#344B2C', paper: '#F8FAEB', bright: '#93AE55', soft: '#CFE1A5' },
};

/** A little cigarette that can sit beside counts and labels. */
export function CigaretteArt({ size = 64, angle = -18 }: { size?: number; angle?: number }) {
  return (
    <View style={[styles.cigSmall, { width: size, height: size * 0.22, transform: [{ rotate: `${angle}deg` }] }]}>
      <View style={{ width: size * 0.12, height: '100%', backgroundColor: '#E36B31' }} />
      <View style={{ width: size * 0.25, height: '100%', backgroundColor: '#C85832', borderLeftWidth: 1, borderColor: '#994025' }} />
      <View style={{ flex: 1, height: '100%', backgroundColor: '#FFFDF4', borderLeftWidth: 2, borderColor: '#E5DFCE' }} />
      <View style={{ position: 'absolute', left: size * 0.52, top: 1, width: 1, height: size * 0.22 - 2, backgroundColor: '#E8DFCC' }} />
    </View>
  );
}

/** A compact seven-blade leaf mark with a clear stem at small sizes. */
export function WeedLeafArt({ size = 90, color = '#415D34' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M50 7C42 24 42 38 50 58c8-20 8-34 0-51Z" fill={color} />
      <Path d="M40 54C32 34 23 24 10 18c2 20 12 34 33 43L40 54ZM60 54c8-20 17-30 30-36-2 20-12 34-33 43l3-7Z" fill={color} />
      <Path d="M37 61C27 49 16 45 4 45c7 16 19 24 37 23l-4-7ZM63 61c10-12 21-16 33-16-7 16-19 24-37 23l4-7Z" fill={color} />
      <Path d="M41 69c-11-4-19-3-27 2 10 7 20 7 32 3l-5-5ZM59 69c11-4 19-3 27 2-10 7-20 7-32 3l5-5Z" fill={color} />
      <Path d="M49 54c-1 16 0 27 6 39" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <Path d="M50 57 23 33M50 61 10 51M50 57l27-24M50 61l40-10" fill="none" stroke="#F8FAEB" strokeOpacity="0.56" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="50" cy="60" r="3" fill="#F8FAEB" />
    </Svg>
  );
}

/** Graphic fill meter, sized for the large hero card. progress runs from 0 to 1. */
export function MeterIllustration({ mode = 'cig', progress = 0, height = 194 }: { mode?: Mood; progress?: number; height?: number }) {
  const colors = palette[mode];
  const clamped = Math.max(0, Math.min(1, progress));
  if (mode === 'weed') {
    return (
      <View style={{ width: height * 0.72, height, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ position: 'absolute', width: height * 0.64, height: height * 0.64, borderRadius: height, backgroundColor: colors.soft, top: height * 0.15 }} />
        <WeedLeafArt size={height * 0.66} color={colors.ink} />
        <View style={{ position: 'absolute', bottom: 5, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: colors.paper }}>
          <Text style={{ color: colors.paper, fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>SLOW BURN</Text>
        </View>
      </View>
    );
  }
  const bodyHeight = height * 0.68;
  return (
    <View style={{ height, width: height * 0.56, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: height * 0.48, height: height * 0.48, borderRadius: height, backgroundColor: colors.soft, top: height * 0.23 }} />
      <View style={{ position: 'absolute', top: height * 0.02, left: height * 0.17, borderWidth: 3, borderColor: colors.ink, width: height * 0.12, height: height * 0.12, borderRadius: height * 0.12, opacity: 0.55 }} />
      <View style={{ position: 'absolute', top: height * 0.10, left: height * 0.29, borderWidth: 3, borderColor: colors.ink, width: height * 0.075, height: height * 0.075, borderRadius: height * 0.075, opacity: 0.45 }} />
      <View style={{ width: height * 0.22, height: bodyHeight, borderRadius: 10, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', transform: [{ rotate: '12deg' }], backgroundColor: colors.paper }}>
        <View style={{ height: bodyHeight * 0.16, backgroundColor: colors.bright, borderBottomWidth: 3, borderColor: colors.ink }} />
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bright, height: `${clamped * 100}%` as `${number}%`, width: '100%' }} />
        </View>
        <View style={{ height: bodyHeight * 0.17, backgroundColor: '#D96C3E', borderTopWidth: 3, borderColor: colors.ink }} />
      </View>
      <View style={{ position: 'absolute', bottom: 5, right: 0, backgroundColor: colors.ink, paddingHorizontal: 9, paddingVertical: 5, transform: [{ rotate: '-9deg' }] }}>
        <Text style={{ color: colors.paper, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 }}>EARN IT</Text>
      </View>
    </View>
  );
}

export function BurstBadge({ label, mode = 'cig', size = 76 }: { label: string; mode?: Mood; size?: number }) {
  const colors = palette[mode];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 0.79, height: size * 0.79, backgroundColor: colors.bright, transform: [{ rotate: '18deg' }], borderWidth: 2, borderColor: colors.ink }} />
      <View style={{ position: 'absolute', width: size * 0.79, height: size * 0.79, backgroundColor: colors.bright, transform: [{ rotate: '63deg' }], borderWidth: 2, borderColor: colors.ink }} />
      <Text style={{ color: colors.ink, fontSize: size * 0.18, fontWeight: '900', textAlign: 'center', maxWidth: size * 0.72, transform: [{ rotate: '-8deg' }] }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cigSmall: { borderRadius: 4, borderWidth: 1.5, borderColor: '#A43D29', overflow: 'hidden', flexDirection: 'row' },
});
