// Recovering the key from a press item that was saved before there were keys.
//
// The whole press room used to be built from English sentences and SAVED that
// way. A career started before that changed carries answered questions in its
// coverage list - "Three options are circled on the staff-room whiteboard" -
// and they are history, so the room never sweeps them: they sit there in
// English until forty newer questions have pushed them out, which is seasons.
//
// The stored sentence is the English template with its variables filled in, so
// the template can be matched back out of it. Every press.* entry becomes a
// regex with a capture where each {hole} was; the first one that matches a
// stored line gives back both the key and the values that were poured into it.
// A player name goes in and comes out unchanged, which is the point - the
// French sentence needs the same name in a different place.
//
// Anything that does not match is left exactly as it was. A wrong guess here
// would put the wrong words in a manager's mouth, so no match means no change.
import EN from '../locales/en.json'
import type { PressItem, PressOption } from './model'
import type { Vars } from './i18n'

type Pattern = { k: string; names: string[]; rx: RegExp; literal: number }

let INDEX: Pattern[] | null = null
/** [key, the English it was saved under before its wording changed] */
const LEGACY_EN: ReadonlyArray<readonly [string, string]> = [
  ['press.campHeat', 'Warm-weather camp ({cost})'],
  // these stopped calling every club's home "the town" (owner: language
  // relevant to location)
  ['press.campQ2', "Three options are circled on the staff-room whiteboard for the spare pre-season week: the heat camp, the town, or the sponsor's roadshow. The department heads are waiting on you."],
  ['press.campHomeR', 'Schools, junior clubs, open training. Costs nothing, and the town will remember it all season.'],
  ['press.silverFansR', 'The town takes it personally, in the best way. Season-ticket renewals do not need a letter this year.'],
  ['press.raceQ3', 'Two horses left in this race, and the other one is {club}. They are talking a big game across town. Anything to send back?'],
  ['press.runInPrivilegeR', 'Instant back-page headline. The town believes.'],
  ['press.unbeatenSayItR', 'The town roars. The board swallows hard - that quote will follow you into every ground.'],
  ['press.derbyWonCity', 'This club owns this city'],
  ['press.derbyLostQ2', 'They will paint the town their colours tonight. A derby lost - how long does this one hurt?'],
]
/** any one quote mark or apostrophe, straight or curly */
const Q = `["“”‘’'«»]`

/** Every press.* entry as a pattern that can be matched backwards. Plural
 *  entries contribute both forms; the key is the same either way.
 *
 *  A template that is NOTHING BUT A HOLE - press.oppNamed is "{opp}", and there
 *  are half a dozen like it - matches every string ever written, so it is not a
 *  candidate at all. The probe caught it claiming a sentence the game has never
 *  written. What is left is ranked by how much literal text it has to match on,
 *  most first, so the most specific template wins rather than the shortest. */
function index(): Pattern[] {
  if (INDEX) return INDEX
  const out: Pattern[] = []
  const add = (k: string, text: string) => {
    const literal = text.replace(/\{\w+\}/g, '').trim()
    if (!literal) return
    const names: string[] = []
    // QUOTE MARKS ARE NOT EVIDENCE. The dictionary's quotes were reset to one
    // rule (game/quotes.ts): straight quotes curled, and the outer quotes on
    // the manager's own answers dropped, because the screen adds them. A line
    // saved before that still carries the old marks, so any quote mark matches
    // any other, and an answer may still wear the pair it was saved in -
    // round the whole line, or round the words before a (+£400k) note.
    const rx = text
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/["“”‘’'«»]/g, Q)
      .replace(/ \\\(/g, `${Q}? \\(`)
      .replace(/\\\{(\w+)\\\}/g, (_m, n: string) => { names.push(n); return '([\\s\\S]*?)' })
    out.push({ k, names, rx: new RegExp(`^${Q}?${rx}${Q}?$`), literal: literal.length })
  }
  const press = (EN as Record<string, unknown>).press as Record<string, unknown>
  for (const [k, v] of Object.entries(press ?? {})) {
    if (typeof v === 'string') add(`press.${k}`, v)
    else if (v && typeof v === 'object') {
      for (const form of Object.values(v as Record<string, string>)) {
        if (typeof form === 'string') add(`press.${k}`, form)
      }
    }
  }
  // English that a key used to have and no longer does: a line saved under
  // the old wording must still find its key (1.8.2 put a minus on the camp's
  // cost, owner: costs read as costs)
  for (const [k, old] of LEGACY_EN) add(k, old)
  out.sort((a, b) => b.literal - a.literal)
  INDEX = out
  return out
}

/** The key and vars behind one stored English line, or null if nothing fits. */
export function recover(text: string): { k: string; v: Vars } | null {
  if (!text) return null
  for (const p of index()) {
    const m = p.rx.exec(text)
    if (!m) continue
    const v: Vars = {}
    p.names.forEach((n, i) => { v[n] = m[i + 1] })
    return { k: p.k, v }
  }
  return null
}

/** Back-fill keys onto press items written before the press room had any.
 *  Returns how many lines were recovered, for the probe to assert on. */
export function migratePress(press: PressItem[]): number {
  let n = 0
  for (const item of press) {
    if (!item.qk) {
      const q = recover(item.question)
      if (q) { item.qk = q.k; item.qv = q.v; n++ }
    }
    for (const o of item.options as PressOption[]) {
      if (!o.lk) {
        const l = recover(o.label)
        if (l) { o.lk = l.k; o.lv = l.v; n++ }
      }
      if (!o.rk && o.reaction) {
        const r = recover(o.reaction)
        if (r) { o.rk = r.k; o.rv = r.v; n++ }
      }
    }
    if (!item.alk && item.answerLabel) {
      const a = recover(item.answerLabel)
      if (a) { item.alk = a.k; item.alv = a.v; n++ }
    }
    if (!item.rk && item.reaction) {
      const r = recover(item.reaction)
      if (r) { item.rk = r.k; item.rv = r.v; n++ }
    }
  }
  return n
}
