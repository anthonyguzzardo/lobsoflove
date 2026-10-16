// Which way the phone is held, from gravity. The app is locked to portrait, so DeviceMotion's own `orientation`
// never changes (it follows the screen); gravity does not care about the screen.
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { turnFromGravity, type Turn } from '@/lib/ink-recognize';

/** The turn the phone is held at, steady for 350 ms before it changes, or null when flat or no sensor. */
export function useHoldTurn(flip: boolean): Turn | null {
  const [turn, setTurn] = useState<Turn | null>(null);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let pending: Turn | null = null;
    let since = 0;
    let alive = true;
    DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok || !alive) return;
      DeviceMotion.setUpdateInterval(120);
      sub = DeviceMotion.addListener((m) => {
        const a = m.accelerationIncludingGravity;
        if (!a) return;
        const t = turnFromGravity(a.x, a.y, a.z, Platform.OS, flip);
        if (t !== pending) { pending = t; since = Date.now(); return; }
        if (Date.now() - since >= 350) setTurn(t);
      });
    }).catch(() => {});
    return () => { alive = false; sub?.remove(); };
  }, [flip]);
  return turn;
}
