import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { SceneView, useScene } from '@/components/scene-view';
import { CASE_HTML } from '@/generated/case-html';
import type { CastId } from '@/lib/roster';

/**
 * The jewel case, drawn by three.js in a WebView (web/case.js). WebGL there is GPU-accelerated on device and simulator alike,
 * and the page owns its own touches, so spinning the case never waits on React.
 */
export function CaseWeb({ cast, playSignal, demo = false, onOpenChange, onPlayed }: { cast: CastId; playSignal: number; demo?: boolean; onOpenChange: (open: boolean) => void; onPlayed: () => void }) {
  const scene = useScene();
  const { run } = scene;

  useEffect(() => { run(`window.setCase(${JSON.stringify(cast)})`); }, [run, cast]);
  useEffect(() => { if (playSignal > 0) run('window.playDisc()'); }, [run, playSignal]);

  return (
    <SceneView
      scene={scene}
      html={CASE_HTML}
      name="case"
      style={styles.web}
      allowsInlineMediaPlayback
      onReady={() => { if (demo) run('setTimeout(() => window.fling(160, 820), 3600); setTimeout(() => window.setOpen(true), 6600)'); }}
      onMessage={(msg) => {
        if (msg.type === 'open') onOpenChange(msg.open);
        else if (msg.type === 'played') onPlayed();
      }}
    />
  );
}

const styles = StyleSheet.create({ web: { backgroundColor: '#f6f5f2' } });
