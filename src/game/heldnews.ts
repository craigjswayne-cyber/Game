// ---- STORIES THAT DO NOT SPEND THE ID COUNTER ----
//
// News, players and fixtures take their ids from one counter, state.nextId,
// and the match engine seeds a fixture's dice from its id. So every story that
// takes an id pushes every fixture drawn after it, in this settle or in any
// later one, onto another id and another stream. A module that only tells the
// manager things (the manager's memory, the club's history book, the identity
// and bonds work) would then move AI results without reading or writing
// anything those matches use. memoryprobe caught it: with ten memory stories
// told, the knockout ties of week 33 were drawn at 1001807 instead of 1001800.
//
// Holding a story to the end of the week settle is not enough on its own, for
// that reason: an id taken at the end of this week is an id next week's draw
// does not get. So a held story takes a FRACTION above the last id minted:
// base + 0.001, base + 0.002, where base = nextId - 1.
//
//   - it sorts after everything filed before it and before everything minted
//     after it, so days.ts (`id >= newsFrom`) and every "newest first" reader
//     see it exactly where a whole id would have put it;
//   - it is unique: one shared cursor (state.heldIds) hands out the fractions
//     for every module that files this way, and resets only when the base moves;
//   - the counter never moves, so no fixture id can.
//
// save.ts floors the highest news id when it repairs nextId, so a fraction can
// never become the counter.
//
// HOW TO USE IT. Hold the story (queue it without an id) while the week is
// being settled, and call fileHeldNews at the end of the settle - season.ts
// does that for the memory and the history book after the advance. A story
// filed from a button, outside any settle, may be passed straight in.

import type { GameState, NewsItem } from './model'

/** A story waiting for its id. */
export type HeldStory = Omit<NewsItem, 'id'>

/** The news list's ceiling (season.ts NEWS_KEEP; season.ts imports the
 *  modules that call this, so the number is repeated rather than imported). */
const NEWS_CAP = 250

/** File held stories with ids that do not spend state.nextId. */
export function fileHeldNews(state: GameState, stories: HeldStory[]): void {
  if (!stories.length) return
  const base = state.nextId - 1
  if (!state.heldIds || typeof state.heldIds !== 'object') state.heldIds = { b: base, n: 0 }
  const cur = state.heldIds
  if (cur.b !== base || !Number.isFinite(cur.n)) { cur.b = base; cur.n = 0 }
  for (const s of stories) {
    cur.n += 1
    // a thousand stories on one base is not a week that happens; if it ever
    // did, the story takes a whole id like anything else rather than collide
    const id = cur.n < 1000 ? base + cur.n / 1000 : state.nextId++
    state.news.push({ ...s, id, k: s.k, v: s.v })
  }
  if (state.news.length > NEWS_CAP) state.news = state.news.slice(-NEWS_CAP)
}
