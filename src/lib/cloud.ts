// The shared season. While you are in a crew, the roster, the matches and who is at which court come from Supabase (schema lol,
// db/sql/rpc/rpc_crew.sql) instead of this phone, and every screen keeps reading the same stores it always did (roster, matches,
// presence). Out of a crew, or with no backend configured, nothing here runs and the app stays local.
//
// Ids: you are always 'you' on this phone, as before; everyone else is their server player id. A match you report shows at once
// as pending, waits in an outbox until the server has it, and counts once the other player confirms.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import venues from '@/data/venues.json';
import { type Match, setCrewMatches } from '@/lib/matches';
import { pushToken } from '@/lib/push';
import { BEACON_HOURS, type Person, setCrewPresence } from '@/lib/presence';
import { type CastId, type Fighter, localYou, setCrewRoster } from '@/lib/roster';
import type { SetScore } from '@/lib/tennis';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const CLOUD_READY = !!URL && !!KEY;

const db = CLOUD_READY
  ? createClient(URL!, KEY!, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      db: { schema: 'lol' },
    })
  : null;

const YOU = 'you';
const OUTBOX_KEY = 'lol.outbox.v1';
const PHOTOS_KEY = 'lol.crewphotos.v1';

export type Crew = { id: string; name: string; code: string; role: string };
/** "Need N at this court": who called it, who it went to and what they said. Ids are roster ids ('you' for you). */
export type Callup = {
  id: string; caller: string; venue: string | null; need: number; message: string; status: 'open' | 'on' | 'off';
  expiresAt: number; createdAt: number; answers: Record<string, 'in' | 'out' | null>;
};
export type CloudState = {
  /** off: no backend configured. solo: signed in, not in a crew. crew: the season is shared. */
  status: 'off' | 'starting' | 'solo' | 'crew' | 'error';
  error: string | null;
  crew: Crew | null;
  /** Claim tokens for the pretenders in your crew, by roster id, for their invite links. */
  claims: Record<string, string>;
  /** Live call-ups in your crew (not expired, not called off), newest first. */
  callups: Callup[];
};

let state: CloudState = { status: CLOUD_READY ? 'starting' : 'off', error: null, crew: null, claims: {}, callups: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<CloudState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

// ------------------------------------------------------------------ rows ----

type PlayerRow = {
  player_id: string; user_id: string | null; display_name: string; cast_code: string; color_hex: string; bio: string;
  favorite_pro: string; home_court: string; racket: string; claim_token: string | null;
};
type MatchRow = {
  match_id: string; venue_code: string | null; venue_name: string; p1_player_id: string; p2_player_id: string; sets: SetScore[];
  minutes: number | null; dttm_played_utc: string; reported_by_player_id: string; status_code: 'pending' | 'confirmed' | 'disputed';
};
type BeaconRow = { player_id: string; venue_code: string; dttm_at_utc: string };
type CallupRow = {
  callup_id: string; caller_player_id: string; venue_code: string | null; need: number; message: string;
  status_code: 'open' | 'on' | 'off'; dttm_expires_utc: string; dttm_created_utc: string;
};
type AnswerRow = { callup_id: string; player_id: string; answer_code: 'in' | 'out' | null };

let meId: string | null = null;
const toLocal = (id: string) => (id === meId ? YOU : id);
const toServer = (id: string) => (id === YOU ? meId! : id);

const venueKey = Object.fromEntries(venues.map((v) => [v.id, v.key]));

// --------------------------------------------------- outbox and photos ----

type Outgoing = { match: Match };
let outbox: Outgoing[] = [];
let photos: Record<string, string> = {};

async function loadLocal() {
  try {
    const [o, p] = await Promise.all([AsyncStorage.getItem(OUTBOX_KEY), AsyncStorage.getItem(PHOTOS_KEY)]);
    outbox = o ? JSON.parse(o) : [];
    photos = p ? JSON.parse(p) : {};
  } catch {
    outbox = [];
    photos = {};
  }
}
const saveOutbox = () => AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)).catch(() => {});
const savePhotos = () => AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)).catch(() => {});

async function send(m: Match): Promise<boolean> {
  if (!db || !meId) return false;
  const { error } = await db.rpc('fn_report_match', {
    p_match_id: m.id,
    p_opponent: toServer(m.p1 === YOU ? m.p2 : m.p1),
    p_sets: m.sets,
    p_venue_code: m.courtId ?? null,
    p_venue_name: m.court,
    p_played_utc: new Date(m.playedAt).toISOString(),
    p_minutes: m.minutes ?? null,
    p_has_photo: !!m.photoUri,
  });
  return !error;
}

