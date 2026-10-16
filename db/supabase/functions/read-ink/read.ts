// The model call behind read-ink, apart from HTTP, caps and logging, so it can be tried directly:
//   CLAUDE_API_KEY=... deno run -A db/tests/try_read_ink.ts "chnge figter to srvebot"
import Anthropic from 'npm:@anthropic-ai/sdk@0.134.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.134.0/helpers/zod';
import { z } from 'npm:zod@4';

export const MODEL = 'claude-opus-5-5';

/** The one action Claude may return. Every field is present; the ones that do not apply are null. */
export const Action = z.object({
  action: z.enum(['log_match', 'log_gear', 'set_fighter', 'set_color', 'set_name', 'set_court', 'set_home_court', 'undo_last_match', 'open_page', 'unknown']),
  opponent_id: z.string().nullable(),
  opponent_written: z.string().nullable(),
  sets: z.array(z.object({ mine: z.number().int(), theirs: z.number().int() })),
  i_won: z.boolean().nullable(),
  played_at_local: z.string().nullable(),
  minutes: z.number().int().nullable(),
  court_id: z.string().nullable(),
  cast_id: z.string().nullable(),
  color: z.string().nullable(),
  name: z.string().nullable(),
  gear_item: z.enum(['RESTRING', 'REGRIP', 'OVERGRIP', 'RACKET', 'SHOES', 'BALLS']).nullable(),
  cost: z.number().nullable(),
  page: z.enum(['home', 'standings', 'courts', 'fighter', 'gear', 'case']).nullable(),
  note: z.string(),
});

// Static, so it caches (tools -> system -> messages; nothing per-request goes here).
const SYSTEM = `You read one line a tennis player wrote with their finger in the LobsOfLove app and decide what they want the app to do. The line came from handwriting recognition, so expect misread letters (0/o, 1/l, 5/s, 6/b), missing spaces, and misspellings. Work out what they meant.

Pick exactly one action:
- log_match: they played a match. sets = every set in order, each as {mine, theirs} from the WRITER's side (people often write the winner's score first: "lost 6-3 6-2" means mine 3, theirs 6). i_won = true/false. opponent_id = the id of the roster player they named; if the name fits nobody, opponent_id = null and opponent_written = what they wrote. played_at_local = "YYYY-MM-DDTHH:MM" only if they wrote a time or day, resolved against now_local (a match being logged is in the past); else null. minutes = how long it lasted, if written. court_id = a venue id if they named one.
- log_gear: a restring, regrip, overgrip, racket, shoes, or balls. gear_item, and cost in dollars if written.
- set_fighter: change their own fighter style. cast_id from casts.
- set_color: change their color. color = one word from colors.
- set_name: change their own display name. name = the new name, as written.
- set_court: the court they are playing at now. court_id from venues.
- set_home_court: their home court. court_id from venues.
- undo_last_match: delete their last logged match.
- open_page: go to a page. page = home, standings, courts, fighter, gear, or case (case = pick an opponent and start a match).
- unknown: anything else, or too unclear to act on.

Only use ids that appear in the context. Never invent an opponent, court, or style. Every field must be present; use null (or [] for sets) for fields that do not apply. note = a few plain words on what you understood (shown to the player if the action is unknown).`;


export type ReadContext = {
  now_local: string;
  roster: { id: string; name: string }[];
  casts: { id: string; name: string }[];
  venues: { id: string; name: string }[];
  colors: string[];
  last_match: string | null;
};

/** One read: low effort (a short classification), fixed JSON shape, server-side fallback if the model declines. */
export function readLine(anthropic: Anthropic, line: string, context: ReadContext) {
  return anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: zodOutputFormat(Action) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify({ context, line }) }],
  });
}
