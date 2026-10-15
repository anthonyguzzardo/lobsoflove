import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LolSplash } from '@/components/lol-splash';

/** Replayable artwork that holds its finished pose; startup exits automatically. */
export default function SplashPreview() {
  return <><StatusBar style="dark" /><LolSplash preview onFinish={() => router.replace('/')} /></>;
}
