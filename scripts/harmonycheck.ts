// THE HARMONY CHECK (2.0.0, overseer).
//
// Owner, for days: "commentary, graphics and animation are all doing
// different things, they need to be in harmony." This script turns what he
// has complained about (scripts/tmp/REBUILD.md) and the team rules
// (scripts/tmp/AGENTS.md) into checks a machine can run on the match record
// (src/game/sim/record.ts), so harmony is proved and not claimed. The
// numbered checklist these rules come from is docs/acceptance-2.0.0.md.
//
// Run: npx vite-node scripts/harmonycheck.ts [seeds=300] [real=20]
//
// It plays `seeds` matches of simSkeleton({ seed }) and `real` real fixtures
// (built the way scripts/simread.ts builds one with "real": a new game on
// that seed, the user's first fixture, worldFromMatch). Every rule below is
// checked on every match. If src/game/sim/commentary.ts exists, every Line
// it writes is checked against the Play it says it describes. If
// src/ui/livepitch/fromRecord.ts exists, its schedule is checked for what can
// be checked without a browser. Both are loaded with a dynamic import, so
// the script still runs when they are missing or broken.
//
// Prints one row per rule: matches failing, the first failing seed and play
// index, and a short reason; then PASSED or FAILED.
import { simSkeleton } from '../src/game/sim/skeleton'
import type { Play, SimResult } from '../src/game/sim/record'
import { Laws, type LawEvent } from '../src/game/sim/law'
import { evenWorld, type World } from '../src/game/sim/world'

// ---------------------------------------------------------------- the rules

export type Owner = 'GAMEPLAY' | 'COMMENTARY' | 'ANIMATION'
export interface Rule { id: string; title: string; owner: Owner; kind: 'match' | 'rate' }

