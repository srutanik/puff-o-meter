import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type PopGlyphName = 'home' | 'plan' | 'goals' | 'crew' | 'settings' | 'spark' | 'heart' | 'music' | 'check' | 'leaf' | 'meter';

export function PopGlyph({ name, size = 28, color = '#211A17', accent = '#C93B2D' }: {
  name: PopGlyphName; size?: number; color?: string; accent?: string;
}) {
  const common = { stroke: color, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let drawing: React.ReactNode;
  switch (name) {
    case 'home':
      drawing = <><Path d="M8 29 32 9l24 20v27H8V29Z" fill="none" {...common} /><Path d="M26 56V39h12v17" fill="none" {...common} /><Path d="m29 22-5 11h8l-4 10 13-16h-9l4-5" fill={accent} stroke={color} strokeWidth="2" strokeLinejoin="round" /></>;
      break;
    case 'plan':
      drawing = <><Rect x="9" y="15" width="46" height="42" rx="6" fill="none" {...common} /><Path d="M9 27h46" {...common} /><Line x1="21" y1="8" x2="21" y2="21" {...common} /><Line x1="43" y1="8" x2="43" y2="21" {...common} /><Path d="m20 42 7 7 16-17" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></>;
      break;
    case 'goals':
      drawing = <><Line x1="14" y1="7" x2="14" y2="58" {...common} /><Path d="M15 11c14-8 20 9 38 1v28c-15 8-25-7-38 0V11Z" fill={accent} {...common} /><Path d="m34 19 2.8 6 6.5.9-4.7 4.6 1.1 6.4-5.7-3-5.8 3 1.1-6.4-4.7-4.6 6.5-.9L34 19Z" fill="#FFF8E8" stroke={color} strokeWidth="1.5" /></>;
      break;
    case 'crew':
      drawing = <><Circle cx="24" cy="25" r="11" fill="none" {...common} /><Circle cx="44" cy="23" r="9" fill={accent} {...common} /><Path d="M5 55c0-12 8-20 19-20 12 0 20 8 20 20H5Z" fill="none" {...common} /><Path d="M40 36c11-2 19 5 19 17" fill="none" {...common} /><Circle cx="20" cy="24" r="1.5" fill={color} /><Circle cx="28" cy="24" r="1.5" fill={color} /><Path d="M20 30c2 3 6 3 8 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></>;
      break;
    case 'settings':
      drawing = <><Path d="M9 18h46M9 32h46M9 46h46" {...common} /><Circle cx="23" cy="18" r="6" fill={accent} {...common} /><Circle cx="43" cy="32" r="6" fill={accent} {...common} /><Circle cx="28" cy="46" r="6" fill={accent} {...common} /></>;
      break;
    case 'spark':
      drawing = <><Path d="M32 4 38 23 59 19 44 32 59 45 38 41 32 60 26 41 5 45 20 32 5 19 26 23 32 4Z" fill={accent} {...common} /><Circle cx="32" cy="32" r="5" fill="#FFF8E8" /></>;
      break;
    case 'heart':
      drawing = <Path d="M32 55 10 34C-2 22 15 3 32 18 49 3 66 22 54 34L32 55Z" fill={accent} {...common} />;
      break;
    case 'music':
      drawing = <><Path d="M10 38v-5c0-30 44-30 44 0v5" fill="none" {...common} /><Rect x="7" y="35" width="11" height="21" rx="5" fill={accent} {...common} /><Rect x="46" y="35" width="11" height="21" rx="5" fill={accent} {...common} /><Path d="M47 57c-4 5-11 5-16 5" fill="none" {...common} /></>;
      break;
    case 'check':
      drawing = <><Circle cx="32" cy="32" r="25" fill={accent} {...common} /><Path d="m18 32 9 9 20-20" fill="none" stroke="#FFF8E8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></>;
      break;
    case 'leaf':
      drawing = <><Path d="M32 6c-5 11-5 20 0 32 5-12 5-21 0-32ZM26 35C21 23 15 17 7 14c1 13 7 22 20 28ZM38 35c5-12 11-18 19-21-1 13-7 22-20 28ZM25 42C19 34 11 32 4 32c5 10 12 15 24 15ZM39 42c6-8 14-10 21-10-5 10-12 15-24 15Z" fill={accent} stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M32 36c-1 11 0 17 4 24" fill="none" {...common} /></>;
      break;
    case 'meter':
      drawing = <><Path d="M9 48a25 25 0 0 1 46 0" fill="none" {...common} /><Path d="M15 44a20 20 0 0 1 17-12" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" /><Path d="M12 51h40" fill="none" {...common} /><Path d="m32 45 12-17" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" /><Circle cx="32" cy="45" r="5" fill={accent} stroke={color} strokeWidth="2" /><Path d="M16 35 12 32M32 24v-5M48 35l4-3" fill="none" {...common} /></>;
      break;
  }
  return <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">{drawing}</Svg>;
}

export function StickerIcon({ name, size = 42, background = '#F8C83D', color = '#211A17', accent = '#C93B2D', tilt = -7 }: {
  name: PopGlyphName; size?: number; background?: string; color?: string; accent?: string; tilt?: number;
}) {
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: size - 2, height: size - 2, left: 3, top: 4, borderRadius: size * 0.25, backgroundColor: color, transform: [{ rotate: `${tilt}deg` }] }} />
    <View style={{ width: size - 3, height: size - 3, borderRadius: size * 0.25, borderWidth: 2, borderColor: color, backgroundColor: background, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${tilt}deg` }] }}>
      <PopGlyph name={name} size={size * 0.61} color={color} accent={accent} />
    </View>
  </View>;
}

export function DoodleSpark({ size = 38, color = '#C93B2D' }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 44 44"><Path d="M22 2v11M22 31v11M2 22h11M31 22h11M7.9 7.9l8 8M28.1 28.1l8 8M36.1 7.9l-8 8M15.9 28.1l-8 8" stroke={color} strokeWidth="3.4" strokeLinecap="round" /><Circle cx="22" cy="22" r="3.5" fill={color} /></Svg>;
}
