import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LolSplash } from '@/components/lol-splash';

/** Persistent art preview; startup uses the same component and exits automatically. */
export default function SplashPreview() {
  return <><StatusBar style="light" /><LolSplash preview onFinish={() => router.replace('/')} /></>;
}
