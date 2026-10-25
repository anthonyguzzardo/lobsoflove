import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LolSplash } from '@/components/lol-splash';
import { C } from '@/constants/arcade';
import { startCloud } from '@/lib/cloud';
import { followTaps } from '@/lib/push';

void SplashScreen.preventAutoHideAsync().catch(() => {});
const hideNativeSplash = () => { void SplashScreen.hideAsync().catch(() => {}); };

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.ball } };

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const finishIntro = useCallback(() => { hideNativeSplash(); setShowIntro(false); }, []);
  // Sign in and load the crew in the background; every screen works from this phone's data until it lands.
  useEffect(() => { void startCloud(); }, []);
  // A tapped push opens its screen: the confirm queue, or the crew photo for a call-up.
  useEffect(() => followTaps(), []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }} accessibilityElementsHidden={showIntro} importantForAccessibility={showIntro ? 'no-hide-descendants' : 'auto'}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, gestureEnabled: false, fullScreenGestureEnabled: false }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="courts" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="fly" options={{ contentStyle: { backgroundColor: '#d8e9ef' } }} />
        <Stack.Screen name="case" options={{ contentStyle: { backgroundColor: '#f6f5f2' } }} />
        <Stack.Screen name="ink" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="fighter" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="gear" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="season" options={{ contentStyle: { backgroundColor: '#ebe8e2' } }} />
        <Stack.Screen name="match" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="drill" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="crew" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="find" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
      </Stack>
      </View>
      {showIntro && <LolSplash onReady={hideNativeSplash} onFinish={finishIntro} />}
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
