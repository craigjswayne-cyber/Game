/**
 * ---- ONE CLUB, ONE SHIRT, BOTH GAMES ----
 *
 * Bristol wear navy and white with a sky pinstripe. They wore that in the men's
 * game and something else in the women's, because every kit table in
 * src/data/kittrim.ts is keyed by the MEN'S club id and every women's club id
 * carries the "w:" prefix. Same for Quins' quarters, Bath's hoops, Saracens'
 * gold collar. Owner: "quins, sarries, Bristol, Exeter, sale jerseys and badges
 * should be the same in the womens game as they are in the mens games."
 *
 * Two halves had to line up and this probe holds both:
 *
 *   the COLOURS, which live in the league data twice, once per world; and
 *   the TREATMENT - pattern, trim, quarters, hoops, cycle, sleeves - which
 *   lives once and is reached through kitKey() in src/game/kits.ts.
 *
 * The failure mode is silent and cosmetic, which is exactly why it survived: a
 * shirt that is the wrong navy still renders, still scales, still passes every
 * other check in this repository, and only somebody who knows the club can see
 * it. Nobody was going to diff two league files by eye.
 *
 * Run: npx vite-node scripts/twinkit.ts
 */
import { readFileSync } from 'node:fs'
import { W } from '../src/game/gender'
import { kitPattern, kitTrim, kitQuarters, kitHoops, kitCycle, kitSleeves } from '../src/game/kits'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Women's club id (without the prefix) -> the men's id for the same club.
 *  Kept here as well as in kits.ts ON PURPOSE: this probe is the second pair of
 *  eyes, and a list that reads itself from the thing it is checking checks
 *  nothing. If the two ever disagree, one of them is wrong and that is the
 *  point. */
const TWINS: Record<string, string> = {
  saracens: 'saracens',
  bristol: 'bristol',
  exeter: 'exeter',
  sale: 'sale',
  leicester: 'leicester',
  quins: 'harlequins',
  glosharty: 'gloucester',
  bathw: 'bath',
}

/** Pull `id -> [colour, colour]` out of a league data file without importing
 *  it, so a broken data file fails here as a missing club rather than as an
 *  import error three probes away. */
function coloursIn(path: string, prefix = ''): Record<string, [string, string]> {
  const text = readFileSync(path, 'utf8')
  const out: Record<string, [string, string]> = {}
  const re = prefix
    ? /id: W \+ '([a-z]+)',[\s\S]{0,400}?colors: \['(#[0-9a-fA-F]{6})', '(#[0-9a-fA-F]{6})'\]/g
    : /id: '([a-z]+)',[\s\S]{0,400}?colors: \['(#[0-9a-fA-F]{6})', '(#[0-9a-fA-F]{6})'\]/g
  for (const m of text.matchAll(re)) {
    out[m[1]] = [m[2].toLowerCase(), m[3].toLowerCase()]
  }
  return out
}

const men = {
  ...coloursIn('src/data/leagues/prem_a.ts'),
  ...coloursIn('src/data/leagues/prem_b.ts'),
}
const women = {
  ...coloursIn('src/data/leagues/w_pwr.ts', W),
  ...coloursIn('src/data/leagues/w_champ.ts', W),
}

console.log(`read ${Object.keys(men).length} men's clubs, ${Object.keys(women).length} women's`)

// ---- 1. the colours are the same two hexes, in the same order ----
for (const [wid, mid] of Object.entries(TWINS)) {
  const m = men[mid]
  const w = women[wid]
  if (!m) { ok(false, `the men's game still has a club called ${mid}`); continue }
  if (!w) { ok(false, `the women's game still has a club called ${wid}`); continue }
  ok(m[0] === w[0] && m[1] === w[1],
    `${wid} wears the same colours as ${mid} (${w.join(', ')} vs ${m.join(', ')})`)
}

// ---- 2. and the same treatment, through kitKey ----
//
// Colours alone are not the shirt. A club with quarters and a club with the
// same two colours in a plain shirt look nothing alike on a crest.
for (const [wid, mid] of Object.entries(TWINS)) {
  const wFull = W + wid
  ok(kitPattern(wFull) === kitPattern(mid),
    `${wid} wears it the same way as ${mid} (${kitPattern(wFull)})`)
  ok(kitTrim(wFull) === kitTrim(mid),
    `and the same trim colour (${kitTrim(wFull) ?? 'none'})`)
  ok(JSON.stringify(kitQuarters(wFull)) === JSON.stringify(kitQuarters(mid)),
    `and the same quarters`)
  ok(JSON.stringify(kitHoops(wFull)) === JSON.stringify(kitHoops(mid)),
    `and the same hoop geometry (${JSON.stringify(kitHoops(wFull))})`)
  ok(JSON.stringify(kitCycle(wFull)) === JSON.stringify(kitCycle(mid)),
    `and the same band cycle`)
  ok(JSON.stringify(kitSleeves(wFull)) === JSON.stringify(kitSleeves(mid)),
    `and the same sleeves`)
}

// ---- 3. a women's club with NO men's twin is left alone ----
//
// The prefix strip must not reach into the men's tables by accident. Ealing and
// Loughborough have no men's side in this game and have to render as they did.
for (const lone of ['trailfinders', 'loughborough']) {
  ok(kitTrim(W + lone) === undefined && kitQuarters(W + lone) === undefined,
    `${lone} has no men's twin and inherits nothing`)
}

console.log(fails
  ? `\nTWIN KIT PROBE FAILED (${fails})`
  : '\nTWIN KIT PROBE PASSED: the same club wears the same shirt in both games')
if (fails) process.exit(1)
