// Tries read-ink's model call directly on a few lines, with a sample context. Costs real money (a few cents).
//   CLAUDE_API_KEY=... deno run -A db/tests/try_read_ink.ts                 # the built-in lines
//   CLAUDE_API_KEY=... deno run -A db/tests/try_read_ink.ts "a line" "..."  # your own
import Anthropic from 'npm:@anthropic-ai/sdk@0.134.0';

import { readLine, type ReadContext } from '../supabase/functions/read-ink/read.ts';

const context: ReadContext = {
  now_local: '2026-10-15T18:30',
  roster: [{ id: 'd1', name: 'DROPSHOT GOBLIN' }, { id: 'd2', name: 'SERVE BOT' }, { id: 'f1', name: 'DAVE' }, { id: 'f2', name: 'MARCO' }],
  casts: [{ id: 'wall', name: 'The Wall' }, { id: 'moon', name: 'Moonballer' }, { id: 'bot', name: 'Serve Bot' }, { id: 'junk', name: 'Junkballer' }],
  venues: [{ id: 'v1', name: 'Balboa Tennis Club' }, { id: 'v2', name: 'Linda Vista Community Park' }, { id: 'v3', name: 'North Park Rec Center' }],
  colors: ['yellow', 'pink', 'blue', 'orange', 'purple', 'green', 'red', 'white'],
  last_match: 'W vs MARCO 6-4 6-2',
};
const lines = Deno.args.length ? Deno.args : [
  'chnge figter to srvebot',
  'lost to dave 7-5 4-6 10-8 at linda vista yesterday around 6',
  'make me the junkballer and set my home court to north park',
  'got new strings 32 bucks',
  'whats the weather',
];
const anthropic = new Anthropic({ apiKey: Deno.env.get('CLAUDE_API_KEY') });
for (const line of lines) {
  const t0 = Date.now();
  const r = await readLine(anthropic, line, context);
  const text = r.content.find((b) => b.type === 'text');
  const out = text && text.type === 'text' ? JSON.parse(text.text) : r.stop_reason;
  const keep = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)));
  console.log(`${line}\n  -> ${JSON.stringify(keep)}\n  ${Date.now() - t0} ms, ${r.usage.input_tokens} in / ${r.usage.output_tokens} out\n`);
}
