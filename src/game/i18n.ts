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

/**
 * The ending on an ordinal, in a given language.
 *
 * ENGLISH PICKS ON THE LAST DIGIT - 1st, 22nd, 33rd - with the 11th-to-13th
 * exception. FRENCH DOES NOT: only 1 takes "er", and 21 is "21e", not "21er".
 * Applying the English rule to French produced exactly that, on the half-term
 * report card and everywhere ord() was already used.
 *
 * So which rule to use is itself a property of the language and lives in the
 * dictionary: _meta.ordByDigit is set for English and empty for French.
 */
function ordSuffix(n: number, lang: Lang = current): string {
  const byDigit = !!lookup(DICTS[lang], '_meta.ordByDigit')
  const abs = Math.abs(n)
  let key = 'common.ordN'
  if (byDigit) {
    const v = abs % 100
    const d = v > 10 && v < 14 ? 0 : abs % 10
    key = d === 1 ? 'common.ord1' : d === 2 ? 'common.ord2' : d === 3 ? 'common.ord3' : 'common.ordN'
  } else if (abs === 1) {
    key = 'common.ord1'
  }
  const s = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key)
  return typeof s === 'string' ? s : ''
}

/** Filled into {braces}. Numbers are localised; everything else is inserted as
 *  given, because a club name is a club name in any language. */
export type Vars = Record<string, string | number>

/** One dictionary entry rendered: a plain string, or a { one, other } plural
 *  picked on vars.n. Shared by t() and by the _l list fragments, which is the
 *  whole point - a fragment inside a list gets the same plural rules as a
 *  sentence, and "1 semaine" against "2 semaines" is exactly the case that
 *  showed the list path had quietly skipped them. */
function render(entry: unknown, vars: Vars | undefined, lang: Lang): string | null {
  if (typeof entry === 'string') return fill(entry, vars, lang)
  if (entry && typeof entry === 'object' && 'other' in (entry as object)) {
    const forms = entry as { one?: string; other: string }
    const n = Number(vars?.n ?? 0)
    const singular = lang === 'fr' ? Math.abs(n) < 2 : n === 1
    return fill(singular && forms.one ? forms.one : forms.other, vars, lang)
  }
  return null
}

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
      return render(frag, vars, lang) ?? v
    }
    // A LIST OF TRANSLATED FRAGMENTS, marked by a _l suffix.
    //
    // Several stories name a group of players and say something about each -
    // "Dupont (FL), rusty for 2 weeks". The clause is per-man, so it cannot be
    // hoisted out of the list into the sentence around it, and a plain joined
    // string freezes whatever language it was built in.
    //
    // So a _l variable holds a JSON array of { k, ...vars } objects: each is
    // rendered like any other key, in the reader's language, and they are joined
    // with the list separator that language uses. Malformed JSON renders as the
    // raw string rather than throwing, because this is a save file and a save
    // file outlives the code that wrote it.
    // AN ORDINAL, marked by _o. English needs 1st/2nd/3rd/4th picked per number
    // and French answers 1er then e for everything else, so this cannot be
    // formatted before the story is filed - the reader's language decides it.
    // Dropping the suffix entirely was the first attempt and it made the
    // English worse ("League: 4"), which is not a trade this change may make.
    if (name.endsWith('_o')) {
      const num = Number(v)
      if (Number.isFinite(num)) return `${num}${ordSuffix(num, lang)}`
    }
    // _ll joins one to a line instead - a power-rankings table, a squad list,
    // anything that is a column rather than a sentence. Checked FIRST, because
    // '_ll' also ends with '_l'.
    if ((name.endsWith('_ll') || name.endsWith('_l')) && typeof v === 'string') {
      try {
        const items = JSON.parse(v) as { k: string; [x: string]: string | number }[]
        if (!Array.isArray(items)) return v
        const sep = name.endsWith('_ll') ? '\n' : (lookup(DICTS[lang], 'common.listSep') ?? ', ') as string
        return items.map(it => {
          const frag = lookup(DICTS[lang], it.k) ?? lookup(DICTS.en, it.k)
          return render(frag, it as Vars, lang) ?? it.k
        }).join(sep)
      } catch { return v }
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
  return `${n}${ordSuffix(n)}`
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
