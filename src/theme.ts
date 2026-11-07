import type { SmokeKind } from './types';

export const palette = {
  ink: '#201C18',
  muted: '#746F63',
  paper: '#F7F3E9',
  white: '#FFFDF8',
  line: '#D9D1C1',
  red: '#D84836',
  yellow: '#F1BE3A',
  yellowLight: '#FFE3A1',
  olive: '#53643B',
  oliveDark: '#313D25',
  mint: '#DAE8BA',
  mintLight: '#F0F5E2',
};

export function modeColors(mode: SmokeKind) {
  return mode === 'weed'
    ? { accent: palette.olive, light: palette.mint, lighter: palette.mintLight, dark: palette.oliveDark, contrast: palette.white }
    : { accent: palette.red, light: palette.yellow, lighter: palette.yellowLight, dark: palette.ink, contrast: palette.white };
}

export const font = {
  display: 'SpaceGrotesk_700Bold',
  poster: 'Bungee_400Regular',
  body: 'SpaceGrotesk_400Regular',
  bold: 'SpaceGrotesk_700Bold',
};