/** Every automatic rule. The id is what docs/acceptance-2.0.0.md calls it. */
export const RULES: Rule[] = [
  { id: 'R01-laws', title: 'every play is a move the laws machine allows', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R02-shape', title: 'starts with a kick-off, one half-time, ends at full time, n in order', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R03-pitch', title: 'x 0..100, y 0..70; open play not on a touchline', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R04-possession', title: 'the ball changes hands only by a catch, turnover, set piece, penalty, restart or score', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R05-actor', title: 'the side carrying, kicking or rucking is the side that has the ball', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R06-knockon', title: 'knock-on only by the side with the ball (or contesting a kick), by the man at the ball', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R07-continuity', title: 'every entry starts where the last ended unless a kick moved it', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R08-gain', title: 'gain agrees with the change in x', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R09-backwards', title: 'no carry that goes wide and ends behind where it started', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R10-scrum', title: 'a scrum has a cause, the right feed, and is not within 5 m of a goal line', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R11-lineout', title: 'a lineout follows the ball going into touch, on that touchline, at that place', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R12-throw', title: 'the side that put it in touch does not throw in, unless penalty to touch or 50:22', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R13-5022', title: 'a 50:22 is called only for a real one: open play, from own half, bounces out in their 22', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R14-5022-missed', title: 'a real 50:22 is always called (the law gives the throw to the kicker)', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R15-penalty-cause', title: 'every penalty or free kick has its offence in the play before (ruck, scrum, lineout, maul)', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R16-goal-spot', title: 'a kick at goal is taken from where the penalty was given', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R17-turnover', title: 'a turnover in open play only at a ruck, tackle or interception, with the man named', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R18-restart-score', title: 'after every score: conversion after a try, then kick-off by the side that conceded', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R19-restart-miss', title: 'missed kick at goal or drop goal: 22 drop-out by the defending side', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R20-restart-dead', title: 'kick made dead: 22 drop-out (ran dead) or goal-line drop-out (touched down), defending side', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R21-restart-heldup', title: 'held up over the line: goal-line drop-out by the defending side', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R22-restart-half', title: 'second half kicked off by the side that did not kick off the first', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R23-restart-cause', title: 'every kick-off and drop-out has its reason before it; kick-off goes 10 m, 22 drop-out crosses the 22', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R24-cards', title: 'a card follows a penalty against the carded side and names a man on that side', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R25-binned', title: 'a man in the bin (ten minutes) or sent off is never named in play while off', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R26-names', title: 'who is on the side the entry is about, vs on the other side, all on the field (real fixtures)', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R27-clock-mono', title: 'the clock never goes backwards', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R28-clock-sum', title: 'the clock moves by exactly the live and dead seconds the record gives', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R29-score', title: 'score arithmetic: try 5, conversion 2, penalty goal 3, drop goal 3; tries and final score agree', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R30-tacklers', title: 'defence reacts: every carry that is stopped names a tackler (real fixtures)', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R31-pen-range', title: 'penalties and free kicks a match between 6 and 17 (at most 10% of matches outside)', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R32-pen-mean', title: 'penalties and free kicks average 11 to 12 a match', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R33-outonfull', title: 'kicks out on the full about 1 or 2 a game (mean 1.0 to 2.0)', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R34-shape-rates', title: 'ball in play 32-38 min, tries 6.0-6.6, points 48-53, scrums 11-17, lineouts 22-29', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R35-decision', title: 'a change from minute M leaves every play before M the same and moves the match after it', owner: 'GAMEPLAY', kind: 'rate' },
  // commentary (only when commentary.ts exists)
  { id: 'C01-line-play', title: 'every Line points at a real Play, in order', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C02-line-side', title: 'a Line is about the side of its Play or the side with the ball', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C03-line-kind', title: 'words name the kind the record has (try, knock-on, kick to touch, 50:22, card, turnover, scrum, lineout)', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C04-line-score', title: 'a score in the words is the score in the record at that play', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C05-line-player', title: 'a named player is in that Play, on that side, on the field', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C06-line-territory', title: 'no territory or momentum line the record does not support', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C07-line-breakdown', title: 'a breakdown penalty is only said after a ruck', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C09-line-binback', title: 'a man back from the bin is said at the right time, with the right count of men', owner: 'COMMENTARY', kind: 'match' },
  { id: 'C08-line-events', title: 'every score, card, penalty and set piece has at least one Line', owner: 'COMMENTARY', kind: 'match' },
  // animation (only when fromRecord.ts exists)
  { id: 'A01-schedule-cover', title: 'the schedule covers every Play once, in order', owner: 'ANIMATION', kind: 'match' },
  { id: 'A02-schedule-time', title: 'the schedule never goes back in time', owner: 'ANIMATION', kind: 'match' },
  { id: 'A03-fades', title: 'fades only on lineouts, conversions, kicks at goal and after half-time', owner: 'ANIMATION', kind: 'match' },
  { id: 'A04-length', title: 'an Extended match takes about 4 minutes to watch (3.5 to 4.5)', owner: 'ANIMATION', kind: 'rate' },
]

export interface Fail { rule: string; n: number; msg: string }
/** a match to check: the record, and when known the men on each side (starting 15) and their names */
export interface Match {
  label: string
  seed: number
  res: SimResult
  /** player ids of each side's starting fifteen, when the match has real team sheets */
  xv?: [Set<string>, Set<string>]
  bench?: [Set<string>, Set<string>]
  names?: Map<string, string>
  /** the two clubs' names (real fixtures), for the commentary */
  teams?: [string, string]
}

const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
const toLine = (s: 0 | 1, x: number) => (s === 0 ? 100 - x : x)
const adv = (s: 0 | 1, from: number, m: number) => (s === 0 ? from + m : from - m)
const near = (a: number, b: number, tol = 0.25) => Math.abs(a - b) <= tol
const CARD = new Set(['yellowCard', 'redCard'])
const TOUCH_KICK = new Set(['touch', 'penaltyToTouch', 'fiftyTwentyTwo', 'outOnFull'])
const SCORE_GOOD = (p: Play) => p.kind === 'conversion' || p.kind === 'penaltyTry' || ((p.kind === 'penaltyGoal' || p.kind === 'dropGoal') && p.good === true)

/** the law event a play is, read from kind and result alone (independent of the simulation's own calls) */
export function lawOf(p: Play): LawEvent | null {
  switch (p.kind) {
    case 'kickoff': return 'KICKOFF'
    case 'dropout22': case 'goalLineDropout': return 'DROPOUT'
    case 'catch': case 'carry': case 'ruck': case 'maul': case 'lineBreak': case 'tap': return 'PLAY'
    case 'knockOn': case 'forwardPass': case 'notStraight': case 'unplayable': case 'restartError': return 'STOP'
    case 'scrum': return 'SCRUM'
    case 'lineout': return 'LINEOUT'
    case 'intoTouch': case 'outOnFull': return 'TOUCH'
    case 'deadBall': case 'heldUp': return 'DEAD'
    case 'penalty': case 'freeKick': return 'PENALTY'
    case 'penaltyGoal': return p.good ? 'GOAL' : 'GOALMISS'
    case 'dropGoal': return p.good ? 'DROPGOAL' : 'DROPMISS'
    case 'kick': return TOUCH_KICK.has(p.result) ? 'TOUCH' : 'KICK'
    case 'try': case 'penaltyTry': return 'TRY'
    case 'conversion': return 'CON'
    case 'halfTime': return 'HALF'
    default: return null // cards, full time
  }
}

/** a card is shown at the clock before its own dead time (the record's t is after it); the man is back ten minutes later */
export const offAt = (c: Play) => c.t - c.dead
export const backAt = (c: Play) => c.t - c.dead + 600

/** the play before k that is not a card */
const prevReal = (plays: Play[], k: number): number => { let j = k - 1; while (j >= 0 && CARD.has(plays[j].kind)) j--; return j }
const nextReal = (plays: Play[], k: number): number => { let j = k + 1; while (j < plays.length && CARD.has(plays[j].kind)) j++; return j }

/** Check one match record against every match rule. Returns every failure. */
export function checkRecord(m: Match): Fail[] {
  const P = m.res.plays
  const out: Fail[] = []
  const fail = (rule: string, n: number, msg: string) => out.push({ rule, n, msg })
  const real = !!m.xv
  const sideOf = (id: string): 0 | 1 | -1 => (m.xv?.[0].has(id) || m.bench?.[0].has(id) ? 0 : m.xv?.[1].has(id) || m.bench?.[1].has(id) ? 1 : -1)

  // R01 laws, replayed through the machine from our own reading of each play
  const L = new Laws()
  for (const p of P) {
    const e = lawOf(p)
    if (e && !L.go(e)) { fail('R01-laws', p.n, `${p.kind}/${p.result} (${e}) not allowed from "${L.state}"`); break }
  }

  // R02 shape
  if (P[0]?.kind !== 'kickoff') fail('R02-shape', 0, `first play is ${P[0]?.kind}`)
  if (P[P.length - 1]?.kind !== 'fullTime') fail('R02-shape', P.length - 1, `last play is ${P[P.length - 1]?.kind}`)
  const hts = P.filter(p => p.kind === 'halfTime')
  if (hts.length !== 1) fail('R02-shape', hts[1]?.n ?? 0, `${hts.length} half-times`)
  P.forEach((p, k) => { if (p.n !== k) fail('R02-shape', k, `n is ${p.n}`) })

  // the bin: id -> [from, until]
  const offUntil = new Map<string, { from: number; until: number; side: 0 | 1 }>()
  let s0 = 0, s1 = 0
  const tries: [number, number] = [0, 0]
  let firstKO: 0 | 1 | null = null

  for (let k = 0; k < P.length; k++) {
    const p = P[k], a = k > 0 ? P[k - 1] : null
    const pj = prevReal(P, k), pr = pj >= 0 ? P[pj] : null
    const nj = nextReal(P, k), nx = nj < P.length ? P[nj] : null

    // R03 within the pitch
    if (!(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 70)) fail('R03-pitch', k, `${p.kind} at x ${p.x} y ${p.y}`)
    if ((['ruck', 'catch', 'tap', 'maul', 'scrum'].includes(p.kind) || (p.kind === 'carry' && p.result !== 'intoTouch') || (p.kind === 'lineBreak'))
      && (p.y <= 0 || p.y >= 70)) fail('R03-pitch', k, `${p.kind}/${p.result} on the touchline (y ${p.y}): the ball would be in touch`)

    // R04 possession changes only on a fact
    if (a && p.ball !== a.ball) {
      const ok =
        p.kind === 'catch' ||
        (p.kind === 'ruck' && p.result === 'turnover') ||
        (p.kind === 'lineout') || (p.kind === 'scrum') ||
        p.kind === 'penalty' || p.kind === 'freeKick' ||
        p.kind === 'kickoff' || p.kind === 'dropout22' || p.kind === 'goalLineDropout' ||
        p.kind === 'try' || p.kind === 'penaltyTry' || p.kind === 'conversion' || p.kind === 'halfTime'
      if (!ok) fail('R04-possession', k, `ball went ${a.ball}->${p.ball} on ${p.kind}/${p.result} after ${a.kind}/${a.result}`)
    }
    if (p.kind === 'lineout' && ['won', 'notStraight', 'penalty'].includes(p.result) && p.ball !== p.side) fail('R04-possession', k, `lineout ${p.result} thrown by ${p.side} but ball ends ${p.ball}`)
    if (p.kind === 'lineout' && p.result === 'stolen' && p.ball === p.side) fail('R04-possession', k, 'lineout stolen but the thrower keeps the ball')
    if (p.kind === 'scrum' && p.result === 'won' && p.ball !== p.side) fail('R04-possession', k, 'scrum won but ball is with the other side')
    if (p.kind === 'scrum' && p.result === 'againstTheHead' && p.ball === p.side) fail('R04-possession', k, 'against the head but the feeding side keeps it')
    if ((p.kind === 'penalty' || p.kind === 'freeKick') && p.ball !== p.side) fail('R04-possession', k, `${p.kind} to ${p.side} but ball ${p.ball}`)

    // R05 the side acting has the ball
    if (pr && ['carry', 'lineBreak', 'ruck', 'maul', 'tap'].includes(p.kind) && pr.ball !== p.side && !(p.kind === 'maul' && pr.kind === 'lineout'))
      fail('R05-actor', k, `${p.kind} by side ${p.side} but side ${pr.ball} had the ball after ${pr.kind}/${pr.result}`)
    if (pr && p.kind === 'maul' && pr.kind === 'lineout' && pr.ball !== p.side) fail('R05-actor', k, `maul by ${p.side} off a lineout the other side has`)
    if (pr && p.kind === 'kick' && pr.ball !== p.side) fail('R05-actor', k, `kick by side ${p.side} but side ${pr.ball} had the ball after ${pr.kind}/${pr.result}`)
    if (p.kind === 'catch' && p.ball !== p.side) fail('R05-actor', k, `catch by side ${p.side} but ball ends with ${p.ball}`)

    // R06 knock-on
    if (p.kind === 'knockOn' && pr) {
      if (pr.kind === 'carry') {
        if (pr.result !== 'knockedOn') fail('R06-knockon', k, `knock-on after a carry that was ${pr.result}`)
        if (p.side !== pr.side) fail('R06-knockon', k, `knock-on by side ${p.side} but side ${pr.side} was carrying`)
        if (real && p.who !== pr.who) fail('R06-knockon', k, `knock-on by ${p.who} but the carrier was ${pr.who}`)
      } else if (pr.kind === 'kick' || pr.kind === 'kickoff' || pr.kind === 'dropout22' || pr.kind === 'goalLineDropout') {
        // a ball in the air: either side may knock it on, at the landing place
      } else fail('R06-knockon', k, `knock-on after ${pr.kind}/${pr.result}: nobody was at the ball`)
      if (!near(p.x, pr.x) || !near(p.y, pr.y)) fail('R06-knockon', k, `knock-on at ${p.x},${p.y} but the ball was at ${pr.x},${pr.y}`)
      if (real && !p.who) fail('R06-knockon', k, 'knock-on with nobody named')
    }

    // R07 continuity: where this entry starts is where the last ended
    if (pr) {
      const same = (what: string) => { if (!near(p.x, pr.x) || !near(p.y, pr.y)) fail('R07-continuity', k, `${what} at ${p.x},${p.y} but ${pr.kind}/${pr.result} ended at ${pr.x},${pr.y}`) }
      if (p.kind === 'ruck') same('ruck')
      // a lineout offence is given where the lineout was, in from touch (no further in than the 15 m line)
      if ((p.kind === 'penalty' || p.kind === 'freeKick') && pr.kind === 'lineout') {
        const line = pr.y < 35 ? 0 : 70
        if (!near(p.x, pr.x) || Math.abs(p.y - line) > 15) fail('R07-continuity', k, `${p.kind} at ${p.x},${p.y} but the lineout was at ${pr.x} on the ${line === 0 ? 'near' : 'far'} touchline`)
      } else if (p.kind === 'penalty' || p.kind === 'freeKick') same(p.kind)
      if (p.kind === 'catch' && pr.kind !== 'kick' && pr.kind !== 'kickoff' && pr.kind !== 'dropout22' && pr.kind !== 'goalLineDropout') fail('R07-continuity', k, `catch after ${pr.kind}: nothing was kicked`)
      if (p.kind === 'catch' && pr.kind === 'kick' && pr.result !== 'chargedDown') same('catch')
      if (p.kind === 'tap') same('tap')
      if (p.kind === 'conversion' && pr.kind === 'try' && !near(p.y, pr.y)) fail('R07-continuity', k, `conversion at y ${p.y}, try scored at y ${pr.y}`)
      if (p.kind === 'try' && !near(p.y, pr.y, 0.25) && pr.kind !== 'kick') fail('R07-continuity', k, `try at y ${p.y} but ${pr.kind} ended at y ${pr.y}`)
      if (p.kind === 'carry' || p.kind === 'lineBreak') {
        // the carrier starts at the ball: a wide carry may move across, but x starts at the last x
        if (pr.kind === 'kick' && pr.result !== 'chargedDown') fail('R07-continuity', k, `carry straight after a kick (${pr.result}) with no catch`)
      }
    }

    // R08 gain vs change in x
    if (pr && p.gain != null && ['carry', 'lineBreak', 'maul', 'kick'].includes(p.kind) && !['outOnFull', 'chargedDown'].includes(p.result)) {
      const from = pr.x
      let want = adv(p.side, from, p.gain)
      if (p.kind === 'carry' && toLine(p.side, want) >= 99) want = p.side === 0 ? 1 : 99
      want = Math.max(0, Math.min(100, want))
      if (!near(p.x, want, 0.25)) fail('R08-gain', k, `${p.kind}/${p.result} gain ${p.gain.toFixed(1)} from x ${from} should end at ${want.toFixed(1)}, ends at ${p.x}`)
    }

    // R09 sideways then backwards
    if (pr && p.kind === 'carry' && p.gain != null && p.gain < -2 && Math.abs(p.y - pr.y) > 10)
      fail('R09-backwards', k, `carry goes ${Math.abs(p.y - pr.y).toFixed(0)} m across and ${(-p.gain).toFixed(1)} m back`)

    // R10 scrum: cause, feed, place
    if (p.kind === 'scrum') {
      if (!pr) fail('R10-scrum', k, 'scrum with nothing before it')
      else {
        const c = pr
        if (['knockOn', 'forwardPass', 'notStraight', 'restartError'].includes(c.kind)) {
          if (p.side !== other(c.side)) fail('R10-scrum', k, `put-in to ${p.side} after ${c.kind} by ${c.side}: it goes against the side that made the error`)
        } else if (c.kind === 'unplayable') {
          const before = P[prevReal(P, pj)]
          if (before?.kind === 'maul' && p.side !== other(before.side)) fail('R10-scrum', k, 'maul stopped: the put-in goes to the side not in possession (Law 16)')
        } else if (c.kind === 'penalty' || c.kind === 'freeKick') {
          if (p.side !== c.side) fail('R10-scrum', k, `scrum option taken by ${p.side} but the penalty was to ${c.side}`)
        } else fail('R10-scrum', k, `scrum after ${c.kind}/${c.result}: no knock-on, forward pass, unplayable ball or penalty before it`)
        if (Math.abs(p.x - Math.max(5, Math.min(95, c.x))) > 0.25) fail('R10-scrum', k, `scrum at x ${p.x} but the stoppage was at x ${c.x}`)
      }
      if (p.x < 5 || p.x > 95) fail('R10-scrum', k, `scrum within 5 m of a goal line (x ${p.x})`)
      if (p.y < 5 || p.y > 65) fail('R10-scrum', k, `scrum within 5 m of touch (y ${p.y})`)
    }

    // R11 / R12 lineout: cause, touchline, place, throw
    if (p.kind === 'lineout') {
      const c = pr
      if (!c || !((c.kind === 'kick' && TOUCH_KICK.has(c.result)) || c.kind === 'intoTouch' || c.kind === 'outOnFull')) {
        fail('R11-lineout', k, `lineout after ${c?.kind}/${c?.result}: nothing went into touch`)
      } else {
        if (c.y !== 0 && c.y !== 70) fail('R11-lineout', k, `${c.kind}/${c.result} went into touch at y ${c.y}, not on a touchline`)
        const line = c.y < 35 ? 0 : 70
        const dy = Math.abs(p.y - line)
        if (dy > 15) fail('R11-lineout', k, `lineout ends ${dy.toFixed(0)} m from the touchline the ball went out on`)
        if (Math.abs(p.x - Math.max(5, Math.min(95, c.x))) > 0.25) fail('R11-lineout', k, `lineout at x ${p.x} but it went out at x ${c.x}`)
        if (c.kind === 'kick' && c.result === 'outOnFull') {
          const kicked = P[prevReal(P, pj)]
          if (kicked && !near(c.x, kicked.x)) fail('R11-lineout', k, `out on the full: lineout should be level with where it was kicked (x ${kicked.x}), is at ${c.x}`)
        }
        const keeps = c.kind === 'kick' && (c.result === 'penaltyToTouch' || c.result === 'fiftyTwentyTwo')
        const outBy = c.kind === 'intoTouch' && P[pj - 1]?.kind === 'carry' ? P[pj - 1].side : c.side
        if (keeps && p.side !== c.side) fail('R12-throw', k, `${c.result}: the kicking side ${c.side} should throw, ${p.side} throws`)
        if (!keeps && p.side === outBy) fail('R12-throw', k, `${c.kind}/${c.result} put out by ${outBy}, and ${outBy} throws in`)
      }
    }

    // R13 / R14 50:22
    if (p.kind === 'kick' && pr && (p.result === 'fiftyTwentyTwo' || p.result === 'touch')) {
      const start = pr.x
      const fromOwnHalf = toLine(p.side, start) > 50
      const intoTheir22 = toLine(p.side, p.x) < 22
      const openPlay = pr.kind !== 'penalty' && pr.kind !== 'freeKick' && !CARD.has(pr.kind)
      const real5022 = fromOwnHalf && intoTheir22 && openPlay
      if (p.result === 'fiftyTwentyTwo' && !real5022) fail('R13-5022', k, `50:22 called from x ${start} (own half: ${fromOwnHalf}) to x ${p.x} (their 22: ${intoTheir22}), open play: ${openPlay}`)
      // a kick from inside the kicker's own 22 can still be a 50:22 in law; the record cannot tell a bounce, so only non-full kicks to touch count
      if (p.result === 'touch' && real5022) fail('R14-5022-missed', k, `kick from own half (x ${start}) bounced into touch in their 22 (x ${p.x}) but was not called a 50:22: the throw is given to the wrong side`)
    }

    // R15 penalty cause
    if ((p.kind === 'penalty' || p.kind === 'freeKick') && pr) {
      const ok = (pr.kind === 'ruck' && /penalty/.test(pr.result)) || (pr.kind === 'scrum' && /penalty|freeKick/.test(pr.result)) ||
        (pr.kind === 'lineout' && pr.result === 'penalty') || (pr.kind === 'maul' && pr.result === 'pulledDown')
      if (!ok) fail('R15-penalty-cause', k, `${p.kind} to ${p.side} after ${pr.kind}/${pr.result}: no offence in the record`)
    }

    // R16 kick at goal from the mark
    if (p.kind === 'penaltyGoal') {
      const c = P[prevReal(P, k)]
      if (!c || (c.kind !== 'penalty')) fail('R16-goal-spot', k, `kick at goal after ${c?.kind}`)
      else if (!near(p.x, c.x) || !near(p.y, c.y)) fail('R16-goal-spot', k, `kick at goal from ${p.x},${p.y}; penalty given at ${c.x},${c.y}`)
      if (c && c.side !== p.side) fail('R16-goal-spot', k, `penalty to ${c.side} but ${p.side} kick at goal`)
    }

    // R17 turnovers
    if (p.kind === 'ruck' && p.result === 'turnover' && real && !(p.vs && p.vs[0])) fail('R17-turnover', k, 'turnover at the ruck with no man named for the steal')

    // R18 restarts after scores
    if (p.kind === 'conversion' && (!pr || pr.kind !== 'try' || pr.side !== p.side)) fail('R18-restart-score', k, `conversion by ${p.side} after ${pr?.kind} (${pr?.side})`)
    if (p.kind === 'penaltyTry' && pr && pr.kind !== 'penalty') fail('R15-penalty-cause', k, `penalty try after ${pr.kind}: no penalty given`)
    if (p.kind === 'try' && (!nx || nx.kind !== 'conversion' || nx.side !== p.side)) fail('R18-restart-score', k, `try by ${p.side} followed by ${nx?.kind} (${nx?.side})`)
    if (SCORE_GOOD(p) && nx && nx.kind !== 'halfTime' && nx.kind !== 'fullTime') {
      if (nx.kind !== 'kickoff') fail('R18-restart-score', k, `${p.kind} followed by ${nx.kind}, not a kick-off`)
      else if (nx.side !== other(p.side)) fail('R18-restart-score', k, `${p.kind} by ${p.side}: kick-off should be by ${other(p.side)}, is by ${nx.side}`)
    }
    if (p.kind === 'conversion' && !p.good && nx && nx.kind !== 'halfTime' && nx.kind !== 'fullTime' && (nx.kind !== 'kickoff' || nx.side !== other(p.side)))
      fail('R18-restart-score', k, `missed conversion by ${p.side} followed by ${nx.kind} by ${nx.side}`)

    // R19 missed kicks at goal
    if ((p.kind === 'penaltyGoal' || p.kind === 'dropGoal') && !p.good && nx && nx.kind !== 'halfTime' && nx.kind !== 'fullTime') {
      if (nx.kind !== 'dropout22') fail('R19-restart-miss', k, `missed ${p.kind} followed by ${nx.kind}, not a 22 drop-out`)
      else if (nx.side !== other(p.side)) fail('R19-restart-miss', k, `missed ${p.kind} by ${p.side}: drop-out by ${nx.side}`)
    }
    // R20 dead ball
    if (p.kind === 'deadBall' && nx && nx.kind !== 'halfTime' && nx.kind !== 'fullTime') {
      const want = p.result === 'touchedDown' ? 'goalLineDropout' : 'dropout22'
      if (nx.kind !== want) fail('R20-restart-dead', k, `dead ball (${p.result}) followed by ${nx.kind}, want ${want}`)
      else if (nx.side !== other(p.side)) fail('R20-restart-dead', k, `dead ball off a kick by ${p.side}: drop-out by ${nx.side}`)
    }
    // R21 held up
    if (p.kind === 'heldUp' && nx && nx.kind !== 'halfTime' && nx.kind !== 'fullTime') {
      if (nx.kind !== 'goalLineDropout') fail('R21-restart-heldup', k, `held up followed by ${nx.kind}`)
      else if (nx.side !== other(p.side)) fail('R21-restart-heldup', k, `held up by ${p.side}: goal-line drop-out by ${nx.side}`)
    }
    // R22 half-time
    if (p.kind === 'kickoff' && firstKO === null) firstKO = p.side
    if (p.kind === 'halfTime' && nx && nx.kind === 'kickoff' && firstKO !== null && nx.side !== other(firstKO))
      fail('R22-restart-half', k, `first half kicked off by ${firstKO}, second half also by ${nx.side}`)
    // R23 every restart has its reason, and goes far enough
    if (p.kind === 'kickoff' && k > 0) {
      if (!pr || !(SCORE_GOOD(pr) || pr.kind === 'halfTime')) fail('R23-restart-cause', k, `kick-off after ${pr?.kind}/${pr?.result}`)
    }
    if (p.kind === 'kickoff' && toLine(p.side, p.x) > 40) fail('R23-restart-cause', k, `kick-off lands at x ${p.x}: short of the 10 m line`)
    if (p.kind === 'dropout22' || p.kind === 'goalLineDropout') {
      if (!pr || !(pr.kind === 'deadBall' || pr.kind === 'heldUp' || ((pr.kind === 'penaltyGoal' || pr.kind === 'dropGoal') && !pr.good))) fail('R23-restart-cause', k, `${p.kind} after ${pr?.kind}/${pr?.result}`)
      if (p.kind === 'dropout22' && toLine(p.side, p.x) > 78) fail('R23-restart-cause', k, `22 drop-out lands at x ${p.x}: it has not crossed the 22`)
    }

    // R24 cards
    if (CARD.has(p.kind)) {
      const c = P[k - 1]
      if (!c || c.kind !== 'penalty') fail('R24-cards', k, `${p.kind} after ${c?.kind}`)
      else if (c.side !== other(p.side)) fail('R24-cards', k, `penalty to ${c.side}, card to ${p.side}`)
      if (real) {
        if (!p.who) fail('R24-cards', k, `${p.kind} with nobody named`)
        else if (sideOf(p.who) !== p.side) fail('R24-cards', k, `${p.kind} to side ${p.side} names ${p.who} of side ${sideOf(p.who)}`)
      }
      if (p.who) offUntil.set(p.who, { from: offAt(p), until: p.kind === 'redCard' ? Infinity : backAt(p), side: p.side })
    }
    // R25 / R26 names on the field and on the right side
    if (real && !CARD.has(p.kind)) {
      const named: [string, 'who' | 'vs' | 'with'][] = []
      if (p.who) named.push([p.who, 'who'])
      for (const v of p.vs ?? []) if (v) named.push([v, 'vs'])
      for (const v of p.with ?? []) if (v) named.push([v, 'with'])
      for (const [id, role] of named) {
        const o = offUntil.get(id)
        if (o && p.t >= o.from && p.t < o.until) fail('R25-binned', k, `${m.names?.get(id) ?? id} named (${role}) in ${p.kind} at ${p.t}s while off the field (${o.until === Infinity ? 'sent off' : `in the bin until ${o.until}s`})`)
        const s = sideOf(id)
        const want = role === 'vs' ? other(p.side) : p.side
        if (s === -1) fail('R26-names', k, `${id} in ${p.kind} is on neither team sheet`)
        else if (s !== want) fail('R26-names', k, `${p.kind}/${p.result} about side ${p.side}: ${role} ${m.names?.get(id) ?? id} is on side ${s}`)
        else if (!m.xv![s].has(id)) fail('R26-names', k, `${m.names?.get(id) ?? id} is on the bench and was never brought on`)
      }
    }

    // R27 / R28 the clock
    if (a) {
      if (p.t < a.t) fail('R27-clock-mono', k, `clock goes back from ${a.t}s to ${p.t}s at ${p.kind} (after ${a.kind})`)
      // the dead time of a drop-out is written on it but spent after it (skeleton dropout)
      const carry = a.kind === 'dropout22' || a.kind === 'goalLineDropout' ? a.dead : 0
      const own = p.kind === 'dropout22' || p.kind === 'goalLineDropout' ? p.live : p.live + p.dead
      const pre = (p as Play & { pre?: number }).pre ?? 0
      const gap = p.t - a.t - own - carry - pre
      // (the second half's kick-off is at 40:00 whatever the first half ran to: checked by R27, not here)
      if (Math.abs(gap) > 1.01 && !(p.kind === 'kickoff' && a.kind === 'halfTime'))
        fail('R28-clock-sum', k, `${p.kind}: clock moved ${p.t - a.t}s, the record accounts for ${(own + carry + pre).toFixed(0)}s (${gap.toFixed(0)}s unexplained)`)
    }

    // R29 score
    const want: [number, number] = [s0, s1]
    if (p.kind === 'try') { want[p.side] += 5; tries[p.side]++ }
    // a penalty try is seven points and no conversion (Law 8.3)
    if (p.kind === 'penaltyTry') { want[p.side] += 7; tries[p.side]++ }
    if (p.kind === 'conversion' && p.good) want[p.side] += 2
    if ((p.kind === 'penaltyGoal' || p.kind === 'dropGoal') && p.good) want[p.side] += 3
    if (p.score[0] !== want[0] || p.score[1] !== want[1]) fail('R29-score', k, `${p.kind}/${p.result}: score ${p.score.join('-')}, should be ${want.join('-')}`)
    s0 = p.score[0]; s1 = p.score[1]

    // R30 the defence is in it
    if (real && p.kind === 'carry' && ['gainLine', 'held', 'knockedOn'].includes(p.result) && !(p.vs && p.vs.length)) fail('R30-tacklers', k, `carry ${p.result} with no tackler named`)
    if (real && p.kind === 'lineBreak' && p.result === 'hauledDown' && !(p.vs && p.vs[0])) fail('R30-tacklers', k, 'line break hauled down by nobody')
  }
  const last = P[P.length - 1]
  if (last && (m.res.score[0] !== last.score[0] || m.res.score[1] !== last.score[1])) fail('R29-score', last.n, `result ${m.res.score.join('-')} but last play ${last.score.join('-')}`)
  if (m.res.tries[0] !== tries[0] || m.res.tries[1] !== tries[1]) fail('R29-score', last?.n ?? 0, `result tries ${m.res.tries.join('-')}, try plays ${tries.join('-')}`)
  return out
}

/** per-match counts the rate rules use */
export function countMatch(r: SimResult) {
  let pens = 0, outFull = 0, live = 0, scrums = 0, lineouts = 0, tries = 0
  for (const p of r.plays) {
    if (p.kind === 'penalty' || p.kind === 'freeKick') pens++
    if (p.kind === 'kick' && p.result === 'outOnFull') outFull++
    if (p.kind === 'scrum') scrums++
    if (p.kind === 'lineout') lineouts++
    if (p.kind === 'try' || p.kind === 'penaltyTry') tries++
    live += p.live
  }
  return { pens, outFull, live, scrums, lineouts, tries, points: r.score[0] + r.score[1] }
}

export interface RateRow { id: string; ok: boolean; msg: string; failing: number; first?: { seed: number; n: number } }

/** the rules measured over many matches */
export function checkRates(ms: Match[]): RateRow[] {
  const c = ms.map(m => ({ m, c: countMatch(m.res) }))
  const N = c.length
  const mean = (f: (x: ReturnType<typeof countMatch>) => number) => c.reduce((s, x) => s + f(x.c), 0) / Math.max(1, N)
  const rows: RateRow[] = []
  const outside = c.filter(x => x.c.pens < 6 || x.c.pens > 17)
  rows.push({ id: 'R31-pen-range', ok: outside.length <= 0.10 * N, failing: outside.length,
    first: outside[0] ? { seed: outside[0].m.seed, n: -1 } : undefined,
    msg: `${outside.length} of ${N} matches outside 6..17 (min ${Math.min(...c.map(x => x.c.pens))}, max ${Math.max(...c.map(x => x.c.pens))})` })
  const pm = mean(x => x.pens)
  rows.push({ id: 'R32-pen-mean', ok: pm >= 11 && pm <= 12, failing: pm >= 11 && pm <= 12 ? 0 : N, msg: `mean ${pm.toFixed(2)} a match` })
  const of = mean(x => x.outFull)
  rows.push({ id: 'R33-outonfull', ok: of >= 1 && of <= 2, failing: of >= 1 && of <= 2 ? 0 : N, msg: `mean ${of.toFixed(2)} a match` })
  const bip = mean(x => x.live) / 60, tr = mean(x => x.tries), pts = mean(x => x.points), sc = mean(x => x.scrums), lo = mean(x => x.lineouts)
  const bad: string[] = []
  if (bip < 32 || bip > 38) bad.push('ball in play')
  if (tr < 6.0 || tr > 6.6) bad.push('tries')
  if (pts < 48 || pts > 53) bad.push('points')
  if (sc < 11 || sc > 17) bad.push('scrums')
  if (lo < 22 || lo > 29) bad.push('lineouts')
  rows.push({ id: 'R34-shape-rates', ok: !bad.length, failing: bad.length ? N : 0,
    msg: `ball in play ${bip.toFixed(1)} min, tries ${tr.toFixed(2)}, points ${pts.toFixed(1)}, scrums ${sc.toFixed(1)}, lineouts ${lo.toFixed(1)}${bad.length ? ` (out: ${bad.join(', ')})` : ''}` })
  return rows
}

/**
 * R35: a manager's call from minute M. The World is the only way in today
 * (there is no decisions input on simSkeleton), so the call is modelled as
 * side 0 becoming 12% stronger at every contest from clock second `from`.
 * Every play before that second must be the same as without the call, and
 * over the seeds side 0 must score more after it.
 */
export function checkDecision(seeds: number[], from = 2400): RateRow {
  const base = evenWorld([1, 1])
  const changed: World = { ...base, str: (s, c, t) => (s === 0 && t >= from ? 1.12 : 1) * base.str(s, c, t) }
  let prefixBroken = 0, firstBad: { seed: number; n: number } | undefined
  let gainA = 0, gainB = 0
  for (const seed of seeds) {
    const A = simSkeleton({ seed, world: base }), B = simSkeleton({ seed, world: changed })
    for (let k = 0; k < A.plays.length; k++) {
      if (A.plays[k].t >= from) break
      if (JSON.stringify(A.plays[k]) !== JSON.stringify(B.plays[k])) { prefixBroken++; firstBad ??= { seed, n: k }; break }
    }
    const after = (r: SimResult) => { const ht = r.plays.find(p => p.t >= from) ?? r.plays[r.plays.length - 1]; return (r.score[0] - ht.score[0]) - (r.score[1] - ht.score[1]) }
    gainA += after(A); gainB += after(B)
  }
  const lift = (gainB - gainA) / seeds.length
  const ok = prefixBroken === 0 && lift > 0
  return { id: 'R35-decision', ok, failing: prefixBroken + (lift > 0 ? 0 : seeds.length), first: firstBad,
    msg: `${prefixBroken} matches changed before minute ${from / 60}; side 0 margin after it moved ${lift >= 0 ? '+' : ''}${lift.toFixed(2)} points a match` }
}

// ------------------------------------------------------------ commentary

/** the commentary's summary lines (about the match so far, not one play); copied from commentary.ts SUMMARY and refreshed from it when it loads */
export const SUMMARY_BASES = new Set(['territory', 'possession', 'tries', 'run', 'binBack', 'winBy', 'draw', 'tryAgain'])

export interface LineLike { n: number; key: string; params?: Record<string, unknown>; level?: unknown; side?: 0 | 1 | null }

/** Check the commentary's lines for one match against its record. `text` is render(line). */
export function checkLines(m: Match, lines: LineLike[], text: (l: LineLike) => string): Fail[] {
  const P = m.res.plays
  const out: Fail[] = []
  const fail = (rule: string, n: number, msg: string) => out.push({ rule, n, msg })
  let lastN = -1
  const said = new Set<number>()
  const names = m.names ?? new Map<string, string>()
  const byName = new Map<string, string>()
  for (const [id, nm] of names) { byName.set(nm, id); const sur = nm.split(' ').slice(-1)[0]; if (sur && sur.length > 3) byName.set(sur, id) }
  const binSaid = new Set<number>()
  const isOff = (id: string, t: number) => P.some(c => CARD.has(c.kind) && c.who === id && t >= offAt(c) && (c.kind === 'redCard' || t < backAt(c)))

  for (const l of lines) {
    const p = P[l.n]
    if (!p) { fail('C01-line-play', l.n, `line ${l.key} points at play ${l.n}, which does not exist`); continue }
    if (l.n < lastN) fail('C01-line-play', l.n, `line ${l.key} for play ${l.n} comes after a line for play ${lastN}`)
    lastN = Math.max(lastN, l.n)
    said.add(l.n)
    let s = ''
    try { s = text(l) } catch (e) { fail('C01-line-play', l.n, `render threw on ${l.key}: ${(e as Error).message}`) }
    const low = (s + ' ' + l.key).toLowerCase()
    const prev = P[prevReal(P, l.n)]
    const isKind = (...k: string[]) => k.includes(p.kind)

    const base = l.key.replace(/^sim\./, '').replace(/\d+$/, '')
    const summary = SUMMARY_BASES.has(base)
    // a set piece or penalty line may give its reason: the play (or two) before it
    const cause = P[prevReal(P, l.n)], cause2 = cause ? P[prevReal(P, cause.n)] : undefined
    const cands = ['scrum', 'lineout', 'penalty', 'freeKick', 'tap', 'kickoff', 'dropout22', 'goalLineDropout', 'conversion', 'penaltyGoal'].includes(p.kind) ? [p, cause, cause2].filter(Boolean) as Play[] : [p]
    const any = (f: (q: Play) => boolean) => cands.some(f)

    // C02 side (summary lines are about the match so far, not this play)
    if (!summary && l.side != null && l.side !== p.side && l.side !== p.ball && !cands.some(q => q.side === l.side))
      fail('C02-line-side', l.n, `"${s}" is about side ${l.side}; play ${p.kind}/${p.result} is about ${p.side}, ball with ${p.ball}`)

    // C03 the words name what the record has (in this play or, at a set piece, the reason for it)
    const kickTouch = (q: Play) => (q.kind === 'kick' && TOUCH_KICK.has(q.result)) || (q.kind === 'intoTouch' && q.result === 'bounced')
    if (/50[:/ -]?22|fifty/.test(low) && !any(q => q.kind === 'kick' && q.result === 'fiftyTwentyTwo')) fail('C03-line-kind', l.n, `"${s}" says 50:22; record has ${p.kind}/${p.result}`)
    if (/(kick|kicks|kicked|finds|find)\b[a-z ]{0,20}\btouch/.test(low) && !any(kickTouch)) fail('C03-line-kind', l.n, `"${s}" says kick to touch; record has ${cands.map(q => `${q.kind}/${q.result}`).join(' < ')}`)
    if (/knock[- ]?on|knocks? (it )?on|knocked on/.test(low) && !any(q => q.kind === 'knockOn' || (q.kind === 'carry' && q.result === 'knockedOn'))) fail('C03-line-kind', l.n, `"${s}" says knock-on; record has ${cands.map(q => `${q.kind}/${q.result}`).join(' < ')}`)
    if (/\btry\b/.test(low) && /(scores?|over|try!|^try)/.test(low) && !/(no try|try line|try[- ]saver|held up|drop goal|tries to)/.test(low) && !summary && !any(q => q.kind === 'try' || q.kind === 'penaltyTry' || q.kind === 'conversion')) fail('C03-line-kind', l.n, `"${s}" says try; record has ${p.kind}/${p.result}`)
    if (/yellow/.test(low) && !isKind('yellowCard')) fail('C03-line-kind', l.n, `"${s}" says yellow card; record has ${p.kind}`)
    if (/\bred card|sent off/.test(low) && !isKind('redCard')) fail('C03-line-kind', l.n, `"${s}" says red card; record has ${p.kind}`)
    if (/turnover|turned over|steal|stolen|against the head/.test(low) && !summary && !((p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'lineout' && p.result === 'stolen') || (p.kind === 'scrum' && p.result === 'againstTheHead') || (p.kind === 'catch' && p.side !== P[l.n - 1]?.side)))
      fail('C03-line-kind', l.n, `"${s}" says turnover; record has ${p.kind}/${p.result}`)
    if (/\bscrum\b/.test(low) && !/scrum[- ]half/.test(low) && !any(q => ['scrum', 'knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError'].includes(q.kind) || (q.kind === 'penalty' && P[q.n + 1]?.kind === 'scrum'))) fail('C03-line-kind', l.n, `"${s}" mentions a scrum; record has ${p.kind}/${p.result}`)
    if (/\blineout\b/.test(low) && !any(q => ['lineout', 'intoTouch', 'kick', 'outOnFull'].includes(q.kind) || (q.kind === 'carry' && q.result === 'intoTouch'))) fail('C03-line-kind', l.n, `"${s}" mentions a lineout; record has ${p.kind}/${p.result}`)
    if (/drop[- ]goal/.test(low) && !any(q => q.kind === 'dropGoal')) fail('C03-line-kind', l.n, `"${s}" says drop goal; record has ${p.kind}`)

    // C04 score in the words
    const sm = s.match(/\b(\d{1,3})\s*[-–]\s*(\d{1,3})\b/)
    if (sm && !/%/.test(s)) {
      const a = Number(sm[1]), b = Number(sm[2])
      const ok = (a === p.score[0] && b === p.score[1]) || (a === p.score[1] && b === p.score[0])
      if (!ok && !/minute|metre|phase/.test(low)) fail('C04-line-score', l.n, `"${s}" gives ${a}-${b}; record ${p.score.join('-')}`)
    }

    // C05 named players: params that are ids, and full names in the text
    const ids = new Set<string>()
    for (const v of Object.values(l.params ?? {})) if (typeof v === 'string' && names.has(v)) ids.add(v)
    for (const [id, nm] of names) if (nm && s.includes(nm)) ids.add(id)
    if (m.xv) for (const id of ids) {
      const inPlay = cands.concat(cause ? [cause] : []).some(q => q.who === id || q.vs?.includes(id) || q.with?.includes(id))
      if (!inPlay) fail('C05-line-player', l.n, `"${s}" names ${names.get(id)}, who is not in ${cands.map(q => `${q.kind}/${q.result}`).join(' < ')}`)
      const side = m.xv[0].has(id) ? 0 : m.xv[1].has(id) ? 1 : -1
      if (side === -1) fail('C05-line-player', l.n, `"${s}" names ${names.get(id)}, who is not in either starting XV`)
      if (isOff(id, p.t) && !CARD.has(p.kind)) fail('C05-line-player', l.n, `"${s}" names ${names.get(id)}, who is off the field`)
    }

    // C06 territory and possession: the number said is the number in the record, and never in the opening minutes
    if (/territor|momentum|on top|all the ball|possession|camped|pinned|dominat/.test(low)) {
      const ht = P.find(q => q.kind === 'halfTime')
      // the second half starts at 40:00 on the clock
      const halfStart = ht && l.n > ht.n ? 2400 : 0
      const into = p.t - halfStart
      const pcts = [...s.matchAll(/(\d{1,3})%/g)].map(x => Number(x[1]))
      const subj = (l.side ?? p.ball) as 0 | 1
      // independent of commentary.ts: live seconds in the other half over the last ten minutes of this half,
      // and live seconds with the ball (the side with it when the play began) so far
      const terr: [number, number] = [0, 0], poss: [number, number] = [0, 0]
      for (let i = 0; i <= l.n; i++) {
        const q = P[i]
        poss[i > 0 ? P[i - 1].ball : q.side] += q.live
        if (q.t > p.t - 600 && q.t >= halfStart && (!ht || (l.n > ht.n ? i > ht.n : i < ht.n))) { if (q.x > 50) terr[0] += q.live; else if (q.x < 50) terr[1] += q.live }
      }
      const tp = (terr[0] + terr[1]) ? Math.round(100 * terr[subj] / (terr[0] + terr[1])) : 0
      const pp = (poss[0] + poss[1]) ? Math.round(100 * poss[0] / (poss[0] + poss[1])) : 0
      const isPoss = /possession/.test(low)
      if (!isPoss && into < 600) fail('C06-line-territory', l.n, `"${s}" said ${Math.round(into / 60)} min into the half`)
      if (isPoss && pcts.length >= 1 && !pcts.some(v => Math.abs(v - pp) <= 2 || Math.abs(v - (100 - pp)) <= 2)) fail('C06-line-territory', l.n, `"${s}": the record gives home ${pp}% of the ball`)
      if (!isPoss && pcts.length >= 1 && !pcts.some(v => Math.abs(v - tp) <= 3)) fail('C06-line-territory', l.n, `"${s}": the record gives side ${subj} ${tp}% of the territory in the last ten minutes`)
      if (!isPoss && !pcts.length && tp < 60) fail('C06-line-territory', l.n, `"${s}": the record gives side ${subj} only ${tp}% of the territory in the last ten minutes`)
    }

    // C09 back from the bin: said at the first play once ten minutes are up, with the right number of men
    if (base === 'binBack') {
      const side = l.side as 0 | 1
      const due = P.filter(q => q.kind === 'yellowCard' && q.side === side && backAt(q) <= p.t && !binSaid.has(q.n))
      if (!due.length) fail('C09-line-binback', l.n, `"${s}": no yellow card for side ${side} has run its ten minutes by ${p.t}s`)
      else {
        const card = due[0]; binSaid.add(card.n)
        const firstAfter = P.find(q => q.n > card.n && q.t >= backAt(card))
        if (firstAfter && p.t - firstAfter.t > 120) fail('C09-line-binback', l.n, `"${s}" said at ${p.t}s; the man was due back at ${backAt(card)}s`)
        const stillOff = P.filter(q => q.side === side && ((q.kind === 'yellowCard' && offAt(q) < p.t && backAt(q) > p.t) || (q.kind === 'redCard' && offAt(q) < p.t))).length
        const men = Number(l.params?.men ?? NaN)
        if (!Number.isNaN(men) && men !== 15 - stillOff) fail('C09-line-binback', l.n, `"${s}": the record has ${15 - stillOff} men on the field for side ${side}`)
      }
    }

    // C07 breakdown penalty
    if (/(breakdown|ruck|jackal|not releas|hands in|sealing|off (his|their) feet)/.test(low) && /penal/.test(low) && !(prev?.kind === 'ruck' || p.kind === 'ruck')) fail('C07-line-breakdown', l.n, `"${s}" is a breakdown penalty; the play before is ${prev?.kind}/${prev?.result}`)
  }
  // C09: every yellow card that runs its ten minutes before full time gets its return said
  const ft = P[P.length - 1]
  for (const c of P) if (c.kind === 'yellowCard' && ft && backAt(c) < ft.t && !binSaid.has(c.n)) fail('C09-line-binback', c.n, `yellow card at ${offAt(c)}s for side ${c.side}: his return at ${backAt(c)}s is never said`)
  // C08 every event worth saying is said
  for (const p of P) {
    if (['try', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'penalty', 'freeKick', 'scrum', 'lineout', 'kickoff', 'halfTime', 'fullTime'].includes(p.kind) && !said.has(p.n))
      fail('C08-line-events', p.n, `${p.kind}/${p.result} at ${p.t}s has no line`)
  }
  return out
}

// ------------------------------------------------------------ animation

/** what we read from one schedule item, whatever the animation agent named the fields */
interface Slot { n: number; at: number; dur: number; fade?: boolean }

function readSchedule(raw: unknown): { slots: Slot[] | null; how: string } {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as Record<string, unknown>).items ?? (raw as Record<string, unknown>).slots ?? (raw as Record<string, unknown>).beats ?? (raw as Record<string, unknown>).steps : null
  if (!Array.isArray(arr)) return { slots: null, how: `schedule returned ${typeof raw}${raw && typeof raw === 'object' ? ` with keys ${Object.keys(raw).join(',')}` : ''}` }
  const num = (o: Record<string, unknown>, ...k: string[]) => { for (const x of k) if (typeof o[x] === 'number') return o[x] as number; return NaN }
  const slots: Slot[] = arr.map(it => {
    const o = it as Record<string, unknown>
    const pl = o.play as Record<string, unknown> | undefined
    const n = num(o, 'n', 'index', 'i', 'play') || (pl && typeof pl.n === 'number' ? pl.n : NaN)
    const at = num(o, 'at', 'start', 't0', 'from', 'begin')
    const end = num(o, 'end', 't1', 'to')
    const dur = num(o, 'dur', 'duration', 'ms', 'len') || (!Number.isNaN(end) && !Number.isNaN(at) ? end - at : NaN)
    const fade = typeof o.fade === 'boolean' ? o.fade : typeof o.fade === 'string' ? o.fade !== 'none' && o.fade !== '' : undefined
    return { n: Number.isNaN(n) && typeof o.n !== 'number' ? (typeof o.n === 'number' ? o.n : NaN) : n, at, dur, fade }
  })
  return { slots, how: `${arr.length} items; fields ${Object.keys((arr[0] ?? {}) as object).join(',')}` }
}

