import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { CLOSET_HTML } from '@/generated/closet-html';
import {
  type GearItem, type GearKind, LIFE, type Service, SERVICES,
  addItem, crackCan, dueList, lowStock, regrip, removeItem, renameItem, restock, service, setPhoto, useCloset, wearOf,
} from '@/lib/gear';
import { type Match, useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';
import { askInk } from '@/lib/ink-ask';

type Msg =
  | { type: 'doors' | 'knock' | 'grab' | 'fling' | 'tick' | 'ping' | 'wrap' | 'kick' | 'pop' | 'land' | 'thud' | 'squeak' | 'crack' }
  | { type: 'clack' | 'pock'; v: number }
  | { type: 'focus'; id: string | null }
  | { type: 'add'; kind: 'racket' | 'shoes' }
  | { type: 'restock'; kind: 'balls' | 'grips' }
  | { type: 'service'; id: string; s: Service }
  | { type: 'photo' | 'edit' | 'remove'; id: string }
  | { type: 'order'; kind: GearKind };

const DEFAULT_NAME: Record<GearKind, string> = { racket: 'RACKET', shoes: 'COURT SHOES', balls: 'BALLS', grips: 'OVERGRIPS' };
const PLACEHOLDER: Record<GearKind, string> = { racket: 'PURE AERO', shoes: 'GEL RESOLUTION', balls: 'PENN CHAMPIONSHIP', grips: 'TOURNA GRIP' };
const SEARCH: Record<GearKind, string> = { racket: 'tennis racket', shoes: 'tennis shoes', balls: 'tennis balls', grips: 'tennis overgrip' };

/** Photos load into the page as data URIs; a file is read once and kept. */
const dataUris = new Map<string, string>();
function dataUri(uri: string | null): string | null {
  if (!uri) return null;
  const hit = dataUris.get(uri);
  if (hit) return hit;
  try {
    const d = `data:image/jpeg;base64,${new File(uri).base64Sync()}`;
    dataUris.set(uri, d);
    return d;
  } catch {
    return null;
  }
}

function stateLine(w: { matches: number; days: number }, s: Service) {
  const life = LIFE[s];
  return `${w.matches} of ${life.matches} matches, ${w.days} of ${life.days} days`;
}

function payloadOf(items: GearItem[], matches: Match[]) {
  return {
    due: dueList(items, matches),
    items: items.map((it) => ({
      id: it.id,
      kind: it.kind,
      name: it.name,
      photo: dataUri(it.photo),
      stock: it.stock ?? 0,
      low: lowStock(it),
      hasOpen: it.kind === 'balls' && it.serviced.can != null,
      stamps: it.serviced,
      rows: SERVICES[it.kind]
        .filter((s) => s !== 'can' || it.serviced.can != null)
        .map((s) => {
          const w = wearOf(it, s, matches);
          return { s, word: LIFE[s].word, verb: LIFE[s].verb, text: stateLine(w, s), worn: w.worn };
        }),
    })),
  };
}

/** A sample closet for `?demo=1` recordings. Never saved. */
const DAY = 86_400_000;
const demoCloset = (now: number): GearItem[] => [
  { id: 'demo-r1', kind: 'racket', name: 'PURE AERO', photo: null, addedAt: now - 200 * DAY, serviced: { strings: now - 96 * DAY, overgrip: now - 12 * DAY } },
  { id: 'demo-r2', kind: 'racket', name: 'BLADE 98', photo: null, addedAt: now - 40 * DAY, serviced: { strings: now - 20 * DAY, overgrip: now - 34 * DAY } },
  { id: 'demo-s1', kind: 'shoes', name: 'GEL RESOLUTION', photo: null, addedAt: now - 150 * DAY, serviced: {} },
  { id: 'balls', kind: 'balls', name: 'PENN CHAMPIONSHIP', photo: null, addedAt: now - 30 * DAY, serviced: { can: now - 9 * DAY }, stock: 3 },
  { id: 'grips', kind: 'grips', name: 'OVERGRIPS', photo: null, addedAt: now - 30 * DAY, serviced: {}, stock: 2 },
];

/** Copies a picked photo into the documents folder so it outlives the picker's cache. */
async function pickPhoto(): Promise<string | null> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  const opts: ImagePicker.ImagePickerOptions = { quality: 0.45, allowsEditing: true, aspect: [1, 1] };
  const res = cam.granted ? await ImagePicker.launchCameraAsync(opts).catch(() => null) : null;
  const picked = res && !res.canceled ? res : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ['images'] });
  if (picked.canceled || !picked.assets[0]) return null;
  try {
    const dest = new File(Paths.document, `gear-${Date.now()}.jpg`);
    await new File(picked.assets[0].uri).copy(dest);
    return dest.uri;
  } catch {
    return picked.assets[0].uri;
  }
}

