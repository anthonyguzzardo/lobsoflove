import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { LOADING_SCENE_HTML } from '@/generated/loading-scene-html';
import type { LoadingSceneProps } from './loading-scene-types';

export function LoadingScene({ reduced, preview, fullReplay, active, onReady, onComplete, onError }: LoadingSceneProps) {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const html = useMemo(() => LOADING_SCENE_HTML.replace('__CONFIG__', JSON.stringify({ reduced, preview, fullReplay, active: true })), [reduced, preview, fullReplay]);
  const syncActive = () => web.current?.injectJavaScript(`window.setLoadingActive?.(${JSON.stringify(active)});true;`);
  useEffect(() => { if (ready.current) web.current?.injectJavaScript(`window.setLoadingActive?.(${JSON.stringify(active)});true;`); }, [active]);
  return <WebView ref={web} source={{ html }} originWhitelist={['*']} style={styles.web}
    scrollEnabled={false} bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="never"
    javaScriptEnabled onError={onError} onContentProcessDidTerminate={onError} onRenderProcessGone={onError}
    onMessage={event => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.source !== 'lol-loading') return;
        if (message.type === 'ready') { ready.current = true; syncActive(); onReady(); }
        else if (message.type === 'complete') onComplete();
        else if (message.type === 'error') onError();
      } catch { onError(); }
    }} />;
}
const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: '#eee9df' } });
