import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LolSplash } from '@/components/lol-splash';
import { C } from '@/constants/arcade';

void SplashScreen.preventAutoHideAsync().catch(() => {});
const hideNativeSplash = () => { void SplashScreen.hideAsync().catch(() => {}); };

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.ball } };

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const finishIntro = useCallback(() => { hideNativeSplash(); setShowIntro(false); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }} accessibilityElementsHidden={showIntro} importantForAccessibility={showIntro ? 'no-hide-descendants' : 'auto'}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, gestureEnabled: false, fullScreenGestureEnabled: false }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="courts" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="case" options={{ contentStyle: { backgroundColor: '#f6f5f2' } }} />
        <Stack.Screen name="ink" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="fighter" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="gear" options={{ contentStyle: { backgroundColor: '#efece5' } }} />
        <Stack.Screen name="season" options={{ contentStyle: { backgroundColor: '#ebe8e2' } }} />
        <Stack.Screen name="match" options={{ presentation: 'modal' }} />
      </Stack>
      </View>
      {showIntro && <LolSplash onReady={hideNativeSplash} onFinish={finishIntro} />}
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
