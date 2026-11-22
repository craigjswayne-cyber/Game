// TWO ENGINES, ONE SET OF ODDS (2.0.0 stage 2, docs/match-sim-spec.md
// section 5). For real fixtures out of real games, the SAME fixture is
// played many times on the current block engine (simMatch) and on the new
// phase-by-phase simulation (worldFromMatch + simSkeleton), nobody managing,
// and the two are compared: home win rate, draws, points, tries, margin.
//
//   npx vite-node scripts/paritycheck.ts [pairings] [matches] [--quiet]
//
// Default 40 pairings x 300 matches. The spec's full run is 200 x 2000.
// Writes every pairing's numbers to scripts/tmp/parity.json.
//
// HOW THE PAIRINGS ARE FOUND. One game per (club, seed) below, advanced a
// week at a time with processWeekAndAdvance. In each week the unplayed
// LEAGUE fixtures are taken, one per league in turn, so every league is in
// the sample; friendlies only if a game runs out of league weeks. Each
// pairing is measured in the week it is found, on the state as that week
// left it, so form, fatigue and injuries are the real ones.
//
// THE OLD ENGINE MUTATES what it is given (scores onto the fixture,
// injuries and condition onto players, chemistry, playbook tallies), so
// every repeat runs on its own copy. A full structuredClone costs about
// 55 ms, nearly all of it the players table, so the copy here clones every
// other part of the state and hands over the players through a
// copy-on-access proxy: a player is cloned the first time the match reads
// him, and every write lands on the copy. cheapClone() is checked against
// a full structuredClone at start-up (same dice, same result, and the
// source game untouched); the run stops if they ever disagree.
//
// THE NEW SIMULATION'S WORLD is built once per pairing (worldFromMatch
// clones the whole game, about 65 ms) and reused across repeats. It keeps
// two things between calls: the clock and a private map of carded men.
// The clock is set again by the first strength the next match asks for. The
// map is cleared after every match by telling the world each carded man is
// back at second -1 (carded(s, id, -1)), so the next match starts with all
// thirty on. Results do not depend on that map anyway (the skeleton draws
// who does what from its own stream), but the names would. The start-up
// check also holds that a reused world gives exactly what a fresh one does.
// Because the dice handed to worldFromMatch move the gate and so the crowd's
// lean on the whistle, WORLDS_PER_PAIRING worlds are built on different dice
// and the repeats rotate through them, as the old engine draws a new gate
// every time.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'
import { worldFromMatch, type MatchWorld } from '../src/game/sim/fromMatch'
import { MatchSim } from '../src/game/sim/skeleton'
import type { World } from '../src/game/sim/world'
/** nobody managing: the game runs both benches, as the old engine's assistant does for the user's side */
const simSkeleton = (o: { seed: number; world: World }) => {
  const m = new MatchSim(o)
  m.apply({ kind: 'bench', side: 0, auto: true }); m.apply({ kind: 'bench', side: 1, auto: true })
  return m.runUntil().result()
}
import { mkdirSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const PAIRINGS = Math.max(1, Number(args[0] ?? 40))
const MATCHES = Math.max(10, Number(args[1] ?? 300))
const QUIET = process.argv.includes('--quiet')
const PER_GAME = 10
const WORLDS_PER_PAIRING = 4
const TOL = { hw: 1.5, pts: 1.0, tries: 0.2 }

// games watched from different clubs on different seeds (bandcheck.ts's
// eight, then more), so the user's own side is not always the same one
const GAMES: [string, number][] = [
  ['leicester', 4242], ['toulouse', 777], ['northampton', 9], ['leinster', 31337],
  ['saracens', 11], ['munster', 23], ['clermont', 404], ['blues', 606],
  ['crusaders', 1], ['bath', 99], ['glasgow', 2026], ['racing92', 5150],
  ['bulls', 808], ['exeter', 3], ['stormers', 71], ['ulster', 1212],
  ['la_rochelle', 64], ['chiefs', 919], ['harlequins', 333], ['benetton', 4747],
]

// ---- the copy the old engine plays on ----------------------------------
function lazyPlayers(src: Record<string, unknown>): Record<string, unknown> {
  const own: Record<string, unknown> = {}
  const gone = new Set<string>()
  const read = (t: Record<string, unknown>, k: string) => {
    if (gone.has(k)) return undefined
    if (k in own) return own[k]
    const v = t[k]
    if (v === null || typeof v !== 'object') return v
    return (own[k] = structuredClone(v))
  }
  return new Proxy(src, {
    get: (t, k) => (typeof k === 'string' ? read(t, k) : Reflect.get(t, k)),
    set: (_t, k, v) => { own[k as string] = v; gone.delete(k as string); return true },
    deleteProperty: (_t, k) => { gone.add(k as string); delete own[k as string]; return true },
    has: (t, k) => (typeof k === 'string' ? !gone.has(k) && (k in own || k in t) : k in t),
    ownKeys: t => [...new Set([...Reflect.ownKeys(t), ...Reflect.ownKeys(own)])].filter(k => !gone.has(k as string)),
    getOwnPropertyDescriptor: (t, k) => {
      if (typeof k !== 'string' || gone.has(k) || !(k in own || k in t)) return undefined
      return { configurable: true, enumerable: true, writable: true, value: read(t, k) }
    },
  })
}
function cheapClone(g: GameState): GameState {
  const out: Record<string, unknown> = {}
  const src = g as unknown as Record<string, unknown>
  for (const k of Object.keys(src)) out[k] = k === 'players' ? lazyPlayers(src.players as Record<string, unknown>) : structuredClone(src[k])
  return out as unknown as GameState
}

interface Game { home: number; away: number; ht: number; at: number }
function oldMatch(g: GameState, fx: Fixture, seed: number, full = false): Game {
  const c = full ? structuredClone(g) : cheapClone(g)
  const f = c.fixtures.find(x => x.id === fx.id)!
  simMatch(c, f, mulberry32(seed), false)
  return { home: f.homeScore, away: f.awayScore, ht: f.homeTries, at: f.awayTries }
}

/** a world that can be handed to match after match: carded men are put back on afterwards */
function reusable(w: MatchWorld) {
  const inner = w.carded!.bind(w)
  const cards: [0 | 1, string][] = []
  const world: MatchWorld = { ...w, carded: (s, id, until) => { cards.push([s, id]); inner(s, id, until) } }
  const reset = () => { for (const [s, id] of cards.splice(0)) inner(s, id, -1) }
  return { world, reset }
}
function newMatch(r: ReturnType<typeof reusable>, seed: number): Game {
  const res = simSkeleton({ seed, world: r.world })
  r.reset()
  return { home: res.score[0], away: res.score[1], ht: res.tries[0], at: res.tries[1] }
}

// ---- the numbers for one engine on one pairing -------------------------
interface Stats { hw: number; dr: number; aw: number; homePts: number; awayPts: number; pts: number; ptsSd: number; tries: number; triesSd: number; margin: number; marginSd: number; absMargin: number }
function stats(gs: Game[]): Stats {
  const n = gs.length
  const m = gs.map(x => x.home - x.away)
  const mean = (f: (x: Game) => number) => gs.reduce((s, x) => s + f(x), 0) / n
  const margin = m.reduce((a, b) => a + b, 0) / n
  const sd = (f: (x: Game) => number) => { const mu = mean(f); return Math.sqrt(gs.reduce((s, x) => s + (f(x) - mu) ** 2, 0) / Math.max(1, n - 1)) }
  return {
    hw: (100 * gs.filter(x => x.home > x.away).length) / n,
    dr: (100 * gs.filter(x => x.home === x.away).length) / n,
    aw: (100 * gs.filter(x => x.home < x.away).length) / n,
    homePts: mean(x => x.home), awayPts: mean(x => x.away),
    pts: mean(x => x.home + x.away), ptsSd: sd(x => x.home + x.away),
    tries: mean(x => x.ht + x.at), triesSd: sd(x => x.ht + x.at),
    margin, marginSd: Math.sqrt(m.reduce((s, v) => s + (v - margin) ** 2, 0) / Math.max(1, n - 1)),
    absMargin: m.reduce((s, v) => s + Math.abs(v), 0) / n,
  }
}

interface Pairing {
  game: string; week: number; fixtureId: number; compId: string; home: string; away: string
  matches: number; band: string; old: Stats; sim: Stats
  /** standard error of the gap in home win %, from the dice alone */
  hwSe: number
}

const fmt = (v: number, d = 1) => v.toFixed(d)
const band = (hw: number) => (Math.abs(hw - 50) < 15 ? 'close' : Math.abs(hw - 50) < 35 ? 'comfortable' : 'mismatch')

// ---- the start-up checks ------------------------------------------------
function selfCheck(g: GameState, fx: Fixture) {
  const before = JSON.stringify(g)
  for (let i = 0; i < 6; i++) {
    const a = oldMatch(g, fx, 9000 + i, true), b = oldMatch(g, fx, 9000 + i)
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`cheapClone disagrees with structuredClone on fixture ${fx.id}, seed ${9000 + i}`)
  }
  const r = reusable(worldFromMatch(g, fx, mulberry32(77)).world)
  for (let i = 0; i < 6; i++) {
    const fresh = simSkeleton({ seed: 500 + i, world: worldFromMatch(g, fx, mulberry32(77)).world })
    const again = newMatch(r, 500 + i)
    if (fresh.score[0] !== again.home || fresh.score[1] !== again.away || fresh.tries[0] !== again.ht || fresh.tries[1] !== again.at)
      throw new Error(`a reused world disagrees with a fresh one on fixture ${fx.id}, seed ${500 + i}`)
  }
  if (JSON.stringify(g) !== before) throw new Error('the game was changed by the measuring')
}

