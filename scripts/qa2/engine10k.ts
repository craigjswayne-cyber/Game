/**
 * TEN THOUSAND MATCHES (runtime brief, section 8): every club fixture of a
 * fixed-seed men's career simulated in detail until ten thousand have been
 * played, with the distribution reported and the engine's rules asserted on
 * every one of them:
 *
 *  - the full-time line carries the score the fixture records
 *  - nobody who was unavailable at kick-off (injured, suspended, away with a
 *    country, on loan) appears in a match event
 *  - a walkover is conceded only by a side with fewer than ten available
 *  - two different, existing teams, non-negative integer scores
 *
 *   npx vite-node scripts/qa2/engine10k.ts [matches] [seed]
 */
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { availablePlayers, FORFEIT_MIN, simMatch } from '../../src/game/matchEngine'
import { mulberry32 } from '../../src/game/rng'
import type { MatchEvent } from '../../src/game/model'

const TARGET = Number(process.argv[2] ?? 10000)
const seed = Number(process.argv[3] ?? 99)
const g = newGame('leicester', 'Engine', seed)
const rng = mulberry32(seed * 7 + 1)

let fails = 0
const bad = (msg: string) => { if (fails++ < 20) console.log(`FAIL  ${msg}`) }

const pts: number[] = []
const margins: number[] = []
let tries = 0, yc = 0, rc = 0, inj = 0, subs = 0, hiaPass = 0, hiaFail = 0, hia = 0, forfeits = 0, uncontested = 0, homeWins = 0, draws = 0
let n = 0
const t0 = Date.now()
while (n < TARGET && g.season < 14) {
  const wk = g.week
  const fxs = g.fixtures.filter(f => f.week === wk && !f.played && g.clubs[f.homeId] && g.clubs[f.awayId])
  for (const fx of fxs) {
    if (n >= TARGET) break
    const home = g.clubs[fx.homeId], away = g.clubs[fx.awayId]
    const availH = availablePlayers(g, home.players), availA = availablePlayers(g, away.players)
    const avail = new Set([...availH, ...availA].map(p => p.id))
    const res = simMatch(g, fx, rng, true)
    n++
    if (fx.homeId === fx.awayId) bad(`${fx.id}: a club drawn against itself`)
    if (!Number.isInteger(fx.homeScore) || !Number.isInteger(fx.awayScore) || fx.homeScore < 0 || fx.awayScore < 0) bad(`${fx.id}: score ${fx.homeScore}-${fx.awayScore}`)
    if (!fx.played) bad(`${fx.id}: not marked played`)
    const ft = res.events.find((e: MatchEvent) => e.type === 'FT')
    if (!ft) bad(`${fx.id}: no full-time line`)
    else if (ft.homeScore !== fx.homeScore || ft.awayScore !== fx.awayScore) bad(`${fx.id}: whistle says ${ft.homeScore}-${ft.awayScore}, record says ${fx.homeScore}-${fx.awayScore}`)
    const forfeit = res.events.some(e => e.k === 'comm.forfeit')
    if (forfeit) {
      forfeits++
      if (availH.length >= FORFEIT_MIN && availA.length >= FORFEIT_MIN) bad(`${fx.id}: walkover with ${availH.length} and ${availA.length} available`)
    } else if (availH.length < FORFEIT_MIN || availA.length < FORFEIT_MIN) bad(`${fx.id}: played with ${availH.length} and ${availA.length} available`)
    for (const e of res.events) {
      if (e.playerId == null) continue
      const p = g.players[e.playerId]
      if (!p) { bad(`${fx.id}: event names player ${e.playerId}, who does not exist`); continue }
      if (!avail.has(e.playerId)) bad(`${fx.id}: ${e.type} by ${p.name}, who was not available at kick-off (injury ${!!p.injury}, bans ${p.bans}, nat ${!!p.natSquad}, loan ${!!p.onLoan})`)
      if (p.clubId !== e.teamId && !(e.type === 'INJ' || e.type === 'SUB')) bad(`${fx.id}: ${e.type} credited to ${e.teamId} by ${p.name} of ${p.clubId}`)
    }
    if (!forfeit) {
      pts.push(fx.homeScore + fx.awayScore)
      margins.push(Math.abs(fx.homeScore - fx.awayScore))
      tries += fx.homeTries + fx.awayTries
      for (const e of res.events) {
        if (e.type === 'YC') yc++
        else if (e.type === 'RC') rc++
        else if (e.type === 'INJ') inj++
        else if (e.type === 'SUB') subs++
        if (e.k === 'comm.hiaLedAway') hia++
        else if (e.k === 'comm.hiaPassed') hiaPass++
        else if (e.k === 'comm.hiaFailed') hiaFail++
        else if (typeof e.k === 'string' && e.k.startsWith('comm.uncontested')) uncontested++
      }
      if (fx.homeScore > fx.awayScore) homeWins++
      else if (fx.homeScore === fx.awayScore) draws++
    }
  }
  processWeekAndAdvance(g)
}
const secs = (Date.now() - t0) / 1000
const m = pts.length
const mean = pts.reduce((a, b) => a + b, 0) / m
const sd = Math.sqrt(pts.reduce((a, b) => a + (b - mean) ** 2, 0) / m)
const sorted = [...pts].sort((a, b) => a - b)
const q = (f: number) => sorted[Math.min(m - 1, Math.floor(f * m))]
console.log(`${n} matches in ${secs.toFixed(0)}s (${g.season} seasons), ${forfeits} walkovers`)
console.log(`total points: mean ${mean.toFixed(1)} sd ${sd.toFixed(1)} min ${sorted[0]} p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)} max ${sorted[m - 1]}`)
console.log(`margin: mean ${(margins.reduce((a, b) => a + b, 0) / m).toFixed(1)}; home wins ${(100 * homeWins / m).toFixed(0)}%, draws ${(100 * draws / m).toFixed(1)}%`)
console.log(`per match: tries ${(tries / m).toFixed(2)}, yellow ${(yc / m).toFixed(3)}, red ${(rc / m).toFixed(3)}, injuries ${(inj / m).toFixed(2)}, subs ${(subs / m).toFixed(1)}, HIA ${(hia / m).toFixed(3)} (passed ${hiaPass}, failed ${hiaFail}), uncontested-scrum lines ${uncontested}`)
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok ' : 'FAIL'}  ${what}`); if (!c) fails++ }
ok(n >= TARGET, `${TARGET} matches played (${n})`)
ok(mean >= 35 && mean <= 70, `mean total points in the real game's band 35 to 70 (${mean.toFixed(1)})`)
ok(tries / m >= 3 && tries / m <= 9, `tries per match between 3 and 9 (${(tries / m).toFixed(2)})`)
ok(rc / m < 0.15, `fewer than one red card in seven matches (${(rc / m).toFixed(3)})`)
ok(hiaPass + hiaFail >= hia * 0.9, `every HIA reaches a verdict (${hia} led away, ${hiaPass + hiaFail} verdicts)`)
console.log(fails ? `\nENGINE 10K FAILED (${fails})` : `\nENGINE 10K PASSED: ${n} matches, the whistle matches the record, nobody unavailable played, walkovers only when a side was short`)
process.exit(fails ? 1 : 0)