export function checkSchedule(m: Match, raw: unknown): { fails: Fail[]; total: number | null; how: string } {
  const P = m.res.plays
  const fails: Fail[] = []
  const { slots, how } = readSchedule(raw)
  if (!slots) { fails.push({ rule: 'A01-schedule-cover', n: 0, msg: how }); return { fails, total: null, how } }
  const seen = new Map<number, number>()
  let last = -1
  for (const s of slots) {
    if (Number.isNaN(s.n)) { fails.push({ rule: 'A01-schedule-cover', n: -1, msg: `an item with no play index (${how})` }); break }
    seen.set(s.n, (seen.get(s.n) ?? 0) + 1)
    if (s.n < last) fails.push({ rule: 'A01-schedule-cover', n: s.n, msg: `play ${s.n} scheduled after play ${last}` })
    last = Math.max(last, s.n)
  }
  for (const p of P) {
    const c = seen.get(p.n) ?? 0
    if (c !== 1) { fails.push({ rule: 'A01-schedule-cover', n: p.n, msg: `${p.kind}/${p.result} scheduled ${c} times` }); break }
  }
  let prevEnd = -Infinity
  for (const s of slots) {
    if (Number.isNaN(s.at)) break
    if (s.at < prevEnd - 1e-6) { fails.push({ rule: 'A02-schedule-time', n: s.n, msg: `starts at ${s.at} before the last one ended at ${prevEnd}` }); break }
    if (!Number.isNaN(s.dur) && s.dur < 0) { fails.push({ rule: 'A02-schedule-time', n: s.n, msg: `negative duration ${s.dur}` }); break }
    prevEnd = s.at + (Number.isNaN(s.dur) ? 0 : s.dur)
  }
  const FADE_OK = new Set(['lineout', 'conversion', 'penaltyGoal', 'halfTime'])
  for (const s of slots) {
    if (!s.fade) continue
    const p = P[s.n]
    const afterHT = p && P[s.n - 1]?.kind === 'halfTime'
    if (p && !FADE_OK.has(p.kind) && !afterHT) { fails.push({ rule: 'A03-fades', n: s.n, msg: `fade on ${p.kind}/${p.result}` }); break }
  }
  const lastSlot = slots[slots.length - 1]
  const total = lastSlot && !Number.isNaN(lastSlot.at) ? lastSlot.at + (Number.isNaN(lastSlot.dur) ? 0 : lastSlot.dur) : null
  return { fails, total, how }
}