// ---- the run ------------------------------------------------------------
function teamName(g: GameState, id: string) {
  return g.clubs[id]?.name ?? (g.natSquads as Record<string, { name?: string }> | undefined)?.[id]?.name ?? id
}

const pairings: Pairing[] = []
const t0 = performance.now()
let checked = false
for (let gi = 0; pairings.length < PAIRINGS; gi++) {
  const [club, gseed] = GAMES[gi % GAMES.length]
  // past the list: the same clubs on new seeds
  const seed = gseed + Math.floor(gi / GAMES.length) * 100003
  const g = newGame(club, 'Parity', seed)
  const want = Math.min(PER_GAME, PAIRINGS - pairings.length)
  const taken = new Set<string>()
  let got = 0, leagueTurn = gi
  for (let w = 0; w < 40 && got < want; w++) {
    const open = g.fixtures.filter(f => f.week === g.week && !f.played && !taken.has(`${f.homeId}|${f.awayId}`))
    let pool = open.filter(f => g.comps[f.compId]?.type === 'league')
    // friendlies only when a game has run out of league weeks to give
    if (!pool.length && w >= 30) pool = open.filter(f => f.compId === 'fr')
    // one per league in turn, at most half the game's quota in any one week
    const byComp = new Map<string, Fixture[]>()
    for (const f of pool) byComp.set(f.compId, [...(byComp.get(f.compId) ?? []), f])
    const comps = [...byComp.keys()].sort()
    const pick: Fixture[] = []
    for (let i = 0; i < comps.length && pick.length < Math.ceil(want / 2) && got + pick.length < want; i++) {
      const list = byComp.get(comps[(i + leagueTurn) % comps.length])!
      pick.push(list[(leagueTurn + w) % list.length])
    }
    leagueTurn += pick.length
    for (const fx of pick) {
      taken.add(`${fx.homeId}|${fx.awayId}`)
      if (!checked) { selfCheck(g, fx); checked = true; if (!QUIET) console.log('start-up checks passed: cheap copy = full copy, reused world = fresh world, game untouched') }
      const base = (seed * 7919 + fx.id * 104729) >>> 0
      const old: Game[] = [], sim: Game[] = []
      for (let i = 0; i < MATCHES; i++) old.push(oldMatch(g, fx, (base + i) >>> 0 || 1))
      const worlds = Array.from({ length: WORLDS_PER_PAIRING }, (_, k) => reusable(worldFromMatch(g, fx, mulberry32((base ^ (0x51ed + k * 7777)) >>> 0 || 1)).world))
      for (let i = 0; i < MATCHES; i++) sim.push(newMatch(worlds[i % worlds.length], (base + 1_000_003 + i) >>> 0 || 1))
      const so = stats(old), ss = stats(sim)
      const p1 = so.hw / 100, p2 = ss.hw / 100
      pairings.push({
        game: `${club}/${seed}`, week: g.week, fixtureId: fx.id, compId: fx.compId,
        home: teamName(g, fx.homeId), away: teamName(g, fx.awayId),
        matches: MATCHES, band: band(so.hw), old: so, sim: ss,
        hwSe: 100 * Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / MATCHES),
      })
      got++
      if (!QUIET) {
        const p = pairings[pairings.length - 1]
        console.log(`${String(pairings.length).padStart(3)} ${p.compId.padEnd(6)} ${`${p.home} v ${p.away}`.slice(0, 40).padEnd(40)} ` +
          `home win ${fmt(so.hw).padStart(5)} / ${fmt(ss.hw).padStart(5)}  pts ${fmt(so.pts).padStart(5)} / ${fmt(ss.pts).padStart(5)}  ` +
          `tries ${fmt(so.tries, 2)} / ${fmt(ss.tries, 2)}  (${((performance.now() - t0) / 1000).toFixed(0)}s)`)
      }
    }
    if (got < want) processWeekAndAdvance(g)
  }
}

