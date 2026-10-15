import { useEffect, useMemo, useRef } from 'react';
import { LOADING_SCENE_HTML } from '@/generated/loading-scene-html';
import type { LoadingSceneProps } from './loading-scene-types';

export function LoadingScene({ reduced, preview, fullReplay, active, onReady, onComplete, onError }: LoadingSceneProps) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => LOADING_SCENE_HTML.replace('__CONFIG__', JSON.stringify({ reduced, preview, fullReplay, active: true })), [reduced, preview, fullReplay]);
  useEffect(() => {
    const syncActive = () => iframe.current?.contentWindow?.postMessage(JSON.stringify({ source: 'lol-loading-control', active }), '*');
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow) return;
      try {
        const message = JSON.parse(event.data);
        if (message.source !== 'lol-loading') return;
        if (message.type === 'ready') { syncActive(); onReady(); }
        else if (message.type === 'complete') onComplete();
        else if (message.type === 'error') onError();
      } catch { onError(); }
    };
    window.addEventListener('message', receive); syncActive();
    return () => window.removeEventListener('message', receive);
  }, [active, onReady, onComplete, onError]);
  return <iframe ref={iframe} title="Lobs of Love team intro" srcDoc={html} sandbox="allow-scripts"
    onError={onError} style={{ width: '100%', height: '100%', border: 0, background: '#eee9df' }} />;
}