// ------------------------------------------------------------ the run

/** the record-only check over a set of seeds of the plain skeleton (used by the test) */
export function skeletonMatches(seeds: number[]): Match[] {
  return seeds.map(seed => ({ label: `seed ${seed}`, seed, res: simSkeleton({ seed }) }))
}

async function realMatches(seeds: number[]): Promise<Match[]> {
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek } = await import('../src/game/season')
  const { mulberry32 } = await import('../src/game/rng')
  const { worldFromMatch } = await import('../src/game/sim/fromMatch')
  const out: Match[] = []
  for (const seed of seeds) {
    const g = newGame('leicester', 'T', seed)
    let fx = userFixtureThisWeek(g)
    for (let i = 0; i < 12 && !fx; i++) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) }
    if (!fx) continue
    const { world, home, away } = worldFromMatch(g, fx, mulberry32(seed))
    const xv: [Set<string>, Set<string>] = [new Set(home.players.filter(p => p.shirt <= 15).map(p => p.id)), new Set(away.players.filter(p => p.shirt <= 15).map(p => p.id))]
    const bench: [Set<string>, Set<string>] = [new Set(home.players.filter(p => p.shirt > 15).map(p => p.id)), new Set(away.players.filter(p => p.shirt > 15).map(p => p.id))]
    const names = new Map<string, string>()
    for (const p of [...home.players, ...away.players]) names.set(p.id, p.name)
    out.push({ label: `real ${seed} (${home.name} v ${away.name})`, seed, res: simSkeleton({ seed, world }), xv, bench, names, teams: [home.name, away.name] })
  }
  return out
}