async function flush() {
  const left: Outgoing[] = [];
  for (const o of outbox) if (!(await send(o.match))) left.push(o);
  if (left.length !== outbox.length) { outbox = left; void saveOutbox(); }
}

// ------------------------------------------------------------------ sync ----

let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const refreshSoon = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void refresh(); }, 400); };

const fighter = (p: PlayerRow): Fighter => ({
  id: toLocal(p.player_id),
  name: p.display_name,
  cast: p.cast_code as CastId,
  color: p.color_hex,
  bio: p.bio,
  favoritePro: p.favorite_pro,
  homeCourt: p.home_court,
  racket: p.racket,
  isYou: p.player_id === meId || undefined,
  pretender: p.user_id === null || undefined,
});

const match = (r: MatchRow): Match => ({
  id: r.match_id,
  p1: toLocal(r.p1_player_id),
  p2: toLocal(r.p2_player_id),
  court: r.venue_name,
  courtId: r.venue_code ?? undefined,
  photoUri: photos[r.match_id] ?? null,
  sets: r.sets,
  playedAt: Date.parse(r.dttm_played_utc),
  minutes: r.minutes ?? undefined,
  status: r.status_code,
  reportedBy: toLocal(r.reported_by_player_id),
});

/** Pulls the whole crew. It is a handful of rows, so every change refetches everything rather than patching. */
export async function refresh() {
  const crew = state.crew;
  if (!db || !crew || !meId) return;
  await flush();
  const [members, players, ms, bs] = await Promise.all([
    db.from('tm_crew_players').select('player_id').eq('crew_id', crew.id),
    db.from('tb_players').select('*'),
    db.from('tb_matches').select('*').eq('crew_id', crew.id).order('dttm_played_utc'),
    db.from('tb_beacons').select('*').eq('crew_id', crew.id),
  ]);
  const err = members.error ?? players.error ?? ms.error ?? bs.error;
  if (err) { set({ error: err.message }); return; }
  const inCrew = new Set((members.data as { player_id: string }[]).map((r) => r.player_id));
  // The crew was deleted, or you left it from another phone: back to solo.
  if (!inCrew.has(meId)) { await loadCrew(); return; }
  const rows = (players.data as PlayerRow[]).filter((p) => inCrew.has(p.player_id));
  // You first, then real friends, then pretenders: the order the case picker and standings fall back on.
  rows.sort((a, b) => Number(b.player_id === meId) - Number(a.player_id === meId) || Number(a.user_id === null) - Number(b.user_id === null));
  const roster = rows.map(fighter);
  const byId = new Map(roster.map((f) => [f.id, f]));

  const server = (ms.data as MatchRow[]).map(match);
  const known = new Set(server.map((m) => m.id));
  const waiting = outbox.map((o) => o.match).filter((m) => !known.has(m.id));

  const since = Date.now() - BEACON_HOURS * 3600 * 1000;
  const people: Person[] = (bs.data as BeaconRow[])
    .filter((b) => b.player_id !== meId && Date.parse(b.dttm_at_utc) > since && venueKey[b.venue_code] && byId.has(b.player_id))
    .map((b) => { const f = byId.get(b.player_id)!; return { name: f.name, color: f.color, cast: f.cast, venue: venueKey[b.venue_code], at: Date.parse(b.dttm_at_utc) }; });

  setCrewRoster(roster, saveYou);
  setCrewMatches([...server, ...waiting], { add, remove });
  setCrewPresence(people, sendBeacon);
  set({
    error: null,
    callups: await loadCallups(crew.id),
    claims: Object.fromEntries(rows.filter((p) => p.claim_token).map((p) => [toLocal(p.player_id), p.claim_token!])),
  });
}

/** Call-ups need migration 003; before it is run the tables are missing and there are simply none. */
async function loadCallups(crewId: string): Promise<Callup[]> {
  if (!db) return [];
  const { data: cs, error } = await db.from('tb_callups').select('*').eq('crew_id', crewId).neq('status_code', 'off')
    .gt('dttm_expires_utc', new Date().toISOString()).order('dttm_created_utc', { ascending: false });
  if (error || !cs?.length) return [];
  const ids = (cs as CallupRow[]).map((c) => c.callup_id);
  const { data: as } = await db.from('tm_callup_players').select('callup_id, player_id, answer_code').in('callup_id', ids);
  return (cs as CallupRow[]).map((c) => ({
    id: c.callup_id, caller: toLocal(c.caller_player_id), venue: c.venue_code, need: c.need, message: c.message, status: c.status_code,
    expiresAt: Date.parse(c.dttm_expires_utc), createdAt: Date.parse(c.dttm_created_utc),
    answers: Object.fromEntries(((as ?? []) as AnswerRow[]).filter((a) => a.callup_id === c.callup_id).map((a) => [toLocal(a.player_id), a.answer_code])),
  }));
}

