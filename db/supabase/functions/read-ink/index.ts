// ============================================================================
// read-ink: turns one line of handwriting into exactly one app action
// ============================================================================
// The app's ink canvas reads a line ("lost to dave 7-5 4-6 10-8 at linda vista",
// "chnge figter to srvebot") and its offline reader does not understand it. The
// app posts the line here with what it knows (roster, courts, fighter styles, the
// local time); Claude picks one action from a fixed list, answering in a fixed
// JSON shape. The app turns that action back into its own card, so the player
// still confirms everything with a check mark. Nothing is written to the app's
// data here.
//
// WHAT THE SERVER ENFORCES:
//   - apikey header must be the app's publishable key (LOL_APP_KEY). That key is
//     public, so this only stops stray traffic. The real guard is next.
//   - Daily caps from lol.th_ink_reads, checked before the paid call:
//     LOL_INK_DAILY_CAP (all devices, default 400) and LOL_INK_DEVICE_CAP (one
//     device, default 60). Past either: 429, no model call.
//   - Input sanitized and capped at 300 characters.
//
// AUTH MODEL: there are no accounts yet, so there is no JWT to verify. When
// accounts exist, verify the caller with auth.getUser() (Dealifier pattern) and
// key the cap by user instead of device.
//
// SECRETS (supabase secrets set ...): CLAUDE_API_KEY, LOL_SUPABASE_SECRET_KEY,
//   LOL_APP_KEY, optional LOL_INK_DAILY_CAP, LOL_INK_DEVICE_CAP.
//   SUPABASE_URL is injected by Supabase.
//
// DEPLOY (from db/): supabase functions deploy read-ink --no-verify-jwt
// ============================================================================

import Anthropic from 'npm:@anthropic-ai/sdk@0.134.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { z } from 'npm:zod@4';

import { Action, readLine } from './read.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SECRET_KEY = Deno.env.get('LOL_SUPABASE_SECRET_KEY') ?? '';
const APP_KEY = Deno.env.get('LOL_APP_KEY') ?? '';
const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') ?? '';
const DAILY_CAP = Number(Deno.env.get('LOL_INK_DAILY_CAP') ?? 400);
const DEVICE_CAP = Number(Deno.env.get('LOL_INK_DEVICE_CAP') ?? 60);
const MAX_LINE = 300;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const Item = z.object({ id: z.string().max(80), name: z.string().max(80) });
const Body = z.object({
  device_id: z.string().min(8).max(64),
  text: z.string().min(1).max(2000),
  context: z.object({
    now_local: z.string().max(40),
    roster: z.array(Item).max(60),
    casts: z.array(Item).max(30),
    venues: z.array(Item).max(30),
    colors: z.array(z.string().max(20)).max(30),
    last_match: z.string().max(120).nullable(),
  }),
});

serve();

function serve() {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      if (!SUPABASE_URL || !SECRET_KEY || !CLAUDE_API_KEY || !APP_KEY) {
        console.error('[read-ink] missing secrets');
        return json({ error: 'Not configured' }, 500);
      }
      if (req.headers.get('apikey') !== APP_KEY) return json({ error: 'Unauthorized' }, 401);

      const parsed = Body.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return json({ error: 'Bad request', code: 'INVALID_BODY' }, 400);
      const { device_id, context } = parsed.data;
      // Strip control and bidi characters, then cap the length (Dealifier input rule).
      const text = parsed.data.text.replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, ' ').trim().slice(0, MAX_LINE);
      if (!text) return json({ error: 'Bad request', code: 'EMPTY_TEXT' }, 400);

      const db = createClient(SUPABASE_URL, SECRET_KEY, { db: { schema: 'lol' }, auth: { persistSession: false } });
      const since = new Date(Date.now() - 24 * 3600e3).toISOString();
      const [all, mine] = await Promise.all([
        db.from('th_ink_reads').select('ink_read_id', { count: 'exact', head: true }).gte('dttm_created_utc', since),
        db.from('th_ink_reads').select('ink_read_id', { count: 'exact', head: true }).gte('dttm_created_utc', since).eq('device_id', device_id),
      ]);
      if (all.error || mine.error) {
        console.error('[read-ink] cap check failed', all.error ?? mine.error);
        return json({ error: 'Server error' }, 500);
      }
      if ((all.count ?? 0) >= DAILY_CAP || (mine.count ?? 0) >= DEVICE_CAP) {
        await db.from('th_ink_reads').insert({ device_id, input_text: text, action: 'capped', is_error: true });
        return json({ error: 'Too many reads today', code: 'CAPPED' }, 429);
      }

      const response = await readLine(new Anthropic({ apiKey: CLAUDE_API_KEY }), text, context);

      const usage = { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
      if (response.stop_reason === 'refusal') {
        await db.from('th_ink_reads').insert({ device_id, input_text: text, action: 'refusal', is_error: true, ...usage });
        return json({ ok: true, action: { action: 'unknown', note: "can't help with that one" } });
      }
      const raw = response.content.find((b) => b.type === 'text');
      const action = raw && raw.type === 'text' ? Action.safeParse(JSON.parse(raw.text)) : null;
      if (!action?.success) {
        console.error('[read-ink] unparseable model output', response.stop_reason);
        await db.from('th_ink_reads').insert({ device_id, input_text: text, action: 'error', is_error: true, ...usage });
        return json({ error: 'Could not read that', code: 'BAD_OUTPUT' }, 502);
      }
      await db.from('th_ink_reads').insert({ device_id, input_text: text, action: action.data.action, result: action.data, ...usage });
      return json({ ok: true, action: action.data });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'Busy, try again', code: 'RATE_LIMITED' }, 429);
      if (err instanceof Anthropic.APIError) {
        console.error('[read-ink] model error', err.status, err.message);
        return json({ error: 'Could not read that', code: 'MODEL_ERROR' }, 502);
      }
      console.error('[read-ink]', err);
      return json({ error: 'Server error' }, 500);
    }
  });
}