// ---- the comparison -----------------------------------------------------
const n = pairings.length
const avg = (f: (p: Pairing) => number, ps = pairings) => ps.reduce((s, p) => s + f(p), 0) / Math.max(1, ps.length)
const mad = (f: (s: Stats) => number, ps = pairings) => avg(p => Math.abs(f(p.sim) - f(p.old)), ps)
const bias = (f: (s: Stats) => number, ps = pairings) => avg(p => f(p.sim) - f(p.old), ps)
function corr(xs: number[], ys: number[]) {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2 }
  return sxy / Math.sqrt(sxx * syy || 1)
}
/** least-squares slope of y on x: above 1, the new engine stretches the old one's gaps */
function slope(xs: number[], ys: number[]) {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  let sxy = 0, sxx = 0
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2 }
  return sxy / (sxx || 1)
}

const overall = {
  pairings: n, matches: MATCHES,
  madHomeWin: mad(s => s.hw), madPoints: mad(s => s.pts), madTries: mad(s => s.tries),
  madDraw: mad(s => s.dr), madMargin: mad(s => s.margin),
  biasHomeWin: bias(s => s.hw), biasDraw: bias(s => s.dr), biasPoints: bias(s => s.pts), biasTries: bias(s => s.tries),
  biasMargin: bias(s => s.margin), biasMarginSd: bias(s => s.marginSd),
  corrHomeWin: corr(pairings.map(p => p.old.hw), pairings.map(p => p.sim.hw)),
  corrMargin: corr(pairings.map(p => p.old.margin), pairings.map(p => p.sim.margin)),
  slopeMargin: slope(pairings.map(p => p.old.margin), pairings.map(p => p.sim.margin)),
  // what the mean absolute gap in home win % would be from the dice alone, if the engines agreed exactly
  noiseHomeWin: avg(p => p.hwSe * Math.sqrt(2 / Math.PI)),
  noisePoints: avg(p => Math.sqrt(2 / Math.PI) * Math.sqrt((p.old.ptsSd ** 2 + p.sim.ptsSd ** 2) / p.matches)),
  noiseTries: avg(p => Math.sqrt(2 / Math.PI) * Math.sqrt((p.old.triesSd ** 2 + p.sim.triesSd ** 2) / p.matches)),
}
const pass = overall.madHomeWin <= TOL.hw && overall.madPoints <= TOL.pts && overall.madTries <= TOL.tries

