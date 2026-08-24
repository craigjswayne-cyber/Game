// Probe: the second language is a translation, not a half-finished one.
//
// Three things go wrong when a game is localised, and all three are silent:
//
//   1. A key is used in code and exists in no dictionary at all. English
//      renders 'menu.tagline' instead of a strapline, and nobody notices until
//      it is on a phone.
//   2. A key exists in English and not in French. The fallback hides it, so the
//      French title screen has one English line on it and the build is green.
//   3. A placeholder is dropped or misspelt in translation. "{manager}" becomes
//      "{mananger}", the fill leaves it as literal braces, and a French player
//      reads "Reprendre - {mananger}, Toulouse".
//
// None of those throws. All three are a bug report from a paying customer, so
// they are assertions here instead.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import en from '../src/locales/en.json'
import fr from '../src/locales/fr.json'
import { LANGS, tIn, type Lang } from '../src/game/i18n'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

type Dict = Record<string, unknown>
const DICTS: Record<string, Dict> = { en: en as Dict, fr: fr as Dict }

/** Every leaf path in a dictionary, ignoring the _meta block and flattening a
 *  plural entry to the key that holds it rather than to its forms. */
function leaves(d: Dict, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(d)) {
    if (!prefix && k === '_meta') continue
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.push(path)
    else if (v && typeof v === 'object') {
      const o = v as Dict
      if ('other' in o) out.push(path)             // a plural: one key, two forms
      else out.push(...leaves(o, path))
    }
  }
  return out
}

/** The {names} inside a string, or inside every form of a plural. */
function slots(d: Dict, key: string): Set<string> {
  let node: unknown = d
  for (const part of key.split('.')) node = (node as Dict)?.[part]
  const texts = typeof node === 'string'
    ? [node]
    : Object.values((node ?? {}) as Record<string, string>).filter(v => typeof v === 'string')
  const out = new Set<string>()
  for (const s of texts) for (const m of s.matchAll(/\{(\w+)\}/g)) out.add(m[1])
  return out
}

// ---- what the code actually asks for -------------------------------------
const files: string[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(name)) files.push(p)
  }
}
walk('src')

