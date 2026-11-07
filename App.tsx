import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import { SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { AppShell } from './src/screens/AppShell';
import { usePuffStore } from './src/store';

export default function App() {
  const [fontsLoaded] = useFonts({ Bungee_400Regular, SpaceGrotesk_400Regular, SpaceGrotesk_700Bold });
  const { data, actions } = usePuffStore();
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AppShell data={data} actions={actions} />
    </SafeAreaProvider>
  );
}