const line = '-'.repeat(100)
console.log(`\n${line}\n${n} pairings x ${MATCHES} matches on each engine (old / new)  ${((performance.now() - t0) / 1000).toFixed(0)}s`)
console.log(`\n                       mean |new - old|   tolerance   mean (new - old)`)
console.log(`  home win %           ${fmt(overall.madHomeWin, 2).padStart(8)}         ${fmt(TOL.hw, 1).padStart(5)}       ${fmt(overall.biasHomeWin, 2).padStart(7)}`)
console.log(`  total points         ${fmt(overall.madPoints, 2).padStart(8)}         ${fmt(TOL.pts, 1).padStart(5)}       ${fmt(overall.biasPoints, 2).padStart(7)}`)
console.log(`  total tries          ${fmt(overall.madTries, 2).padStart(8)}         ${fmt(TOL.tries, 1).padStart(5)}       ${fmt(overall.biasTries, 2).padStart(7)}`)
console.log(`  draw %               ${fmt(overall.madDraw, 2).padStart(8)}             -       ${fmt(overall.biasDraw, 2).padStart(7)}`)
console.log(`  home margin          ${fmt(overall.madMargin, 2).padStart(8)}             -       ${fmt(overall.biasMargin, 2).padStart(7)}`)
console.log(`  spread of margins (sd)                   -       ${fmt(overall.biasMarginSd, 2).padStart(7)}`)
console.log(`\n  correlation of home win % across pairings ${fmt(overall.corrHomeWin, 3)}; of home margin ${fmt(overall.corrMargin, 3)}`)
console.log(`  slope of new margin on old margin ${fmt(overall.slopeMargin, 2)} (1 = same gaps; under 1 = new engine closes them up)`)
console.log(`  noise floor: engines that agreed exactly would still show, at ${MATCHES} matches, a mean |gap| of about`)
console.log(`    ${fmt(overall.noiseHomeWin, 2)} in home win %, ${fmt(overall.noisePoints, 2)} in points and ${fmt(overall.noiseTries, 2)} in tries, from the dice alone`)

