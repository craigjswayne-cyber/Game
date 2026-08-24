/**
 * ---- THE GAME IN MORE THAN ONE LANGUAGE ----
 *
 * A hand-rolled 150 lines rather than i18next, for the same reason the rest of
 * this project has no runtime dependency but React: the whole of what is needed
 * here is lookup, interpolation, a plural rule and a fallback, and a library
 * that does forty other things is forty other things to keep offline, audit and
 * ship. If this ever needs ICU message format or a translation-management
 * integration, swap it then - the call site is t('a.b.c', vars) either way.
 *
 * WHAT A KEY LOOKS LIKE. Namespace first, then the screen or system, then the
 * thing: 'menus.title.newCareer', 'match.commentary.highBallLost'. Named
 * placeholders, never positional, because a French or Japanese translator has
 * to be free to reorder the sentence:
 *
 *   "{player} calls for the high ball and loses it. {team} scramble."
 *
 * A POSITIONAL PLACEHOLDER WOULD LOCK THE WORD ORDER TO ENGLISH, which is the
 * single most common way a game gets localised badly.
 *
 * MISSING KEYS FALL BACK TO ENGLISH AND SAY SO in dev. They never render as a
 * raw key to a player: a French screen with one English line is a blemish, a
 * French screen reading 'menus.title.newCareer' is a bug report.
 */

import en from '../locales/en.json'
import fr from '../locales/fr.json'

export type Lang = 'en' | 'fr'

/** The languages offered, in the order the picker shows them. `label` is in the
 *  language itself, because somebody looking for French is looking for
 *  "Français" rather than for the French word an English speaker would use. */
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
]

type Dict = Record<string, unknown>
const DICTS: Record<Lang, Dict> = { en: en as Dict, fr: fr as Dict }

const STORAGE_KEY = 'rm-lang'

let current: Lang = 'en'
const listeners = new Set<() => void>()

/** Read the stored choice, or take the browser's hint the first time. */
export function initLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'fr') current = saved
    else {
      // no stored choice: honour the device, but only for a language we have
      const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
      current = nav === 'fr' ? 'fr' : 'en'
    }
  } catch {
    current = 'en'
  }
  // set on the way out of both branches, so the very first paint carries the
  // right lang attribute for the screen reader and the hyphenation rules
  try { document.documentElement.lang = current } catch { /* no DOM in a probe */ }
  return current
}

export const getLang = (): Lang => current

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* private mode */ }
  // the <html lang> matters to a screen reader and to line breaking
  try { document.documentElement.lang = lang } catch { /* no DOM in a probe */ }
  for (const fn of listeners) fn()
}

/** Subscribe to language changes (the store re-renders the tree on one). */
export function onLangChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function lookup(dict: Dict, key: string): unknown {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

/** Filled into {braces}. Numbers are localised; everything else is inserted as
 *  given, because a club name is a club name in any language. */
export type Vars = Record<string, string | number>

function fill(text: string, vars?: Vars, lang: Lang = current): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name]
    if (v == null) return whole
    // A VARIABLE THAT IS ITSELF A KEY, marked by a _k suffix on its name.
    //
    // News stories are saved as a key plus variables, and some of those
    // variables are fragments of the sentence that vary - "sky-high: silverware
    // is demanded" against "modest: steady the ship". Storing the English
    // fragment would put English back inside a French paragraph, which is the
    // exact bug this whole mechanism exists to remove; giving every combination
    // its own key would multiply four stories into forty.
    //
    // So a `_k` variable holds a key and is looked up in the reader's language
    // on the way in. One level only - a fragment cannot carry fragments - which
    // keeps this a substitution rather than a template language.
    if (name.endsWith('_k') && typeof v === 'string') {
      const frag = lookup(DICTS[lang], v) ?? lookup(DICTS.en, v)
      return typeof frag === 'string' ? frag : v
    }
    return typeof v === 'number' ? v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB') : String(v)
  })
}

/** Names that were looked up and were not there. Read by scripts/i18nprobe.ts,
 *  and printed once each in dev so a missing key is noticed rather than
 *  silently papered over by the English fallback. */
export const missing = new Set<string>()

/**
 * The whole API.
 *
 * `t('menus.title.newCareer')` - plain.
 * `t('squad.count', { n: 3 })` - interpolated.
 * `t('squad.injured', { n })` with a value shaped `{ one, other }` - plural.
 */
export function t(key: string, vars?: Vars): string {
  let entry = lookup(DICTS[current], key)
  if (entry === undefined && current !== 'en') {
    if (!missing.has(key)) {
      missing.add(key)
      if (import.meta.env?.DEV) console.warn(`[i18n] ${current} is missing "${key}", falling back to English`)
    }
    entry = lookup(DICTS.en, key)
  }
  if (entry === undefined) {
    // English itself does not have it: that is a bug in the code, not in a
    // translation, and it must be loud rather than rendered
    missing.add(key)
    if (import.meta.env?.DEV) console.error(`[i18n] no such key "${key}"`)
    return key
  }
  // plural: { one, other }. English and French both split at n === 1, but
  // French keeps the singular for 0 as well ("0 blessure"), which is exactly
  // the sort of thing a positional shortcut gets wrong.
  if (typeof entry === 'object' && entry !== null && 'other' in (entry as object)) {
    const forms = entry as { one?: string; other: string }
    const n = Number(vars?.n ?? 0)
    const singular = current === 'fr' ? Math.abs(n) < 2 : n === 1
    return fill(singular && forms.one ? forms.one : forms.other, vars)
  }
  if (typeof entry !== 'string') return key
  return fill(entry, vars)
}

/**
 * A number with its ordinal ending: 1st, 2nd, 3rd, 11th - 1er, 2e, 11e.
 *
 * Deliberately NOT the same function as gossip.ordinal(), which the engine uses
 * inside stored news bodies. Those sentences are written once, in English, and
 * saved into the career; giving them French endings would produce "You finished
 * 3e" inside an otherwise English paragraph. This one is for the interface,
 * where the whole line is translated.
 *
 * The 11th-to-13th exception is an English rule and costs nothing elsewhere:
 * French answers "e" for all three anyway.
 */
export function ord(n: number): string {
  const v = Math.abs(n) % 100
  const d = v > 10 && v < 14 ? 0 : Math.abs(n) % 10
  return `${n}${t(d === 1 ? 'common.ord1' : d === 2 ? 'common.ord2' : d === 3 ? 'common.ord3' : 'common.ordN')}`
}

/** A position's full name, in the reader's language. model.POS_NAMES stays
 *  English because it is used inside stored news bodies. */
export const posName = (pos: string): string => t(`pos.${pos}`)

/** Values that are STORED in English - an attribute key, a personality, a trait
 *  name - shown in the reader's language. The stored value never changes: it is
 *  what the engine matches on and it is inside every save already. */
export const attrName = (k: string): string => t(`attrs.${k}`)
export const persName = (p: string): string => t(`pers.${p}`)
export const traitName = (name: string): string => t(`traits.${name}`)
export const traitInfo = (name: string): string => t(`traits.${name}Info`)

/** For a probe, or anything that needs a language it is not currently in. */
export function tIn(lang: Lang, key: string, vars?: Vars): string {
  const prev = current
  current = lang
  try { return t(key, vars) } finally { current = prev }
}