/** Gear closet: a locker drawn by three.js in a WebView (web/closet.js). */
export default function Closet() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const saved = useCloset();
  const [demo] = useState(() => demoCloset(Date.now()));
  const items = params.demo === '1' ? demo : saved;
  const matches = useMatches();
  const scene = useScene();
  const { run } = scene;
  const focused = useRef<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const data = useMemo(() => JSON.stringify(payloadOf(items, matches)), [items, matches]);
  useEffect(() => { run(`window.setCloset(${data})`); }, [run, data]);

  const byId = (id: string) => itemsRef.current.find((i) => i.id === id);
  /** Naming a piece of gear happens on the TYPE / WRITE page; the answer renames it here. */
  const startEdit = (id: string) => {
    const it = byId(id);
    if (!it) return;
    askInk({ label: 'WHAT IS IT CALLED', max: 22, upper: true, examples: [PLACEHOLDER[it.kind]] }, (t) => { renameItem(id, t || DEFAULT_NAME[it.kind]); void Haptics.selectionAsync(); });
  };
  const add = async (kind: 'racket' | 'shoes') => {
    const photo = await pickPhoto();
    const id = addItem(kind, DEFAULT_NAME[kind], photo);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startEdit(id);
  };
  const back = () => {
    if (focused.current) run('window.unfocus()');
    else goBack();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={CLOSET_HTML}
        name="closet"
        cues={{ land: null, slid: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } }}
        onReady={() => { if (params.demo === '1') run('window.demoCloset()'); }}
        onMessage={(m: SceneMsg) => {
          const msg = m as Msg;
          switch (msg.type) {
            case 'doors': sfx('swish', 0.35); break;
            case 'knock': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('clack', 0.35); break;
            case 'grab': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); break;
            case 'fling': sfx('swish', 0.5); break;
            case 'clack': void Haptics.impactAsync(msg.v > 0.5 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); sfx('clack', 0.3 + 0.6 * msg.v); break;
            case 'pock': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('bounce', 0.3 + 0.5 * msg.v); break;
            case 'squeak': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('squeak', 0.5); break;
            case 'thud': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('bounce', 0.6); break;
            case 'ping': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('ping', 0.8); break;
            case 'wrap': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('swish', 0.4); break;
            case 'kick': sfx('swish', 0.6); break;
            case 'pop': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('can', 0.8); break;
            case 'land': sfx('pock', 0.4); break;
            case 'tick': void Haptics.selectionAsync(); sfx('tick', 0.5); break;
            case 'focus': focused.current = msg.id; if (msg.id) { void Haptics.selectionAsync(); sfx('select', 0.5); } break;
            case 'add': if (params.demo !== '1') void add(msg.kind); break;
            case 'restock': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (params.demo !== '1') restock(msg.kind, 1); break;
            case 'crack': if (params.demo !== '1') crackCan(); break;
            case 'service':
              if (params.demo === '1') break;
              if (msg.s === 'overgrip') regrip(msg.id); else service(msg.id, msg.s);
              break;
            case 'photo': void pickPhoto().then((p) => { if (p) setPhoto(msg.id, p); }); break;
            case 'edit': startEdit(msg.id); break;
            case 'remove': {
              const it = byId(msg.id);
              if (!it || it.kind === 'balls' || it.kind === 'grips') break;
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(`Take ${it.name} out of the closet?`, 'Its wear history goes with it.', [
                { text: 'Keep it', style: 'cancel' },
                { text: 'Take it out', style: 'destructive', onPress: () => { removeItem(msg.id); run('window.unfocus()'); } },
              ]);
              break;
            }
            case 'order': {
              const it = itemsRef.current.find((i) => i.kind === msg.kind);
              const q = it && it.name !== DEFAULT_NAME[msg.kind] ? `${it.name} ${SEARCH[msg.kind]}` : SEARCH[msg.kind];
              void WebBrowser.openBrowserAsync(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`);
              break;
            }
          }
        }}
      />
      <BackSwing floating onBack={back} />
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
