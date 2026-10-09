/**
 * ---- HOW OFTEN THE AFTERNOON'S INCIDENTS HAPPEN (1.8.16) ----
 *
 * The owner fed the engine a season of real commentary (TNT Sports Prem
 * broadcasts, the Quilter Nations Series) and asked that every match feel
 * different and authentic. This counts, per watched match, the things those
 * broadcasts were full of: cards and why, penalty tries, interceptions, held
 * up over the line, free kicks, 50:22s, TMO calls, scuffles, warnings. It is
 * a reporter first (the rates are printed so a change can be read against
 * them) and asserts only that each incident happens at a rugby-shaped rate:
 * present, and never a weekly fixture.
 *
 * Watched matches, because the counts are read off the commentary keys; the
 * engine is one engine watched or not (detailprobe), so the rates are the
 * world's.
 */
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

const WORLDS: [string, number][] = [['leicester', 101], ['toulouse', 202], ['northampton', 303], ['leinster', 404]]
const PER = 300

const counts: Record<string, number> = {}
let n = 0, pts = 0, tries = 0, yc = 0, rc = 0, pens = 0
// item 35: the net points a side gives up while a man sits in the bin
let binNet = 0, binN = 0
for (const [club, seed] of WORLDS) {
  const g = newGame(club, 'Incidents', seed)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId] && !f.stage && f.compId !== 'fr').slice(0, PER)
  fxs.forEach((fx, i) => {
    const r = simMatch(g, fx, mulberry32(seed * 1000 + i), true)
    n++
    pts += fx.homeScore + fx.awayScore
    tries += fx.homeTries + fx.awayTries
    // the ten minutes after each card: points against minus points for
    r.events.forEach((e, idx) => {
      if (e.type !== 'YC' || e.min > 70) return
      const s0 = r.events[idx]
      const end = r.events.filter(x => x.min <= e.min + 10).pop() ?? s0
      const home = e.teamId === fx.homeId
      const forD = (home ? end.homeScore - s0.homeScore : end.awayScore - s0.awayScore)
      const agD = (home ? end.awayScore - s0.awayScore : end.homeScore - s0.homeScore)
      binNet += agD - forD; binN++
    })
    for (const e of r.events) {
      const k = (e.k ?? '').replace(/(?<![0-9]{2})\d$/, '')
      counts[k] = (counts[k] ?? 0) + 1
      if (e.type === 'YC') yc++
      if (e.type === 'RC') rc++
      if (e.type === 'PEN') pens++
    }
  })
}

const per = (x: number) => (x / n).toFixed(3)
const sum = (prefix: string) => Object.entries(counts).filter(([k]) => k.startsWith(prefix)).reduce((s, [, c]) => s + c, 0)
console.log(`matches ${n}   pts ${(pts / n).toFixed(1)}   tries ${(tries / n).toFixed(2)}   pens kicked ${per(pens)}`)
console.log(`yellow ${per(yc)}   red ${per(rc)}   net points conceded in the ten minutes of a yellow ${(binNet / Math.max(1, binN)).toFixed(2)} (over ${binN} cards; a level ten minutes is 0)`)
const ROWS: [string, string][] = [
  ['penalty tries', 'comm.penTry'],
  ['interception tries', 'comm.tryIntercept'],
  ['interceptions run down', 'comm.interceptCaught'],
  ['professional fouls', 'comm.ycProfFoul'],
  ['cynical (all kinds)', 'comm.cyn_'],
  ['held up over the line', 'comm.heldUp'],
  ['goal-line drop-outs', 'comm.gldo'],
  ['free kicks', 'comm.fk_'],
  ['not straight', 'comm.notStraight'],
  ['50:22 kicked', 'comm.fifty22'],
  ['50:22 voided', 'comm.void5022'],
  ['out on the full', 'comm.outFull'],
  ['TMO foul play', 'comm.tmoFoul_'],
  ['TMO mitigated', 'comm.tmoMit_'],
  ['TMO try reviews', 'comm.tmoReview'],
  ['TMO no try', 'comm.tmoNoTry'],
  ['scuffles', 'comm.scuffle'],
  ['ref reversals', 'comm.reverse_'],
  ['ref warnings', 'comm.refWarn'],
  ['offences named', 'comm.off_'],
  ['shot clock', 'comm.shotClock'],
  ['kick hits post', 'comm.penPost'],
  ['late withdrawals', 'comm.lateWithdrawal'],
  ['water breaks', 'comm.waterBreak'],
  ['team yellow (repeated)', 'comm.ycRepeated'],
  ['charge-downs', 'comm.chargeDown'],
  ['drop goals', 'comm.dropGoal'],
  ['match-day lines', 'comm.day_'],
]
for (const [label, prefix] of ROWS) console.log(`  ${label.padEnd(26)} ${per(sum(prefix))}`)

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const rate = (p: string) => sum(p) / n
if (process.argv.includes('--assert')) {
  ok(rate('comm.penTry') > 0.03 && rate('comm.penTry') < 0.3, 'penalty tries: present, not weekly')
  ok(rate('comm.tryIntercept') > 0.05 && rate('comm.tryIntercept') < 0.4, 'interception tries: present, not weekly')
  ok(rate('comm.heldUp') > 0.2 && rate('comm.heldUp') < 1.6, 'held up over the line: most weeks')
  ok(rate('comm.fk_') > 1 && rate('comm.fk_') < 8, 'free kicks: a handful a match')
  ok(rate('comm.fifty22') > 0.05 && rate('comm.fifty22') < 0.8, '50:22: now and then')
  ok(rate('comm.tmoFoul_') > 0.05 && rate('comm.tmoFoul_') < 0.6, 'TMO foul-play reviews: now and then')
  ok(yc / n > 0.8 && yc / n < 2.6, 'yellow cards: professional-game rate')
  ok(rc / n < 0.15, 'red cards: rare')
  console.log(fails ? `INCIDENT PROBE FAILED: ${fails}` : 'INCIDENT PROBE PASSED')
  process.exit(fails ? 1 : 0)
}
