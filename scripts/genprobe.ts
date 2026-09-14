// Is every invented player still declared as one?
//
// WHAT WENT WRONG. The women's database is 2,096 players and 841 of them are
// invented - the French second tier and the whole English Championship, built
// the way champ.ts and natl1.ts build the men's lower tiers because no reachable
// source carries those squads. That split was recorded in three places and in
// none of them could it be checked:
//
//   1. a sentence at the top of each data file,
//   2. a `// 30 players, 19 real` comment above each club,
//   3. a table in docs/womens-game.md,
//
// and by v1.6.2 all three disagreed. w_champ.ts was BORN contradicting itself in
// commit 5529966: the header said ALL 600 PLAYERS ARE GENERATED while its own
// per-club comments claimed 98 were real. docs/womens-game.md gave Élite 1 as
// 342 players and 261 real when the file held 357 and 300, and Élite 2 as 19
// real when it held 116. Nothing could adjudicate, because the rows themselves
// said nothing at all. Prose is not a check.
//
// AND IT WAS NOT COSMETIC. newgame.ts stamped `p.real = true` on every player
// that came out of a data file, invented or not. The maternity gate is `!p.real`
// and exists precisely because inventing a pregnancy for a real, living person
// is not the game's to invent - so with all 2,096 women flagged real, leave could
// only ever fall on the generated academy and squad fill, never on a player in a
// league squad, however invented she was. Measured over ten women's seasons:
// 126 leaves before, 187 after. It reads RawPlayer.gen now.
//
// WHAT THIS HOLDS. The claim now lives on the row, and these are the numbers it
// must add up to. They are measured, not guessed, and they reconcile with the
// owner's own audit of 6 Sep 2026: 1,255 real, 841 generated.
//
//   w_pwr    375 real, 0 generated    owner's squad sheet
//   w_celt   185 real, 0 generated    competition team pages
//   w_pac    279 real, 0 generated    2026 Aupiki + Super W
//   w_e1     300 real, 57 generated   FFR workbook plus three club pages
//   w_e2     116 real, 184 generated  workbook carries one club of ten
//   w_champ    0 real, 600 generated  no reachable source carries this division
//
// Change a squad and this fails until the table is changed with it, in the same
// commit, by somebody who decided the number. That is the whole point.
import { readFileSync } from 'node:fs'
import { LEAGUE_DEFS, newGame } from '../src/game/newgame'
import { W } from '../src/game/gender'
import type { RawClub } from '../src/data/types'

/** league id suffix -> [real, generated]. See the header for provenance. */
const EXPECT: Record<string, [number, number]> = {
  pwr: [375, 0],
  celt: [185, 0],
  pac: [279, 0],
  e1: [300, 57],
  e2: [116, 184],
  champ: [0, 600],
}

let fails = 0
const fail = (msg: string) => { fails++; console.log(`FAIL: ${msg}`) }

// ---- 1. the counts the data actually carries ----
let totReal = 0, totGen = 0
for (const def of LEAGUE_DEFS('w')) {
  const key = def.id.slice(W.length)
  const clubs = def.clubs as RawClub[]
  const real = clubs.reduce((n, c) => n + c.players.filter(p => !p.gen).length, 0)
  const gen = clubs.reduce((n, c) => n + c.players.filter(p => p.gen).length, 0)
  totReal += real; totGen += gen
  const want = EXPECT[key]
  if (!want) { fail(`${key}: no expected count - a league was added without deciding its provenance`); continue }
  const ok = want[0] === real && want[1] === gen
  console.log(`  ${key.padEnd(6)} ${String(real).padStart(4)} real ${String(gen).padStart(4)} generated  ${ok ? 'ok' : `EXPECTED ${want[0]}/${want[1]}`}`)
  if (!ok) fail(`${key}: data says ${real} real and ${gen} generated, the table says ${want[0]} and ${want[1]}`)

  // ---- 2. a club's real players come first ----
  // Every file states this convention and several tools rely on reading the
  // first N rows of a club as the sourced ones. An invented player above a real
  // one silently breaks that without changing any count.
  for (const c of clubs) {
    const firstGen = c.players.findIndex(p => p.gen)
    if (firstGen === -1) continue
    const realAfter = c.players.slice(firstGen).filter(p => !p.gen)
    if (realAfter.length) {
      fail(`${c.short}: ${realAfter.length} real player(s) sit below a generated one, first is ${realAfter[0].name}`)
    }
  }
}
console.log(`  ${'total'.padEnd(6)} ${String(totReal).padStart(4)} real ${String(totGen).padStart(4)} generated`)
if (totReal + totGen !== 2096) fail(`women's database is ${totReal + totGen} players, expected 2096`)