function subscribe(crewId: string) {
  if (!db) return;
  if (channel) void db.removeChannel(channel);
  const on = (table: string, filter?: string) => ({ event: '*' as const, schema: 'lol', table, ...(filter ? { filter } : {}) });
  channel = db
    .channel(`crew:${crewId}`)
    .on('postgres_changes', on('tb_matches', `crew_id=eq.${crewId}`), refreshSoon)
    .on('postgres_changes', on('tb_beacons', `crew_id=eq.${crewId}`), refreshSoon)
    .on('postgres_changes', on('tm_crew_players', `crew_id=eq.${crewId}`), refreshSoon)
    .on('postgres_changes', on('tb_players'), refreshSoon)
    .on('postgres_changes', on('tb_callups', `crew_id=eq.${crewId}`), refreshSoon)
    .on('postgres_changes', on('tm_callup_players'), refreshSoon)
    .on('postgres_changes', on('tb_crews'), refreshSoon)
    .subscribe();
}

async function loadCrew() {
  if (!db || !meId) return;
  const { data: link } = await db.from('tm_crew_players').select('crew_id, role_code').eq('player_id', meId).limit(1).maybeSingle();
  if (!link) {
    if (channel && db) { void db.removeChannel(channel); channel = null; }
    setCrewRoster(null); setCrewMatches(null); setCrewPresence(null);
    set({ status: 'solo', crew: null, claims: {}, callups: [] });
    return;
  }
  const { data: c, error } = await db.from('tb_crews').select('crew_id, crew_name, invite_code').eq('crew_id', link.crew_id).single();
  if (error || !c) { set({ status: 'error', error: error?.message ?? 'crew not found' }); return; }
  set({ status: 'crew', crew: { id: c.crew_id, name: c.crew_name, code: c.invite_code, role: link.role_code } });
  subscribe(c.crew_id);
  await refresh();
}

// --------------------------------------------------------------- writes ----

function add(m: Match) {
  outbox = [...outbox, { match: m }];
  void saveOutbox();
  if (m.photoUri) { photos = { ...photos, [m.id]: m.photoUri }; void savePhotos(); }
  void flush().then(refreshSoon);
}

function remove(id: string) {
  outbox = outbox.filter((o) => o.match.id !== id);
  void saveOutbox();
  if (db) void db.rpc('fn_withdraw_match', { p_match_id: id }).then(refreshSoon);
}

function saveYou(f: Fighter) {
  if (!db) return;
  void db.rpc('fn_save_me', {
    p_name: f.name, p_cast: f.cast, p_color: f.color, p_bio: f.bio, p_pro: f.favoritePro, p_home: f.homeCourt, p_racket: f.racket,
  });
}

function sendBeacon(venue: string | null) {
  if (db && state.crew) void db.rpc('fn_set_beacon', { p_venue_code: venue });
}

// --------------------------------------------------------------- public ----

let starting: Promise<void> | null = null;

/** Signs this phone in (anonymously: no signup screen), saves your fighter as a player, and loads your crew if you have one. */
export function startCloud(): Promise<void> {
  if (!db) return Promise.resolve();
  starting ??= (async () => {
    await loadLocal();
    let { data: { session } } = await db.auth.getSession();
    if (!session) {
      const { data, error } = await db.auth.signInAnonymously();
      if (error) {
        set({ status: 'error', error: /anonymous/i.test(error.message) ? 'Anonymous sign-ins are off in Supabase (Authentication, Providers).' : error.message });
        starting = null;
        return;
      }
      session = data.session;
    }
    const me = await localYou();
    const { data: id, error } = await db.rpc('fn_save_me', {
      p_name: me.name, p_cast: me.cast, p_color: me.color, p_bio: me.bio, p_pro: me.favoritePro, p_home: me.homeCourt, p_racket: me.racket,
    });
    if (error || !id) { set({ status: 'error', error: error?.message ?? 'could not save your fighter' }); starting = null; return; }
    meId = id as string;
    await loadCrew();
    // This phone's push token, so confirm requests and call-ups reach it. Fire and forget: no token is fine.
    void pushToken().then((t) => { if (t && db) void db.rpc('fn_save_push_token', { p_token: t, p_platform: Platform.OS }); });
  })();
  return starting;
}

if (db) {
  // Supabase on React Native: refresh the session only while the app is in front, and catch up on whatever changed meanwhile.
  AppState.addEventListener('change', (s) => {
    if (s === 'active') { db.auth.startAutoRefresh(); if (state.crew) void refresh(); }
    else db.auth.stopAutoRefresh();
  });
}

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function createCrew(name: string) {
  await startCloud();
  if (!db) throw new Error('No backend configured.');
  const { error } = await db.rpc('fn_create_crew', { p_name: name });
  fail(error);
  await loadCrew();
}

