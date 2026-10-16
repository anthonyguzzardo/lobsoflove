// The AI reader: when the offline reader (ink-commands, ink-parse) does not understand a line, the line goes to the
// read-ink edge function (db/supabase/functions/read-ink), which returns one action. The action is turned back into
// text the offline reader does understand, so every card, check and question stays in one place.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLOR_WORDS } from '@/lib/ink-commands';
import { when, type Card } from '@/lib/ink-parse';
import { CAST, CAST_IDS, type CastId, type Fighter } from '@/lib/roster';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const AI_READER_READY = !!URL && !!KEY;

/** What read-ink returns (mirrors Action in db/supabase/functions/read-ink/read.ts). */
export type InkAction = {
  action: 'log_match' | 'log_gear' | 'set_fighter' | 'set_color' | 'set_name' | 'set_court' | 'set_home_court' | 'undo_last_match' | 'open_page' | 'unknown';
  opponent_id?: string | null;
  opponent_written?: string | null;
  sets?: { mine: number; theirs: number }[];
  i_won?: boolean | null;
  played_at_local?: string | null;
  minutes?: number | null;
  court_id?: string | null;
  cast_id?: string | null;
  color?: string | null;
  name?: string | null;
  gear_item?: string | null;
  cost?: number | null;
  page?: string | null;
  note: string;
};

export type AiContext = { roster: Fighter[]; venues: { id: string; name: string }[]; lastMatch: string | null };

const DEVICE_KEY = 'lol.device';
let device: string | null = null;
/** A random id per install: the server caps reads per device until accounts exist. */
async function deviceId(): Promise<string> {
  if (device) return device;
  device = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (!device) {
    device = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    AsyncStorage.setItem(DEVICE_KEY, device).catch(() => {});
  }
  return device;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Asks read-ink. Throws on no signal, a cap, or a server error; the caller shows that on the card. */
export async function askAiReader(text: string, ctx: AiContext): Promise<InkAction> {
  if (!AI_READER_READY) throw new Error('AI reader not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${URL}/functions/v1/read-ink`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: KEY!, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        device_id: await deviceId(),
        text,
        context: {
          now_local: localStamp(new Date()),
          roster: ctx.roster.filter((f) => !f.isYou).map((f) => ({ id: f.id, name: f.name })),
          casts: CAST_IDS.map((c) => ({ id: c, name: CAST[c].label })),
          venues: ctx.venues,
          colors: Object.keys(COLOR_WORDS),
          last_match: ctx.lastMatch,
        },
      }),
    });
    const body = (await res.json()) as { ok?: boolean; action?: InkAction; code?: string };
    if (!res.ok || !body.action) throw new Error(body.code ?? `HTTP ${res.status}`);
    return body.action;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The action as a line the offline reader understands, plus what that line cannot carry (a written time, a court).
 * null for "unknown".
 */
export function actionToLine(a: InkAction, ctx: AiContext): { line: string; playedAt?: number; courtId?: string } | null {
  const venue = (id?: string | null) => ctx.venues.find((v) => v.id === id)?.name;
  switch (a.action) {
    case 'log_match': {
      const opp = ctx.roster.find((f) => f.id === a.opponent_id)?.name ?? a.opponent_written ?? '';
      const sets = (a.sets ?? []).map((s) => `${s.mine}-${s.theirs}`).join(' ');
      const word = a.i_won === true ? 'beat' : a.i_won === false ? 'lost to' : 'vs';
      const at = a.played_at_local ? new Date(a.played_at_local).getTime() : NaN;
      return {
        line: `${word} ${opp} ${sets}${a.minutes ? ` ${a.minutes}min` : ''}`.trim(),
        playedAt: Number.isFinite(at) ? at : undefined,
        courtId: venue(a.court_id) ? a.court_id! : undefined,
      };
    }
    case 'log_gear':
      return a.gear_item ? { line: `${a.gear_item.toLowerCase()}${a.cost != null ? ` $${a.cost}` : ''}` } : null;
    case 'set_fighter':
      return a.cast_id && a.cast_id in CAST ? { line: `change fighter to ${CAST[a.cast_id as CastId].label}` } : null;
    case 'set_color':
      return a.color ? { line: `color ${a.color}` } : null;
    case 'set_name':
      return a.name ? { line: `call me ${a.name}` } : null;
    case 'set_court':
      return venue(a.court_id) ? { line: `court ${venue(a.court_id)}` } : null;
    case 'set_home_court':
      return venue(a.court_id) ? { line: `home court ${venue(a.court_id)}` } : null;
    case 'undo_last_match':
      return { line: 'undo last match' };
    case 'open_page':
      return a.page ? { line: `open ${a.page === 'case' ? 'play' : a.page}` } : null;
    default:
      return null;
  }
}

/** Fills in what the line could not carry: the written time and the court, on a match card. */
export function patchCard(card: Card, extra: { playedAt?: number; courtId?: string }, venues: { id: string; name: string }[]): Card {
  if (card.draft.kind !== 'match') return card;
  const draft = { ...card.draft };
  const lines = [...card.lines];
  if (extra.playedAt) {
    draft.playedAt = extra.playedAt;
    draft.when = when(new Date(extra.playedAt), new Date());
    lines[2] = lines[2]?.includes('·') ? `${draft.when} ·${lines[2].split('·').slice(1).join('·')}` : draft.when;
  }
  if (extra.courtId) {
    draft.courtId = extra.courtId;
    lines.push(`@ ${venues.find((v) => v.id === extra.courtId)?.name ?? ''}`);
  }
  return { ...card, lines, draft };
}

/** The card for a line the AI could not turn into anything. */
export function unknownCard(text: string, note: string): Card {
  return { text, lines: [`"${text}"`, note || 'not sure what to do with that', 'try writing it another way'], questions: [], warn: null, canSave: false, draft: { kind: 'none' } };
}