// ---- 3. the per-club comments must say what the rows say ----
// These are what went stale last time, so they are held rather than trusted.
for (const f of ['w_pwr', 'w_celt', 'w_pac', 'w_e1', 'w_e2', 'w_champ']) {
  const src = readFileSync(`src/data/leagues/${f}.ts`, 'utf8')
  const blocks = src.split(/\n  \{\n/).slice(1)
  for (const b of blocks) {
    const short = /short: '([^']+)'/.exec(b)?.[1] ?? '?'
    const rows = [...b.matchAll(/\{ name: '/g)].length
    const gen = [...b.matchAll(/gen: true/g)].length
    const m = /\/\/ (\d+) players(?:, (\d+) (?:real|of them from the workbook))?/.exec(b)
    if (!m) { fail(`${f} ${short}: no "// N players" comment to check`); continue }
    const saidTotal = Number(m[1])
    const saidReal = m[2] === undefined ? rows : Number(m[2])
    if (saidTotal !== rows) fail(`${f} ${short}: comment says ${saidTotal} players, the array has ${rows}`)
    if (saidReal !== rows - gen) fail(`${f} ${short}: comment says ${saidReal} real, the rows say ${rows - gen}`)
  }
}

// ---- 4. nothing checked against a source may be marked invented ----
// womens-verified.json is 93 players checked one at a time, each with the source
// it came from. A name in there is a fact about a living person and marking it
// generated would hand her to the maternity model.
const verified = JSON.parse(readFileSync('scripts/tools/womens-verified.json', 'utf8')) as Record<string, unknown>
const genNames = new Set<string>()
for (const def of LEAGUE_DEFS('w')) {
  for (const c of def.clubs as RawClub[]) {
    for (const p of c.players) if (p.gen) genNames.add(p.name.toLowerCase())
  }
}
for (const k of Object.keys(verified)) {
  if (k === '_meta') continue
  // 93 plain names today. The men's verified.ts scopes a disputed one as
  // name@club, so split on it in case this file ever needs to as well.
  const name = k.split('@')[0].trim().toLowerCase()
  if (genNames.has(name)) fail(`${k} is in womens-verified.json and is marked generated`)
}

// ---- 5. the built world must agree with the data ----
// The marker is only worth having if the engine reads it. newgame stamps
// p.real from it, and the maternity gate and namedup both test p.real.
const g = newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Provenance Audit', 909, undefined, 'coach', 'w')
// A squad row that carries `gen` is stamped real === false. The academy and the
// squad fill are invented too but never had the flag set either way, so they
// read undefined - `!p.real` catches both, which is what the maternity gate
// wants, while this exact test isolates the rows that came out of the data.
const built = Object.values(g.players).filter(p => p.real === false).length
console.log(`  built world: ${Object.keys(g.players).length} players, ${built} squad rows stamped not-real from the data`)
if (built !== totGen) {
  fail(`built world stamped ${built} squad rows generated, the data carries ${totGen} - p.real is not reading RawPlayer.gen`)
}

console.log(fails
  ? `\nPROVENANCE AUDIT FAILED: ${fails} problems`
  : `\nPROVENANCE AUDIT PASSED: ${totReal} real and ${totGen} generated, every club's comment agrees with its rows, and the engine reads the flag`)
process.exit(fails ? 1 : 0)