/** `dump <seed> [from] [to] [real]`: the plays of one match, one a line, to read round a failure */
async function dump(argv: string[]) {
  const seed = Number(argv[0] ?? 1), from = Number(argv[1] ?? 0), to = Number(argv[2] ?? 9999)
  const m = argv.includes('real') ? (await realMatches([seed]))[0] : skeletonMatches([seed])[0]
  const nm = (id?: string) => (id ? m.names?.get(id) ?? id : '')
  for (const p of m.res.plays.slice(from, to + 1)) {
    console.log(`#${p.n} t${p.t} ${p.kind}/${p.result} side ${p.side} ball ${p.ball} x ${p.x} y ${p.y}` +
      `${p.gain != null ? ` gain ${p.gain.toFixed(1)}` : ''}${p.kick ? ` kick ${p.kick}` : ''}${p.good != null ? ` good ${p.good}` : ''} live ${p.live} dead ${p.dead} score ${p.score.join('-')}` +
      `${p.who ? ` who ${nm(p.who)}` : ''}${p.vs?.length ? ` vs ${p.vs.map(nm).join(',')}` : ''}${p.with?.length ? ` with ${p.with.map(nm).join(',')}` : ''}`)
  }
  try {
    const C = await import('../src/game/sim/commentary') as unknown as { commentate: (r: SimResult, n: unknown) => LineLike[]; render: (l: LineLike) => string }
    const ls = C.commentate(m.res, { teams: m.teams ?? ['Home', 'Away'], player: (id: string) => m.names?.get(id) ?? '' })
    for (const l of ls) if (l.n >= from && l.n <= to) console.log(`  LINE #${l.n} ${l.key} side ${l.side}: ${C.render(l)}`)
    for (const f of checkLines(m, ls, C.render)) if (f.n >= from && f.n <= to) console.log(`FAIL ${f.rule} #${f.n}: ${f.msg}`)
  } catch (e) { console.log(`(no commentary: ${(e as Error).message.split('\n')[0]})`) }
  const fs = checkRecord(m).filter(f => f.n >= from && f.n <= to)
  for (const f of fs) console.log(`FAIL ${f.rule} #${f.n}: ${f.msg}`)
}

