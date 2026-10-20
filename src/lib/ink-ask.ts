import { router } from 'expo-router';

/**
 * One answer from the TYPE / WRITE page (/ink?for=ask) for a page that needs a few words: your fighter's name, a racket's
 * name, a call-up message. No form sheet: the page asks, /ink takes it typed or handwritten, and `done` gets the text.
 */
export type Ask = { label: string; max: number; upper?: boolean; examples?: string[] };

let pending: { ask: Ask; done: (text: string) => void } | null = null;

export function askInk(ask: Ask, done: (text: string) => void) {
  pending = { ask, done };
  router.push('/ink?for=ask');
}

/** The question /ink is answering, if it was opened for one. */
export const currentAsk = (): Ask | null => pending?.ask ?? null;

/** The answer, cleaned to the ask's length and case. Calls the asking page back once. */
export function answerAsk(text: string) {
  const p = pending;
  pending = null;
  if (!p) return;
  const t = text.trim().slice(0, p.ask.max);
  p.done(p.ask.upper ? t.toUpperCase() : t);
}