/** Rename your crew (anyone in it can). */
export async function renameCrew(name: string) {
  if (!db) throw new Error('No backend configured.');
  const { error } = await db.rpc('fn_rename_crew', { p_name: name });
  fail(error);
  await loadCrew();
}

/** Join by invite code. With a claim token you also become the pretender someone added for you, with their matches. */
export async function joinCrew(code: string, claim?: string | null) {
  await startCloud();
  if (!db) throw new Error('No backend configured.');
  const { error } = await db.rpc('fn_join_crew', { p_code: code, p_claim: claim ?? null });
  fail(error);
  await loadCrew();
}

/** Add a friend who is not in the app yet. They show as a pretender until they open their invite link. */
export async function addPretender(name: string, cast: CastId, color: string): Promise<string> {
  if (!db) throw new Error('No backend configured.');
  const { data, error } = await db.rpc('fn_add_pretender', { p_name: name, p_cast: cast, p_color: color });
  fail(error);
  await refresh();
  return toLocal((data as { player_id: string }).player_id);
}

/** The opponent's answer to a reported score: confirm it, or dispute it. */
export async function answerMatch(id: string, confirm: boolean) {
  if (!db) throw new Error('No backend configured.');
  const { error } = await db.rpc('fn_answer_match', { p_match_id: id, p_confirm: confirm });
  fail(error);
  await refresh();
}

/** The link that drops a friend into your crew; with a pretender's id, it also hands them that fighter. */
/** The crew you are in right now, read fresh (a screen's copy from useCloud is a render behind right after createCrew). */
export const crewNow = () => state.crew;

export function inviteLink(forId?: string): string | null {
  if (!state.crew) return null;
  const claim = forId ? state.claims[forId] : undefined;
  return Linking.createURL(`join/${state.crew.code}`, claim ? { queryParams: { claim } } : undefined);
}

/**
 * Call up the friends you circled (roster ids; empty means the whole crew): need `need` besides you, at `venue`, with a message.
 * Returns the call-up id for its link.
 */
export async function postCallup(players: string[], need: number, venue: string | null, message: string): Promise<string> {
  if (!db) throw new Error('No backend configured.');
  const { data, error } = await db.rpc('fn_post_callup', { p_venue_code: venue, p_need: need, p_message: message, p_players: players.map(toServer) });
  if (error) throw new Error(/fn_post_callup/.test(error.message) ? 'Run migration 003 in Supabase first.' : error.message);
  await refresh();
  return data as string;
}

/** In or out of a friend's call-up. Returns 'on' once enough are in. */
export async function answerCallup(id: string, inn: boolean): Promise<string> {
  if (!db) throw new Error('No backend configured.');
  const { data, error } = await db.rpc('fn_answer_callup', { p_callup_id: id, p_in: inn });
  fail(error);
  await refresh();
  return data as string;
}

export async function cancelCallup(id: string) {
  if (!db) return;
  const { error } = await db.rpc('fn_cancel_callup', { p_callup_id: id });
  fail(error);
  await refresh();
}

/** Leave your crew (your matches stay on their record). If you were the last real member, the crew is gone. */
export async function leaveCrew() {
  if (!db) return;
  const { error } = await db.rpc('fn_leave_crew');
  fail(error);
  await loadCrew();
}

/** The commissioner deletes the crew for everyone, with its matches, call-ups and pretenders. */
export async function deleteCrew() {
  if (!db) return;
  const { error } = await db.rpc('fn_delete_crew');
  fail(error);
  await loadCrew();
}

/** Take a pretender you added back out of the crew. */
export async function removePretender(id: string) {
  if (!db) return;
  const { error } = await db.rpc('fn_remove_pretender', { p_player: toServer(id) });
  fail(error);
  await refresh();
}

/** The link that opens a call-up; for anyone not in the crew it also joins them. */
export function callupLink(id: string): string | null {
  if (!state.crew) return null;
  return Linking.createURL(`callup/${id}`, { queryParams: { crew: state.crew.code } });
}

/** Call-ups a friend sent you that you have not answered. */
export const toCallupAnswer = (cs: Callup[]) => cs.filter((c) => c.caller !== YOU && c.status !== 'off' && c.answers[YOU] === null);

/** Matches someone reported against you that are waiting on your answer. */
export const toAnswer = (ms: Match[]) => ms.filter((m) => m.status === 'pending' && m.p2 === YOU && m.reportedBy !== YOU);