async function main() {
  if (process.argv.includes('dump')) return dump(process.argv.slice(process.argv.indexOf('dump') + 1))
  const args = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number)
  const N = args[0] ?? 300, R = args[1] ?? 20
  const t0 = Date.now()
  const seeds = Array.from({ length: N }, (_, i) => 1 + i)
  const matches: Match[] = []
  const crashed: { seed: number; msg: string }[] = []
  for (const seed of seeds) {
    try { matches.push({ label: `seed ${seed}`, seed, res: simSkeleton({ seed }) }) } catch (e) { crashed.push({ seed, msg: (e as Error).message }) }
  }
  let reals: Match[] = []
  try { reals = await realMatches(Array.from({ length: R }, (_, i) => 1 + i)) } catch (e) { crashed.push({ seed: -1, msg: `real fixtures: ${(e as Error).message}` }) }
  const all = [...matches, ...reals]

  // per-rule tallies
  type Tally = { failing: number; first?: { label: string; seed: number; n: number; msg: string }; count: number; ran: boolean }
  const T = new Map<string, Tally>(RULES.map(r => [r.id, { failing: 0, count: 0, ran: false }]))
  /** with --why: each rule's failures grouped by their message with the numbers taken out */
  const why = new Map<string, Map<string, { c: number; ex: string }>>()
  const add = (m: Match, fs: Fail[], ids: string[]) => {
    for (const id of ids) T.get(id)!.ran = true
    for (const f of fs) {
      const key = f.msg.replace(/"[^"]*"/g, '"..."').replace(/-?\d+(\.\d+)?/g, '#')
      if (!why.has(f.rule)) why.set(f.rule, new Map())
      const g = why.get(f.rule)!, e = g.get(key)
      if (e) e.c++; else g.set(key, { c: 1, ex: `${m.label} #${f.n}: ${f.msg}` })
    }
    const by = new Map<string, Fail[]>()
    for (const f of fs) { if (!by.has(f.rule)) by.set(f.rule, []); by.get(f.rule)!.push(f) }
    for (const [rule, list] of by) {
      const t = T.get(rule)!
      t.failing++; t.count += list.length
      t.first ??= { label: m.label, seed: m.seed, n: list[0].n, msg: list[0].msg }
    }
  }
  const matchRuleIds = RULES.filter(r => r.kind === 'match' && r.id.startsWith('R')).map(r => r.id)
  for (const m of all) add(m, checkRecord(m), matchRuleIds)

  for (const row of checkRates(all)) { const t = T.get(row.id)!; t.ran = true; t.failing = row.ok ? 0 : Math.max(1, row.failing); t.first = { label: 'all matches', seed: row.first?.seed ?? -1, n: row.first?.n ?? -1, msg: row.msg } }
  const dec = checkDecision(Array.from({ length: Math.min(100, N) }, (_, i) => 1 + i))
  { const t = T.get('R35-decision')!; t.ran = true; t.failing = dec.ok ? 0 : Math.max(1, dec.failing); t.first = { label: dec.first ? `seed ${dec.first.seed}` : '100 seeds', seed: dec.first?.seed ?? -1, n: dec.first?.n ?? -1, msg: dec.msg } }

  // commentary
  const notes: string[] = []
  try {
    const C = await import('../src/game/sim/commentary') as unknown as { commentate?: (r: SimResult, names: { teams: [string, string]; player(id: string): string }) => LineLike[]; render?: (l: LineLike) => string }
    if (typeof C.commentate !== 'function') throw new Error('commentary.ts has no commentate()')
    const SUM = (C as unknown as { SUMMARY?: Set<string> }).SUMMARY
    if (SUM) for (const b of SUM) SUMMARY_BASES.add(b)
    const render = typeof C.render === 'function' ? C.render : (l: LineLike) => l.key
    const ids = RULES.filter(r => r.owner === 'COMMENTARY').map(r => r.id)
    let lines = 0
    for (const m of all) {
      let ls: LineLike[]
      const names = { teams: m.teams ?? ['Home', 'Away'] as [string, string], player: (id: string) => m.names?.get(id) ?? '' }
      try { ls = C.commentate(m.res, names) } catch (e) { add(m, [{ rule: 'C01-line-play', n: -1, msg: `commentate threw: ${(e as Error).message}` }], ids); continue }
      lines += ls.length
      add(m, checkLines(m, ls, render), ids)
    }
    notes.push(`commentary: ${lines} lines over ${all.length} matches (${(lines / Math.max(1, all.length)).toFixed(0)} a match)`)
  } catch (e) { notes.push(`commentary: not checked (${(e as Error).message.split('\n')[0]})`) }

  // animation
  try {
    const A = await import('../src/ui/livepitch/fromRecord') as unknown as { schedule?: (plays: Play[]) => unknown }
    if (typeof A.schedule !== 'function') throw new Error('fromRecord.ts has no schedule()')
    const ids = ['A01-schedule-cover', 'A02-schedule-time', 'A03-fades']
    const totals: number[] = []
    let how = ''
    for (const m of all) {
      try {
        const r = checkSchedule(m, A.schedule(m.res.plays))
        how = r.how
        if (r.total != null) totals.push(r.total)
        add(m, r.fails, ids)
      } catch (e) { add(m, [{ rule: 'A01-schedule-cover', n: -1, msg: `schedule threw: ${(e as Error).message}` }], ids) }
    }
    if (totals.length) {
      const mean = totals.reduce((a, b) => a + b, 0) / totals.length
      // a match is thousands of seconds of clock: a total over 2,000 is taken as milliseconds
      const sec = mean > 2000 ? mean / 1000 : mean
      const t = T.get('A04-length')!; t.ran = true
      const ok = sec >= 210 && sec <= 270
      t.failing = ok ? 0 : 1
      t.first = { label: 'all matches', seed: -1, n: -1, msg: `mean ${(sec / 60).toFixed(2)} min to watch (read as ${mean > 2000 ? 'ms' : 's'})` }
    }
    notes.push(`animation: schedule read (${how})`)
  } catch (e) { notes.push(`animation: not checked (${(e as Error).message.split('\n')[0]})`) }

  // the table
  const pad = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '~' : s.padEnd(w))
  console.log(`harmonycheck: ${matches.length} skeleton seeds + ${reals.length} real fixtures, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  if (crashed.length) for (const c of crashed.slice(0, 5)) console.log(`CRASHED seed ${c.seed}: ${c.msg}`)
  console.log(pad('rule', 22) + pad('owner', 11) + pad('failing', 9) + pad('first (match, play)', 36) + 'reason')
  let failed = crashed.length > 0, passing = 0, failing = 0, notRun = 0
  for (const r of RULES) {
    const t = T.get(r.id)!
    const st = !t.ran ? 'not run' : t.failing ? String(t.failing) : '0'
    if (!t.ran) notRun++; else if (t.failing) { failing++; failed = true } else passing++
    const first = t.first ? `${t.first.label}${t.first.n >= 0 ? ` #${t.first.n}` : ''}` : ''
    const why = t.first ? t.first.msg : !t.ran ? '' : r.title
    console.log(pad(r.id, 22) + pad(r.owner, 11) + pad(st, 9) + pad(first, 36) + why)
  }
  for (const n of notes) console.log(n)
  if (process.argv.includes('--why')) for (const [rule, g] of why) {
    console.log(`\n${rule}`)
    for (const [, e] of [...g.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 6)) console.log(`  ${String(e.c).padStart(5)}  ${e.ex}`)
  }
  console.log(`rules: ${passing} passing, ${failing} failing, ${notRun} not run`)
  console.log(failed ? 'HARMONY FAILED' : 'HARMONY PASSED')
  if (process.argv.includes('--json')) console.log(JSON.stringify([...T.entries()]))
}

// run as a script, not when the test imports the checks (vite-node does not pass the script path in argv)
if (!process.env.VITEST) void main()
