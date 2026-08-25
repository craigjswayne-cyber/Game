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
    const rx = text
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{(\w+)\\\}/g, (_m, n: string) => { names.push(n); return '([\\s\\S]*?)' })
    out.push({ k, names, rx: new RegExp(`^${rx}$`), literal: literal.length })
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
