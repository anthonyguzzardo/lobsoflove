import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { CASE_HTML } from '@/generated/case-html';
import type { CastId } from '@/lib/roster';

type Msg = { type: 'ready' } | { type: 'open'; open: boolean } | { type: 'played' } | { type: 'error'; message: string; at?: string };

/**
 * The jewel case, drawn by three.js in a WebView (web/case.js). WebGL there is GPU-accelerated on device and simulator alike,
 * and the page owns its own touches, so spinning the case never waits on React.
 */
export function CaseWeb({ cast, playSignal, demo = false, onOpenChange, onPlayed }: { cast: CastId; playSignal: number; demo?: boolean; onOpenChange: (open: boolean) => void; onPlayed: () => void }) {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);

  useEffect(() => { if (ready.current) run(`window.setCase(${JSON.stringify(cast)})`); }, [cast]);
  useEffect(() => { if (ready.current && playSignal > 0) run('window.playDisc()'); }, [playSignal]);

  return (
    <WebView
      ref={web}
      source={{ html: CASE_HTML }}
      originWhitelist={['*']}
      style={styles.web}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      javaScriptEnabled
      allowsInlineMediaPlayback
      onMessage={(e) => {
        const msg = JSON.parse(e.nativeEvent.data) as Msg;
        if (msg.type === 'ready') {
          ready.current = true;
          run(`window.setCase(${JSON.stringify(cast)})`);
          if (playSignal > 0) run('window.playDisc()');
          if (demo) run('setTimeout(() => window.fling(160, 820), 3600); setTimeout(() => window.setOpen(true), 6600)');
        } else if (msg.type === 'open') onOpenChange(msg.open);
        else if (msg.type === 'played') onPlayed();
        else console.warn('case scene:', msg.message, msg.at ?? '');
      }}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: '#f6f5f2' } });