console.log(`\n  by band (old engine's home win %: close within 15 of 50, comfortable within 35, else mismatch)`)
console.log(`  band          n   |hw|   bias hw   |pts|   bias pts   |tries|  bias tries   bias margin`)
const bands: Record<string, unknown> = {}
for (const b of ['close', 'comfortable', 'mismatch']) {
  const ps = pairings.filter(p => p.band === b)
  if (!ps.length) { console.log(`  ${b.padEnd(12)} 0`); continue }
  const r = { n: ps.length, madHomeWin: mad(s => s.hw, ps), biasHomeWin: bias(s => s.hw, ps), madPoints: mad(s => s.pts, ps), biasPoints: bias(s => s.pts, ps), madTries: mad(s => s.tries, ps), biasTries: bias(s => s.tries, ps), biasMargin: bias(s => s.margin, ps) }
  bands[b] = r
  console.log(`  ${b.padEnd(12)}${String(r.n).padStart(2)} ${fmt(r.madHomeWin).padStart(6)} ${fmt(r.biasHomeWin).padStart(9)} ${fmt(r.madPoints).padStart(7)} ${fmt(r.biasPoints).padStart(10)} ${fmt(r.madTries, 2).padStart(9)} ${fmt(r.biasTries, 2).padStart(11)} ${fmt(r.biasMargin).padStart(13)}`)
}

console.log(`\n  the 10 furthest apart on home win %`)
console.log(`  comp   fixture                                   home win old/new   pts old/new    tries old/new   margin old/new`)
for (const p of [...pairings].sort((a, b) => Math.abs(b.sim.hw - b.old.hw) - Math.abs(a.sim.hw - a.old.hw)).slice(0, 10)) {
  console.log(`  ${p.compId.padEnd(6)} ${`${p.home} v ${p.away}`.slice(0, 40).padEnd(40)} ${fmt(p.old.hw).padStart(6)} /${fmt(p.sim.hw).padStart(5)}   ${fmt(p.old.pts).padStart(5)} /${fmt(p.sim.pts).padStart(5)}   ` +
    `${fmt(p.old.tries, 2).padStart(5)} /${fmt(p.sim.tries, 2).padStart(5)}   ${fmt(p.old.margin).padStart(6)} /${fmt(p.sim.margin).padStart(6)}`)
}

mkdirSync('scripts/tmp', { recursive: true })
writeFileSync('scripts/tmp/parity.json', JSON.stringify({ when: new Date().toISOString(), tolerance: TOL, overall, bands, pass, pairings }, null, 2))
console.log(`\n  per-pairing numbers written to scripts/tmp/parity.json`)
console.log(pass ? '\nPARITY PASSED' : '\nPARITY FAILED')
process.exit(pass ? 0 : 1)
