/**
 * ---- ONE TELLING AFTER ANOTHER ----
 *
 * Owner, 1.8.1: "we need to increase the variety of news stories to fill the
 * game out a bit, feels too samey at times."
 *
 * Measured before a word was written (scripts/newsmix.ts, three seasons in each
 * world): the wire's three-line pools each printed ONE line for a whole season.
 * They picked with `(season * 5 + week * 3 + salt) % 3`, and week * 3 is a
 * multiple of three, so the week never moved the answer: "Still frosty at
 * Gloucester" ran nine times in three seasons, word for word, and never once
 * as either of the other two lines written for it. A two-line or four-line pool
 * happened to escape; every three-line pool in the game was a single sentence.
 *
 * So the choice is a rotation now, and the thing that turns it is the inbox
 * itself: how many stories from this pool have already been filed this season.
 * The next one is the line that has had the longest rest, so a story told
 * three times in a season is told three different ways, and the season number
 * moves the starting point so next year does not open with the same line.
 *
 * Deterministic and rng-free, like the arithmetic it replaces: reading the
 * inbox cannot move the world stream, and a replayed week picks the same line.
 */
import type { GameState } from './model'
import { baseKey } from './i18n'

/**
 * The next telling from a pool of keys. `family` is what counts as "already
 * told" - the pool itself by default; a pool of headlines passes the pool of
 * bodies it travels with, because a headline is stored inside the story's
 * variables rather than as its key.
 */
export function nextTelling(state: GameState, opts: readonly string[], salt = 0, family: readonly string[] = opts): string {
  const told = state.news.filter(n =>
    n.season === state.season && n.k != null && family.includes(baseKey(n.k))).length
  return opts[(told + state.season * 3 + salt) % opts.length]
}

/**
 * The same, for a story written as one key with numbered retellings: the base
 * key is the first telling and `${base}V2`, `${base}V3` the others. A telling
 * that is a story carries its own headline (`${key}Subj`), as every story key
 * does; one that is a fragment inside a story does not need one.
 */
export function telling(state: GameState, base: string, salt = 0, family?: readonly string[]): string {
  const opts = tellingsOf(base)
  return nextTelling(state, opts, salt, family ?? opts)
}

/** The story a key tells, whichever telling it is: `news.coachOutV2` is still
 *  `news.coachOut`. What a probe or a filter should compare against. */
export const storyOf = (k: string): string => k.replace(/V\d+$/, '')

/** The base key and its numbered retellings, in order. */
export const tellingsOf = (base: string): string[] =>
  [base, ...Array.from({ length: (RETOLD[base] ?? 1) - 1 }, (_, i) => `${base}V${i + 2}`)]

/** Every key the numbered retellings add, for the probes that hold them to six
 *  languages. Kept beside telling() so a new retelling is one edit. */
export const RETOLD: Record<string, number> = {
  'news.backInTraining': 3,
  'news.milestone': 3,
  'news.coachOut': 3,
  'news.campRound': 3,
  'news.boardMemo': 3,
  'news.deputationNamed': 3,
  'news.aLeaguePos': 3,
  'news.fanRumble': 3,
  'news.fanForgiven': 3,
  // fragments inside the A League report rather than stories of their own, so
  // they carry no headline
  'news.aCoachNamed': 3,
  'news.aCoachAnon': 3,
}