/** Comments stripped, because i18n.ts documents itself with example keys -
 *  t('menus.title.newCareer') and friends - and a probe that reports those as
 *  broken call sites is a probe nobody will keep. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const used = new Set<string>()
const dynamic = new Set<string>()
for (const f of files) {
  const src = code(readFileSync(f, 'utf8'))
  for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1])
  // t(`titles.${cur.screen}`) - the prefix is checkable even when the tail is
  // not, and an unknown prefix is as broken as an unknown key
  for (const m of src.matchAll(/\bt\(\s*`([\w.]*)\$\{/g)) dynamic.add(m[1])
  // AND ANY TEMPLATE LITERAL THAT LOOKS LIKE A KEY, wherever it sits.
  //
  // Three shapes have turned up so far and only the first was covered: a
  // fragment variable (`verdict_k: \`news.htGrade${grade}\``), a key built into
  // a local first (`const tailKey = \`news.${won ? 'aWonLine' : 'aLostLine'}
  // ${n}\``), and one assembled inside a map. Rather than chase the position,
  // match the VALUE: a backtick string whose first characters are a namespace
  // and a dot, followed by an interpolation, is a computed key.
  for (const m of src.matchAll(/`([a-z][\w]*\.[\w.]*)\$\{/gi)) dynamic.add(m[1])
}

const enKeys = new Set(leaves(en as Dict))
ok(used.size > 20, `the sweep found call sites at all (${used.size} static keys in ${files.length} files)`)

const orphans = [...used].filter(k => !enKeys.has(k))
ok(orphans.length === 0, `every key in the code is in en.json${orphans.length ? ': missing ' + orphans.slice(0, 6).join(', ') : ''}`)

// THE OTHER DIRECTION. A key in en.json that nothing asks for is either dead
// weight or - far more often - a replacement that was written into the
// dictionary and then never wired into the screen, which is how a half-done
// extraction passes every check above. Namespaces reached by a computed key are
// exempt, since their members are unreachable by a text search.
{
  // A computed prefix is a raw string, not a namespace path: t(`titles.${s}`)
  // gives "titles." and t(`squad.status${id}`) gives "squad.status", and the
  // second one reaches squad.statusKey without any dot after it. Both are
  // exempt by string prefix rather than by first segment.
  const blob = files.map(f => readFileSync(f, 'utf8')).join('\n')
  const idle = [...enKeys].filter(k => {
    if ([...dynamic].some(p => p && k.startsWith(p))) return false
    // A news story's subject key is its body key with Subj on the end - see
    // newsSubject() in model.ts. Only the body key is ever written down, so the
    // subject is reachable exactly when its body is, and looking for it
    // literally finds nothing. Checked against the body rather than waved
    // through: a Subj with no story behind it is still dead weight.
    if (k.startsWith('news.') && k.endsWith('Subj')) {
      const body = k.slice(0, -4)
      return !blob.includes(`'${body}'`) && !blob.includes(`\`${body}`)
    }
    return !blob.includes(`'${k}'`) && !blob.includes(`\`${k}`)
  })
  ok(idle.length === 0, `no key sits in en.json unused${idle.length ? ` (${idle.length}): ${idle.slice(0, 8).join(', ')}` : ''}`)
}

// a dynamic key's prefix must name a real namespace, or the whole family is dead
for (const prefix of dynamic) {
  const hit = prefix !== '' && [...enKeys].some(k => k.startsWith(prefix))
  ok(hit, `the computed key t(\`${prefix}\${...}\`) reaches keys that exist`)
}

// ---- and every language answers the same questions ------------------------
for (const { code, label } of LANGS) {
  if (code === 'en') continue
  const d = DICTS[code]
  const theirs = new Set(leaves(d))

  const gaps = [...enKeys].filter(k => !theirs.has(k))
  ok(gaps.length === 0, `${label} has every key English has${gaps.length ? ` (${gaps.length} missing: ${gaps.slice(0, 6).join(', ')})` : ''}`)

  const stale = [...theirs].filter(k => !enKeys.has(k))
  ok(stale.length === 0, `${label} has no keys English has dropped${stale.length ? ': ' + stale.slice(0, 6).join(', ') : ''}`)

  const bad: string[] = []
  for (const k of enKeys) {
    if (!theirs.has(k)) continue
    const a = slots(en as Dict, k)
    const b = slots(d, k)
    if (a.size !== b.size || [...a].some(x => !b.has(x))) bad.push(`${k} [${[...a]}] vs [${[...b]}]`)
  }
  ok(bad.length === 0, `${label} carries the same placeholders${bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''}`)

  // nothing renders as a raw key or an empty box.
  //
  // EXCEPT common.nothing, which is the ONE sanctioned empty string in the
  // game. A story writes `merc_k: merc ? 'news.wMerc1' : 'common.nothing'` so
  // that a clause either appears or does not, and the absent side has to render
  // as nothing at all. One key rather than a naming rule, because the first
  // attempt exempted every key ending None and there are already keys called
  // finishersNone and prepNone that mean "none" and say so out loud.
  const BLANK_OK = 'common.nothing'
  const blanks = [...theirs].filter(k =>
    k !== BLANK_OK && (tIn(code as Lang, k).trim() === '' || tIn(code as Lang, k) === k))
  ok(blanks.length === 0, `${label} has no blank or unresolved strings${blanks.length ? ': ' + blanks.slice(0, 4).join(', ') : ''}`)
}

// ---- the two things a fill has to get right -------------------------------
{
  const line = tIn('fr', 'menu.continue', { manager: 'A. Gaffer', club: 'RC Toulouse' })
  ok(line.includes('A. Gaffer') && line.includes('RC Toulouse'), `French interpolates: "${line}"`)
  ok(!/\{\w+\}/.test(line), 'and leaves no unfilled braces behind')
  // a number goes through the locale, so a French screen reads 12 000 rather
  // than 12,000 - the sort of thing that reads as a decimal point to a player
  const wk = tIn('fr', 'menu.savedAt', { season: '2026/27', week: 12000 })
  ok(wk.includes('12') && !wk.includes('12,000'), `French formats numbers its own way: "${wk}"`)
}

// ---- English is a test selector as well as a string -----------------------
//
// Forty browser harnesses find buttons with text=New Career and the like. If a
// tidy-up ever rewords the English side of the dictionary, those go red with a
// timeout and no clue why - so the handful the harnesses depend on are pinned.
{
  const PINNED: [string, string][] = [
    ['menu.newCareer', 'New Career'],
    ['menu.loadCareer', 'Load Career'],
    ['nav.home', 'Home'],
    ['titles.squad', 'Team'],
    ['groups.handbook', "The Manager's Handbook"],
    ['groups.bug', 'Report a Bug'],
    // the new-career wizard, which every browser harness walks through before
    // it can measure anything at all
    ['wizard.confirm', 'Confirm'],
    ['wizard.startCareer', '▸ Start Career'],
    ['wizard.namePlaceholder', 'e.g. A. Gaffer'],
    ['wizard.starPlayer', 'Star Player'],
    ['selection.bestXV', 'Best XV'],
    ['tacticsScreen.tabPrep', 'Prep'],
    ['tacticsScreen.tabPlan', 'Game Plan'],
    ['groups.tactics', 'Tactics'],
    // match day, which half the harnesses have to walk through to reach a
    // second season: the tunnel, the touchline and the way back out
    ['matchday.kickOff', 'Kick Off ▸'],
    ['matchday.takeField', '▸ Take the Field'],
    ['matchday.spCalm', 'Calm the nerves'],
    ['matchday.sayNothing', 'Say nothing - straight out'],
    ['matchday.skip', 'Skip ▸'],
    ['matchday.startSecondHalf', '▸ Start Second Half'],
    ['matchday.playFinalQuarter', '▸ Play the Final Quarter'],
    ['matchday.continueToResults', 'Continue to Results ▸'],
    ['matchday.matchDaySquad', 'Match-Day Squad'],
    ['matchday.takeBack', '↩ Take back the last change'],
    ['matchday.optPosts', 'Take the Points'],
    ['matchday.quickPlans', 'Quick Game Plans'],
    ['matchday.matchSettings', 'Match Settings'],
    ['matchday.spdFast', 'Fast'],
    ['matchday.stakes', 'The Stakes'],
    ['matchday.storySoFar', 'The Story So Far'],
    ['dayroom.treatmentRoom', 'Treatment Room'],
  ]
  for (const [k, want] of PINNED) {
    ok(tIn('en', k) === want, `en.${k} is still "${want}" (browser harnesses select on it)`)
  }
}

console.log(fails ? `I18N PROBE FAILED (${fails})` : 'I18N PROBE PASSED: both languages answer every question the code asks')
process.exit(fails ? 1 : 0)
