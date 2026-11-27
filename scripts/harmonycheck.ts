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
  { id: 'R36-substitution', title: 'a substitution only with the ball dead; the man off was on, the man on was on the bench; the man off is never named again', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'R37-dec-sub', title: 'a substitution at minute 50 (real sheets): nothing before it changes, it is made at a dead ball, the man on plays, the man off is never seen again', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R38-dec-call', title: 'the manager\'s penalty call is obeyed: posts a kick at goal, corner a kick to touch, tap a tap, scrum a scrum', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R39-dec-tactics', title: 'a tactics change at minute 50 leaves every play before it the same, and changes the match after it', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'R40-dec-talk', title: 'a half-time team talk leaves the first half the same, and changes the second', owner: 'GAMEPLAY', kind: 'rate' },
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
  { id: 'P01-length', title: 'match length is reported (owner, 25 Nov: "Leave it"); a warning only above 12 minutes', owner: 'ANIMATION', kind: 'rate' },
  { id: 'P02-every-play', title: 'every play is shown: none condensed, every play with ball in play has time on screen', owner: 'ANIMATION', kind: 'match' },
  { id: 'P03-key-1x', title: 'every key moment at the highlight clips\' pace (every frame within 15% of it); of the line breaks only the big ones, bigBreak() (owner, 25 Nov)', owner: 'ANIMATION', kind: 'match' },
  { id: 'P04-buildup-1x', title: 'the whole possession that ends in each try, from its first play: no play of it faster than 2.5x (clip pace, a ruck pause wound on at most 2.5x)', owner: 'ANIMATION', kind: 'match' },
  { id: 'P05-ff', title: 'fast forward elsewhere: 80% of the other frames at 1.5x or more', owner: 'ANIMATION', kind: 'match' },
  { id: 'P06-close', title: 'margin 7 or fewer at 75:00: the rest at no more than 2.2x; margin 15 or more: not slowed (median over 2.2x)', owner: 'ANIMATION', kind: 'match' },
  { id: 'P07-ease', title: 'no step in speed: never more than 10% faster or slower from one screen frame to the next', owner: 'ANIMATION', kind: 'match' },
  { id: 'S01-steps', title: 'smooth on screen (60 fps, 3.3 px a metre): men 99th percentile step 5 px or less in fast forward, change in step 99th percentile 1 px or less; ball 99th percentile 14 px or less', owner: 'ANIMATION', kind: 'match' },
  { id: 'S02-jitter', title: 'no shaking: a man\'s step reverses between two screen frames (both 0.3 px+) for under 0.5 men on average, and 3 or more at once in under 1% of frames', owner: 'ANIMATION', kind: 'match' },
  { id: 'S03-positions', title: 'positions (scripts/tmp/oddruns.ts): odd runs 196 or fewer a match, no side sliding 5 m or more, wings in lane 90%, flat line at 80% of rucks', owner: 'ANIMATION', kind: 'match' },
  // (W01, one line every 1.4 s and 7 in 10 s, retired 24 Nov by the owner's "a lot faster paced, a bit like the old Football Manager": T01 to T05 replace it)
  // (W02, 15 s of silence, replaced 24 Nov by T02's 1.2 s while the ball is in play)
  { id: 'W03-key-words', title: 'every key moment has a line on screen while it happens', owner: 'COMMENTARY', kind: 'match' },
  { id: 'W04-repeat', title: 'not repetitive in a match: no more than 15% of lines word for word an earlier line, and no wording three times running', owner: 'COMMENTARY', kind: 'match' },
  { id: 'W05-sameness', title: 'not repetitive across matches: sameness score 60 or less over 20 pairings, 70 or less over 20 matches of one pairing', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'B01-record-bounds', title: 'the record puts the ball where it went: a kick that ran dead lands beyond the try line, a kick to touch on a touchline, a try on the line', owner: 'GAMEPLAY', kind: 'match' },
  { id: 'B02-picture-bounds', title: 'on screen the ball crosses the line the record says and stops beyond it: dead-ball line, touchline; tries over the try line; kicks at goal between the posts and over the bar only when good', owner: 'ANIMATION', kind: 'match' },
  { id: 'T01-build-said', title: 'ticker: every play of a try build-up has its own line', owner: 'COMMENTARY', kind: 'match' },
  { id: 'T02-tick', title: 'ticker: no dead air while the ball is in play: never over 1.2 s with nothing on screen (a held line counts), and at clip pace no line up over 2.5 s', owner: 'COMMENTARY', kind: 'match' },
  { id: 'T03-flash', title: 'ticker: every try, goal and card line is there and stays up 2 s before the next line', owner: 'COMMENTARY', kind: 'match' },
  { id: 'T04-in-step', title: 'ticker: the line on screen is never about a play still to come, and is more than one play behind for under 2% of the time the ball is in play', owner: 'COMMENTARY', kind: 'match' },
  { id: 'T05-short', title: 'ticker: ticker lines 70 characters or fewer, fuller lines 90, flash lines 48', owner: 'COMMENTARY', kind: 'match' },
  { id: 'W01-stored', title: 'wiring: the result the game stores is the match that was watched (score, scorers and minutes, cards, substitutions, injuries, season tries), 20 managed matches with scripted decisions', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'W02-session-decisions', title: 'wiring: through the session, a call at 50:00 leaves everything before it the same and changes the match after it', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'W03-rest-untouched', title: 'wiring: with the new engine playing the managed match, every other fixture of that week is the same result as on the old engine', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'W04-fingerprint', title: 'wiring: scripts/fingerprint.ts still prints FINGERPRINT PASSED', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'W05-season', title: 'wiring: a season with every home match watched on the new engine stays within 10% of the old engine on table, cards, injuries, condition, morale, money and player stats; a save read back plays on (`season 3`)', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'W07-screen-session', title: 'wiring: the match screen (Sim2Live.tsx, stream.ts) gets plays and results only through the store\'s session, never by simulating on its own (import, source and run-time proof)', owner: 'ANIMATION', kind: 'rate' },
  { id: 'W06-ratings', title: 'wiring: match ratings from the adapter on the old engine\'s scale and spread by position, means within 10% and spreads within 25% (`season 3`)', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'F01-realism', title: 'fundamentals: every sourced real-rugby figure (docs/match-sim-sources.md) within the sources\' range widened by 20%', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'M01-levers', title: 'every manager lever leaves every play before the call the same and changes the match after it (which way and how much: `levers 80`, paired t)', owner: 'GAMEPLAY', kind: 'rate' },
  { id: 'M02-card-cost', title: 'a yellow card costs the carded side: worse points margin a minute in the bin than out of it', owner: 'GAMEPLAY', kind: 'rate' },
  // (A04, about 4 minutes, retired 22 Nov by the owner's "8 mins is fine": P01 replaces it)
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
  /** the occasion from the game (context.ts contextFromGame), when the match was built from one */
  ctx?: ClaimCtx
  /** the two clubs' names (real fixtures), for the commentary */
  teams?: [string, string]
  /** each side's players with the shirt they started in, as the pitch wants them */
  sides?: [{ players: { id: string; shirt: number }[] }, { players: { id: string; shirt: number }[] }]
}

const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
const toLine = (s: 0 | 1, x: number) => (s === 0 ? 100 - x : x)
const adv = (s: 0 | 1, from: number, m: number) => (s === 0 ? from + m : from - m)
const near = (a: number, b: number, tol = 0.25) => Math.abs(a - b) <= tol
/** plays that sit between two others without being part of the flow (prevReal / nextReal step over them) */
const CARD = new Set(['yellowCard', 'redCard', 'substitution'])
const CARDS_ONLY = new Set(['yellowCard', 'redCard'])
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
/** the record's own return time when it gives one (Play.until, since 21 Nov), else ten minutes on */
export const backAt = (c: Play) => c.until ?? c.t - c.dead + 600

/** the offences the record may give for a penalty, by where it happened (record.ts Play.cause) */
export const PEN_CAUSES: Record<'ruck' | 'scrum' | 'lineout' | 'maul' | 'kick', string[]> = {
  ruck: ['handsInRuck', 'offside', 'notRollingAway', 'highTackle', 'holdingOn', 'sealingOff', 'obstruction', 'notReleasing'],
  scrum: ['collapsing', 'standingUp', 'notBinding', 'earlyEngagement'],
  lineout: ['obstruction', 'offsideAtLineout', 'closingTheGap'],
  maul: ['collapsingMaul', 'obstruction'],
  kick: ['offsideAtKick', 'obstruction', 'highTackle', 'notReleasing'],
}

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
  /** who is on the field, through the substitutions (real fixtures) */
  const onField: [Set<string>, Set<string>] = [new Set(m.xv?.[0] ?? []), new Set(m.xv?.[1] ?? [])]
  const usedBench = new Set<string>(), subbedOff = new Set<string>()

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
        (p.kind === 'carry' && p.result === 'intercepted') ||
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
      // the halfway line is in a side's own half and the 22 line is in the 22 (the record is to 0.1 m)
      const out = p.land ? p.land[0] : p.x
      // a kick from exactly on halfway (x 50.0) is left alone either way: the law says "inside its own half"
      // and the record does not say which side of the line the boot was (listed for the owner in the checklist)
      // the same for a kick that comes down exactly on the 22 line
      const onHalfway = Math.abs(toLine(p.side, start) - 50) < 0.05 || Math.abs(toLine(p.side, p.land ? p.land[0] : p.x) - 22) < 0.05
      const fromOwnHalf = toLine(p.side, start) >= 50
      const intoTheir22 = toLine(p.side, out) <= 22
      const openPlay = pr.kind !== 'penalty' && pr.kind !== 'freeKick' && !CARD.has(pr.kind)
      const real5022 = fromOwnHalf && intoTheir22 && openPlay && !onHalfway
      if (p.result === 'fiftyTwentyTwo' && !real5022 && !onHalfway) fail('R13-5022', k, `50:22 called from x ${start} (own half: ${fromOwnHalf}) to x ${p.x} (their 22: ${intoTheir22}), open play: ${openPlay}`)
      // a kick from inside the kicker's own 22 can still be a 50:22 in law; the record cannot tell a bounce, so only non-full kicks to touch count
      if (p.result === 'touch' && real5022) fail('R14-5022-missed', k, `kick from own half (x ${start}) bounced into touch in their 22 (x ${p.x}) but was not called a 50:22: the throw is given to the wrong side`)
    }

    // R15 penalty cause: the record names the offence (Play.cause), it fits the play before, and the offender is on the other side
    if ((p.kind === 'penalty' || p.kind === 'freeKick') && pr) {
      const fam = pr.kind === 'ruck' && /penalty/.test(pr.result) ? 'ruck' : pr.kind === 'scrum' && /penalty|freeKick/.test(pr.result) ? 'scrum'
        : pr.kind === 'lineout' && pr.result === 'penalty' ? 'lineout' : pr.kind === 'maul' && pr.result === 'pulledDown' ? 'maul'
        : (pr.kind === 'kick' || pr.kind === 'catch') ? 'kick' : null
      if (!fam) fail('R15-penalty-cause', k, `${p.kind} to ${p.side} after ${pr.kind}/${pr.result}: no place for an offence`)
      else if (!p.cause) fail('R15-penalty-cause', k, `${p.kind} to ${p.side} after ${pr.kind}/${pr.result} with no cause`)
      else if (!PEN_CAUSES[fam].includes(p.cause)) fail('R15-penalty-cause', k, `${p.kind} for ${p.cause} after ${pr.kind}/${pr.result}: not an offence of the ${fam}`)
      if (real && p.offender) {
        const os = sideOf(p.offender)
        if (os !== other(p.side)) fail('R15-penalty-cause', k, `${p.kind} to side ${p.side}: offender ${m.names?.get(p.offender) ?? p.offender} is on side ${os}`)
        const o = offUntil.get(p.offender)
        if (o && p.t >= o.from && p.t < o.until) fail('R15-penalty-cause', k, `offender ${m.names?.get(p.offender) ?? p.offender} is off the field`)
        if (!onField[os === -1 ? 0 : os].has(p.offender)) fail('R15-penalty-cause', k, `offender ${m.names?.get(p.offender) ?? p.offender} is not on the field`)
      } else if (real && p.kind === 'penalty') fail('R15-penalty-cause', k, `penalty for ${p.cause} with no offender named`)
    }
    if (p.kind === 'penaltyTry' && pr && pr.kind !== 'penalty') fail('R15-penalty-cause', k, `penalty try after ${pr.kind}`)

    // R16 kick at goal from the mark
    if (p.kind === 'penaltyGoal') {
      const c = P[prevReal(P, k)]
      if (!c || (c.kind !== 'penalty')) fail('R16-goal-spot', k, `kick at goal after ${c?.kind}`)
      else if (!near(p.x, c.x) || !near(p.y, c.y)) fail('R16-goal-spot', k, `kick at goal from ${p.x},${p.y}; penalty given at ${c.x},${c.y}`)
      if (c && c.side !== p.side) fail('R16-goal-spot', k, `penalty to ${c.side} but ${p.side} kick at goal`)
    }

    // R17 turnovers
    if (p.kind === 'ruck' && p.result === 'turnover' && real && !(p.vs && p.vs[0])) fail('R17-turnover', k, 'turnover at the ruck with no man named for the steal')
    if (p.kind === 'carry' && p.result === 'intercepted') {
      if (p.ball !== other(p.side)) fail('R17-turnover', k, `intercepted pass by side ${p.side} but the ball stays with ${p.ball}`)
      if (real && !(p.vs && p.vs[0])) fail('R17-turnover', k, 'interception with nobody named for it')
    }

    // R18 restarts after scores
    if (p.kind === 'conversion' && (!pr || pr.kind !== 'try' || pr.side !== p.side)) fail('R18-restart-score', k, `conversion by ${p.side} after ${pr?.kind} (${pr?.side})`)
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
    // a kick-off short of ten metres or out on the full is fine when the record calls it (restartError next)
    if (p.kind === 'kickoff') {
      const short = toLine(p.side, p.x) > 40, outFull = p.y <= 0 || p.y >= 70
      const called = nx?.kind === 'restartError' ? nx.result : null
      if (short && called !== 'notTen') fail('R23-restart-cause', k, `kick-off lands at x ${p.x}, short of the 10 m line, and is played on (next ${nx?.kind}/${nx?.result})`)
      if (outFull && !short && called !== 'outOnFull') fail('R23-restart-cause', k, `kick-off lands on the touchline (y ${p.y}) and is played on`)
      if (called === 'notTen' && !short) fail('R23-restart-cause', k, `called not ten metres but the kick-off went to x ${p.x}`)
      if (called === 'outOnFull' && !outFull) fail('R23-restart-cause', k, `called out on the full but the kick-off landed at y ${p.y}`)
    }
    if (p.kind === 'dropout22' || p.kind === 'goalLineDropout') {
      if (!pr || !(pr.kind === 'deadBall' || pr.kind === 'heldUp' || ((pr.kind === 'penaltyGoal' || pr.kind === 'dropGoal') && !pr.good))) fail('R23-restart-cause', k, `${p.kind} after ${pr?.kind}/${pr?.result}`)
      if (p.kind === 'dropout22' && toLine(p.side, p.x) > 78) fail('R23-restart-cause', k, `22 drop-out lands at x ${p.x}: it has not crossed the 22`)
    }

    // R24 cards
    if (CARDS_ONLY.has(p.kind)) {
      const c = P[k - 1]
      if (!c || c.kind !== 'penalty') fail('R24-cards', k, `${p.kind} after ${c?.kind}`)
      else if (c.side !== other(p.side)) fail('R24-cards', k, `penalty to ${c.side}, card to ${p.side}`)
      if (real) {
        if (!p.who) fail('R24-cards', k, `${p.kind} with nobody named`)
        else if (sideOf(p.who) !== p.side) fail('R24-cards', k, `${p.kind} to side ${p.side} names ${p.who} of side ${sideOf(p.who)}`)
      }
      if (p.who) offUntil.set(p.who, { from: offAt(p), until: p.kind === 'redCard' ? Infinity : backAt(p), side: p.side })
    }
    // R36 substitutions: only with the ball dead, the man off was on, the man on is from that side's bench
    if (p.kind === 'substitution' && p.result === 'made') {
      const off = p.who ?? '', on = p.with?.[0] ?? ''
      const before = pr, after = nx
      const DEAD_AFTER = new Set(['kickoff', 'dropout22', 'goalLineDropout', 'scrum', 'lineout', 'penalty', 'freeKick', 'halfTime', 'fullTime', 'substitution'])
      if (after && !DEAD_AFTER.has(after.kind)) fail('R36-substitution', k, `substitution made in open play: next is ${after.kind}/${after.result}`)
      if (before && ['carry', 'ruck', 'catch', 'tap', 'lineBreak'].includes(before.kind) && !(before.kind === 'carry' && before.result === 'intoTouch')) fail('R36-substitution', k, `substitution straight after ${before.kind}/${before.result}: the ball is live`)
      if (real) {
        if (!onField[p.side].has(off)) fail('R36-substitution', k, `${m.names?.get(off) ?? off} taken off but he is not on the field`)
        if (!m.bench?.[p.side].has(on) || usedBench.has(on)) fail('R36-substitution', k, `${m.names?.get(on) ?? on} brought on but he is not on this side's bench (or already used)`)
        onField[p.side].delete(off); onField[p.side].add(on); usedBench.add(on); subbedOff.add(off)
      }
    }
    // R25 / R26 names on the field and on the right side
    if (real && !CARD.has(p.kind) && p.kind !== 'substitution') {
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
        else if (subbedOff.has(id)) fail('R26-names', k, `${m.names?.get(id) ?? id} named (${role}) in ${p.kind} after he was substituted`)
        else if (!onField[s].has(id)) fail('R26-names', k, `${m.names?.get(id) ?? id} is on the bench and was never brought on`)
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

// ------------------------------------------------------------ the manager's hand, on real team sheets

interface RealFixture { seed: number; build: () => { world: World; home: { teamId: string; name: string; players: { id: string; name: string; shirt: number }[] }; away: { teamId: string; name: string; players: { id: string; name: string; shirt: number }[] } }; userSide: 0 | 1; match: Match }

/**
 * R37 to R40: each of the manager's calls, made at its moment on a real
 * fixture, against the same fixture with nothing done. Every play written
 * before the call must be the same; after it the match must be legal, and
 * (for tactics and talks) must change in at least some matches.
 */
export async function checkDecisionsReal(fixtures: RealFixture[]): Promise<RateRow[]> {
  const { MatchSim } = await import('../src/game/sim/skeleton')
  const same = (a: Play[], b: Play[], upto: number) => JSON.stringify(a.slice(0, upto)) === JSON.stringify(b.slice(0, upto))
  const rows: RateRow[] = []
  const recFails = (f: RealFixture, res: SimResult) => checkRecord({ ...f.match, res }).filter(x => ['R26-names', 'R36-substitution', 'R25-binned', 'R01-laws'].includes(x.rule))

  // R37 substitution: the No. 8 off, the shirt 20 on, at the first dead ball after 50:00
  { let bad = 0, made = 0; let first: RateRow['first']; let why = ''
    for (const f of fixtures) {
      const base = new MatchSim({ seed: f.seed, world: f.build().world }).runUntil().result()
      const b = f.build(), sheet = (f.userSide === 0 ? b.home : b.away).players
      const off = sheet.find(p => p.shirt === 8)?.id, on = sheet.find(p => p.shirt === 20)?.id
      if (!off || !on) continue
      const m = new MatchSim({ seed: f.seed, world: b.world }).runUntil({ clock: 3000, dead: true })
      const at = m.plays.length
      m.apply({ kind: 'substitution', side: f.userSide, off, on })
      const r = m.runUntil().result()
      // (the record now has the game's own substitutions too: the manager's is the one taking his man off)
      // (and from the call on: the man may have gone off hurt before it, which is the game's own substitution)
      const k = r.plays.findIndex(p => p.n >= at && p.kind === 'substitution' && p.who === off)
      const sub = r.plays[k]
      const problems: string[] = []
      if (!same(r.plays, base.plays, at)) problems.push('plays before the substitution changed')
      if (!sub) problems.push('no substitution play')
      // refused because the man is in the bin is the law (a binned man cannot be replaced): not a fault
      else if (sub.result !== 'made') {
        // refused rightly: the man is in the bin, or the game's own substitution has already brought the No. 20 on
        const usedAlready = r.plays.some(q => q.n < k && q.kind === 'substitution' && q.result === 'made' && q.with?.[0] === on)
        // or he has already gone off (hurt, replaced by the game before the call)
        const goneAlready = r.plays.some(q => q.n < at && q.kind === 'substitution' && q.result === 'made' && q.who === off)
        if (!/bin|sent off/.test(sub.cause ?? '') && !usedAlready && !(goneAlready && /not on the field/.test(sub.cause ?? ''))) problems.push(`substitution ${sub.result} (${sub.cause})`)
      }
      else {
        made++
        if (!r.plays.slice(k + 1).some(p => p.who === on || p.vs?.includes(on) || p.with?.includes(on))) problems.push('the man on is never named')
        if (r.plays.slice(k + 1).some(p => p.who === off || p.vs?.includes(off) || p.with?.includes(off) || p.offender === off)) problems.push('the man off is named again')
      }
      const rf = recFails(f, r)
      if (rf.length) problems.push(`${rf[0].rule} #${rf[0].n}: ${rf[0].msg}`)
      if (problems.length) { bad++; if (!first) { first = { seed: f.seed, n: k }; why = problems.join('; ') } }
    }
    rows.push({ id: 'R37-dec-sub', ok: bad === 0 && made > 0, failing: bad, first, msg: bad ? why : `${made} of ${fixtures.length} made at a dead ball, before unchanged, man on plays, man off gone` })
  }

  // R38 penalty calls: the manager asked at every penalty to his side, the calls taken in turn
  { let asked = 0, wrong = 0; let first: RateRow['first']; let why = ''
    const want: Record<string, (p: Play) => boolean> = {
      posts: p => p.kind === 'penaltyGoal', corner: p => p.kind === 'kick' && p.result === 'penaltyToTouch',
      tap: p => p.kind === 'tap', scrum: p => p.kind === 'scrum',
    }
    for (const f of fixtures) {
      const m = new MatchSim({ seed: f.seed, world: f.build().world })
      m.apply({ kind: 'penaltyCall', side: f.userSide, call: 'ask' })
      for (let g = 0; g < 200 && !m.done; g++) {
        m.runUntil()
        const pend = m.pending
        if (!pend) break
        const call = pend.options[asked % pend.options.length]
        asked++
        const at = m.plays.length
        m.answer(call)
        for (let i = 0; i < 3 && m.plays.length === at; i++) m.step()
        const next = m.plays.slice(at).find(p => !CARD.has(p.kind))
        if (!next || !want[call](next)) { wrong++; if (!first) { first = { seed: f.seed, n: at }; why = `called ${call}, next play ${next?.kind}/${next?.result}` } }
      }
    }
    rows.push({ id: 'R38-dec-call', ok: wrong === 0 && asked > 0, failing: wrong, first, msg: wrong ? `${wrong} of ${asked} calls not obeyed; first: ${why}` : `${asked} calls asked over ${fixtures.length} matches, all obeyed` })
  }

  // R39 tactics and R40 talk: before the same, after changed
  const before = async (id: string, stop: { clock: number; dead?: boolean }, d: (f: RealFixture) => Parameters<InstanceType<typeof MatchSim>['apply']>[0]) => {
    let broke = 0, changed = 0; const refused = 0; let first: RateRow['first']
    for (const f of fixtures) {
      const base = new MatchSim({ seed: f.seed, world: f.build().world }).runUntil().result()
      const m = new MatchSim({ seed: f.seed, world: f.build().world }).runUntil(stop)
      const at = m.plays.length
      m.apply(d(f))
      const r = m.runUntil().result()
      if (!same(r.plays, base.plays, at)) { broke++; first ??= { seed: f.seed, n: at } }
      if (JSON.stringify(r.plays.slice(at)) !== JSON.stringify(base.plays.slice(at))) changed++
    }
    const ok = broke === 0 && changed > 0
    rows.push({ id, ok, failing: broke + (changed ? 0 : fixtures.length), first,
      msg: `${broke} of ${fixtures.length} changed before the call; ${changed} changed after it${refused ? `; refused in ${refused}` : ''}` })
  }
  await before('R39-dec-tactics', { clock: 3000 }, f => ({ kind: 'tactics', side: f.userSide, set: { tempo: 85, kicking: 20, aggression: 80 } }))
  await before('R40-dec-talk', { clock: 2400, dead: true }, f => ({ kind: 'talk', side: f.userSide, tone: 'fire' }))
  return rows
}

// ------------------------------------------------------------ commentary

/** the commentary's summary lines (about the match so far, not one play); copied from commentary.ts SUMMARY and refreshed from it when it loads */
/** the commentary module: HARMONY_COMM (an absolute path) points at another copy (a trial with switches turned on) */
const loadComm = (): Promise<unknown> => { const at = typeof process !== 'undefined' ? process.env.HARMONY_COMM : undefined; return at ? import(/* @vite-ignore */ at) : import('../src/game/sim/commentary') }

/** summary lines at the whistle that may name a man from earlier in the match (C05 (a), round 9) */
export const NAMED_SUMMARY_BASES = new Set(['decidedTry', 'decidedKick', 'motm', 'standTries', 'standSteals', 'standTackles', 'standCarries',
  // COMMENTARY's held-back whistle lines (NAMED_WHISTLE_MORE, overnight 27 Nov), each with its claim checked below
  'duelHalf', 'duelFull', 'motmNums', 'postTackler', 'postJackal', 'postCulprit', 'debutHalf'])

/** is a whistle summary's claim about a man true of the record up to play n? Returns why not, or '' when true.
 *  Counted from the record here, not from commentary.ts: tries scored, turnovers won (a ruck turnover or an
 *  interception), tackles (a carry he is in `vs` of), carries (carries and line breaks, not intercepted) and their metres */
/** what a man did up to play n, counted off the record */
export function manCounts(P: Play[], n: number, id: string, from = 0) {
  const upTo = P.slice(from, n + 1)
  const carries = upTo.filter(q => (q.kind === 'carry' || q.kind === 'lineBreak') && q.who === id && q.result !== 'intercepted')
  return {
    tries: upTo.filter(q => (q.kind === 'try' || q.kind === 'penaltyTry') && q.who === id).length,
    breaks: upTo.filter(q => q.kind === 'lineBreak' && q.who === id).length,
    turnovers: upTo.filter(q => ((q.kind === 'ruck' && q.result === 'turnover') || (q.kind === 'carry' && q.result === 'intercepted')) && q.vs?.[0] === id).length,
    jackals: upTo.filter(q => q.kind === 'ruck' && q.result === 'turnover' && q.vs?.[0] === id).length,
    carries: carries.length,
    metres: Math.round(carries.reduce((a, q) => a + Math.max(0, q.gain ?? 0), 0)),
    tackles: upTo.filter(q => q.kind === 'carry' && q.vs?.includes(id)).length,
    pens: upTo.filter(q => (q.kind === 'penalty' || q.kind === 'freeKick') && q.offender === id).length,
  }
}
export interface ClaimCtx { men?: Record<string, { side: 0 | 1; shirt: number; careerApps?: number }>; news?: { kind: string; id?: string }[] }
export function summaryClaimWrong(P: Play[], n: number, base: string, params: Record<string, unknown>, ids: Set<string>, byName: Map<string, string>, motm?: string, ctx?: ClaimCtx): string {
  const pn = params.player
  const id = typeof pn === 'string' ? (byName.get(pn) ?? ([...ids][0])) : [...ids][0]
  if (!id) return 'names a man the check cannot find'
  const upTo = P.slice(0, n + 1)
  if (!upTo.some(q => q.who === id || q.vs?.includes(id) || q.with?.includes(id))) return `names ${pn}, who is nowhere in the record so far`
  const num = (k: string) => Number(params[k])
  if (base === 'motm') return motm != null && motm !== id ? `names ${pn}, but the game's player of the match is ${motm}` : ''
  if (base === 'standTries') { const c = upTo.filter(q => (q.kind === 'try' || q.kind === 'penaltyTry') && q.who === id).length; return c === num('count') ? '' : `says ${num('count')} tries; the record has ${c}` }
  if (base === 'standSteals') { const c = upTo.filter(q => ((q.kind === 'ruck' && q.result === 'turnover') || (q.kind === 'carry' && q.result === 'intercepted')) && q.vs?.[0] === id).length; return c === num('count') ? '' : `says ${num('count')} turnovers; the record has ${c}` }
  if (base === 'standTackles') { const c = upTo.filter(q => q.kind === 'carry' && q.vs?.includes(id)).length; return c === num('count') ? '' : `says ${num('count')} tackles; the record has ${c}` }
  if (base === 'standCarries') {
    const cs = upTo.filter(q => (q.kind === 'carry' || q.kind === 'lineBreak') && q.who === id && q.result !== 'intercepted')
    const mt = Math.round(cs.reduce((a, q) => a + Math.max(0, q.gain ?? 0), 0))
    return cs.length === num('count') && Math.abs(mt - num('m')) <= 1 ? '' : `says ${num('count')} carries for ${num('m')} m; the record has ${cs.length} for ${mt} m`
  }
  if (base === 'duelHalf' || base === 'duelFull') {
    const opp = typeof params.oppPlayer === 'string' ? byName.get(params.oppPlayer) : undefined
    if (!opp) return `names ${params.oppPlayer} as the opposite number, who the check cannot find`
    const sh = num('shirt'), mA = ctx?.men?.[id], mB = ctx?.men?.[opp]
    if (!mA || !mB) return 'a duel with no team sheet to check the shirts against'
    if (mA.shirt !== sh || mB.shirt !== sh || mA.side === mB.side) return `calls ${pn} (${mA.side}, ${mA.shirt}) and ${params.oppPlayer} (${mB.side}, ${mB.shirt}) the two No. ${sh}s`
    const W: Record<string, keyof ReturnType<typeof manCounts>> = { 'sim.duelTries1': 'tries', 'sim.duelBreaks1': 'breaks', 'sim.duelTurnovers1': 'turnovers', 'sim.duelCarries1': 'carries', 'sim.duelTackles1': 'tackles' }
    const k = W[String(params.what_k)]
    if (!k) return `an unknown duel measure ${params.what_k}`
    const a = manCounts(P, n, id)[k], b = manCounts(P, n, opp)[k]
    return a === num('a') && b === num('b') ? '' : `says ${num('a')} to ${num('b')} ${k}; the record has ${a} to ${b}`
  }
  if (base === 'motmNums') {
    if (motm != null && motm !== id) return `gives the numbers of ${pn}, who is not the game's player of the match`
    const c = manCounts(P, n, id), wrong: string[] = []
    if (params.car != null && num('car') !== c.carries) wrong.push(`carries ${num('car')} (record ${c.carries})`)
    if (params.tk != null && num('tk') !== c.tackles) wrong.push(`tackles ${num('tk')} (record ${c.tackles})`)
    if (params.tries != null && num('tries') !== c.tries) wrong.push(`tries ${num('tries')} (record ${c.tries})`)
    return wrong.join(', ')
  }
  if (base === 'postTackler' || base === 'postJackal' || base === 'postCulprit') {
    const k = base === 'postTackler' ? 'tackles' : base === 'postJackal' ? 'jackals' : 'pens'
    const mine = manCounts(P, n, id)[k]
    if (mine !== num('n')) return `says ${num('n')} ${k}; the record has ${mine}`
    // the most of anyone in the match
    const men = new Set<string>(); for (const q of P.slice(0, n + 1)) for (const x of [q.who, q.offender, ...(q.vs ?? []), ...(q.with ?? [])]) if (x) men.add(x)
    const best = [...men].filter(x => x !== id).map(x => [x, manCounts(P, n, x)[k]] as const).sort((a, b) => b[1] - a[1])[0]
    return best && best[1] > mine ? `calls ${pn} the most (${mine} ${k}); ${best[0]} has ${best[1]}` : ''
  }
  if (base === 'debutHalf') {
    const isDebut = ctx?.news?.some(x => x.kind === 'debut' && x.id === id) || ctx?.men?.[id]?.careerApps === 0
    if (!isDebut) return `calls ${pn} a debutant; the team sheet has him with appearances before`
    const c = manCounts(P, n, id), wrong: string[] = []
    if (params.car != null && num('car') !== c.carries) wrong.push(`carries ${num('car')} (record ${c.carries})`)
    if (params.tk != null && num('tk') !== c.tackles) wrong.push(`tackles ${num('tk')} (record ${c.tackles})`)
    return wrong.join(', ')
  }
  if (base === 'decidedTry' || base === 'decidedKick') {
    const last = P[n], win: 0 | 1 = last.score[0] > last.score[1] ? 0 : 1
    if (last.score[0] === last.score[1]) return 'says who decided a drawn match'
    let at = -1, prev = false
    for (const q of upTo) { const a = q.score[win] > q.score[1 - win]; if (a && !prev) at = q.n; prev = a }
    const q = P[at]
    if (!q) return 'says who decided it; the winner was never ahead'
    const kick = q.kind === 'penaltyGoal' || q.kind === 'dropGoal' || q.kind === 'conversion'
    if (q.who !== id) return `credits ${pn}; the score that put the winner ahead for good was ${q.kind} by ${q.who}`
    if ((base === 'decidedKick') !== kick) return `calls it a ${base === 'decidedKick' ? 'kick' : 'try'}; it was ${q.kind}`
    const min = Math.floor((q.clock ?? q.t) / 60) + 1
    return params.min != null && num('min') !== min ? `says minute ${num('min')}; the record has ${min}` : ''
  }
  return ''
}

export const SUMMARY_BASES = new Set([
  // (overnight: the co-commentator's spell, the duels and the full-time block are about the match so far)
  'anaKicking', 'anaHands', 'anaWide', 'anaMiddle', 'anaCollide', 'anaStopped', 'anaJackal', 'tipBreakdown', 'anaScrumBad', 'tipScrum', 'anaPensRuck', 'tipPens', 'anaPensOffside', 'anaInTheirHalf',
  'duelHalf', 'duelFull', 'postUp', 'postDown', 'postStay', 'postBonusTry', 'postBonusLose', 'postCupWon', 'postCupThrough', 'postStat', 'postMgrGood', 'postMgrBad', 'postMgrMixed', 'postNext', 'motmNums', 'postTackler', 'postJackal', 'postCulprit', 'debutHalf', 'bonusTry',
  'territory', 'possession', 'tries', 'run', 'binBack', 'winBy', 'draw', 'tryAgain'])

export interface LineLike { n: number; key: string; params?: Record<string, unknown>; level?: unknown; side?: 0 | 1 | null; priority?: number }

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
  /** off at play n: carded at an earlier play (a man penalised and then carded is on the field when penalised) */
  const isOff = (id: string, t: number, n: number) => P.some(c => c.n < n && CARDS_ONLY.has(c.kind) && c.who === id && t >= offAt(c) && (c.kind === 'redCard' || t < backAt(c)))

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
    const cands = ['restartError', 'scrum', 'lineout', 'penalty', 'freeKick', 'tap', 'kickoff', 'dropout22', 'goalLineDropout', 'conversion', 'penaltyGoal'].includes(p.kind) ? [p, cause, cause2].filter(Boolean) as Play[] : [p]
    const any = (f: (q: Play) => boolean) => cands.some(f)

    // C02 side (summary lines are about the match so far, not this play)
    // (the other coach's change is about the side the record names on Play.coach; a pre-match line is about the occasion)
    const coachSide = (p as Play & { coach?: { side: 0 | 1 } }).coach?.side
    // (a first touch is about the man: his side, from the team sheet, may be the defence's)
    const manSide = (id: string) => (m.xv?.[0].has(id) || m.bench?.[0].has(id) ? 0 : m.xv?.[1].has(id) || m.bench?.[1].has(id) ? 1 : null)
    const aboutMan = ['debutFirst', 'clubFirst', 'returnFirst', 'backFromBin'].includes(base) && Object.values(l.params ?? {}).some(v => typeof v === 'string' && byName.has(v) && manSide(byName.get(v)!) === l.side)
    if (!summary && !aboutMan && !(l as LineLike & { pre?: boolean }).pre && l.side !== coachSide && l.side != null && l.side !== p.side && l.side !== p.ball && !cands.some(q => q.side === l.side))
      fail('C02-line-side', l.n, `"${s}" is about side ${l.side}; play ${p.kind}/${p.result} is about ${p.side}, ball with ${p.ball}`)

    // C03 the words name what the record has (in this play or, at a set piece, the reason for it)
    const kickTouch = (q: Play) => (q.kind === 'kick' && TOUCH_KICK.has(q.result)) || (q.kind === 'intoTouch' && q.result === 'bounced') || (q.kind === 'restartError' && q.result === 'outOnFull')
    if (/50[:/ -]?22|fifty/.test(low) && !any(q => q.kind === 'kick' && q.result === 'fiftyTwentyTwo')) fail('C03-line-kind', l.n, `"${s}" says 50:22; record has ${p.kind}/${p.result}`)
    if (/(kick|kicks|kicked|finds|find)\b[a-z ]{0,20}\btouch\b(?!ed)(?! down)/.test(low) && !any(kickTouch)) fail('C03-line-kind', l.n, `"${s}" says kick to touch; record has ${cands.map(q => `${q.kind}/${q.result}`).join(' < ')}`)
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
    // (a) a half-time or full-time summary naming a man from earlier in the match: the claim is checked against
    // the record up to the whistle (round 9 ruling), and the man need not be in the whistle's play or on the field
    const wSum = (p.kind === 'halfTime' || p.kind === 'fullTime') && NAMED_SUMMARY_BASES.has(base)
    if (wSum) {
      const why = summaryClaimWrong(P, l.n, base, l.params ?? {}, ids, byName, (m.res as SimResult & { motm?: string }).motm, m.ctx)
      if (why) fail('C05-line-player', l.n, `"${s}" ${why}`)
    }
    // a pre-match line names men from the team sheet (team news, milestones): in the 23, checked for truth by `ctxaudit`
    const preLine = !!(l as LineLike & { pre?: boolean }).pre
    if (preLine && m.xv) for (const id of ids) { if (!m.xv[0].has(id) && !m.xv[1].has(id) && !m.bench?.[0].has(id) && !m.bench?.[1].has(id)) fail('C05-line-player', l.n, `"${s}" (before kick-off) names ${names.get(id)}, who is not in either 23`) }
    if (m.xv && !wSum && !preLine) for (const id of ids) {
      // (b) the defender a line break beat (Play.beat) is in that play
      const inPlay = cands.concat(cause ? [cause] : []).some(q => q.who === id || q.vs?.includes(id) || q.with?.includes(id) || q.offender === id || q.beat?.includes(id))
      if (!inPlay) fail('C05-line-player', l.n, `"${s}" names ${names.get(id)}, who is not in ${cands.map(q => `${q.kind}/${q.result}`).join(' < ')}`)
      // on the field: the starting XV, through the substitutions made up to this play (a substitution line names both men)
      const on = (x: string) => {
        let in_ = m.xv![0].has(x) || m.xv![1].has(x)
        for (const q of P) { if (q.n > l.n) break; if (q.kind !== 'substitution' || q.result !== 'made') continue; if (q.with?.[0] === x) in_ = true; if (q.who === x && q.n < l.n) in_ = false }
        return in_
      }
      if (!on(id)) fail('C05-line-player', l.n, `"${s}" names ${names.get(id)}, who is not on the field at play ${l.n}`)
      if (isOff(id, p.t, l.n) && !CARD.has(p.kind)) fail('C05-line-player', l.n, `"${s}" names ${names.get(id)}, who is off the field`)
    }

    // C06 territory and possession: the number said is the number in the record, and never in the opening minutes
    // ("deep into their territory" says where a kick went, not who has had the territory)
    if (/territor|momentum|on top|all the ball|possession|camped|pinned|dominat/.test(low.replace(/(deep )?into [^.,:]* territory/g, ''))) {
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
        const stillOff = P.filter(q => q.n < l.n && q.side === side && ((q.kind === 'yellowCard' && backAt(q) > p.t) || q.kind === 'redCard')).length
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
  /** the first of the fields that is a number (0 is a number: play 0 and a start at 0 are real) */
  const num = (o: Record<string, unknown>, ...k: string[]) => { for (const x of k) if (typeof o[x] === 'number' && !Number.isNaN(o[x])) return o[x] as number; return NaN }
  const slots: Slot[] = arr.map(it => {
    const o = it as Record<string, unknown>
    const pl = o.play as Record<string, unknown> | undefined
    let n = num(o, 'n', 'index', 'i')
    if (Number.isNaN(n) && pl && typeof pl.n === 'number') n = pl.n
    const at = num(o, 'start', 'at', 't0', 'from', 'begin')
    const end = num(o, 'end', 't1', 'to')
    let dur = num(o, 'dur', 'duration', 'len')
    if (Number.isNaN(dur) && !Number.isNaN(end) && !Number.isNaN(at)) dur = end - at
    const fade = typeof o.fade === 'boolean' ? o.fade : typeof o.fade === 'string' ? o.fade !== 'none' && o.fade !== '' : undefined
    return { n, at, dur, fade }
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

// ------------------------------------------------------------ round 4: pace, smoothness, words, sameness
//
// Owner, 22 Nov 2026 22:13 (scripts/tmp/AGENTS.md): "8 mins is fine." "For build ups to tries and key
// moments the game should be normal speed, then everything else is on fast forward BUT still
// happening, not just being ignored." "If a [close] game the last few mins should be slower." "I
// believe we can get there with smoothness." "We need more commentary notes to keep it engaging and
// clear." "The games shouldn't feel repetitive."

/** the key moments, read from the record alone (spec section 8), so the pitch is not marked against its own list */
export function isKeyPlay(P: Play[], n: number): boolean {
  const p = P[n], nx = P[n + 1]
  if (['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'heldUp', 'lineBreak'].includes(p.kind)) return true
  const in22 = p.x < 22 || p.x > 78
  if (in22 && ((p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'lineout' && p.result === 'stolen') || (p.kind === 'scrum' && p.result === 'againstTheHead'))) return true
  if (p.kind === 'carry' && p.result === 'intercepted') return true
  if (p.kind === 'kick' && p.result === 'chargedDown') return true
  return !!nx && (nx.kind === 'try' || nx.kind === 'heldUp') && (p.kind === 'carry' || p.kind === 'maul' || p.kind === 'lineBreak')
}

/** the first play of the possession that ends at play k (the set piece, turnover, catch or tap it began with) */
export function possessionStart(P: Play[], k: number): number {
  const s = P[k].side
  let j = k
  while (j > 0) {
    const q = P[j - 1]
    if (q.ball !== s || ['conversion', 'penaltyGoal', 'dropGoal', 'halfTime', 'try', 'penaltyTry'].includes(q.kind)) break
    j--
    if (['lineout', 'scrum', 'tap', 'catch'].includes(P[j].kind) || (P[j].kind === 'ruck' && P[j].result === 'turnover') || (P[j].kind === 'carry' && P[j].result === 'intercepted')) break
  }
  return j
}

const pct = (a: number[], q: number) => { if (!a.length) return NaN; const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.floor(q * b.length))] }
const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-')

/** what the pitch module gives us, read loosely so a renamed field fails one rule and not the script */
interface Pitch {
  bakeOf: (plays: Play[], sides?: Match['sides']) => { n: number; pos: Float32Array; ball: Float32Array; seg: Int16Array; flags: Uint8Array; cuts: number[]; segs: { n: number; a0: number; act: number; a1: number; condensed?: boolean }[] }
  timeline: (bk: unknown) => { V: Float64Array; rate: Float32Array; total: number }
  schedule: (plays: Play[], sides?: Match['sides']) => { n: number; start: number; dur: number; speed: number; fade: boolean; condensed?: boolean }[]
  oddRuns?: (bk: unknown, sides?: Match['sides']) => { runs: number; odd: number; slide: number; slideAt: number; wingShare: number; flat: number; spreadMedian: number }
  FPS: number
  BUILD_MAX?: number
  /** the measured pace of the 1.9.16/1.9.17 highlight clips, as a rate against the bake's clock (owner, 24 Nov) */
  CLIP_RATE?: number; CLIP_PACE?: number; HIGHLIGHT_RATE?: number
  /** owner, 25 Nov ("Only big ones"): which line breaks slow to clip pace */
  bigBreak?: (plays: Play[], n: number) => boolean
}
/** "normal speed" is now the highlight clips' pace (owner, 24 Nov), as the pitch publishes it; 1 until it does */
/** the fastest any play of a try's possession may run: a ruck pause wound on (lead's ruling, 24 Nov) */
export const BUILD_MAX_RATE = 2.5
export const clipRate = (A: Pitch) => A.CLIP_RATE ?? A.CLIP_PACE ?? A.HIGHLIGHT_RATE ?? 1
/** a frame at clip pace: within 15% of it */
const atClip = (r: number, c: number) => r <= c * 1.15 && r >= c * 0.85

export interface PitchReport {
  label: string; seed: number
  view: number; plays: number; shown: number; condensed: number
  keyPlays: number; keySlow: number; keyWorst?: { n: number; rate: number }
  tries: number; buildSlow: number; buildWorst?: { n: number; share: number }; longMoves: number
  buildFast: number; buildFastAt?: { n: number; rate: number }; buildPlaysN: number; buildClipShare: number
  ffShare: number; ffMedian: number
  close: 'close' | 'blowout' | 'neither'; margin: number; closeMax: number; closeMedian: number
  rateJump: number; rateJumpAt: number
  // on screen at 60 frames a second
  manStep: { ff: number[]; normal: number[] }; ballStep: { ff: number[]; normal: number[] }
  manJerk: number[]; ballJerk: number[]; worstFrame: { what: string; v: number; px: number }
  jitterMean: number; jitterMax: number; jitterAt: number; jitter3: number
  odd?: { runs: number; odd: number; slide: number; slideAt: number; wingShare: number; flat: number; spreadMedian: number }
}

/** the screen: 330 px for the pitch's 100 m (coordinator's figure; fromRecord.ts uses 2.8 px a metre) */
export const SCREEN_PX_PER_M = 3.3
export const VIEW_FPS = 60

export function checkPitch(A: Pitch, m: Match): PitchReport {
  const P = m.res.plays, FPS = A.FPS
  const bk = A.bakeOf(P, m.sides), tl = A.timeline(bk), sch = A.schedule(P, m.sides)
  const N = bk.n
  const segOf = (n: number) => bk.segs[n]
  const fr = (a: number) => Math.max(0, Math.min(N - 1, Math.round(a * FPS)))
  // the frames that are meant to be at life speed (key moments and try build-ups) and the close finish
  const life = new Uint8Array(N)
  const clip = clipRate(A)
  let keyPlays = 0, keySlow = 0, keyWorst: PitchReport['keyWorst']
  for (let n = 0; n < P.length; n++) {
    if (!isKeyPlay(P, n)) continue
    // (owner, 25 Nov, "Only big ones": a line break is a key moment only when it is a big one, bigBreak() in fromRecord.ts)
    if (P[n].kind === 'lineBreak' && A.bigBreak && !A.bigBreak(P, n)) continue
    const g = segOf(n); if (!g) continue
    keyPlays++
    let worst = 0, off = 0, all = 0
    for (let f = fr(g.a0); f < fr(g.a0 + g.act); f++) { life[f] = 1; all++; if (!atClip(tl.rate[f], clip)) { off++; if (Math.abs(tl.rate[f] - clip) > Math.abs(worst - clip)) worst = tl.rate[f] } }
    if (g.act <= 0 || off === 0) keySlow++
    else if (!keyWorst || Math.abs(worst - clip) > Math.abs(keyWorst.rate - clip)) keyWorst = { n, rate: worst }
    void all
  }
  // (owner, 24 Nov: "no shortening of build-ups": the whole move, however long; longMoves counts those past the pitch's old BUILD_MAX)
  // TRY BUILD-UPS (lead's ruling, 24 Nov 16:35): every play of the possession that ends in a try, from
  // its first play, at clip pace; only a ball lying at a ruck may be wound on, up to 2.5x. A frame of the
  // move faster than BUILD_MAX_RATE fails the play it is in.
  let tries = 0, buildSlow = 0, longMoves = 0, buildWorst: PitchReport['buildWorst']
  const oldCap = A.BUILD_MAX ?? 35
  const tlSlow = (tl as unknown as { slow?: Uint8Array }).slow
  let buildFast = 0, buildFastAt: { n: number; rate: number } | undefined, buildPlaysN = 0, clipFrames = 0, allFrames = 0
  for (let k = 0; k < P.length; k++) {
    if (P[k].kind !== 'try') continue
    tries++
    const j = possessionStart(P, k), end = segOf(k).a0 + segOf(k).act
    if (segOf(j).a0 < end - oldCap) longMoves++
    let fastHere = false
    for (let n = j; n <= k; n++) {
      buildPlaysN++
      // (the play itself, not the dead time after it: a penalty's walk back is not play)
      const g = segOf(n), stop = g.a0 + g.act
      let top = 0
      for (let f = fr(g.a0); f < fr(stop); f++) {
        life[f] = 1; allFrames++
        if (atClip(tl.rate[f], clip) || (tlSlow && tlSlow[f] === 3)) clipFrames++
        top = Math.max(top, tl.rate[f])
      }
      if (top > BUILD_MAX_RATE + 0.05) { buildFast++; fastHere = true; if (!buildFastAt || top > buildFastAt.rate) buildFastAt = { n, rate: top } }
    }
    if (!fastHere) buildSlow++
    else if (!buildWorst) buildWorst = { n: k, share: 0 }
  }
  // the close finish: the margin when the referee's clock reaches 75:00
  const at75 = P.find(q => (q.clock ?? q.t) >= 4500 && P.some(h => h.kind === 'halfTime' && h.n < q.n))
  const margin = at75 ? Math.abs(at75.score[0] - at75.score[1]) : 99
  const close: PitchReport['close'] = margin <= 7 ? 'close' : margin >= 15 ? 'blowout' : 'neither'
  const finRates: number[] = []
  if (at75) for (let f = fr(segOf(at75.n).a0); f < N; f++) if (!life[f]) finRates.push(tl.rate[f])
  // fast forward elsewhere
  const ffRates: number[] = []
  const finFrom = at75 ? fr(segOf(at75.n).a0) : N
  for (let f = 0; f < N; f++) if (!life[f] && (close !== 'close' || f < finFrom)) ffRates.push(tl.rate[f])
  // no step in speed: the change in rate per second on screen
  let rateJump = 0, rateJumpAt = 0
  const cuts = new Set(bk.cuts)
  for (let f = 1; f < N; f++) {
    if (cuts.has(f)) continue
    // relative change of speed per second on screen (10% between two 60 fps frames is ln(1.1) x 60 = 5.7)
    const dv = Math.max(1e-6, tl.V[f + 1] - tl.V[f])
    const j = Math.abs(Math.log(tl.rate[f] / tl.rate[f - 1])) / dv
    if (j > rateJump) { rateJump = j; rateJumpAt = bk.seg[f] }
  }
  // ON SCREEN: sample the screen at 60 a second and follow every man and the ball
  const px = SCREEN_PX_PER_M
  const manStep = { ff: [] as number[], normal: [] as number[] }, ballStep = { ff: [] as number[], normal: [] as number[] }
  const manJerk: number[] = [], ballJerk: number[] = []
  let worstFrame = { what: '', v: 0, px: 0 }
  const total = tl.total, K = Math.floor(total * VIEW_FPS)
  let fi = 0, lastF = 0
  const cutList = [...cuts].sort((a, b) => a - b)
  /** a dissolve anywhere between two screen frames: the step across it is not a step on screen */
  const cutBetween = (a: number, b: number) => cutList.some(c => c > a && c <= b + 1)
  const cutAtView = new Uint8Array(K + 2)
  const prev = new Float64Array(62), prevStep = new Float64Array(31).fill(-1)
  const hist: Float64Array[] = []
  let jitSum = 0, jitN = 0, jitMax = 0, jitAt = -1, jit3 = 0
  const W = 15 // half a second either way
  for (let k = 0; k <= K; k++) {
    const v = k / VIEW_FPS
    while (fi < N - 1 && tl.V[fi + 1] <= v) fi++
    const u = Math.max(0, Math.min(1, (v - tl.V[fi]) / Math.max(1e-9, tl.V[fi + 1] - tl.V[fi])))
    const f0 = fi, f1 = Math.min(N - 1, fi + 1)
    const cur = new Float64Array(62)
    for (let i = 0; i < 30; i++) {
      cur[i * 2] = bk.pos[f0 * 62 + i * 2] + (bk.pos[f1 * 62 + i * 2] - bk.pos[f0 * 62 + i * 2]) * u
      cur[i * 2 + 1] = bk.pos[f0 * 62 + i * 2 + 1] + (bk.pos[f1 * 62 + i * 2 + 1] - bk.pos[f0 * 62 + i * 2 + 1]) * u
    }
    cur[60] = bk.ball[f0 * 3] + (bk.ball[f1 * 3] - bk.ball[f0 * 3]) * u
    cur[61] = bk.ball[f0 * 3 + 1] + (bk.ball[f1 * 3 + 1] - bk.ball[f0 * 3 + 1]) * u
    hist.push(cur)
    const crossed = k > 0 && cutBetween(lastF, f1)
    if (crossed) cutAtView[k] = 1
    lastF = f0
    if (k > 0 && !crossed) {
      const normal = tl.rate[f0] <= 1.15
      for (let i = 0; i < 31; i++) {
        if (i < 30 && (bk.flags[f0 * 30 + i] & 4)) { prevStep[i] = -1; continue }
        const st = Math.hypot(cur[i * 2] - prev[i * 2], cur[i * 2 + 1] - prev[i * 2 + 1]) * px
        if (i < 30) (normal ? manStep.normal : manStep.ff).push(st); else (normal ? ballStep.normal : ballStep.ff).push(st)
        if (prevStep[i] >= 0) { const j = Math.abs(st - prevStep[i]); (i < 30 ? manJerk : ballJerk).push(j) }
        if (st > worstFrame.px && i < 30) worstFrame = { what: `play ${bk.seg[f0]} (${P[bk.seg[f0]].kind}/${P[bk.seg[f0]].result}) ${i < 15 ? 'home' : 'away'} shirt ${(i % 15) + 1}`, v, px: st }
        prevStep[i] = st
      }
    } else prevStep.fill(-1)
    prev.set(cur)
    // jitter: a man shaking on screen, his step reversing direction from one screen frame to the next with
    // both steps visible (0.3 px or more); men bound in a scrum, ruck or maul, off the field or lifted are left out
    if (k >= 2 && !crossed && !cutAtView[k - 1]) {
      const h0 = hist[k - 2], h1 = hist[k - 1], h2 = hist[k]
      let jit = 0
      for (let i = 0; i < 30; i++) {
        if (bk.flags[f0 * 30 + i] & (2 | 4 | 8)) continue
        const ax = (h1[i * 2] - h0[i * 2]) * px, ay = (h1[i * 2 + 1] - h0[i * 2 + 1]) * px
        const bx = (h2[i * 2] - h1[i * 2]) * px, by = (h2[i * 2 + 1] - h1[i * 2 + 1]) * px
        if (ax * bx + ay * by < 0 && Math.hypot(ax, ay) >= 0.3 && Math.hypot(bx, by) >= 0.3) jit++
      }
      jitSum += jit; jitN++
      if (jit >= 3) jit3++
      if (jit > jitMax) { jitMax = jit; jitAt = bk.seg[f0] }
    }
    if (k >= 3) hist[k - 3] = undefined as unknown as Float64Array
  }
  const odd = A.oddRuns ? A.oddRuns(bk, m.sides) : undefined
  return {
    label: m.label, seed: m.seed, view: total, plays: P.length,
    shown: sch.filter(x => x.dur > 0 || P[x.n].live === 0).length, condensed: sch.filter(x => x.condensed).length,
    keyPlays, keySlow, keyWorst, tries, buildSlow, buildWorst, longMoves, buildFast, buildFastAt, buildPlaysN, buildClipShare: allFrames ? clipFrames / allFrames : 1,
    ffShare: ffRates.length ? ffRates.filter(r => r >= 1.5).length / ffRates.length : 0, ffMedian: pct(ffRates, 0.5),
    close, margin, closeMax: finRates.length ? finRates.reduce((a, b) => (b > a ? b : a), 0) : NaN, closeMedian: pct(finRates, 0.5),
    rateJump, rateJumpAt, manStep, ballStep, manJerk, ballJerk, worstFrame,
    jitterMean: jitN ? jitSum / jitN : 0, jitterMax: jitMax, jitterAt: jitAt, jitter3: jitN ? jit3 / jitN : 0, odd,
  }
}

/** a line on screen: the play it is for, and when it appears (the line's own time if the commentary gives one, else its play's start) */
export function lineTimes(lines: LineLike[], sch: { n: number; start: number; dur: number }[]): number[] {
  return lines.map(l => {
    const own = (l as unknown as { at?: number; show?: number }).at ?? (l as unknown as { show?: number }).show
    return typeof own === 'number' ? own : sch[l.n]?.start ?? 0
  })
}

export interface LoadReport { busyAt: number; busyPlay: number; label: string; ffRate: number; normalRate: number; busiest10: number; longestGap: number; gapAt: number; keyCovered: number; keyTotal: number; keyMissed?: number }

/** commentary load on the schedule: lines a second in fast forward and at life speed, the busiest ten seconds, the longest silence, key moments with words */
export function checkLoad(m: Match, lines: LineLike[], sch: { n: number; start: number; dur: number; speed: number }[]): LoadReport {
  const P = m.res.plays
  const ts = lineTimes(lines, sch).slice().sort((a, b) => a - b)
  const total = sch.length ? sch[sch.length - 1].start + sch[sch.length - 1].dur : 0
  let ffT = 0, nT = 0, ffL = 0, nL = 0
  for (const x of sch) { if (x.speed <= 1.15) nT += x.dur; else ffT += x.dur }
  const times = lineTimes(lines, sch)
  lines.forEach((l, i) => { const x = sch[l.n]; if (!x) return; void times[i]; if (x.speed <= 1.15) nL++; else ffL++ })
  let busiest = 0, busyAt = 0
  for (let i = 0, j = 0; i < ts.length; i++) { while (ts[i] - ts[j] > 10) j++; if (i - j + 1 > busiest) { busiest = i - j + 1; busyAt = ts[j] } }
  let gap = ts.length ? ts[0] : total, gapAt = 0
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > gap) { gap = ts[i] - ts[i - 1]; gapAt = ts[i - 1] }
  if (ts.length && total - ts[ts.length - 1] > gap) { gap = total - ts[ts.length - 1]; gapAt = ts[ts.length - 1] }
  let keyTotal = 0, keyCovered = 0, keyMissed: number | undefined
  for (let n = 0; n < P.length; n++) {
    if (!isKeyPlay(P, n) || !sch[n]) continue
    keyTotal++
    const a = sch[n].start - 1.5, b = sch[n].start + sch[n].dur + 1.5
    if (lines.some((l, i) => Math.abs(l.n - n) <= 1 && times[i] >= a && times[i] <= b)) keyCovered++
    else keyMissed ??= n
  }
  // (the gap at the very start is the wait for the kick-off line)
  const gapAtPlay = sch.find(x => x.start >= gapAt)?.n ?? -1
  const busyPlay = sch.find(x => x.start + x.dur >= busyAt)?.n ?? -1
  return { busyAt, busyPlay, label: m.label, ffRate: ffT ? ffL / ffT : 0, normalRate: nT ? nL / nT : 0, busiest10: busiest, longestGap: gap, gapAt: gapAtPlay, keyCovered, keyTotal, keyMissed }
}

// ---- sameness

/** a line with the names, the clubs and the numbers taken out: what a reader recognises as "that line again" */
export function template(text: string, names: Iterable<string>, teams: string[]): string {
  let t = text
  for (const nm of [...names, ...teams].filter(Boolean).sort((a, b) => b.length - a.length)) t = t.split(nm).join('#')
  return t.replace(/\d+/g, '0').trim()
}

export interface MatchShape { tries: Map<string, number>; tri: Map<string, number>; tmpl: Map<string, number>; scoring: string; texts: string[]; keys: string[] }

/** the parts of a match a watcher would notice repeating */
export function shapeOf(m: Match, lines: LineLike[], text: (l: LineLike) => string): MatchShape {
  const P = m.res.plays
  const tries = new Map<string, number>()
  for (const p of P) if (p.kind === 'try' || p.kind === 'penaltyTry') {
    const o = P[possessionStart(P, p.n)]
    const k = `${p.kind === 'penaltyTry' ? 'penaltyTry' : p.result} from ${o.kind === 'ruck' ? 'turnover' : o.kind === 'carry' ? 'interception' : o.kind}`
    tries.set(k, (tries.get(k) ?? 0) + 1)
  }
  const ks = P.map(p => p.kind).filter(k => k !== 'ruck')
  const tri = new Map<string, number>()
  for (let i = 2; i < ks.length; i++) { const k = `${ks[i - 2]}>${ks[i - 1]}>${ks[i]}`; tri.set(k, (tri.get(k) ?? 0) + 1) }
  const nm = m.names ? [...m.names.values()] : []
  const texts = lines.map(text)
  const tmpl = new Map<string, number>()
  for (const t of texts) { const k = template(t, nm, m.teams ?? ['Home', 'Away']); tmpl.set(k, (tmpl.get(k) ?? 0) + 1) }
  // the scoring in order, by who (H home, A away) and what (T try, C conversion, P penalty, D drop goal, 7 penalty try)
  const code: Record<string, string> = { try: 'T', conversion: 'C', penaltyGoal: 'P', dropGoal: 'D', penaltyTry: '7' }
  const scoring = P.filter(p => code[p.kind] && (p.kind === 'try' || p.kind === 'penaltyTry' || p.good)).map(p => (p.side === 0 ? 'H' : 'A') + code[p.kind]).join(' ')
  return { tries, tri, tmpl, scoring, texts, keys: lines.map(l => l.key.replace(/\d+$/, '')) }
}

const cosine = (a: Map<string, number>, b: Map<string, number>) => {
  let d = 0, na = 0, nb = 0
  for (const [k, v] of a) { na += v * v; d += v * (b.get(k) ?? 0) }
  for (const v of b.values()) nb += v * v
  return na && nb ? d / Math.sqrt(na * nb) : na === nb ? 1 : 0
}
/** how alike two scoring sequences are, 0 to 1 (one minus the edit distance over the longer) */
const seqSim = (a: string, b: string) => {
  const x = a ? a.split(' ') : [], y = b ? b.split(' ') : []
  if (!x.length && !y.length) return 1
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)])
  for (let j = 1; j <= y.length; j++) d[0][j] = j
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length)
}

export interface Sameness { pairs: number; tries: number; play: number; words: number; scoring: number; score: number }

/**
 * THE SAMENESS SCORE (proposed, 22 Nov): over every pair of matches in a set, the mean of four
 * likenesses, each 0 (nothing alike) to 1 (the same): how the tries came (try type and the start
 * of the move), the run of play (kind trigrams, rucks left out), the words (line templates with
 * names and numbers taken out), and the scoring sequence. Reported 0 to 100.
 */
export function sameness(shapes: MatchShape[]): Sameness {
  let pairs = 0, t = 0, p = 0, w = 0, sc = 0
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    pairs++
    t += cosine(shapes[i].tries, shapes[j].tries); p += cosine(shapes[i].tri, shapes[j].tri)
    w += cosine(shapes[i].tmpl, shapes[j].tmpl); sc += seqSim(shapes[i].scoring, shapes[j].scoring)
  }
  const n = Math.max(1, pairs)
  const r = { pairs, tries: t / n, play: p / n, words: w / n, scoring: sc / n }
  return { ...r, score: 100 * (r.tries + r.play + r.words + r.scoring) / 4 }
}

/** within one match: the share of lines whose template was already used, and the longest run of one line key */
export function repeatWithin(sh: MatchShape, m: Match): { tmplRun: number; tmplRunText: string; repeatShare: number; longestRun: number; runKey: string; topRepeat: string; topCount: number } {
  const seen = new Map<string, number>()
  let rep = 0
  const nm = m.names ? [...m.names.values()] : []
  for (const tx of sh.texts) { const k = template(tx, nm, m.teams ?? ['Home', 'Away']); if (seen.has(k)) rep++; seen.set(k, (seen.get(k) ?? 0) + 1) }
  let run = 0, best = 0, bestKey = ''
  for (let i = 0; i < sh.keys.length; i++) { run = i && sh.keys[i] === sh.keys[i - 1] ? run + 1 : 1; if (run > best) { best = run; bestKey = sh.keys[i] } }
  const top = [...seen.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  // the same wording (names and numbers aside) back to back
  let tr = 0, tBest = 0, tText = ''
  const tm = sh.texts.map(tx => template(tx, nm, m.teams ?? ['Home', 'Away']))
  for (let i = 0; i < tm.length; i++) { tr = i && tm[i] === tm[i - 1] ? tr + 1 : 1; if (tr > tBest) { tBest = tr; tText = tm[i] } }
  return { tmplRun: tBest, tmplRunText: tText, repeatShare: sh.texts.length ? rep / sh.texts.length : 0, longestRun: best, runKey: bestKey, topRepeat: top[0], topCount: top[1] }
}

// ------------------------------------------------------------ round 5: boundaries, clip pace, ticker, levers, realism

/** the in-goal drawn on the pitch, try line to dead-ball line (src/ui/livepitch/LivePitch.tsx GOAL); Law 1 allows 6 to 22 m */
export const IN_GOAL_M = 8
/** the posts (Law 1): 5.6 m apart, the crossbar 3.0 m up */
export const POSTS_HALF = 2.8, CROSSBAR = 3.0
const TOUCH_OUT = new Set(['touch', 'penaltyToTouch', 'fiftyTwentyTwo', 'outOnFull'])

/**
 * THE RECORD'S BOUNDARIES (owner, 24 Nov: "a moment early on said the ball went dead, but on
 * screen it did not cross the dead-ball line"). What the record itself says about where the
 * ball went: a kick that ran dead has a landing point beyond the try line (it cannot be drawn
 * over the dead-ball line if the record puts it on the try line); a kick to touch lands on a
 * touchline; a try is on the line.
 */
export function checkRecordBounds(m: Match): Fail[] {
  const P = m.res.plays, out: Fail[] = []
  for (const p of P) {
    if (p.kind === 'kick' && p.result === 'dead') {
      const lx = p.land ? p.land[0] : p.x
      if (toLine(p.side, lx) >= 0) out.push({ rule: 'B01-record-bounds', n: p.n, msg: `kick/dead by side ${p.side} from x ${P[p.n - 1]?.x}: the record lands it at x ${lx} (on the try line), so nothing says it crossed the dead-ball line; gain ${fmt(p.gain ?? 0)} m is cut at the line` })
    }
    // a touchdown in-goal must be in the in-goal: grounded (`out` on the dead-ball play, else the landing point) short of the dead-ball line
    const nx = P[p.n + 1] as (Play & { out?: [number, number] }) | undefined
    if (p.kind === 'kick' && p.result === 'dead' && nx?.kind === 'deadBall' && nx.result === 'touchedDown') {
      const at = nx.out ? nx.out[0] : p.land ? p.land[0] : p.x
      if (toLine(p.side, at) < -IN_GOAL_M) out.push({ rule: 'B01-record-bounds', n: p.n, msg: `kick/dead then deadBall/touchedDown, but it is grounded at x ${at}, ${fmt(-toLine(p.side, at))} m past the try line: over the dead-ball line (${IN_GOAL_M} m), so it ran dead${nx.out ? '' : ' (no out on the dead-ball play)'}` })
    }
    if (p.kind === 'kick' && TOUCH_OUT.has(p.result) && p.land && p.land[1] !== 0 && p.land[1] !== 70) out.push({ rule: 'B01-record-bounds', n: p.n, msg: `kick/${p.result} lands at y ${p.land[1]}, not on a touchline` })
    if ((p.kind === 'try') && toLine(p.side, p.x) > 0) out.push({ rule: 'B01-record-bounds', n: p.n, msg: `try at x ${p.x}: not on or over the line` })
  }
  return out
}

export interface BoundReport { checked: number; fails: Fail[]; byKind: Record<string, [number, number]> }

/**
 * THE PICTURE'S BOUNDARIES: the baked ball crosses the line the record says it went over and
 * ends beyond it. Dead: past the dead-ball line (IN_GOAL_M beyond the try line). Touch, out on
 * the full, carried into touch: past the touchline. A try: the ball over the try line while the
 * try is shown. A kick at goal that is over: it passes the goal line between the posts and over
 * the bar; one that is missed does not.
 */
export function checkPictureBounds(A: Pitch, m: Match): BoundReport {
  const P = m.res.plays
  const bk = A.bakeOf(P, m.sides), F = A.FPS
  const fails: Fail[] = []
  const byKind: Record<string, [number, number]> = {}
  const tally = (k: string, ok: boolean) => { const t = byKind[k] ?? (byKind[k] = [0, 0]); t[0]++; if (!ok) t[1]++ }
  const frames = (a: number, b: number) => { const o: number[] = []; for (let f = Math.max(0, Math.floor(a * F)); f <= Math.min(bk.n - 1, Math.ceil(b * F)); f++) o.push(f); return o }
  const bx = (f: number) => bk.ball[f * 3], by = (f: number) => bk.ball[f * 3 + 1], bz = (f: number) => bk.ball[f * 3 + 2]
  let checked = 0
  for (const p of P) {
    const g = bk.segs[p.n]; if (!g) continue
    const nx = P[p.n + 1], gn = nx ? bk.segs[nx.n] : undefined
    if (p.kind === 'kick' && p.result === 'dead') {
      // from the kick to the end of the dead-ball play that follows. Ran dead: past the dead-ball line.
      // Touched down (ANIMATION, 24 Nov): grounded in the in-goal where the record says (land), and it stays there.
      const end = nx?.kind === 'deadBall' && gn ? gn.a0 + gn.act : g.a1
      const fs = frames(g.a0, end)
      const far = Math.min(...fs.map(f => toLine(p.side, bx(f))))
      const last = toLine(p.side, bx(fs[fs.length - 1]))
      if (nx?.kind === 'deadBall' && nx.result === 'touchedDown') {
        // where it was grounded: the dead-ball play's `out` (record.ts), else the kick's landing point
        const outP = (nx as Play & { out?: [number, number] }).out
        const want = outP ? toLine(p.side, outP[0]) : p.land ? toLine(p.side, p.land[0]) : -1
        const ok = last < 0 && last >= -IN_GOAL_M && Math.abs(last - want) <= 1.5
        checked++; tally('touched down in-goal', ok)
        if (!ok) fails.push({ rule: 'B02-picture-bounds', n: p.n, msg: `kick touched down in-goal (record: grounded ${fmt(-want)} m in${outP ? '' : ', from the landing point'}); on screen the ball stops ${fmt(-last)} m past the try line` })
      } else {
        const ok = far <= -IN_GOAL_M && last <= -IN_GOAL_M + 0.5
        checked++; tally('ran dead', ok)
        if (!ok) fails.push({ rule: 'B02-picture-bounds', n: p.n, msg: `kick ran dead (record) but on screen the ball gets ${fmt(-far)} m past the try line and stops ${fmt(-last)} m past it; the dead-ball line is ${IN_GOAL_M} m past it` })
      }
    }
    const toTouch = (p.kind === 'kick' && TOUCH_OUT.has(p.result)) || (p.kind === 'carry' && p.result === 'intoTouch')
    if (toTouch) {
      const line = p.y < 35 ? 0 : 70
      const end = gn && (nx!.kind === 'intoTouch') ? gn.a0 + gn.act : g.a0 + g.act
      const fs = frames(g.a0, end)
      const beyond = (f: number) => (line === 0 ? by(f) <= 0 : by(f) >= 70)
      const crossed = fs.some(beyond), stops = beyond(fs[fs.length - 1])
      checked++; tally(p.kind === 'carry' ? 'carried into touch' : p.result === 'outOnFull' ? 'out on the full' : 'kick to touch', crossed && stops)
      if (!(crossed && stops)) fails.push({ rule: 'B02-picture-bounds', n: p.n, msg: `${p.kind}/${p.result}: record has it in touch at y ${line}; on screen the ball ${crossed ? 'crosses but comes back' : `never crosses (closest y ${fmt(line === 0 ? Math.min(...fs.map(by)) : Math.max(...fs.map(by)))})`}` })
    }
    if (p.kind === 'try') {
      const fs = frames(g.a0, g.a0 + g.act)
      const ok = fs.some(f => toLine(p.side, bx(f)) <= 0)
      checked++; tally('try', ok)
      if (!ok) fails.push({ rule: 'B02-picture-bounds', n: p.n, msg: `try: on screen the ball is never over the try line (closest ${fmt(Math.min(...fs.map(f => toLine(p.side, bx(f)))))} m short)` })
    }
    if ((p.kind === 'penaltyGoal' || p.kind === 'conversion' || p.kind === 'dropGoal') && p.good != null) {
      const fs = frames(g.a0, g.a1)
      let through = false, crossedAt: { y: number; z: number } | null = null
      for (let i = 1; i < fs.length; i++) {
        const a = toLine(p.side, bx(fs[i - 1])), b = toLine(p.side, bx(fs[i]))
        if (a > 0 && b <= 0) { const y = by(fs[i]), z = bz(fs[i]); crossedAt = { y, z }; through = Math.abs(y - 35) < POSTS_HALF && z > CROSSBAR; break }
      }
      const ok = p.good ? through : !through
      checked++; tally(p.good ? 'goal over' : 'goal missed', ok)
      if (!ok) fails.push({ rule: 'B02-picture-bounds', n: p.n, msg: `${p.kind} ${p.good ? 'over' : 'missed'} (record); on screen the ball ${crossedAt ? `crosses the goal line at y ${fmt(crossedAt.y)}, ${fmt(crossedAt.z)} m up (posts y ${35 - POSTS_HALF} to ${35 + POSTS_HALF}, bar ${CROSSBAR} m)` : 'never reaches the goal line'}` })
    }
  }
  return { checked, fails, byKind }
}

/**
 * THE TICKER (owner, 24 Nov: "a lot faster paced, a bit like the old Football Manager, where it's
 * flicking through and then it flashes when there's a key [moment], a try or a penalty goal". It
 * must fit what is shown on the pitch). On the pitch's schedule, after commentary.ts thin():
 *  - every play of a try build-up has its own line;
 *  - while the ball is in play, never more than TICK_GAP s on screen without a new line;
 *  - the flash lines (try, goal, card) are all there and stay up FLASH_HOLD s before the next line;
 *  - the line on screen is about the play on screen: never a play ahead, at most one behind;
 *  - lines are short enough to read at that pace.
 */
export const TICK_GAP = 1.2, STALE_S = 2.5, FLASH_HOLD = 2.0, TICK_MAX_CHARS = 70, FULL_MAX_CHARS = 90, FLASH_MAX_CHARS = 48, BEHIND_SHARE = 0.02
const FLASH_KINDS = new Set(['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard'])

export interface TickerReport {
  buildPlays: number; buildSaid: number; buildMissed?: number
  empty: number; emptyWorst: number; emptyAt: number; stale: number; staleWorst: number; staleAt: number; gapP95: number
  flashes: number; flashLines: number; flashDropped?: number; flashShort: number; flashShortAt?: number; holdMin: number
  ahead: number; aheadAt?: number; behindShare: number; behindAt?: number; behindFFShare: number; behindClipShare: number; behindInFF: number
  long: number; longest: number; longestText: string; flashLong: number
  linesPerSecFF: number; linesPerSec1x: number
}

export function checkTicker(A: Pitch, m: Match, lines: LineLike[], text: (l: LineLike) => string): TickerReport {
  const P = m.res.plays
  const bk = A.bakeOf(P, m.sides), tl = A.timeline(bk), sch = A.schedule(P, m.sides), F = A.FPS
  const times = lineTimes(lines, sch)
  const order = lines.map((_, i) => i).sort((a, b) => times[a] - times[b] || lines[a].n - lines[b].n)
  // build-ups: every play from the start of the move to the try
  // a run line (commentary round 7) covers every play from run[0] to run[1] (coordinator, round 8)
  const said = new Set<number>()
  for (const l of lines) { const r = (l as unknown as { run?: [number, number] }).run; if (r) for (let k = r[0]; k <= r[1]; k++) said.add(k); else said.add(l.n) }
  let buildPlays = 0, buildSaid = 0, buildMissed: number | undefined
  for (const p of P) if (p.kind === 'try') {
    for (let n = possessionStart(P, p.n); n <= p.n; n++) { buildPlays++; if (said.has(n)) buildSaid++; else buildMissed ??= n }
  }
  // screen seconds while the ball is in play
  const live = new Uint8Array(bk.n)
  for (let f = 0; f < bk.n; f++) { const g = bk.segs[bk.seg[f]] as unknown as { live?: boolean; a0: number; act: number }; live[f] = g && g.live && f / F < g.a0 + g.act ? 1 : 0 }
  const frameAtView = (v: number) => { let lo = 0, hi = bk.n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tl.V[mid] <= v) lo = mid; else hi = mid - 1 } return lo }
  const liveSeconds = (a: number, b: number) => {
    let sum = 0
    for (let f = frameAtView(a); f < bk.n && tl.V[f] < b; f++) if (live[f]) sum += Math.min(b, tl.V[f + 1]) - Math.max(a, tl.V[f])
    return sum
  }
  const ts = order.map(i => times[i])
  const gaps: number[] = []
  for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1])
  // flashes: every try, goal and card has its flash line, held at least FLASH_HOLD s
  let flashes = 0, flashLines = 0, flashDropped: number | undefined, flashShort = 0, flashShortAt: number | undefined, holdMin = Infinity
  for (const p of P) {
    if (!FLASH_KINDS.has(p.kind) || (p.kind !== 'try' && p.kind !== 'penaltyTry' && p.kind !== 'yellowCard' && p.kind !== 'redCard' && !p.good)) continue
    flashes++
    const k = order.findIndex(i => lines[i].n === p.n && ((lines[i] as unknown as { flash?: string | null }).flash != null || lines[i].priority === 3))
    if (k < 0) { flashDropped ??= p.n; continue }
    flashLines++
    const own = (lines[order[k]] as unknown as { hold?: number }).hold
    const hold = typeof own === 'number' ? own : (k + 1 < order.length ? ts[k + 1] - ts[k] : Infinity)
    holdMin = Math.min(holdMin, hold)
    if (hold < FLASH_HOLD) { flashShort++; flashShortAt ??= p.n }
  }
  // DEAD AIR (lead's ruling, 24 Nov 15:05: "a held line counts"): with the ball in play, time with no line
  // on screen at all (a line is up from `at` for its `hold`), and, at clip pace, the same line up more than
  // STALE_S. Sampled every 0.05 s of viewing.
  const holds = order.map(i => { const h = (lines[i] as unknown as { hold?: number }).hold; return typeof h === 'number' ? h : Infinity })
  const tlx = tl as unknown as { slow?: Uint8Array }
  let empty = 0, emptyRun = 0, emptyWorst = 0, emptyAt = -1, stale = 0, staleWorst = 0, staleAt = -1
  for (let v = 0, k = -1; v < tl.total; v += 0.05) {
    while (k + 1 < ts.length && ts[k + 1] <= v) k++
    const f = frameAtView(v)
    if (!live[f]) { emptyRun = 0; continue }
    const up = k >= 0 && v < ts[k] + holds[k]
    if (!up) { emptyRun += 0.05; if (emptyRun > emptyWorst) { emptyWorst = emptyRun; emptyAt = bk.seg[f] } }
    else { if (emptyRun > TICK_GAP) empty++; emptyRun = 0 }
    const atClipNow = tlx.slow ? tlx.slow[f] === 1 : tl.rate[f] <= clipRate(A) * 1.15
    // (a flash is meant to stay up: it is not stale)
    const isFlash = k >= 0 && (lines[order[k]] as unknown as { flash?: string | null }).flash != null
    if (up && atClipNow && !isFlash) { const age = v - ts[k]; if (age > staleWorst) { staleWorst = age; staleAt = bk.seg[f] } }
    if (up && atClipNow && !isFlash && v - ts[k] > STALE_S && v - ts[k] <= STALE_S + 0.05) stale++
  }
  if (emptyRun > TICK_GAP) empty++
  // the line on screen against the play on screen, ten times a second while the ball is in play
  let ahead = 0, aheadAt: number | undefined, behind = 0, samples = 0, behindAt: number | undefined
  let behindFF = 0, samplesFF = 0, behindClip = 0, samplesClip = 0
  for (let v = 0, k = -1; v < tl.total; v += 0.1) {
    while (k + 1 < ts.length && ts[k + 1] <= v) k++
    const f = frameAtView(v)
    if (!live[f] || k < 0) continue
    samples++
    const lr = (lines[order[k]] as unknown as { run?: [number, number] }).run
    const onScreen = bk.seg[f], shown = lr ? lr[1] : lines[order[k]].n, shownFrom = lr ? lr[0] : shown
    const ff = tl.rate[f] > 1.5
    if (ff) samplesFF++; else samplesClip++
    if (shownFrom > onScreen) { ahead++; aheadAt ??= shownFrom }
    else if (shown < onScreen - 1) { behind++; behindAt ??= onScreen; if (ff) behindFF++; else behindClip++ }
  }
  // length, by register (lead's ruling 24 Nov 15:05): flash lines 48, ticker lines 70, fuller lines 90
  let long = 0, longest = 0, longestText = '', flashLong = 0
  for (const l of lines) {
    const t = text(l), x = l as unknown as { flash?: string | null; reg?: 'tick' | 'full' }
    const cap = x.flash != null ? FLASH_MAX_CHARS : x.reg === 'full' ? FULL_MAX_CHARS : TICK_MAX_CHARS
    if (t.length > cap) { if (x.flash != null) flashLong++; else long++ }
    if (t.length > longest) { longest = t.length; longestText = t }
  }
  let ffT = 0, nT = 0, ffL = 0, nL = 0
  for (const x of sch) { if (x.speed <= 1.15) nT += x.dur; else ffT += x.dur }
  for (const l of lines) { const x = sch[l.n]; if (!x) continue; if (x.speed <= 1.15) nL++; else ffL++ }
  return {
    buildPlays, buildSaid, buildMissed, empty, emptyWorst, emptyAt, stale, staleWorst, staleAt, gapP95: pct(gaps, 0.95),
    flashes, flashLines, flashDropped, flashShort, flashShortAt, holdMin,
    ahead, aheadAt, behindShare: samples ? behind / samples : 0, behindAt,
    behindFFShare: samplesFF ? behindFF / samplesFF : 0, behindClipShare: samplesClip ? behindClip / samplesClip : 0, behindInFF: behind ? behindFF / behind : 0,
    long, longest, longestText, flashLong, linesPerSecFF: ffT ? ffL / ffT : 0, linesPerSec1x: nT ? nL / nT : 0,
  }
}

/**
 * THE MANAGER'S LEVERS (owner, 24 Nov: "Make sure everything in the game is affected by the
 * decisions of the manager. This can't be a preset result."). For each lever the engine takes,
 * on one real pairing over N match seeds: the same seed with and without the call. Every play
 * before the call must be the same; after it the measure the lever should move is compared over
 * the pairs (mean difference, the share of pairs that moved at all, and a sign test), and the
 * direction is checked where rugby says which way it should go.
 */
export interface LeverRow { t: number; verdict: 'acts' | 'weak' | 'wrong' | 'nothing'; lever: string; from: string; measure: string; want: '+' | '-' | 'any'; base: number; with: number; diff: number; moved: number; pairs: number; prefixBroken: number; z: number; ok: boolean; note: string }

export async function checkLevers(f: RealFixture, N: number): Promise<LeverRow[]> {
  const { MatchSim } = await import('../src/game/sim/skeleton')
  const us = f.userSide, them = other(us)
  const sheet = (b: ReturnType<RealFixture['build']>) => (us === 0 ? b.home : b.away).players
  type Dec = Parameters<InstanceType<typeof MatchSim>['apply']>[0]
  type Run = { res: SimResult; at: number }
  const run = (seed: number, stop: { clock: number; dead?: boolean } | null, decs: (b: ReturnType<RealFixture['build']>) => Dec[]): Run => {
    const b = f.build()
    const ds = decs(b)
    const m = new MatchSim({ seed, world: b.world })
    if (stop) m.runUntil(stop)
    const at = m.plays.length
    for (const d of ds) m.apply(d)
    for (let g = 0; g < 400 && !m.done; g++) { m.runUntil(); const pd = m.pending; if (pd) m.answer(pd.options.includes('posts') ? 'posts' : 'corner') }
    return { res: m.result(), at }
  }
  const after = (r: Run, fn: (p: Play) => number) => r.res.plays.slice(r.at).reduce((a, p) => a + fn(p), 0)
  const ptsAfter = (side: 0 | 1) => (r: Run) => { const P = r.res.plays, s0 = P[r.at - 1]?.score[side] ?? 0; return r.res.score[side] - s0 }
  const margin = (r: Run) => ptsAfter(us)(r) - ptsAfter(them)(r)
  const levers: { lever: string; from: string; stop: { clock: number; dead?: boolean } | null; decs: (b: ReturnType<RealFixture['build']>) => Dec[]; measure: string; fn: (r: Run) => number; want: LeverRow['want'] }[] = [
    { lever: 'strength x1.12 (any change of World)', from: '40:00', stop: { clock: 2400 }, decs: () => [{ kind: 'strength', side: us, factor: 1.12 }], measure: 'margin after the call', fn: margin, want: '+' },
    { lever: 'bench: props and hooker on at 55:00', from: '55:00', stop: { clock: 3300, dead: true }, decs: b => { const sh = sheet(b); return ([[1, 17], [2, 16], [3, 18]] as const).map(([o, n]) => ({ kind: 'substitution' as const, side: us, off: sh.find(p => p.shirt === o)!.id, on: sh.find(p => p.shirt === n)!.id })) }, measure: 'own points after 55:00', fn: ptsAfter(us), want: '+' },
    { lever: 'third-choice 10: the No. 10 off at 1:00 for the No. 23', from: '1:00', stop: { clock: 60, dead: true }, decs: b => { const sh = sheet(b); return [{ kind: 'substitution', side: us, off: sh.find(p => p.shirt === 10)!.id, on: sh.find(p => p.shirt === 23)!.id }] }, measure: 'margin after the call', fn: margin, want: '-' },
    { lever: 'bench: props and hooker on at 55:00 (the scrum)', from: '55:00', stop: { clock: 3300, dead: true }, decs: b => { const sh = sheet(b); return ([[1, 17], [2, 16], [3, 18]] as const).map(([o, n]) => ({ kind: 'substitution' as const, side: us, off: sh.find(p => p.shirt === o)!.id, on: sh.find(p => p.shirt === n)!.id })) }, measure: 'own scrums won or penalty won, minus lost, after 55:00', fn: r => after(r, p => (p.kind !== 'scrum' ? 0 : (p.side === us && ['won', 'penaltyWon'].includes(p.result)) || (p.side === them && ['penaltyLost', 'againstTheHead'].includes(p.result)) ? 1 : (p.side === us && ['penaltyLost', 'againstTheHead'].includes(p.result)) || (p.side === them && p.result === 'penaltyWon') ? -1 : 0)), want: '+' },
    { lever: 'third-choice 10 (goal kicking)', from: '1:00', stop: { clock: 60, dead: true }, decs: b => { const sh = sheet(b); return [{ kind: 'substitution', side: us, off: sh.find(p => p.shirt === 10)!.id, on: sh.find(p => p.shirt === 23)!.id }] }, measure: 'own kicks at goal missed minus made', fn: r => after(r, p => ((p.kind === 'penaltyGoal' || p.kind === 'conversion') && p.side === us ? (p.good ? -1 : 1) : 0)), want: '+' },
    { lever: 'tactics: kicking 15 to 90', from: '20:00', stop: { clock: 1200 }, decs: () => [{ kind: 'tactics', side: us, set: { kicking: 90 } }], measure: 'own kicks from hand after the call', fn: r => after(r, p => (p.kind === 'kick' && p.side === us && p.kick !== 'restart' && p.result !== 'penaltyToTouch' ? 1 : 0)), want: '+' },
    { lever: 'tactics: aggression 90', from: '20:00', stop: { clock: 1200 }, decs: () => [{ kind: 'tactics', side: us, set: { aggression: 90 } }], measure: 'penalties conceded after the call', fn: r => after(r, p => ((p.kind === 'penalty' || p.kind === 'freeKick') && p.side === them ? 1 : 0)), want: '+' },
    { lever: 'tactics: tempo 90', from: '20:00', stop: { clock: 1200 }, decs: () => [{ kind: 'tactics', side: us, set: { tempo: 90 } }], measure: 'own carries after the call', fn: r => after(r, p => (p.kind === 'carry' && p.side === us ? 1 : 0)), want: '+' },
    { lever: 'team talk: fire at half-time', from: '40:00', stop: { clock: 2400, dead: true }, decs: () => [{ kind: 'talk', side: us, tone: 'fire' }], measure: 'margin after the call', fn: margin, want: 'any' },
    { lever: 'team talk: criticise at half-time', from: '40:00', stop: { clock: 2400, dead: true }, decs: () => [{ kind: 'talk', side: us, tone: 'criticise' }], measure: 'margin after the call', fn: margin, want: 'any' },
    { lever: 'penalty call: always posts', from: '0:00', stop: null, decs: () => [{ kind: 'penaltyCall', side: us, call: 'posts' }], measure: 'own kicks at goal', fn: r => after(r, p => (p.kind === 'penaltyGoal' && p.side === us ? 1 : 0)), want: '+' },
    { lever: 'penalty call: always corner', from: '0:00', stop: null, decs: () => [{ kind: 'penaltyCall', side: us, call: 'corner' }], measure: 'own lineouts after a penalty to touch', fn: r => after(r, p => (p.kind === 'kick' && p.result === 'penaltyToTouch' && p.side === us ? 1 : 0)), want: '+' },
  ]
  const rows: LeverRow[] = []
  const bases = new Map<number, SimResult>()
  for (let i = 0; i < N; i++) { const seed = 2000 + i; bases.set(seed, run(seed, null, () => []).res) }
  for (const L of levers) {
    let sb = 0, sw = 0, moved = 0, plus = 0, minus = 0, broke = 0, note = ''
    const ds: number[] = []
    for (let i = 0; i < N; i++) {
      const seed = 2000 + i, base = bases.get(seed)!
      let w: Run
      try { w = run(seed, L.stop, L.decs) } catch (e) { note = `threw: ${(e as Error).message}`; break }
      const b: Run = { res: base, at: w.at }
      if (JSON.stringify(base.plays.slice(0, w.at)) !== JSON.stringify(w.res.plays.slice(0, w.at))) broke++
      const refused = w.res.plays.filter(p => p.kind === 'substitution' && p.result === 'refused' && p.side === us).length
      if (refused && !note) note = `${refused} substitution(s) refused (${w.res.plays.find(p => p.kind === 'substitution' && p.result === 'refused' && p.side === us)?.cause})`
      const x = L.fn(b), y = L.fn(w)
      sb += x; sw += y; ds.push(y - x)
      if (JSON.stringify(base.plays.slice(w.at)) !== JSON.stringify(w.res.plays.slice(w.at))) moved++
      if (y > x) plus++; else if (y < x) minus++
    }
    const diff = (sw - sb) / N
    // a sign test: how many standard deviations the split of ups and downs is from even
    const k = plus + minus, z = k ? (plus - minus) / Math.sqrt(k) : 0
    // a paired t on the measure: the mean change over its standard error
    const md = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length)
    const sd = Math.sqrt(ds.reduce((a, b) => a + (b - md) ** 2, 0) / Math.max(1, ds.length - 1))
    const t = sd > 0 ? md / (sd / Math.sqrt(ds.length)) : md === 0 ? 0 : Infinity
    const signed = L.want === '-' ? -t : t
    const verdict: LeverRow['verdict'] = moved === 0 || md === 0 ? 'nothing' : L.want === 'any' ? (Math.abs(t) >= 2 ? 'acts' : 'weak') : signed >= 2 ? 'acts' : signed <= -2 ? 'wrong' : 'weak'
    const dirOk = verdict === 'acts'
    rows.push({ t, verdict, lever: L.lever, from: L.from, measure: L.measure, want: L.want, base: sb / N, with: sw / N, diff, moved, pairs: N, prefixBroken: broke, z, ok: broke === 0 && moved > 0 && dirOk, note })
  }
  return rows
}

/** what a yellow card costs, from the record: the carded side's points for minus against a minute, in the bin and out of it */
export function cardCost(ms: Match[]): { inBin: number; outBin: number; minutesIn: number; cards: number } {
  let pin = 0, tin = 0, pout = 0, tout = 0, cards = 0
  for (const m of ms) {
    const P = m.res.plays
    for (const c of P) {
      if (c.kind !== 'yellowCard') continue
      cards++
      const s = c.side, o = other(s), from = offAt(c), to = Math.min(backAt(c), P[P.length - 1].t)
      const at = (t: number) => { let q = P[0]; for (const p of P) { if (p.t > t) break; q = p } return q.score }
      const a = at(from), b = at(to)
      pin += (b[s] - a[s]) - (b[o] - a[o]); tin += (to - from) / 60
      const end = P[P.length - 1].score
      pout += (end[s] - end[o]) - ((b[s] - a[s]) - (b[o] - a[o])); tout += (P[P.length - 1].t - (to - from)) / 60
    }
  }
  return { inBin: tin ? pin / tin : 0, outBin: tout ? pout / tout : 0, minutesIn: tin, cards }
}

/**
 * FUNDAMENTALS AGAINST REAL RUGBY (owner, 24 Nov: "check all the fundamentals of the game, making
 * sure it's as realistic as possible from what you can see and from what data you have"). Our
 * per-match figures on real fixtures beside the sourced ones in docs/match-sim-sources.md. The
 * band for each row is the range the sources give, widened by 20% either way; a row with no
 * source says so and is not judged.
 */
export function ourRates(ms: Match[]): Record<string, number> {
  const N = Math.max(1, ms.length)
  const sum = (f: (p: Play, P: Play[]) => number) => ms.reduce((a, m) => a + m.res.plays.reduce((b, p) => b + f(p, m.res.plays), 0), 0) / N
  const share = (num: (p: Play) => boolean, den: (p: Play) => boolean) => { let a = 0, b = 0; for (const m of ms) for (const p of m.res.plays) { if (den(p)) { b++; if (num(p)) a++ } } return b ? 100 * a / b : NaN }
  // 22 entries: a side's possession reaching the other 22 (counted once until the ball changes hands or play restarts)
  let entries = 0, entryPts = 0
  let poss = 0, phases = 0
  for (const m of ms) {
    const P = m.res.plays
    let inside = false, owner = -1, ptsAt = 0
    for (let i = 0; i < P.length; i++) {
      const p = P[i]
      if (p.ball !== owner || ['kickoff', 'dropout22', 'goalLineDropout', 'halfTime'].includes(p.kind)) {
        if (inside) entryPts += P[i - 1].score[owner as 0 | 1] - ptsAt
        inside = false; if (p.ball !== owner) { poss++; owner = p.ball }
      }
      if (!inside && p.live > 0 && toLine(p.ball, p.x) <= 22 && p.kind !== 'conversion') { inside = true; entries++; ptsAt = p.score[p.ball] }
      if (p.kind === 'ruck' && p.result === 'recycled') phases++
    }
  }
  const home = ms.filter(m => m.res.score[0] > m.res.score[1]).length, draws = ms.filter(m => m.res.score[0] === m.res.score[1]).length
  return {
    yellow: sum(p => (p.kind === 'yellowCard' ? 1 : 0)),
    red: sum(p => (p.kind === 'redCard' ? 1 : 0)),
    cards: sum(p => (p.kind === 'yellowCard' || p.kind === 'redCard' ? 1 : 0)),
    lineBreaks: sum(p => (p.kind === 'lineBreak' ? 1 : 0)),
    offloads: sum(p => (p.kind === 'offload' ? 1 : 0)),
    tackles: sum(p => ((p.kind === 'carry' || p.kind === 'lineBreak') && p.result !== 'clean' && p.result !== 'interception' ? (p.vs?.length || 1) : 0)),
    carries: sum(p => (p.kind === 'carry' ? 1 : 0)),
    rucks: sum(p => (p.kind === 'ruck' || p.kind === 'maul' ? 1 : 0)),
    turnoversRuck: sum(p => (p.kind === 'ruck' && p.result === 'turnover' ? 1 : 0)),
    turnoversAll: sum(p => ((p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'carry' && p.result === 'intercepted') || (p.kind === 'lineout' && p.result === 'stolen') || (p.kind === 'scrum' && p.result === 'againstTheHead') ? 1 : 0)),
    knockOns: sum(p => (p.kind === 'knockOn' ? 1 : 0)),
    handlingErrors: sum(p => (p.kind === 'knockOn' || p.kind === 'forwardPass' ? 1 : 0)),
    penalties: sum(p => (p.kind === 'penalty' ? 1 : 0)),
    pensAndFK: sum(p => (p.kind === 'penalty' || p.kind === 'freeKick' ? 1 : 0)),
    outOnFull: sum(p => (p.kind === 'kick' && p.result === 'outOnFull' ? 1 : 0)),
    kicksInPlay: sum(p => (p.kind === 'kick' && p.kick !== 'restart' && p.result !== 'penaltyToTouch' ? 1 : 0)),
    scrums: sum(p => (p.kind === 'scrum' ? 1 : 0)),
    lineouts: sum(p => (p.kind === 'lineout' ? 1 : 0)),
    scrumWonPct: share(p => p.result === 'won' || p.result === 'penaltyWon' || p.result === 'freeKick', p => p.kind === 'scrum'),
    lineoutWonPct: share(p => p.result === 'won' || p.result === 'quick', p => p.kind === 'lineout'),
    goalPct: share(p => !!p.good, p => p.kind === 'penaltyGoal' || p.kind === 'conversion'),
    penGoalPct: share(p => !!p.good, p => p.kind === 'penaltyGoal'),
    conPct: share(p => !!p.good, p => p.kind === 'conversion'),
    tries: sum(p => (p.kind === 'try' || p.kind === 'penaltyTry' ? 1 : 0)),
    points: ms.reduce((a, m) => a + m.res.score[0] + m.res.score[1], 0) / N,
    homeTries: sum(p => ((p.kind === 'try' || p.kind === 'penaltyTry') && p.side === 0 ? 1 : 0)),
    awayTries: sum(p => ((p.kind === 'try' || p.kind === 'penaltyTry') && p.side === 1 ? 1 : 0)),
    homeWinPct: 100 * home / N, drawPct: 100 * draws / N,
    homeMargin: ms.reduce((a, m) => a + m.res.score[0] - m.res.score[1], 0) / N,
    entries22: entries / N, pointsPerEntry: entries ? entryPts / entries : NaN,
    possessions: poss / N, phasesPerPossession: poss ? phases / poss : NaN,
    injuries: sum(p => (p.kind === ('injury' as Play['kind']) ? 1 : 0)),
    subs: sum(p => (p.kind === 'substitution' && p.result === 'made' ? 1 : 0)),
    ruckRetention: share(p => p.result === 'recycled' || p.result === 'penaltyWon', p => p.kind === 'ruck'),
    scrumPens: sum(p => (p.kind === 'scrum' && (p.result === 'penaltyWon' || p.result === 'penaltyLost') ? 1 : 0)),
    scrumPenPct: share(p => p.result === 'penaltyWon' || p.result === 'penaltyLost' || p.result === 'freeKick', p => p.kind === 'scrum'),
    mauls: sum(p => (p.kind === 'maul' ? 1 : 0)),
    dropGoals: sum(p => (p.kind === 'dropGoal' && p.good ? 1 : 0)),
    dropPct: share(p => !!p.good, p => p.kind === 'dropGoal'),
    penGoalsMade: sum(p => (p.kind === 'penaltyGoal' && p.good ? 1 : 0)),
    penToTouchPct: (() => { let t = 0, a = 0; for (const m of ms) for (const p of m.res.plays) { if (p.kind === 'kick' && p.result === 'penaltyToTouch') t++; if (p.kind === 'penalty') a++ } return a ? 100 * t / a : NaN })(),
    ...tryOrigins(ms),
    ballInPlayMin: ms.reduce((a, m) => a + m.res.plays.reduce((b, p) => b + p.live, 0), 0) / N / 60,
  }
}

/** where each try's move began (World Rugby's categories: lineout, scrum, opposition kick, turnover, restart, penalty or free kick), as shares */
export function tryOrigins(ms: Match[]): Record<string, number> {
  const c: Record<string, number> = { lineout: 0, scrum: 0, kick: 0, turnover: 0, restart: 0, penalty: 0 }
  let n = 0
  for (const m of ms) {
    const P = m.res.plays
    for (const p of P) if (p.kind === 'try') {
      n++
      const o = P[possessionStart(P, p.n)], before = P[o.n - 1]
      const k = o.kind === 'lineout' ? 'lineout' : o.kind === 'scrum' ? 'scrum' : o.kind === 'tap' ? 'penalty'
        : o.kind === 'catch' ? (before && ['kickoff', 'dropout22', 'goalLineDropout'].includes(before.kind) ? 'restart' : 'kick')
        : 'turnover'
      c[k]++
    }
  }
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [`origin_${k}`, n ? 100 * v / n : NaN]))
}

/** THE SOURCED FIGURES (docs/match-sim-sources.md, commit 77b49a5f, section numbers given), per match unless said. A band is
 *  the range of the sources' own figures; per-team figures are doubled to per match only where the source gives them per team. */
export const TARGETS: Target[] = [
  { what: 'Yellow cards a match', key: 'yellow', lo: 0.53, hi: 2.4, source: 's1: 0.53 6N 2017, 0.64 RWC 2019; Top 14 2024-25 0.6 to 1.2 a team' },
  { what: 'Red cards a match', key: 'red', lo: 0.12, hi: 0.18, source: 's1: URC 2024-25 0.12, RWC 2019 0.18' },
  { what: 'Line breaks a match', key: 'lineBreaks', lo: 9.6, hi: 10.7, source: 's3: 6N 2026 9.6, Prem 2022-23 10.5, URC 2025-26 10.7' },
  { what: 'Offloads a match', key: 'offloads', lo: 10, hi: 15, source: 's3: 6N 2026 10 (medium-low); RWC 2023 under 15' },
  { what: 'Tackles a match (named tacklers on stopped carries)', key: 'tackles', lo: 258, hi: 344, source: 's4: RWC 2019 129 a team, URC 2025-26 344' },
  { what: 'Tackle completion %', key: 'none', source: 'no record: the record has no missed tackles (s4: 84% to 89%)' },
  { what: 'Carries a match', key: 'carries', lo: 228, hi: 230, source: 's4: RWC 2019 and 2023, 114 to 115 a team' },
  { what: 'Rucks and mauls a match', key: 'rucks', lo: 158, hi: 164, source: 's4: RWC, 79 to 82 rucks a team' },
  { what: 'Ruck retention %, side in possession', key: 'ruckRetention', lo: 92, hi: 98, source: 's2: RWC 2019 94% (92% to 98% by team)' },
  { what: 'Turnovers won a match (ruck, interception, lineout steal, against the head)', key: 'turnoversAll', lo: 10.6, hi: 16.8, source: 's2: 5.3 to 8.4 a team, RWC 2023 and 6N 2026 (definitions differ)' },
  { what: 'Conversion success %', key: 'conPct', lo: 75, hi: 83, source: 's5: RWC 2019 75%, 6N 2017 83%' },
  { what: 'Penalty goal success %', key: 'penGoalPct', lo: 76, hi: 89, source: 's5: RWC 2019 76%, 6N 2017 80%, Prem 2022-23 84% to 89%' },
  { what: 'Drop goal success %', key: 'dropPct', lo: 35, hi: 35, source: 's5: RWC 2019 6 of 17' },
  { what: 'Penalty goals kicked a match', key: 'penGoalsMade', lo: 2.0, hi: 2.43, source: 's10: 6N 2026 2.0; s5: Prem 2022-23 2.43' },
  { what: 'Drop goals a match', key: 'dropGoals', lo: 0.07, hi: 0.13, source: 's10: Prem 2024-25 0.07, RWC 2019 and 6N 2017 0.13' },
  { what: 'Own lineout won %', key: 'lineoutWonPct', lo: 87, hi: 91, source: 's6: 6N 2017 87%, RWC 2019 88% to 91%' },
  { what: 'Own scrum won %', key: 'scrumWonPct', lo: 84, hi: 95, source: 's6: RWC 2019 93% to 95%, RWC 2023 84%, Prem 85% to 88%' },
  { what: 'Scrums ending in a penalty or free kick %', key: 'scrumPenPct', lo: 27, hi: 33, source: 's6: RWC 2019 27%, 6N 2022 one in three' },
  { what: 'Scrum penalties a match', key: 'scrumPens', lo: 3.1, hi: 3.7, source: 's6: RWC 2019 3.7, RWC 2023 3.1' },
  { what: 'Mauls a match', key: 'mauls', lo: 8.3, hi: 12.3, source: 's6: ROE 2025, Super Rugby 8.3 to Rugby Championship 12.3 (unit unclear)' },
  { what: 'Scrums a match', key: 'scrums', lo: 10.2, hi: 14.4, source: 's8: 6N 2025 10.2 to RWC 14.4' },
  { what: 'Lineouts a match', key: 'lineouts', lo: 24, hi: 28.1, source: 's6, s8: 6N 2017 24, domestic leagues 28.1' },
  { what: 'Possessions a match', key: 'possessions', lo: 84.8, hi: 100, source: 's7: RWC 84.8 to 85.5; 6N 2025 about 50 a team' },
  { what: 'Phases (rucks) a possession', key: 'phasesPerPossession', lo: 1.8, hi: 3.0, source: 's7: RWC 2023 1.8, RWC 2019 3.0, Prem 2.7 to 2.9' },
  { what: 'Points per 22 entry', key: 'pointsPerEntry', lo: 1.49, hi: 3.4, source: 's7: 6N 2024 and 2026, Italy 1.49 to Ireland 3.4 (team range)' },
  { what: '22 entries a match', key: 'entries22', source: 'no source' },
  { what: 'Tries from a lineout %', key: 'origin_lineout', lo: 47, hi: 49, source: 's7: 6N 2017 47%, RWC 2019 49%' },
  { what: 'Tries from a scrum %', key: 'origin_scrum', lo: 16, hi: 20, source: 's7: RWC 2019 16%, 6N 2017 20%' },
  { what: 'Tries from an opposition kick %', key: 'origin_kick', lo: 15, hi: 15, source: 's7: RWC 2019 15%' },
  { what: 'Tries from a turnover %', key: 'origin_turnover', lo: 11, hi: 12, source: 's7: 6N 2017 11%, RWC 2019 12%' },
  { what: 'Tries from a restart %', key: 'origin_restart', lo: 6, hi: 6, source: 's7: RWC 2019 6%' },
  { what: 'Tries from a penalty or free kick tap %', key: 'origin_penalty', lo: 2, hi: 2, source: 's7: RWC 2019 2%' },
  { what: 'Penalties and free kicks a match', key: 'pensAndFK', lo: 17, hi: 22.9, source: 's10: RWC 2019 17, 6N 2017 21, Prem 2022-23 22.9 (the owner chose 11 to 12, 20 Nov)' },
  { what: 'Penalties sent to touch % of penalties', key: 'penToTouchPct', lo: 67, hi: 67, source: 's10: RWC 2019 67% of penalty options' },
  { what: 'Knock-ons a match', key: 'knockOns', lo: 7, hi: 14, source: 's11: about 7 knock-on scrums (6N 2025, low); handling errors about 7 a team (low)' },
  { what: 'Kicks from hand a match', key: 'kicksInPlay', lo: 46, hi: 60, source: 's12: RWC 2019 46, URC 2021-22 46, 6N 2026 about 30 a team' },
  { what: 'Kicks out on the full a match', key: 'outOnFull', source: 'no source (s12: not found)' },
  { what: 'Replacements used a match', key: 'subs', lo: 15.6, hi: 15.6, source: 's14: RWC 2019 15.6' },
  { what: 'Injury stoppages a match', key: 'injuries', source: 'no source (s13 gives 3.0 time-loss injuries a match, a different measure)' },
  { what: 'Home win %', key: 'homeWinPct', lo: 58.9, hi: 71.5, source: 's9: pooled 58.9 to 63.9, Prem 65.6 and 69, Top 14 71.5' },
  { what: 'Home points margin', key: 'homeMargin', lo: 4.6, hi: 6.8, source: 's9: pooled +4.6 to +6.7, Prem 2024-25 +6.8' },
  { what: 'Tries a match', key: 'tries', lo: 5.97, hi: 8.0, source: 's9: Prem 2022-23 3.36 + 2.61; spec 4: RWC 2019 6.3, Prem 2024-25 8.0' },
  { what: 'Points a match', key: 'points', lo: 40, hi: 56.3, source: 'spec 4: RWC 2019 40, Prem 2024-25 56.3 (the game band is 48 to 53)' },
  { what: 'Ball in play, minutes', key: 'ballInPlayMin', lo: 33.4, hi: 35.7, source: 'spec 4: RWC 2019 35:44, Oval Insights 33.4 to 35.3' },
]

/** a sourced figure: what it is, the sources' range (per match unless stated), and where it comes from in docs/match-sim-sources.md */
export interface Target { what: string; key: string; lo?: number; hi?: number; source: string; unit?: string }

/** the realism table: our figure, the sources' band widened by 20%, and the verdict */
export function realism(ours: Record<string, number>, targets: Target[]): { rows: string[]; misses: string[] } {
  const rows: string[] = [], misses: string[] = []
  for (const t of targets) {
    const v = ours[t.key]
    if (t.lo == null || t.hi == null) { rows.push(`| ${t.what} | ${fmt(v, 2)} | no source | | ${t.source || 'no source'} |`); continue }
    const lo = t.lo * 0.8, hi = t.hi * 1.2
    const ok = v >= lo && v <= hi
    rows.push(`| ${t.what} | ${fmt(v, 2)} | ${t.lo === t.hi ? fmt(t.lo, 2) : `${fmt(t.lo, 2)} to ${fmt(t.hi, 2)}`} | ${ok ? 'in line' : v < lo ? 'LOW' : 'HIGH'} | ${t.source} |`)
    if (!ok) misses.push(`${t.what}: ours ${fmt(v, 2)}, real ${t.lo === t.hi ? fmt(t.lo, 2) : `${fmt(t.lo, 2)} to ${fmt(t.hi, 2)}`} (${t.source})`)
  }
  return { rows, misses }
}

// ------------------------------------------------------------ round 8: the wiring (stage 6)
//
// AGENTS.md ROUND 8: "When the user watches a managed match in Extended, the match IS the new
// engine's match ... its final record becomes the result the game stores. ... Everything behind one
// switch (SIM2_EXTENDED)". These checks are written against the plan before the adapter exists. They
// load src/game/sim/toResult.ts with a dynamic import and report "not run" until it is there. The
// names they look for (any one of each) are in WIRING_API; the request to GAMEPLAY says the same.

export const WIRING_API = {
  play: ['playManaged', 'playManagedMatch', 'simManaged'],
  start: ['startSim2', 'startManaged', 'startSession', 'newSession', 'managedSession'],
  flag: ['SIM2_EXTENDED'],
}

/** what a session must offer (any MatchSim-like object with a finish that writes the result into the game) */
interface Session { sim?: { plays: Play[]; runUntil(s: unknown): unknown; apply(d: unknown): void; done: boolean; result(): SimResult }; plays?: readonly Play[]; runUntil?(s: unknown): unknown; apply?(d: unknown): unknown; answer?(c: string): void; pending?: { options: string[] } | null; done?: boolean; finish(): unknown; result?(): SimResult }
type Adapter = Record<string, unknown>
type PlayFn = (state: unknown, fx: unknown, opts?: { seed?: number; assistantBench?: boolean; decisions?: { at: Record<string, number | boolean>; decision: unknown }[] }) => { result?: SimResult; plays?: Play[] } | SimResult
type StartFn = (state: unknown, fx: unknown, opts?: { seed?: number; assistantBench?: boolean }) => Session

async function loadAdapter(): Promise<{ A: Adapter | null; why: string; play?: PlayFn; start?: StartFn; flag?: unknown }> {
  let A: Adapter
  try { A = await import('../src/game/sim/toResult' as string) as unknown as Adapter } catch (e) { return { A: null, why: `src/game/sim/toResult.ts not there (${(e as Error).message.split('\n')[0].slice(0, 80)})` } }
  const pick = (names: string[]) => names.map(n => A[n]).find(v => v !== undefined)
  let play = pick(WIRING_API.play) as PlayFn | undefined
  const rawStart = pick(WIRING_API.start) as ((...a: unknown[]) => Session) | undefined
  // startSim2(state, fx, seed, opts) takes the seed in place; sim2Seed(state, fx) is the game's own
  const seedOf = A.sim2Seed as ((g: unknown, f: unknown) => number) | undefined
  const start: StartFn | undefined = rawStart ? (g, f, o) => rawStart(g, f, o?.seed ?? (seedOf ? seedOf(g, f) : 1), o?.assistantBench ? { assistantBench: true } : {}) : undefined
  // no one-call play: play a session to the end, the decisions at their moments, every penalty call answered
  if (!play && start) play = (g, f, o) => {
    const ss = start(g, f, { seed: o?.seed, assistantBench: o?.assistantBench })
    const run = (st: unknown) => { for (let k = 0; k < 300; k++) { ss.runUntil!(st); const pd = ss.pending; if (pd) ss.answer!(pd.options.includes('posts') ? 'posts' : 'corner'); else break } }
    for (const d of o?.decisions ?? []) { run(d.at); ss.apply!(d.decision) }
    for (let k = 0; k < 300 && !ss.done; k++) run({})
    ss.finish()
    return { plays: [...(ss.plays ?? [])], result: ss.sim?.result() }
  }
  let flag = pick(WIRING_API.flag)
  if (flag === undefined) { try { const F = await import('../src/game/sim/flags' as string) as Adapter; flag = F.SIM2_EXTENDED } catch { /* elsewhere */ } }
  const why = !play && !start ? `toResult.ts has none of ${[...WIRING_API.play, ...WIRING_API.start].join(', ')}` : ''
  return { A, why, play, start, flag }
}

const recOf = (r: { result?: SimResult; plays?: Play[] } | SimResult): SimResult => {
  const x = r as { result?: SimResult; plays?: Play[]; score?: [number, number]; tries?: [number, number] }
  if (x.result) return x.result
  return { plays: x.plays ?? [], score: x.score ?? [0, 0], tries: x.tries ?? [0, 0] }
}

interface GameLike { fixtures: { id: number; week: number; homeId: string; awayId: string; played: boolean; homeScore: number; awayScore: number; homeTries: number; awayTries: number; events?: { min: number; type: string; teamId: string; playerId?: number }[]; motm?: number }[]; players: Record<number, { id: number; ratings?: number[]; stats: { apps: number; tries: number; points: number }; injury: unknown; bans: number; cond: number; morale: number; pos?: string }>; clubs: Record<string, { players: number[]; balance: number }>; userClubId: string; week: number; season: number; comps: Record<string, { type: string; table: { teamId: string; pts: number }[]; teamIds: string[] }> }

/**
 * W01 THE STORED RESULT IS THE WATCHED MATCH. 20 managed matches (Leicester's first fixture in new
 * games on seeds 1 to 20) with scripted decisions: a tactics change at 30:00, the No. 8 off for the
 * No. 20 at 50:00, every penalty to the posts. The game's fixture afterwards against the record.
 */
export async function checkStored(ad: Awaited<ReturnType<typeof loadAdapter>>, N = 20): Promise<RateRow> {
  if (!ad.play) return { id: 'W01-stored', ok: false, failing: -1, msg: `not run: ${ad.why || 'no play function (' + WIRING_API.play.join(', ') + ')'}` }
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek } = await import('../src/game/season')
  let bad = 0, first: RateRow['first'], why = ''
  for (let seed = 1; seed <= N; seed++) {
    const g = newGame('leicester', 'T', seed) as unknown as GameLike
    let fx = userFixtureThisWeek(g as never) as unknown as GameLike['fixtures'][number] | undefined
    for (let i = 0; i < 12 && !fx; i++) { processWeekAndAdvance(g as never); fx = userFixtureThisWeek(g as never) as never }
    if (!fx) continue
    const us = fx.homeId === g.userClubId ? 0 : 1, uid = us === 0 ? fx.homeId : fx.awayId
    const sh = g.clubs[uid].players
    const statsBefore = new Map(Object.values(g.players).map(p => [String(p.id), { tries: p.stats.tries, apps: p.stats.apps }]))
    let rec: SimResult
    try {
      const off8 = (g as unknown as { clubs: Record<string, { tactic: { lineup: number[] } }> }).clubs[uid].tactic.lineup[7], on20 = (g as unknown as { clubs: Record<string, { tactic: { lineup: number[] } }> }).clubs[uid].tactic.lineup[19]
      rec = recOf(ad.play(g, fx, { seed, decisions: [
        { at: { clock: 0 }, decision: { kind: 'penaltyCall', side: us, call: 'posts' } },
        { at: { clock: 1800 }, decision: { kind: 'tactics', side: us, set: { kicking: 70 } } },
        { at: { clock: 3000, dead: true }, decision: { kind: 'substitution', side: us, off: String(off8), on: String(on20) } },
      ] }))
      void sh
    } catch (e) { bad++; first ??= { seed, n: -1 }; why ||= `playManaged threw: ${(e as Error).message.split('\n')[0]}`; continue }
    const f = g.fixtures.find(x => x.id === fx!.id)!
    const P = rec.plays, problems: string[] = []
    if (!f.played) problems.push('fixture not marked played')
    if (f.homeScore !== rec.score[0] || f.awayScore !== rec.score[1]) problems.push(`score stored ${f.homeScore}-${f.awayScore}, watched ${rec.score.join('-')}`)
    if (f.homeTries !== rec.tries[0] || f.awayTries !== rec.tries[1]) problems.push(`tries stored ${f.homeTries}-${f.awayTries}, watched ${rec.tries.join('-')}`)
    const ev = f.events ?? []
    // the game writes stoppage time as 40 and 80 (the old engine's minutes run 1 to 40 and 41 to 80)
    const htAt = P.find(q => q.kind === 'halfTime')?.n ?? Infinity
    const minOf = (p: Play) => Math.min(p.n < htAt ? 40 : 80, Math.floor((p.clock ?? p.t) / 60) + 1)
    const teamOf = (s: 0 | 1) => (s === 0 ? f.homeId : f.awayId)
    // (a SUB event is any commentary line; a substitution is one whose key is comm.sub..., naming the man on)
    const want = (kind: string, type: string, pred: (p: Play) => boolean = () => true, evPred: (e: { k?: string }) => boolean = () => true, who: (p: Play) => string | undefined = p => p.who) => {
      // (a penalty try is stored as a TRY too)
      const ps = P.filter(p => (p.kind === kind || (kind === 'try' && p.kind === 'penaltyTry')) && pred(p)), es = ev.filter(e => e.type === type && evPred(e as { k?: string }))
      if (ps.length !== es.length) { problems.push(`${type}: ${es.length} stored, ${ps.length} watched`); return }
      ps.forEach((p, i) => {
        const e = es[i]
        if (e.teamId !== teamOf(p.side)) problems.push(`${type} ${i + 1}: team ${e.teamId}, watched ${teamOf(p.side)}`)
        const w = who(p)
        if (w && e.playerId != null && String(e.playerId) !== w) problems.push(`${type} ${i + 1}: player ${e.playerId}, watched ${w}`)
        if (Math.abs(e.min - minOf(p)) > 1) problems.push(`${type} ${i + 1}: minute ${e.min}, watched ${minOf(p)}`)
      })
    }
    want('try', 'TRY'); want('yellowCard', 'YC'); want('redCard', 'RC')
    want('substitution', 'SUB', p => p.result === 'made', e => /^comm\.sub/.test(e.k ?? ''), p => p.with?.[0])
    want('injury' as Play['kind'], 'INJ')
    // each try scorer's season tries went up by one per try
    const scored = new Map<string, number>()
    for (const p of P) if (p.kind === 'try' && p.who) scored.set(p.who, (scored.get(p.who) ?? 0) + 1)
    // (only a competitive club match goes on a man's record: match/side.ts onRecord, compId 'fr' is a friendly)
    const onRec = (fx as unknown as { compId: string }).compId !== 'fr'
    if (onRec) for (const [id, n] of scored) { const pl = g.players[Number(id)]; const b = statsBefore.get(id); if (pl && b && g.clubs[(fx as unknown as { homeId: string }).homeId] && pl.stats.tries - b.tries !== n) problems.push(`player ${id} scored ${n} watched, season tries +${pl.stats.tries - b.tries}`) }
    if (problems.length) { bad++; first ??= { seed, n: -1 }; why ||= problems.slice(0, 3).join('; ') }
  }
  return { id: 'W01-stored', ok: bad === 0, failing: bad, first, msg: bad ? `${bad} of ${N} managed matches stored differently from what was watched; first: ${why}` : `${N} managed matches: score, tries, scorers and minutes, cards, substitutions, injuries and season tries all as watched` }
}

/** W02 NOTHING IS PRESET, through the session: a call at 50:00 leaves every play before it the same and changes the match after it */
export async function checkSessionDecisions(ad: Awaited<ReturnType<typeof loadAdapter>>, N = 20): Promise<RateRow> {
  if (!ad.start) return { id: 'W02-session-decisions', ok: false, failing: -1, msg: `not run: ${ad.why || 'no session function (' + WIRING_API.start.join(', ') + ')'}` }
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek } = await import('../src/game/season')
  let broke = 0, changed = 0, n = 0, why = ''
  for (let seed = 1; seed <= N; seed++) {
    const mk = () => { const g = newGame('leicester', 'T', seed); let fx = userFixtureThisWeek(g); for (let i = 0; i < 12 && !fx; i++) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) } return { g, fx } }
    try {
      const a = mk(), b = mk()
      if (!a.fx || !b.fx) continue
      const us = a.fx.homeId === a.g.userClubId ? 0 : 1
      const sa = ad.start(a.g, a.fx, { seed }), sb = ad.start(b.g, b.fx, { seed })
      const run = (x: Session, st: unknown) => { for (let k = 0; k < 300; k++) { x.runUntil!(st); const pd = x.pending; if (pd) x.answer!(pd.options.includes('posts') ? 'posts' : 'corner'); else break } }
      const plays = (x: Session) => [...(x.plays ?? x.sim?.plays ?? [])]
      run(sa, { clock: 3000 }); run(sb, { clock: 3000 })
      const at = plays(sb).length
      const d = { kind: 'tactics', side: us, set: { tempo: 90, kicking: 85 } }
      sb.apply!(d)
      for (let k = 0; k < 300 && !sa.done; k++) run(sa, {})
      for (let k = 0; k < 300 && !sb.done; k++) run(sb, {})
      sa.finish(); sb.finish()
      n++
      if (JSON.stringify(plays(sa).slice(0, at)) !== JSON.stringify(plays(sb).slice(0, at))) broke++
      if (JSON.stringify(plays(sa).slice(at)) !== JSON.stringify(plays(sb).slice(at))) changed++
    } catch (e) { why ||= (e as Error).message.split('\n')[0] }
  }
  if (!n) return { id: 'W02-session-decisions', ok: false, failing: -1, msg: `not run: the session would not play (${why})` }
  return { id: 'W02-session-decisions', ok: broke === 0 && changed >= n * 0.8, failing: broke + (changed >= n * 0.8 ? 0 : 1), msg: `${n} matches through the session: ${broke} changed before the call at 50:00, ${changed} changed after it` }
}

/**
 * W03 THE REST OF THE GAME IS UNTOUCHED. The same game played two ways in its first managed week: the
 * old engine's watched match (simMatch with the match's own dice, as the live screen plays it) then the
 * week; and the new engine's managed match then the week. Every other fixture of the week must be the
 * same, result for result: the new engine must not move the week's dice.
 */
export async function checkRestUntouched(ad: Awaited<ReturnType<typeof loadAdapter>>, seeds = [1, 2, 3, 4]): Promise<RateRow> {
  if (!ad.play) return { id: 'W03-rest-untouched', ok: false, failing: -1, msg: `not run: ${ad.why || 'no play function'}` }
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek, matchRng } = await import('../src/game/season')
  const { simMatch } = await import('../src/game/matchEngine')
  let diff = 0, checked = 0, first: RateRow['first'], why = ''
  for (const seed of seeds) {
    const mk = () => { const g = newGame('leicester', 'T', seed); let fx = userFixtureThisWeek(g); for (let i = 0; i < 12 && !fx; i++) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) } return { g, fx } }
    const A = mk(), B = mk()
    if (!A.fx || !B.fx) continue
    simMatch(A.g, A.fx, matchRng(A.g), true)
    try { ad.play(B.g, B.fx, {}) } catch (e) { why ||= (e as Error).message.split('\n')[0]; continue }
    const week = A.g.week
    processWeekAndAdvance(A.g); processWeekAndAdvance(B.g)
    for (const fa of A.g.fixtures.filter(f => f.week === week && f.id !== A.fx!.id)) {
      const fb = B.g.fixtures.find(f => f.id === fa.id)!
      checked++
      if (fa.homeScore !== fb.homeScore || fa.awayScore !== fb.awayScore || fa.homeTries !== fb.homeTries) { diff++; first ??= { seed, n: fa.id }; why ||= `fixture ${fa.id} (${fa.homeId} v ${fa.awayId}): ${fa.homeScore}-${fa.awayScore} on the old engine's week, ${fb.homeScore}-${fb.awayScore} after the new engine's match` }
    }
  }
  if (!checked) return { id: 'W03-rest-untouched', ok: false, failing: -1, msg: `not run: ${why || 'no week compared'}` }
  return { id: 'W03-rest-untouched', ok: diff === 0, failing: diff, first, msg: diff ? `${diff} of ${checked} other fixtures in the managed week changed; first: ${why}` : `${checked} other fixtures in ${seeds.length} managed weeks identical either way` }
}

/** W04 the switch off leaves the game as main has it: scripts/fingerprint.ts still prints FINGERPRINT PASSED */
export async function checkFingerprint(): Promise<RateRow> {
  try {
    const { execFileSync } = await import('node:child_process')
    const out = execFileSync('npx', ['vite-node', 'scripts/fingerprint.ts'], { encoding: 'utf8', timeout: 240000, stdio: ['ignore', 'pipe', 'pipe'] })
    const ok = /FINGERPRINT PASSED/.test(out)
    return { id: 'W04-fingerprint', ok, failing: ok ? 0 : 1, msg: ok ? 'scripts/fingerprint.ts: FINGERPRINT PASSED' : `scripts/fingerprint.ts: ${out.trim().split('\n').slice(-2).join(' / ')}` }
  } catch (e) { const o = (e as { stdout?: string }).stdout ?? ''; return { id: 'W04-fingerprint', ok: false, failing: 1, msg: `scripts/fingerprint.ts failed: ${(o || (e as Error).message).trim().split('\n').slice(-2).join(' / ')}` } }
}

/** the simulator's entry points: none may be reached by the screen except through the store's session */
const SIM_MAKERS = ['MatchSim', 'simSkeleton', 'simWithDecisions', 'worldFromMatch', 'startSim2', 'replaySim2', 'simMatch', 'standInSession', 'mulberry32', 'matchRng', 'weekRng', 'playMatch']
const SIM_MODULES = /game\/(sim\/(skeleton|fromMatch|world|toResult)|matchEngine|match\/[^'"]+|season\/dice|rng)['"]/

/** code without comments or string bodies, so a word in a note does not count */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``').replace(/'(?:\\.|[^'\\\n])*'/g, "''").replace(/"(?:\\.|[^"\\\n])*"/g, '""')
}
/** the text of `export function name(...) { ... }`, by brace counting */
function fnSpan(src: string, name: string): [number, number] | null {
  const i = src.search(new RegExp(`function ${name}\\b`))
  if (i < 0) return null
  let k = src.indexOf('{', src.indexOf(')', i)), d = 0
  for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return [i, j + 1] }
  return null
}

/**
 * W07: THE SCREEN CANNOT DRIFT FROM THE SESSION (round 9). Proof at the import and source level, then once at run time:
 *  1. Sim2Live.tsx imports nothing that can simulate at value level (skeleton, fromMatch, world, toResult, matchEngine
 *     beyond names and labels, match/*, dice, rng), names none of SIM_MAKERS in its code, never steps an engine itself
 *     (`.runUntil(`, `.step(`), takes from stream.ts only fromSim2, StreamFeed and types, and makes its one session
 *     with fromSim2 on the store's liveMatch.sim2;
 *  2. stream.ts names the simulator only inside standInSession (the tests' stand-in), and nothing in src calls standInSession;
 *  3. every other ui file Sim2Live reaches by import obeys rule 1;
 *  4. the session the screen would be given is the store's: fromSim2 over a startSim2 session hands back the same plays
 *     array, played out through the screen's own calls, and its result is the session's.
 */
export async function checkScreenSession(ad?: Awaited<ReturnType<typeof loadAdapter>>, rootAt?: string): Promise<RateRow> {
  const fs = await import('node:fs'), path = await import('node:path')
  const root = rootAt ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
  const LIVE = 'src/ui/screens/matchday/Sim2Live.tsx', STREAM = 'src/ui/livepitch/stream.ts'
  const read = (f: string) => { try { return fs.readFileSync(path.join(root, f), 'utf8') } catch { return null } }
  const live = read(LIVE), stream = read(STREAM)
  if (live == null || stream == null) return { id: 'W07-screen-session', ok: false, failing: -1, msg: `not run: ${live == null ? LIVE : STREAM} not there` }
  const bad: string[] = []
  const valueImports = (src: string) => [...src.matchAll(/^import\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)].map(m => ({ what: m[1], from: m[2] }))
  const rule1 = (f: string, src: string, allowStream: boolean) => {
    for (const im of valueImports(src)) {
      if (!SIM_MODULES.test(im.from + "'")) continue
      // a value import from a simulator module: allowed only for names that cannot simulate (labels, short names)
      const names = im.what.replace(/[{}]/g, '').split(',').map(x => x.trim()).filter(x => x && !x.startsWith('type '))
      const makers = names.filter(x => SIM_MAKERS.includes(x.split(/\s+as\s+/)[0]))
      if (makers.length || /^\*/.test(im.what)) bad.push(`${f} imports ${makers.join(', ') || im.what} from ${im.from}`)
    }
    const code = codeOnly(src).replace(/^import[\s\S]*?from\s+''\s*$/gm, '')
    for (const w of SIM_MAKERS) if (new RegExp(`\\b${w}\\b`).test(code)) bad.push(`${f} names ${w} in its code`)
    // the engine's step() takes nothing; a step with a time in it is the picture's own motion (LivePitch S.step(1 / 120))
    if (/\.runUntil\s*\(|\.step\s*\(\s*\)/.test(code)) bad.push(`${f} steps an engine itself (.runUntil or .step())`)
    if (/import\s*\(/.test(code)) bad.push(`${f} loads a module at run time (cannot be proved here)`)
    if (!allowStream) for (const im of valueImports(src)) if (/livepitch\/stream$/.test(im.from) && /standInSession/.test(im.what)) bad.push(`${f} imports standInSession`)
  }
  // 1. the screen
  rule1(LIVE, live, false)
  const lc = codeOnly(live)
  const streamNames = valueImports(live).filter(im => /livepitch\/stream$/.test(im.from)).flatMap(im => im.what.replace(/[{}]/g, '').split(',').map(x => x.trim()).filter(Boolean))
  const extra = streamNames.filter(x => !/^type\s/.test(x) && !['fromSim2', 'StreamFeed'].includes(x))
  if (extra.length) bad.push(`${LIVE} takes ${extra.join(', ')} from stream.ts`)
  const made = [...lc.matchAll(/fromSim2\s*\(\s*([A-Za-z_$][\w$]*)\.sim2\b/g)].map(m => m[1])
  const calls = (lc.match(/fromSim2\s*\(/g) ?? []).length
  const fromStore = made.every(v => new RegExp(`\\b${v}\\s*=\\s*useStore\\(\\s*\\w+\\s*=>\\s*\\w+\\.liveMatch\\s*\\)`).test(lc))
  if (calls !== 1 || made.length !== 1 || !fromStore) bad.push(`${LIVE} makes its session ${calls} time(s), ${made.length ? `from ${made.join(', ')}.sim2${fromStore ? '' : ', not the store\'s liveMatch'}` : 'not from liveMatch.sim2'}`)
  // 2. stream.ts: the simulator only inside standInSession
  const sp = fnSpan(stream, 'standInSession')
  const rest = sp ? stream.slice(0, sp[0]) + stream.slice(sp[1]) : stream
  const restCode = codeOnly(rest).replace(/^import[\s\S]*?from\s+''\s*$/gm, '')
  for (const w of SIM_MAKERS.filter(w => w !== 'standInSession')) if (new RegExp(`\\b${w}\\b`).test(restCode)) bad.push(`${STREAM} names ${w} outside standInSession`)
  if (/\bstandInSession\s*\(/.test(restCode)) bad.push(`${STREAM} calls standInSession itself`)
  const fs2 = fnSpan(stream, 'fromSim2')
  if (!fs2) bad.push(`${STREAM} has no fromSim2`)
  const srcFiles: string[] = []
  const walk = (d: string) => { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) srcFiles.push(p) } }
  walk('src')
  const users = srcFiles.filter(f => f !== STREAM && /\bstandInSession\b/.test(codeOnly(read(f) ?? '')))
  if (users.length) bad.push(`standInSession used in ${users.join(', ')}`)
  // 3. every ui file the screen reaches by import (not into game/ or store/, which are not the screen)
  const seen = new Set<string>([LIVE])
  const queue = [LIVE]
  while (queue.length) {
    const f = queue.shift()!, src = read(f) ?? ''
    // (a worker the screen starts, new Worker(new URL('./x.ts', import.meta.url)), is screen code too)
    const refs = [...src.matchAll(/^(?:import|export)\s+(?!type\b)[\s\S]*?\s+from\s+['"](\.[^'"]+)['"]/gm), ...src.matchAll(/new\s+Worker\s*\(\s*new\s+URL\s*\(\s*['"](\.[^'"]+)['"]/g)]
    for (const m of refs) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]))
      if (!base.startsWith('src/ui/')) continue
      const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(x => base + x).find(x => fs.existsSync(path.join(root, x)) && fs.statSync(path.join(root, x)).isFile())
      if (!hit || seen.has(hit)) continue
      seen.add(hit); queue.push(hit)
      if (hit !== STREAM) rule1(hit, read(hit) ?? '', true)
    }
  }
  // 4. at run time: the screen's view of a store session is that session
  let runMsg = 'run-time step not run (no adapter)'
  if (ad?.start) {
    try {
      const S = await import('../src/ui/livepitch/stream' as string) as { fromSim2: (s: unknown, g: unknown) => { plays: Play[]; playOut(): void; result(): SimResult } }
      const { newGame } = await import('../src/game/newgame')
      const { processWeekAndAdvance, userFixtureThisWeek } = await import('../src/game/season')
      const g = newGame('leicester', 'T', 7); let fx = userFixtureThisWeek(g)
      for (let i = 0; i < 12 && !fx; i++) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) }
      if (fx) {
        const sess = ad.start(g, fx, {}) as unknown as { plays: Play[]; sim: { result(): SimResult } }
        const view = S.fromSim2(sess, g)
        const same0 = view.plays === sess.plays
        view.playOut()
        const r = view.result(), r2 = sess.sim.result()
        const same = same0 && view.plays === sess.plays && r.plays.length === r2.plays.length && r.score.join() === r2.score.join()
        if (!same) bad.push('at run time the screen\'s plays are not the store session\'s plays')
        runMsg = `run time: the screen's plays are the session's own array through ${r.plays.length} plays (${r.score.join('-')})`
      } else runMsg = 'run-time step not run (no managed fixture)'
    } catch (e) { runMsg = `run-time step not run (${(e as Error).message.split('\n')[0]})` }
  }
  return { id: 'W07-screen-session', ok: bad.length === 0, failing: bad.length, msg: bad.length ? bad.slice(0, 4).join('; ') : `${seen.size} screen files read: no simulator reached except the store's session through fromSim2; stream.ts names the simulator only in standInSession, used by tests alone; ${runMsg}` }
}

/** Student's t at 97.5% for df degrees of freedom (two-sided 95%) */
const T975 = (df: number) => [NaN, 12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23][df] ?? (df < 20 ? 2.15 : df < 40 ? 2.04 : 1.98)
/**
 * engine against engine, a season's figures. BEYOND THE NOISE (round 9): seasons are paired by seed, so the spread
 * of (new - old) across seasons gives the standard error of the difference; a figure fails only when it is off by
 * more than 10% AND its paired difference is beyond the 95% interval (t on n - 1 degrees of freedom: 4.30 standard
 * errors for three seasons). A 10% move in a count of 8 or 9 a season over three seasons is not evidence.
 */
export function seasonCompare(sums: Record<string, Record<string, number>[]>, hasNew: boolean) {
  const keys = Object.keys(sums.old[0] ?? {})
  const avg = (rows: Record<string, number>[], k: string) => rows.reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length)
  return keys.map(k => {
    const a = avg(sums.old, k), b = hasNew ? avg(sums.new, k) : NaN
    const rel = Math.abs(a) > 1e-9 ? (b - a) / Math.abs(a) : b - a
    const d = (sums.new ?? []).map((r, i) => r[k] - (sums.old[i]?.[k] ?? NaN)).filter(Number.isFinite), dm = d.reduce((x, y) => x + y, 0) / Math.max(1, d.length)
    const se = d.length > 1 ? Math.sqrt(d.reduce((x, y) => x + (y - dm) ** 2, 0) / (d.length - 1)) / Math.sqrt(d.length) : NaN
    const band = Number.isFinite(se) ? T975(d.length - 1) * se : NaN
    const over10 = Number.isFinite(b) && Math.abs(rel) > 0.10, beyond = Number.isFinite(band) ? Math.abs(dm) > band : true
    return { k, old: a, new: b, rel, se, band, over10, flag: over10 && beyond }
  })
}

/** a season's figures for the user's club, to compare engines */
function seasonSummary(g: GameLike, events: { yc: number; rc: number; inj: number }) {
  const club = g.clubs[g.userClubId], ps = club.players.map(id => g.players[id]).filter(Boolean)
  const league = Object.values(g.comps).find(c => c.type === 'league' && c.teamIds.includes(g.userClubId))
  const rows = league ? [...league.table].sort((a, b) => b.pts - a.pts) : []
  const pos = rows.findIndex(r => r.teamId === g.userClubId) + 1
  const mean = (f: (p: GameLike['players'][number]) => number) => ps.reduce((a, p) => a + f(p), 0) / Math.max(1, ps.length)
  return {
    points: rows.find(r => r.teamId === g.userClubId)?.pts ?? NaN, position: pos,
    yellow: events.yc, red: events.rc, injuriesInMatch: events.inj,
    injuredNow: ps.filter(p => p.injury).length, bannedNow: ps.filter(p => p.bans > 0).length,
    condition: mean(p => p.cond), morale: mean(p => p.morale), balance: club.balance,
    apps: ps.reduce((a, p) => a + p.stats.apps, 0), tries: ps.reduce((a, p) => a + p.stats.tries, 0), playerPoints: ps.reduce((a, p) => a + p.stats.points, 0),
  }
}

/**
 * `season [seasons]`: W05 and W06. Whole seasons for Leicester with every HOME match watched: on the
 * old engine (simMatch with the match's dice, as the live screen) and on the new (the adapter), the
 * rest of each week as the game plays it. The season's figures compared engine against engine; a
 * figure whose mean moves more than 10% is flagged. Half way, the game is saved to text and read back
 * (save.ts readImport), and the loaded copy must finish the season exactly as the original. And the
 * managed side's match ratings (player.ratings) by position, old engine against new.
 */
async function seasonDump(argv: string[]) {
  const NS = Number(argv[0] ?? 3)
  const ad = await loadAdapter()
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek, matchRng } = await import('../src/game/season')
  const { simMatch } = await import('../src/game/matchEngine')
  const { readImport } = await import('../src/game/save')
  const out: Record<string, unknown> = { when: new Date().toISOString(), seasons: NS }
  if (!ad.play) { out.notRun = ad.why || 'no play function'; console.log(`season: not run: ${out.notRun}`); }
  const engines: ('old' | 'new')[] = ad.play ? ['old', 'new'] : ['old']
  const sums: Record<string, Record<string, number>[]> = { old: [], new: [] }
  const ratings: Record<string, Record<string, number[]>> = { old: {}, new: {} }
  let saveFail = ''
  for (const eng of engines) for (let s = 1; s <= NS; s++) {
    const g0 = newGame('leicester', 'T', Number(process.env.HARMONY_SEASON_SEED ?? 300) + s) as unknown as GameLike
    const startSeason = g0.season
    const ev = { yc: 0, rc: 0, inj: 0 }
    const playWeek = (g: GameLike, count: boolean) => {
      const fx = userFixtureThisWeek(g as never) as unknown as GameLike['fixtures'][number] | undefined
      if (fx && fx.homeId === g.userClubId && !fx.played) {
        const before = new Map(g.clubs[g.userClubId].players.map(id => [id, JSON.stringify(g.players[id]?.ratings ?? [])]))
        if (eng === 'old') simMatch(g as never, fx as never, matchRng(g as never), true)
        // (the assistant has the bench, as simMatch gives the old engine's side: like for like)
        else ad.play!(g, fx, { assistantBench: true })
        const f = g.fixtures.find(x => x.id === fx.id)!
        if (count) for (const e of f.events ?? []) { if (e.teamId !== g.userClubId) continue; if (e.type === 'YC') ev.yc++; if (e.type === 'RC') ev.rc++; if (e.type === 'INJ') ev.inj++ }
        // only the men who played this match (a rating added by it; the list keeps the last ten)
        if (count) for (const id of g.clubs[g.userClubId].players) { const p = g.players[id]; const n1 = p?.ratings?.length ?? 0; const r = p?.ratings?.[n1 - 1]; if (r != null && p.pos && JSON.stringify(p.ratings) !== before.get(id)) (ratings[eng][p.pos] ??= []).push(r) }
      }
      processWeekAndAdvance(g as never)
    }
    let g = g0, half = false
    for (let w = 0; w < 60 && g.season === startSeason; w++) {
      // the league is over when every league fixture of the user's club is played: measure then, before the rollover
      const lg = Object.values(g.comps).find(c => c.type === 'league' && c.teamIds.includes(g.userClubId))
      const left = g.fixtures.filter(f => !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId) && lg && g.comps[(f as unknown as { compId: string }).compId] === lg).length
      if (!left) break
      if (!half && w === 15 && s === 1) {
        half = true
        // SAVE AND LOAD: the text the game saves, read back (save.ts readImport), must play the next three
        // weeks exactly as an untouched copy of the same game does
        try {
          const loaded = readImport(JSON.stringify(g)) as unknown as GameLike | null
          if (!loaded) saveFail ||= `${eng} engine, season ${s}, week ${g.week}: readImport refused the saved game`
          else {
            const same = structuredClone(g)
            const from = g.week
            for (let k = 0; k < 3; k++) { playWeek(loaded, false); playWeek(same, false) }
            const res = (x: GameLike) => JSON.stringify(x.fixtures.filter(f => f.week >= from && f.week < from + 3).map(f => [f.id, f.played, f.homeScore, f.awayScore, f.homeTries, f.awayTries]))
            if (res(loaded) !== res(same)) saveFail ||= `${eng} engine, season ${s}: after a save and load at week ${from} the next three weeks play differently from the game that was not saved`
          }
        } catch (e) { saveFail ||= `${eng} engine: save or load threw: ${(e as Error).message.split('\n')[0]}` }
      }
      playWeek(g, true)
    }
    sums[eng].push(seasonSummary(g, ev))
  }
  const cmp = seasonCompare(sums, engines.includes('new'))
  out.compare = cmp; out.saveFail = saveFail || null; out.perSeason = sums
  const posStats = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); return { n: xs.length, mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)) } }
  out.ratings = Object.fromEntries(Object.keys(ratings.old).map(pos => [pos, { old: posStats(ratings.old[pos] ?? []), new: posStats(ratings.new[pos] ?? []) }]))
  console.log(`season: ${NS} seasons per engine (${engines.join(' and ')}), Leicester, every home match watched`)
  console.log('| Figure | Old engine | New engine | Change | Noise (95% band of the paired difference) | Flag |\n|---|---|---|---|---|---|')
  for (const c of cmp) console.log(`| ${c.k} | ${fmt(c.old, 2)} | ${fmt(c.new, 2)} | ${Number.isFinite(c.rel) ? `${c.rel >= 0 ? '+' : ''}${fmt(100 * c.rel, 0)}%` : '-'} | ${fmt(c.band, 2)} | ${c.flag ? 'OFF: over 10% and beyond the noise' : c.over10 ? 'over 10%, within the noise' : ''} |`)
  console.log(`save and load: ${saveFail || 'the saved text reads back and plays on'}`)
  console.log('| Position | Old: ratings n, mean, sd | New: n, mean, sd |\n|---|---|---|')
  for (const [pos, r] of Object.entries(out.ratings as Record<string, { old: { n: number; mean: number; sd: number }; new: { n: number; mean: number; sd: number } }>)) console.log(`| ${pos} | ${r.old.n}, ${fmt(r.old.mean, 2)}, ${fmt(r.old.sd, 2)} | ${r.new.n}, ${fmt(r.new.mean, 2)}, ${fmt(r.new.sd, 2)} |`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync('scripts/tmp/harmony-season.json', JSON.stringify(out, null, 1))
}

// ------------------------------------------------------------ the run

/** the record-only check over a set of seeds of the plain skeleton (used by the test) */
export function skeletonMatches(seeds: number[]): Match[] {
  return seeds.map(seed => ({ label: `seed ${seed}`, seed, res: simSkeleton({ seed }) }))
}

/**
 * A BALANCED SET (lead's ruling, round 6): one round of league fixtures from several leagues, none of
 * them the user's, so both benches are run by the game and no club appears more than once a round.
 * Built from new games for Leicester, Toulouse, Leinster and Northampton (as scripts/paritycheck.ts),
 * one fixture per league in turn, in the first week each game has league fixtures.
 */
async function balancedFixtures(want: number, perGame = 15): Promise<RealFixture[]> {
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance } = await import('../src/game/season')
  const { mulberry32 } = await import('../src/game/rng')
  const { worldFromMatch } = await import('../src/game/sim/fromMatch')
  const out: RealFixture[] = []
  const clubs = ['leicester', 'toulouse', 'leinster', 'northampton']
  for (let gi = 0; out.length < want && gi < 40; gi++) {
    const club = clubs[gi % clubs.length], seed = 100 + gi
    const g = newGame(club, 'T', seed)
    type Fx = (typeof g.fixtures)[number]
    let pool: Fx[] = []
    for (let w = 0; w < 12 && !pool.length; w++) {
      pool = g.fixtures.filter(f => f.week === g.week && !f.played && g.comps[f.compId]?.type === 'league' && f.homeId !== g.userClubId && f.awayId !== g.userClubId)
      if (!pool.length) processWeekAndAdvance(g)
    }
    const byComp = new Map<string, Fx[]>()
    for (const f of pool) byComp.set(f.compId, [...(byComp.get(f.compId) ?? []), f])
    const picked: Fx[] = []
    for (let round = 0; picked.length < Math.min(perGame, want - out.length) && round < 20; round++) {
      let any = false
      for (const list of byComp.values()) { const f = list[round]; if (f && picked.length < Math.min(perGame, want - out.length)) { picked.push(f); any = true } }
      if (!any) break
    }
    for (const fx of picked) {
      const mseed = seed * 1000 + fx.id
      const build = () => worldFromMatch(g, fx, mulberry32(mseed))
      const { world, home, away } = build()
      const xv: [Set<string>, Set<string>] = [new Set(home.players.filter(p => p.shirt <= 15).map(p => p.id)), new Set(away.players.filter(p => p.shirt <= 15).map(p => p.id))]
      const bench: [Set<string>, Set<string>] = [new Set(home.players.filter(p => p.shirt > 15).map(p => p.id)), new Set(away.players.filter(p => p.shirt > 15).map(p => p.id))]
      const names = new Map<string, string>()
      for (const p of [...home.players, ...away.players]) names.set(p.id, p.name)
      const match: Match = { label: `${fx.compId} ${home.name} v ${away.name} (${club}/${seed})`, seed: mseed, res: simSkeleton({ seed: mseed, world }), xv, bench, names, teams: [home.name, away.name], sides: [{ players: home.players }, { players: away.players }] }
      out.push({ seed: mseed, build, userSide: 0, match })
    }
  }
  return out
}

async function realMatches(seeds: number[]): Promise<Match[]> {
  return (await realFixtures(seeds)).map(f => f.match)
}

export async function realFixtures(seeds: number[]): Promise<RealFixture[]> {
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek } = await import('../src/game/season')
  const { mulberry32 } = await import('../src/game/rng')
  const { worldFromMatch } = await import('../src/game/sim/fromMatch')
  const out: RealFixture[] = []
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
    const match: Match = { label: `real ${seed} (${home.name} v ${away.name})`, seed, res: simSkeleton({ seed, world }), xv, bench, names, teams: [home.name, away.name], sides: [{ players: home.players }, { players: away.players }] }
    const fxd = fx
    // the same world again, fresh (a decision changes the world it is made in); worldFromMatch never touches g
    const build = () => worldFromMatch(g, fxd, mulberry32(seed))
    out.push({ seed, build, userSide: home.teamId === g.userClubId ? 0 : 1, match })
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
      `${p.clock != null ? ` clock ${p.clock}` : ''}${p.pre ? ` pre ${p.pre}` : ''}${p.cause ? ` cause ${p.cause}` : ''}${p.offender ? ` offender ${nm(p.offender)}` : ''}${p.until != null ? ` until ${p.until}` : ''}${p.land ? ` land ${p.land.join(',')}` : ''}${p.passes ? ` passes ${p.passes}` : ''}` +
      `${p.who ? ` who ${nm(p.who)}` : ''}${p.vs?.length ? ` vs ${p.vs.map(nm).join(',')}` : ''}${p.with?.length ? ` with ${p.with.map(nm).join(',')}` : ''}`)
  }
  try {
    const C = await loadComm() as unknown as { commentate: (r: SimResult, n: unknown) => LineLike[]; render: (l: LineLike) => string }
    const ls = C.commentate(m.res, { teams: m.teams ?? ['Home', 'Away'], player: (id: string) => m.names?.get(id) ?? '' })
    for (const l of ls) if (l.n >= from && l.n <= to) console.log(`  LINE #${l.n} ${l.key} side ${l.side}: ${C.render(l)}`)
    for (const f of checkLines(m, ls, C.render)) if (f.n >= from && f.n <= to) console.log(`FAIL ${f.rule} #${f.n}: ${f.msg}`)
  } catch (e) { console.log(`(no commentary: ${(e as Error).message.split('\n')[0]})`) }
  const fs = checkRecord(m).filter(f => f.n >= from && f.n <= to)
  for (const f of fs) console.log(`FAIL ${f.rule} #${f.n}: ${f.msg}`)
}

/** `moments`: for the owner's recording list, the first play of each kind worth watching in real fixtures 1 to 8 */
async function moments() {
  const fs = await realFixtures([1, 2, 3, 4, 5, 6, 7, 8])
  const want: [string, (p: Play, P: Play[]) => boolean][] = [
    ['knock-on in contact', p => p.kind === 'knockOn' && p.result === 'inContact'],
    ['knock-on under a high ball', p => p.kind === 'knockOn' && p.result === 'underTheHighBall'],
    ['wide carry, 2+ passes, 15 m+ across', (p, P) => p.kind === 'carry' && (p.passes ?? 0) >= 2 && Math.abs(p.y - P[p.n - 1].y) >= 15],
    ['carry stopped by two tacklers', p => p.kind === 'carry' && (p.vs?.length ?? 0) >= 2 && p.result === 'held'],
    ['line break hauled down', p => p.kind === 'lineBreak' && p.result === 'hauledDown'],
    ['forward pass', p => p.kind === 'forwardPass'],
    ['interception', p => p.kind === 'carry' && p.result === 'intercepted'],
    ['scrum after a knock-on', (p, P) => p.kind === 'scrum' && P[p.n - 1]?.kind === 'knockOn'],
    ['kick-off after a score', (p, P) => p.kind === 'kickoff' && p.n > 0 && P[p.n - 1]?.kind !== 'halfTime'],
    ['22 drop-out', p => p.kind === 'dropout22'],
    ['goal-line drop-out', p => p.kind === 'goalLineDropout'],
    ['lineout', p => p.kind === 'lineout' && p.result === 'won'],
    ['try', p => p.kind === 'try'],
    ['yellow card', p => p.kind === 'yellowCard'],
    ['half-time and second-half kick-off', p => p.kind === 'halfTime'],
  ]
  for (const [what, f] of want) {
    let found = ''
    for (const fx of fs) {
      const P = fx.match.res.plays
      const p = P.find(q => f(q, P))
      if (p) { found = `real ${fx.seed} (${fx.match.teams?.join(' v ')}) play ${p.n}, minute ${Math.floor((p.clock ?? p.t) / 60) + 1}: ${p.kind}/${p.result}${p.who ? ` ${fx.match.names?.get(p.who) ?? ''}` : ''}`; break }
    }
    console.log(`${what}: ${found || 'none in fixtures 1-8'}`)
  }
}

/** `pace <real seed> <from> <to>`: each play's time on screen, speed, and the slowest and fastest frame */
async function paceDump(argv: string[]) {
  const seed = Number(argv[0] ?? 1), from = Number(argv[1] ?? 0), to = Number(argv[2] ?? 9999)
  const m = (await realMatches([seed]))[0]
  const A = await import('../src/ui/livepitch/fromRecord') as unknown as Pitch
  const bk = A.bakeOf(m.res.plays, m.sides), tl = A.timeline(bk), sch = A.schedule(m.res.plays, m.sides)
  for (const x of sch.slice(from, to + 1)) {
    const g = bk.segs[x.n], p = m.res.plays[x.n]
    let lo = Infinity, hi = 0
    for (let f = Math.round(g.a0 * A.FPS); f < Math.round(g.a1 * A.FPS); f++) { lo = Math.min(lo, tl.rate[f]); hi = Math.max(hi, tl.rate[f]) }
    console.log(`#${x.n} ${p.kind}/${p.result} side ${p.side} ball ${p.ball} clock ${p.clock} on screen ${fmt(x.start)} s for ${fmt(x.dur, 2)} s, ${fmt(x.speed)}x (frames ${fmt(lo)}x to ${fmt(hi)}x)${isKeyPlay(m.res.plays, x.n) ? ' KEY' : ''}${x.fade ? ' FADE' : ''}`)
  }
}

/** `eyes`: ten moments for the owner to watch, with the preview link at the second on screen they start */
async function eyes() {
  const fs = await realFixtures(Array.from({ length: 20 }, (_, i) => i + 1))
  const at75 = (P: Play[]) => P.find(x => (x.clock ?? x.t) >= 4500 && P.some(h => h.kind === 'halfTime' && h.n < x.n))
  type Want = [string, (P: Play[]) => number | undefined, string]
  const want: Want[] = [
    ['a try build-up at clip pace', P => { const t = P.find(p => p.kind === 'try' && p.n - possessionStart(P, p.n) >= 8); return t ? possessionStart(P, t.n) : undefined }, 'the whole move, from its first phase, at the 1.9.16 clips\' pace; only a ball lying at a ruck wound on; a ticker line for every phase'],
    ['a line break run down by the cover', P => { const p = P.find(q => q.kind === 'lineBreak' && (q.result === 'hauledDown' || q.result === 'heldShort') && q.vs?.length); return p ? Math.max(0, p.n - 1) : undefined }, 'the break at clip pace, the cover chasing across and the named man making the tackle'],
    ['a maul', P => { const p = P.find(q => q.kind === 'maul'); return p ? Math.max(0, p.n - 1) : undefined }, 'the lineout, the maul forming round the jumper, driven, and the ball out or the drive over'],
    ['a switch or loop', P => { const p = P.find(q => q.kind === 'carry' && (q.shape === 'switch' || q.shape === 'loop' || q.move === 'mv_switch' || q.move === 'mv_loop')); return p ? Math.max(0, p.n - 1) : undefined }, 'the runner changing angle (switch) or the passer going round (loop), and the ticker naming it'],
    ['a close finish', P => { const q = at75(P); return q && Math.abs(q.score[0] - q.score[1]) <= 7 ? q.n : undefined }, 'from 75:00 slower, at about 2x, to the whistle'],
    ['a card period', P => P.find(p => p.kind === 'yellowCard')?.n, 'the card flashes, 14 men for ten minutes, the return said and seen'],
    ['an interception', P => { const p = P.find(q => q.kind === 'carry' && q.result === 'intercepted'); return p ? Math.max(0, p.n - 1) : undefined }, 'the pass, the interceptor, the ball turning round with no jump, the flash'],
    ['a dead ball', P => P.find(p => p.kind === 'kick' && p.result === 'dead' && P[p.n + 1]?.result === 'ranDead')?.n, 'the kick goes over the try line and the dead-ball line before the 22 drop-out'],
    ['the ticker in fast forward', P => { for (let i = 20; i < P.length - 12; i++) if (P.slice(i, i + 12).every(p => !isKeyPlay(P, p.n) && (p.kind === 'carry' || p.kind === 'ruck'))) return i; return undefined }, 'lines flicking through, each about the play on screen or the one before'],
    ['a flash: a penalty goal', P => { const p = P.find(q => q.kind === 'penaltyGoal' && q.good); return p ? Math.max(0, p.n - 1) : undefined }, 'the flash with the kick, up long enough to read, the ball between the posts over the bar'],
  ]
  const fs4242 = await realFixtures([4242])
  fs.unshift(...fs4242)
  const A = await import('../src/ui/livepitch/fromRecord') as unknown as Pitch
  const used = new Map<number, ReturnType<Pitch['schedule']>>()
  for (const [what, f, look] of want) {
    let line = `${what}: none in fixtures 1 to 20`
    for (const fx of fs) {
      const P = fx.match.res.plays, n = f(P)
      if (n == null) continue
      if (!used.has(fx.seed)) used.set(fx.seed, A.schedule(P, fx.match.sides))
      const sch = used.get(fx.seed)!, from = Math.max(0, Math.floor(sch[n].start) - 2), p = P[n]
      line = `${what}: rec=${fx.seed} (${fx.match.teams?.join(' v ')}), minute ${Math.floor((p.clock ?? p.t) / 60) + 1}, play ${n}, /lp-record.html?rec=${fx.seed}&from=${from} : ${look}`
      break
    }
    console.log(line)
  }
}

/** `words <real seed> <from s> <to s>`: the commentary as thin() leaves it on the pitch's schedule, with the second on screen */
async function wordsDump(argv: string[]) {
  const seed = Number(argv[0] ?? 1), from = Number(argv[1] ?? 0), to = Number(argv[2] ?? 9999)
  const m = (await realMatches([seed]))[0]
  const A = await import('../src/ui/livepitch/fromRecord') as unknown as Pitch
  const C = await loadComm() as unknown as { commentate: (r: SimResult, n: unknown) => LineLike[]; render: (l: LineLike) => string; thin?: (l: LineLike[], s: unknown) => LineLike[] }
  const sch = A.schedule(m.res.plays, m.sides)
  const raw = C.commentate(m.res, { teams: m.teams ?? ['Home', 'Away'], player: (id: string) => m.names?.get(id) ?? '' })
  const ls = C.thin ? C.thin(raw, sch) : raw
  const ts = lineTimes(ls, sch)
  ls.forEach((l, i) => { if (ts[i] >= from && ts[i] <= to) console.log(`${fmt(ts[i])} s  #${l.n} ${m.res.plays[l.n].kind}/${m.res.plays[l.n].result} ${fmt(sch[l.n].speed)}x  [${l.key} p${(l as unknown as { priority?: number }).priority}] ${C.render(l)}`) })
}

/** `levers [pairs]`: every manager lever on fixture 1's pairing over many paired seeds */
async function leversDump(argv: string[]) {
  const N = Number(argv[0] ?? 40)
  const f = (await realFixtures([1]))[0]
  const rows = await checkLevers(f, N)
  console.log(`levers, ${f.match.teams?.join(' v ')}, user side ${f.userSide}, ${N} paired seeds (2000 to ${2000 + N - 1})`)
  console.log('| Lever | From | Measure | Without | With | Change a match | Matches changed after | Paired t | Wanted | Changed before | Verdict |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) console.log(`| ${r.lever} | ${r.from} | ${r.measure} | ${fmt(r.base, 2)} | ${fmt(r.with, 2)} | ${r.diff >= 0 ? '+' : ''}${fmt(r.diff, 2)} | ${r.moved}/${r.pairs} | ${fmt(r.t, 1)} | ${r.want} | ${r.prefixBroken} | ${r.verdict}${r.note ? ` (${r.note})` : ''} |`)
}

/** `realism [fixtures]`: the realism table over that many real fixtures (seeds 1 to N) */
async function realismDump(argv: string[]) {
  const N = Number(argv[0] ?? 120)
  const fsx = await balancedFixtures(N)
  const ms = fsx.map(f => f.match)
  const r = realism(ourRates(ms), TARGETS)
  const comps = new Map<string, number>(); for (const m of ms) { const c = m.label.split(' ')[0]; comps.set(c, (comps.get(c) ?? 0) + 1) }
  console.log(`realism over ${ms.length} league fixtures, none managed (one round of each league in new games; ${[...comps.entries()].map(([c, n]) => `${c} ${n}`).join(', ')})`)
  console.log('| Figure | Ours | Real | Verdict (band widened 20%) | Source |\n|---|---|---|---|---|')
  for (const x of r.rows) console.log(x)
  console.log(`\n${r.misses.length} out of line:\n` + r.misses.map(x => `- ${x}`).join('\n'))
}

/**
 * `clubs [pairings] [seeds]`: do clubs read as different? For each of several pairings, many match seeds;
 * for each style figure, the share of its spread across all those matches that is explained by which
 * pairing it is (an intraclass correlation: 0 means the clubs make no difference, 1 means only the clubs do).
 */
async function clubsDump(argv: string[]) {
  const NP = Number(argv[0] ?? 8), NS = Number(argv[1] ?? 12)
  const fsx = await balancedFixtures(NP, 2)
  const feats: Record<string, (r: SimResult) => number> = {
    'kicks from hand': r => r.plays.filter(p => p.kind === 'kick' && p.kick !== 'restart' && p.result !== 'penaltyToTouch').length,
    'mauls': r => r.plays.filter(p => p.kind === 'maul').length,
    'offloads': r => r.plays.filter(p => p.kind === 'offload').length,
    'line breaks': r => r.plays.filter(p => p.kind === 'lineBreak').length,
    'carries': r => r.plays.filter(p => p.kind === 'carry').length,
    'passes a carry': r => { const c = r.plays.filter(p => p.kind === 'carry'); return c.length ? c.reduce((a, p) => a + (p.passes ?? 0), 0) / c.length : 0 },
    'tries': r => r.tries[0] + r.tries[1],
    'penalties': r => r.plays.filter(p => p.kind === 'penalty' || p.kind === 'freeKick').length,
    'home margin': r => r.score[0] - r.score[1],
  }
  const vals: Record<string, number[][]> = Object.fromEntries(Object.keys(feats).map(k => [k, []]))
  for (const f of fsx) {
    const rows: Record<string, number[]> = Object.fromEntries(Object.keys(feats).map(k => [k, []]))
    for (let i = 0; i < NS; i++) { const r = simSkeleton({ seed: 5000 + i, world: f.build().world }); for (const k in feats) rows[k].push(feats[k](r)) }
    for (const k in feats) vals[k].push(rows[k])
  }
  console.log(`clubs: ${fsx.length} pairings x ${NS} match seeds: ${fsx.map(f => f.match.teams?.join(' v ')).join('; ')}`)
  console.log('| Figure | Share of the spread explained by the pairing (ICC) | Range of pairing means |\n|---|---|---|')
  for (const k in feats) {
    const g = vals[k], all = g.flat(), mean = all.reduce((a, b) => a + b, 0) / all.length
    const gm = g.map(x => x.reduce((a, b) => a + b, 0) / x.length)
    const msb = g.reduce((a, x, i) => a + x.length * (gm[i] - mean) ** 2, 0) / (g.length - 1)
    const msw = g.reduce((a, x, i) => a + x.reduce((b, v) => b + (v - gm[i]) ** 2, 0), 0) / (all.length - g.length)
    const icc = (msb - msw) / (msb + (NS - 1) * msw)
    console.log(`| ${k} | ${fmt(Math.max(0, icc), 2)} | ${fmt(Math.min(...gm), 1)} to ${fmt(Math.max(...gm), 1)} |`)
  }
}

/** `spot [pairs]`: three rows of docs/match-sim-manager-levers.md re-measured independently on its own fixture (4242) */
async function spotDump(argv: string[]) {
  const N = Number(argv[0] ?? 400)
  const f = (await realFixtures([4242]))[0]
  const { MatchSim } = await import('../src/game/sim/skeleton')
  const us = f.userSide, them = other(us)
  type Dec = Parameters<InstanceType<typeof MatchSim>['apply']>[0]
  const run = (seed: number, at: { clock: number; dead?: boolean } | null, decs: (b: ReturnType<RealFixture['build']>) => Dec[]) => {
    const b = f.build(), m = new MatchSim({ seed, world: b.world })
    const ds = decs(b)
    if (at) m.runUntil(at)
    const n0 = m.plays.length
    for (const d of ds) m.apply(d)
    for (let g = 0; g < 400 && !m.done; g++) { m.runUntil(); const pd = m.pending; if (pd) m.answer(pd.options.includes('posts') ? 'posts' : 'corner') }
    return { r: m.result(), n0 }
  }
  const sh = (b: ReturnType<RealFixture['build']>) => (us === 0 ? b.home : b.away).players
  const scrumScore = (r: SimResult, from: number) => r.plays.slice(from).reduce((a, p) => a + (p.kind !== 'scrum' ? 0 : (p.side === us && ['won', 'penaltyWon'].includes(p.result)) || (p.side === them && ['penaltyLost', 'againstTheHead'].includes(p.result)) ? 1 : (p.side === us && ['penaltyLost', 'againstTheHead'].includes(p.result)) || (p.side === them && p.result === 'penaltyWon') ? -1 : 0), 0)
  const rows: { row: string; doc: string; a: number[]; b: number[]; unit: string }[] = []
  const pairT = (a: number[], b: number[]) => { const d = a.map((x, i) => b[i] - x), m = d.reduce((s, x) => s + x, 0) / d.length, sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (d.length - 1)); return { m, t: sd ? m / (sd / Math.sqrt(d.length)) : 0 } }
  const R1 = { row: 'Bench front row on at 55:00 v none: own scrum results after 55:00 (won and penalties won, minus lost)', doc: '1.63 to 1.93', a: [] as number[], b: [] as number[], unit: '' }
  const R2 = { row: 'Half-time talk: praise v criticise: own second-half points', doc: '14.7 v 14.7 (dice)', a: [] as number[], b: [] as number[], unit: '' }
  const R3 = { row: 'Aggression 20 v 80 from kick-off: own penalties conceded', doc: '5.4 to 5.7 (cards 0.34 to 0.63)', a: [] as number[], b: [] as number[], unit: '' }
  const R3c = { row: 'Aggression 20 v 80 from kick-off: own cards', doc: '0.34 to 0.63', a: [] as number[], b: [] as number[], unit: '' }
  for (let i = 0; i < N; i++) {
    const seed = 9000 + i
    { const x = run(seed, { clock: 3300, dead: true }, () => []), y = run(seed, { clock: 3300, dead: true }, b => { const p = sh(b); return ([[1, 17], [2, 16], [3, 18]] as const).map(([o, n]) => ({ kind: 'substitution' as const, side: us, off: p.find(q => q.shirt === o)!.id, on: p.find(q => q.shirt === n)!.id })) })
      R1.a.push(scrumScore(x.r, x.n0)); R1.b.push(scrumScore(y.r, y.n0)) }
    { const at = { clock: 2400, dead: true }
      const x = run(seed, at, () => [{ kind: 'talk', side: us, tone: 'praise' }]), y = run(seed, at, () => [{ kind: 'talk', side: us, tone: 'criticise' }])
      const sp = (z: { r: SimResult; n0: number }) => z.r.score[us] - (z.r.plays[z.n0 - 1]?.score[us] ?? 0)
      R2.a.push(sp(x)); R2.b.push(sp(y)) }
    { const x = run(seed, null, () => [{ kind: 'tactics', side: us, set: { aggression: 20 } }]), y = run(seed, null, () => [{ kind: 'tactics', side: us, set: { aggression: 80 } }])
      const pc = (r: SimResult) => r.plays.filter(p => (p.kind === 'penalty' || p.kind === 'freeKick') && p.side === them).length
      const cc = (r: SimResult) => r.plays.filter(p => (p.kind === 'yellowCard' || p.kind === 'redCard') && p.side === us).length
      R3.a.push(pc(x.r)); R3.b.push(pc(y.r)); R3c.a.push(cc(x.r)); R3c.b.push(cc(y.r)) }
  }
  rows.push(R1, R2, R3, R3c)
  const out: { row: string; doc: string; ours: string; t: number; agrees: boolean }[] = []
  console.log(`spot check of docs/match-sim-manager-levers.md, ${f.match.teams?.join(' v ')} (seed 4242), ${N} paired match seeds (9000 to ${9000 + N - 1})`)
  console.log('| Row | The doc says | We measure | Paired t |\n|---|---|---|---|')
  for (const r of rows) {
    const ma = r.a.reduce((s, x) => s + x, 0) / N, mb = r.b.reduce((s, x) => s + x, 0) / N, { t } = pairT(r.a, r.b)
    console.log(`| ${r.row} | ${r.doc} | ${fmt(ma, 2)} to ${fmt(mb, 2)} | ${fmt(t, 1)} |`)
    out.push({ row: r.row, doc: r.doc, ours: `${fmt(ma, 2)} to ${fmt(mb, 2)}`, t, agrees: true })
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync('scripts/tmp/harmony-spot.json', JSON.stringify({ when: new Date().toISOString(), pairs: N, rows: out }, null, 1))
}

/** `wiring [matches]`: W01 to W04 only */
async function wiringDump(argv: string[]) {
  const N = Number(argv[0] ?? 20)
  const ad = await loadAdapter()
  for (const row of [await checkStored(ad, N), await checkSessionDecisions(ad, Math.min(N, 20)), await checkRestUntouched(ad), await checkFingerprint(), await checkScreenSession(ad)])
    console.log(`${row.id.padEnd(24)}${row.failing < 0 ? 'not run' : row.ok ? 'PASS' : `FAIL (${row.failing})`}  ${row.msg}${row.first ? ` [seed ${row.first.seed}]` : ''}`)
}

/**
 * CARDS ON THE MANAGED SIDE (round 9): every managed match of new games for four clubs, each played on BOTH engines
 * from the same state (two copies; the old engine as the watched path, simMatch with matchRng and detail, the new
 * through the session with the assistant holding the bench, as in `season`). Yellow and red cards per match for
 * the managed side and the opponent, from the game's stored events; on the new engine also the penalties each
 * side conceded, the card's cause (the yellowCard play's result), and each side's card price (cardRisk) at kick-off. Paired by match: a paired t
 * on (new - old) for each side. `cards NG` plays NG seeds per club (default 4), until the league is done.
 */
async function cardsDump(argv: string[]) {
  const NG = Number(argv[0] ?? 4)
  const ad = await loadAdapter()
  if (!ad.start) { console.log(`cards: not run: ${ad.why}`); return }
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek, matchRng } = await import('../src/game/season')
  const { simMatch } = await import('../src/game/matchEngine')
  type Row = { club: string; home: boolean; old: [number, number, number, number]; neu: [number, number, number, number]; pens: [number, number]; risk: [number, number]; causes: string[]; oppCauses: string[]; ownPen: number; oppPen: number }
  const rows: Row[] = []
  const t0 = Date.now()
  for (const club of ['leicester', 'toulouse', 'leinster', 'northampton']) for (let s = 1; s <= NG; s++) {
    const g = newGame(club, 'T', 900 + s) as unknown as GameLike
    const startSeason = g.season
    for (let w = 0; w < 60 && g.season === startSeason; w++) {
      const fx = userFixtureThisWeek(g as never) as unknown as (GameLike['fixtures'][number] & { compId: string }) | undefined
      if (fx && !fx.played) {
        const uid = g.userClubId, us: 0 | 1 = fx.homeId === uid ? 0 : 1
        const cards = (x: GameLike) => {
          const f = x.fixtures.find(q => q.id === fx.id)!, ev = f.events ?? []
          const c = (team: boolean, t: string) => ev.filter(e => (e.teamId === uid) === team && e.type === t).length
          return [c(true, 'YC'), c(false, 'YC'), c(true, 'RC'), c(false, 'RC')] as [number, number, number, number]
        }
        const A = structuredClone(g), B = structuredClone(g)
        simMatch(A as never, A.fixtures.find(q => q.id === fx.id) as never, matchRng(A as never), true)
        const fb = B.fixtures.find(q => q.id === fx.id)!
        const ss = ad.start(B, fb, { assistantBench: true }) as Session & { ctx?: { home: { cardRisk?: number }; away: { cardRisk?: number } } }
        const risk: [number, number] = [ss.ctx?.[us === 0 ? 'home' : 'away']?.cardRisk ?? NaN, ss.ctx?.[us === 0 ? 'away' : 'home']?.cardRisk ?? NaN]
        const run = (st: unknown) => { for (let k = 0; k < 300; k++) { ss.runUntil!(st); const pd = ss.pending; if (pd) ss.answer!(pd.options.includes('posts') ? 'posts' : 'corner'); else break } }
        for (let k = 0; k < 300 && !ss.done; k++) run({})
        const P = [...(ss.plays ?? [])] as Play[]
        ss.finish!()
        // a penalty play's side is the side it was given to: conceded by the other
        const pens: [number, number] = [P.filter(p => p.kind === 'penalty' && p.side !== us).length, P.filter(p => p.kind === 'penalty' && p.side === us).length]
        const yc = P.filter(p => p.kind === 'yellowCard')
        rows.push({ club, home: us === 0, old: cards(A), neu: cards(B), pens, risk, causes: yc.filter(p => p.side === us).map(p => p.result ?? '?'), oppCauses: yc.filter(p => p.side !== us).map(p => p.result ?? '?'), ownPen: 0, oppPen: 0 })
        if (rows.length % 50 === 0) console.error(`${rows.length} matches, ${Math.round((Date.now() - t0) / 1000)} s`)
      }
      const lg = Object.values(g.comps).find(c => c.type === 'league' && c.teamIds.includes(g.userClubId))
      const left = g.fixtures.filter(f => !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId) && lg && g.comps[(f as unknown as { compId: string }).compId] === lg).length
      if (!left) break
      processWeekAndAdvance(g as never)
    }
  }
  const N = rows.length
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
  const paired = (d: number[]) => { const m = mean(d), sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, d.length - 1)); return { m, t: m / (sd / Math.sqrt(d.length)) } }
  console.log(`cards: ${N} managed matches, each on both engines (${NG} new games for each of 4 clubs, seeds 901+)`)
  console.log('| Per match | Old engine | New engine | New - old (paired t) |')
  console.log('|---|---|---|---|')
  const line = (lab: string, i: number) => { const o = rows.map(r => r.old[i]), nn = rows.map(r => r.neu[i]), p = paired(rows.map(r => r.neu[i] - r.old[i])); console.log(`| ${lab} | ${fmt(mean(o), 3)} | ${fmt(mean(nn), 3)} | ${p.m >= 0 ? '+' : ''}${fmt(p.m, 3)} (t ${fmt(p.t, 1)}) |`) }
  line('yellow cards, managed side', 0); line('yellow cards, opponent', 1); line('red cards, managed side', 2); line('red cards, opponent', 3)
  for (const h of [true, false]) { const R = rows.filter(r => r.home === h); console.log(`| yellow, managed side ${h ? 'at home' : 'away'} (${R.length}) | ${fmt(mean(R.map(r => r.old[0])), 3)} | ${fmt(mean(R.map(r => r.neu[0])), 3)} | |`) }
  for (const c of ['leicester', 'toulouse', 'leinster', 'northampton']) { const R = rows.filter(r => r.club === c); console.log(`| yellow, managed side, ${c} (${R.length}) | ${fmt(mean(R.map(r => r.old[0])), 3)} | ${fmt(mean(R.map(r => r.neu[0])), 3)} | |`) }
  console.log(`new engine: penalties conceded per match, managed ${fmt(mean(rows.map(r => r.pens[0])), 2)}, opponent ${fmt(mean(rows.map(r => r.pens[1])), 2)}; yellow cards per penalty conceded, managed ${fmt(mean(rows.map(r => r.neu[0])) / mean(rows.map(r => r.pens[0])), 3)}, opponent ${fmt(mean(rows.map(r => r.neu[1])) / mean(rows.map(r => r.pens[1])), 3)}`)
  console.log(`card price at kick-off (cardRisk, 0.012 plain): managed ${fmt(mean(rows.map(r => r.risk[0])), 4)}, opponent ${fmt(mean(rows.map(r => r.risk[1])), 4)}`)
  const tally = (a: string[]) => { const m = new Map<string, number>(); for (const x of a) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') }
  console.log(`new engine yellow-card causes, managed: ${tally(rows.flatMap(r => r.causes))}`)
  console.log(`new engine yellow-card causes, opponent: ${tally(rows.flatMap(r => r.oppCauses))}`)
  const fs = await import('node:fs')
  fs.writeFileSync('scripts/tmp/harmony-cards.json', JSON.stringify({ when: new Date().toISOString(), rows }, null, 1))
}

/**
 * THE OVERNIGHT ENGINE AUDIT (27 Nov, engine frozen at fe485f15), independent of skeleton.ts's own sums:
 * every figure here is counted off the record. `overnight NF NS`: NF balanced fixtures (AI v AI, the
 * referee fixed by fixture), NS match seeds each; then the other coach on and off over paired seeds on
 * managed fixtures. Writes scripts/tmp/harmony-overnight.json.
 */
export interface AuditFault { what: string; label: string; n: number; msg: string }
export function auditMatch(res: SimResult, label: string, managed: 0 | 1 | null): { faults: AuditFault[]; m: Record<string, unknown> } {
  const P = res.plays, faults: AuditFault[] = []
  const bad = (what: string, n: number, msg: string) => faults.push({ what, label, n, msg })
  const ref = (res as SimResult & { referee?: { name: string; style: string; warnAt: number } }).referee
  const cond = (res as SimResult & { conditions?: { weather: string; wind: { strength: number; toward: 0 | 1 }; hot?: boolean } }).conditions
  const htN = P.find(p => p.kind === 'halfTime')?.n ?? Infinity
  const other = (s: 0 | 1) => (s === 0 ? 1 : 0) as 0 | 1
  // PENALTIES: kind penalty or freeKick; side is the side it was given to
  const conceded: [number, number] = [0, 0], pens: [number, number] = [0, 0]
  const warned: [number, number] = [0, 0]
  for (const p of P) {
    if (p.kind !== 'penalty' && p.kind !== 'freeKick') continue
    const off = other(p.side); pens[off]++
    if (p.kind === 'penalty') conceded[off]++
    const w = (p as Play & { warning?: boolean }).warning
    if (w) {
      warned[off]++
      if (p.kind !== 'penalty') bad('ref-warning', p.n, 'a warning on a free kick')
      if (ref && conceded[off] !== ref.warnAt - 1) bad('ref-warning', p.n, `warning at the side's penalty ${conceded[off]}; his limit is ${ref.warnAt}, so it should come at ${ref.warnAt - 1}`)
    } else if (ref && p.kind === 'penalty' && conceded[off] === ref.warnAt - 1) bad('ref-warning', p.n, `side ${off} reached ${conceded[off]} (one short of ${ref.warnAt}) with no warning`)
  }
  // CARDS
  const yc: [number, number] = [0, 0], red: [number, number] = [0, 0], second: [number, number] = [0, 0]
  for (const p of P) { if (p.kind === 'yellowCard') yc[p.side]++; if (p.kind === 'redCard') { if (p.result === 'secondYellow') second[p.side]++; else red[p.side]++ } }
  // men short at time t, from the record: binned (until), sent off, hurt and not yet replaced
  const shortAt = (s: 0 | 1, t: number, n: number) => {
    let k = 0
    for (const q of P) {
      if (q.n >= n) break
      if (q.side !== s) continue
      if (q.kind === 'yellowCard' && q.t <= t && (q.until ?? 0) > t) k++
      if (q.kind === 'redCard') k++
    }
    return k
  }
  // THE OTHER COACH: every recorded change has a true reason at that moment (the state after the play before it)
  const coachSeen: Record<string, number> = {}
  for (const p of P) {
    const c = (p as Play & { coach?: { side: 0 | 1; mode: string; reason: string } }).coach
    if (!c) continue
    coachSeen[c.mode] = (coachSeen[c.mode] ?? 0) + 1
    if (managed != null && c.side === managed) bad('coach-managed', p.n, `a coach change (${c.mode}) for the managed side`)
    const prev = P[p.n - 1] ?? p, sc = prev.score, lead = sc[c.side] - sc[other(c.side)]
    const clk = p.clock ?? p.t, clk0 = prev.clock ?? prev.t
    const whyMap: Record<string, string> = { exploitShort: 'manUp', chase: 'chasing', protect: 'protecting', wet: 'wetBall', targetScrum: 'scrumOnTop', frontRow: 'scrumBeaten' }
    if (whyMap[c.mode] !== c.reason) bad('coach-reason', p.n, `mode ${c.mode} with reason ${c.reason}`)
    let ok = true, why = ''
    if (c.mode === 'exploitShort') {
      // binned or sent off from the record; a man hurt and waiting for cover is not in the record's bins, so allowed when an injury play is within the last minute
      const up = shortAt(other(c.side), p.t, p.n) > shortAt(c.side, p.t, p.n) || shortAt(other(c.side), prev.t, p.n) > shortAt(c.side, prev.t, p.n)
      // hurt and off, waiting for the replacement: an injury play, until the substitution that takes him off
      const waiting = (s: 0 | 1) => { const w = new Set<string>(); for (const q of P) { if (q.n >= p.n) break; if (q.kind === 'injury' && q.side === s && q.who) w.add(q.who); if (q.kind === 'substitution' && q.result === 'made' && q.who) w.delete(q.who) } return w.size }
      const hurt = shortAt(other(c.side), p.t, p.n) + waiting(other(c.side)) > shortAt(c.side, p.t, p.n) + waiting(c.side)
      ok = up || hurt; why = `the other side is not a man down (bins and reds ${shortAt(other(c.side), p.t, p.n)} against ${shortAt(c.side, p.t, p.n)})`
    } else if (c.mode === 'chase') { ok = (clk >= 3300 && lead < -7) || (clk >= 4200 && lead < 0); why = `lead ${lead} at ${Math.floor(clk / 60)}:${String(Math.round(clk % 60)).padStart(2, '0')}` }
    else if (c.mode === 'protect') { ok = clk >= 3900 && lead >= 1 && lead <= 14; why = `lead ${lead} at ${Math.floor(clk / 60)} min` }
    else if (c.mode === 'wet') { ok = cond?.weather === 'Rain' || cond?.weather === 'Snow'; why = `weather ${cond?.weather}` }
    else if (c.mode === 'targetScrum' || c.mode === 'frontRow') {
      const sp: [number, number] = [0, 0]
      for (const q of P) { if (q.n >= p.n) break; if (q.kind === 'scrum' && q.result === 'penaltyWon') sp[q.side]++; if (q.kind === 'scrum' && q.result === 'penaltyLost') sp[other(q.side)]++ }
      // (scrum penalties as the engine counts them: a scrum's penaltyWon or penaltyLost; a free kick at the scrum is not one)
      const my = sp[c.side], th = sp[other(c.side)]
      if (c.mode === 'targetScrum') {
        const d = c.side === 0 ? 100 - p.x : p.x
        ok = my >= 3 && my > th && (p as Play & { call?: string }).call === 'scrum' && d > 5 && d <= 15 || (my >= 3 && my > th && p.kind === 'scrum')
        why = `scrum penalties ${my} against ${th}, ${Math.round(d)} m out, call ${(p as Play & { call?: string }).call ?? 'none'} on ${p.kind}`
      } else { ok = Math.max(clk, clk0) >= 1800 - 60 && th - my >= 2; why = `scrum penalties won ${my}, given away ${th}, at ${Math.floor(clk / 60)} min` }
    }
    if (!ok) bad(`coach-${c.mode}`, p.n, why)
  }
  // THE WIND: the tag on every kick, goal kick and conversion is what the wind and the half say
  const windRows: { kind: string; kick?: string; wind: number; len?: number; far?: number; good?: boolean }[] = []
  let windWrong = 0
  for (const p of P) {
    if (!(p.kind === 'kick' || p.kind === 'penaltyGoal' || p.kind === 'conversion') || p.result === 'chargedDown') continue
    const tag = (p as Play & { wind?: string }).wind
    const w = cond?.wind ? cond.wind.strength * (cond.wind.toward === 1 ? 1 : -1) * (p.side === 0 ? 1 : -1) * (p.n > htN ? -1 : 1) : 0
    const want = w >= 0.5 ? 'with' : w <= -0.5 ? 'into' : undefined
    // (a penalty kicked to touch: the engine gives it no wind, in length or on the record: counted apart)
    if (p.kind === 'kick' && p.result === 'penaltyToTouch') { if (want) bad('wind-penaltyTouch', p.n, `a penalty kicked to touch ${want} a wind of ${cond?.wind.strength}: no wind on its length or its record`) ; continue }
    if (tag !== want) { windWrong++; if (windWrong <= 50) bad('wind-tag', p.n, `${p.kind} ${p.kick ?? ''}/${p.result} by side ${p.side} ${p.n > htN ? 'second' : 'first'} half: tagged ${tag ?? 'none'}, the wind says ${want ?? 'none'} (strength ${cond?.wind.strength}, toward ${cond?.wind.toward})`) }
    const toLine = p.side === 0 ? 100 - p.x : p.x
    if (p.kind === 'kick' && p.gain != null) windRows.push({ kind: 'kick', kick: p.kick, wind: w, len: p.gain })
    if (p.kind === 'penaltyGoal') windRows.push({ kind: 'goal', wind: w, far: Math.hypot(toLine, Math.abs(p.y - 35)), good: p.good })
  }
  // SET PIECES: options, the 5 m law, the pushover
  const lo: Record<string, { n: number; stolen: number; near: number }> = {}
  const scrumOpt: Record<string, number> = {}
  let pushovers = 0
  for (const p of P) {
    const opt = (p as Play & { option?: string }).option
    if (p.kind === 'lineout' && (p.result === 'won' || p.result === 'stolen')) {
      if (!opt) bad('lineout-option', p.n, 'a lineout with no call')
      const o = (lo[opt ?? '?'] ??= { n: 0, stolen: 0, near: 0 }); o.n++; if (p.result === 'stolen') o.stolen++
      const d = p.side === 0 ? 100 - p.x : p.x; if (d < 25) o.near++
    }
    if (p.kind === 'scrum') {
      const d = p.side === 0 ? 100 - p.x : p.x, dOwn = p.side === 0 ? p.x : 100 - p.x
      if (d < 5 - 0.01 || dOwn < 5 - 0.01) bad('scrum-5m', p.n, `a scrum ${Math.min(d, dOwn).toFixed(1)} m from a goal line (Law 19: at least 5 m)`)
      if (opt) {
        scrumOpt[opt] = (scrumOpt[opt] ?? 0) + 1
        if (d > 7.01) bad('scrum-option', p.n, `scrum option ${opt} ${d.toFixed(1)} m out (only within 7 m of their line)`)
      }
      if (p.result === 'pushover') {
        pushovers++
        const t = P[p.n + 1]
        if (!t || t.kind !== 'try' || t.result !== 'pushover' || t.side !== p.side) bad('pushover', p.n, `pushover not followed by its try (${t?.kind}/${t?.result})`)
        if (opt !== 'shove') bad('pushover', p.n, `pushover from option ${opt}`)
      }
    }
    if (p.kind === 'kickoff') {
      const by = p.side, prev = P[p.n - 1] ?? p, lead = prev.score[by] - prev.score[other(by)], clk = p.clock ?? p.t
      // (the call is made before the restart's own seconds go on the clock: judged at either clock, the play before's or the kick's)
      const wantAt = (c: number) => { const chasing = (c >= 3600 && lead <= -8) || (c >= 4200 && lead < 0), protecting = c >= 3600 && lead > 0 && lead <= 20; return chasing ? 'short' : protecting ? 'long' : 'contestable' }
      const want = wantAt(clk), want0 = wantAt(prev.clock ?? prev.t)
      if (opt && opt !== want && opt !== want0) bad('kickoff-option', p.n, `kick-off ${opt}; lead ${lead} at ${Math.floor(clk / 60)} min says ${want}`)
      if (!opt) bad('kickoff-option', p.n, 'a kick-off with no option')
    }
  }
  const lastP = P[P.length - 1]
  return { faults, m: { label, ref: ref?.name, style: ref?.style, warnAt: ref?.warnAt, pens: pens[0] + pens[1], pensSide: pens, conceded, warned, yc, red, second, coach: coachSeen, wind: windRows, windStrength: cond?.wind.strength ?? 0, weather: cond?.weather, hot: !!cond?.hot, lo, scrumOpt, pushovers, points: lastP.score[0] + lastP.score[1], tries: res.tries[0] + res.tries[1], home: lastP.score[0] > lastP.score[1] ? 1 : lastP.score[0] === lastP.score[1] ? 0.5 : 0, margin: lastP.score[0] - lastP.score[1] } }
}

async function overnightDump(argv: string[]) {
  const NF = Number(argv[0] ?? 120), NS = Number(argv[1] ?? 4)
  const { MatchSim, K } = await import('../src/game/sim/skeleton') as unknown as { MatchSim: new (o: { seed: number; world: World }) => { runUntil(s?: unknown): { result(): SimResult } }; K: Record<string, unknown> }
  const t0 = Date.now()
  const fx = await balancedFixtures(NF)
  const rows: Record<string, unknown>[] = [], faults: AuditFault[] = []
  for (const f of fx) for (let k = 0; k < NS; k++) {
    const seed = f.seed + k * 7919
    const res = new MatchSim({ seed, world: f.build().world }).runUntil().result()
    const a = auditMatch(res, `${f.match.label} seed ${seed}`, null)
    rows.push(a.m); faults.push(...a.faults)
  }
  console.error(`balanced ${rows.length} matches, ${Math.round((Date.now() - t0) / 1000)} s`)
  const num = (k: string) => rows.map(r => r[k] as number)
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
  const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] }
  const out: Record<string, unknown> = { when: new Date().toISOString(), matches: rows.length }
  console.log(`overnight audit: ${fx.length} balanced fixtures x ${NS} seeds = ${rows.length} matches`)
  // referees
  const pens = num('pens')
  console.log(`penalties and free kicks a match: mean ${fmt(mean(pens), 2)}, 5th percentile ${pct(pens, 0.05)}, 95th ${pct(pens, 0.95)}, min ${pct(pens, 0)}, max ${pct(pens, 1)} (owner: mean 11 to 12, spread inside 6 to 17)`)
  const byRef = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) byRef.set(String(r.ref), [...(byRef.get(String(r.ref)) ?? []), r])
  console.log('| Referee | style | warnAt | matches | penalties a match | yellows a match | second yellows | warnings a match |\n|---|---|---|---|---|---|---|---|')
  for (const [name, R] of [...byRef].sort((a, b) => mean(a[1].map(r => r.pens as number)) - mean(b[1].map(r => r.pens as number))))
    console.log(`| ${name} | ${R[0].style} | ${R[0].warnAt} | ${R.length} | ${fmt(mean(R.map(r => r.pens as number)), 2)} | ${fmt(mean(R.map(r => (r.yc as number[])[0] + (r.yc as number[])[1])), 2)} | ${R.reduce((a, r) => a + (r.second as number[])[0] + (r.second as number[])[1], 0)} | ${fmt(mean(R.map(r => (r.warned as number[])[0] + (r.warned as number[])[1])), 2)} |`)
  for (const st of ['strict', 'fair', 'lenient']) { const R = rows.filter(r => r.style === st); if (R.length) console.log(`  ${st}: ${R.length} matches, ${fmt(mean(R.map(r => r.pens as number)), 2)} penalties, ${fmt(mean(R.map(r => (r.yc as number[])[0] + (r.yc as number[])[1])), 3)} yellows a match`) }
  // the warning and the card after it
  // cards
  const ycAll = mean(rows.map(r => (r.yc as number[])[0] + (r.yc as number[])[1])), sy = mean(rows.map(r => (r.second as number[])[0] + (r.second as number[])[1])), rd = mean(rows.map(r => (r.red as number[])[0] + (r.red as number[])[1]))
  console.log(`cards a match (both sides): yellow ${fmt(ycAll, 3)}, second yellow ${fmt(sy, 4)} (old engine 0.007), straight red ${fmt(rd, 4)} (old engine 0.038, the owner's rate)`)
  // the bands
  console.log(`bands: points ${fmt(mean(num('points')), 2)} (48 to 53), tries ${fmt(mean(num('tries')), 2)} (6.0 to 6.6), home wins ${fmt(100 * mean(num('home')), 1)}% (51 to 57), penalties ${fmt(mean(pens), 2)} (11 to 12)`)
  // coach
  const cm: Record<string, number> = {}
  for (const r of rows) for (const [k, v] of Object.entries(r.coach as Record<string, number>)) cm[k] = (cm[k] ?? 0) + v
  console.log(`the other coach's changes over ${rows.length} matches: ${Object.entries(cm).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  // wind
  const W = rows.flatMap(r => r.wind as { kind: string; kick?: string; wind: number; len?: number; far?: number; good?: boolean }[])
  for (const kick of ['clearance', 'long', 'touch', 'box', 'bomb', 'chip', 'grubber', 'restart']) {
    const K2 = W.filter(w => w.kind === 'kick' && w.kick === kick && w.len != null)
    if (K2.length < 30) continue
    const wi = K2.filter(w => w.wind >= 0.5), into = K2.filter(w => w.wind <= -0.5), calm = K2.filter(w => Math.abs(w.wind) < 0.2)
    console.log(`  ${kick} kicks: with the wind ${fmt(mean(wi.map(w => w.len!)), 1)} m (${wi.length}), into it ${fmt(mean(into.map(w => w.len!)), 1)} m (${into.length}), calm ${fmt(mean(calm.map(w => w.len!)), 1)} m (${calm.length})`)
  }
  const G = W.filter(w => w.kind === 'goal')
  for (const [lo2, hi2] of [[0, 30], [30, 40], [40, 99]]) {
    const g = G.filter(w => w.far! >= lo2 && w.far! < hi2), wi = g.filter(w => w.wind >= 0.5), into = g.filter(w => w.wind <= -0.5)
    console.log(`  penalty goals ${lo2} to ${hi2} m: with the wind ${fmt(100 * mean(wi.map(w => (w.good ? 1 : 0))), 0)}% (${wi.length}), into it ${fmt(100 * mean(into.map(w => (w.good ? 1 : 0))), 0)}% (${into.length}), all ${fmt(100 * mean(g.map(w => (w.good ? 1 : 0))), 0)}% (${g.length})`)
  }
  console.log(`  hot days: ${rows.filter(r => r.hot).length} of ${rows.length}; weather: ${['Dry', 'Damp', 'Rain', 'Wind', 'Snow'].map(w => `${w} ${rows.filter(r => r.weather === w).length}`).join(', ')}`)
  // set pieces
  const lo: Record<string, { n: number; stolen: number; near: number }> = {}
  for (const r of rows) for (const [k, v] of Object.entries(r.lo as Record<string, { n: number; stolen: number; near: number }>)) { const o = (lo[k] ??= { n: 0, stolen: 0, near: 0 }); o.n += v.n; o.stolen += v.stolen; o.near += v.near }
  console.log(`lineout calls: ${Object.entries(lo).map(([k, v]) => `${k} ${v.n} (stolen ${fmt(100 * v.stolen / v.n, 1)}%, ${fmt(100 * v.near / v.n, 0)}% inside their 25)`).join('; ')}`)
  const so: Record<string, number> = {}
  for (const r of rows) for (const [k, v] of Object.entries(r.scrumOpt as Record<string, number>)) so[k] = (so[k] ?? 0) + v
  console.log(`attacking scrums within 7 m: ${Object.entries(so).map(([k, v]) => `${k} ${v}`).join(', ')}; pushover tries ${rows.reduce((a, r) => a + (r.pushovers as number), 0)} (${fmt(rows.reduce((a, r) => a + (r.pushovers as number), 0) / rows.length, 3)} a match)`)
  // faults
  const byWhat = new Map<string, AuditFault[]>()
  for (const f of faults) byWhat.set(f.what, [...(byWhat.get(f.what) ?? []), f])
  console.log(`faults: ${faults.length}`)
  for (const [w, F] of byWhat) console.log(`  ${w}: ${F.length}; first ${F[0].label} play ${F[0].n}: ${F[0].msg}`)
  out.rows = rows; out.faults = faults
  const fsm = await import('node:fs')
  fsm.writeFileSync('scripts/tmp/harmony-overnight.json', JSON.stringify(out))
  // THE OTHER COACH ON AND OFF: managed fixtures (only the side nobody manages has a coach), paired seeds
  const NR = Number(argv[2] ?? 10), NP = Number(argv[3] ?? 30)
  const reals = await realFixtures(Array.from({ length: NR }, (_, i) => i + 1))
  const d: number[] = [], winOn: number[] = [], winOff: number[] = []
  let changedBefore = 0
  const cf: AuditFault[] = []
  for (const f of reals) for (let k = 0; k < NP; k++) {
    const seed = f.seed * 1000 + k
    K.COACH_ON = true
    const on = new MatchSim({ seed, world: f.build().world }).runUntil().result()
    cf.push(...auditMatch(on, `${f.match.label} seed ${seed}`, f.userSide).faults.filter(x => x.what.startsWith('coach')))
    K.COACH_ON = false
    const off = new MatchSim({ seed, world: f.build().world }).runUntil().result()
    K.COACH_ON = true
    const opp = (f.userSide === 0 ? 1 : 0) as 0 | 1
    const m = (r: SimResult) => { const s = r.plays[r.plays.length - 1].score; return s[opp] - s[f.userSide] }
    const w = (r: SimResult) => { const x = m(r); return x > 0 ? 1 : x === 0 ? 0.5 : 0 }
    d.push(m(on) - m(off)); winOn.push(w(on)); winOff.push(w(off))
    const firstCoach = on.plays.findIndex(p => (p as Play & { coach?: unknown }).coach)
    if (firstCoach > 0 && JSON.stringify(on.plays.slice(0, firstCoach)) !== JSON.stringify(off.plays.slice(0, firstCoach))) changedBefore++
  }
  const dm = mean(d), sd = Math.sqrt(d.reduce((a, x) => a + (x - dm) ** 2, 0) / Math.max(1, d.length - 1))
  const wd = winOn.map((x, i) => x - winOff[i]), wm = mean(wd), wsd = Math.sqrt(wd.reduce((a, x) => a + (x - wm) ** 2, 0) / Math.max(1, wd.length - 1))
  console.log(`the other coach on and off, ${d.length} paired matches on ${reals.length} managed fixtures (only the unmanaged side has a coach): its win rate ${fmt(100 * mean(winOff), 1)}% off, ${fmt(100 * mean(winOn), 1)}% on (${wm >= 0 ? '+' : ''}${fmt(100 * wm, 1)} points, 95% interval +-${fmt(196 * wsd / Math.sqrt(wd.length), 1)}); its margin ${dm >= 0 ? '+' : ''}${fmt(dm, 2)} a match (t ${fmt(dm / (sd / Math.sqrt(d.length)), 1)}); matches whose plays before the first coach change differ: ${changedBefore}`)
  console.log(`coach faults on managed fixtures: ${cf.length}${cf.length ? `; first ${cf[0].label} play ${cf[0].n}: ${cf[0].msg}` : ''}`)
  out.coachOnOff = { n: d.length, winOff: mean(winOff), winOn: mean(winOn), winDiff: wm, winCI: 1.96 * wsd / Math.sqrt(wd.length), margin: dm, t: dm / (sd / Math.sqrt(d.length)), changedBefore, faults: cf }
  fsm.writeFileSync('scripts/tmp/harmony-overnight.json', JSON.stringify(out))
  console.error(`done, ${Math.round((Date.now() - t0) / 1000)} s`)
}

/**
 * THE COMMENTARY'S FACTS AGAINST THE GAME (overnight, 27 Nov). `ctxaudit N`: N managed matches at points through
 * the season (four clubs), each through the session as the screen plays it, the context built with COMMENTARY's
 * contextFromGame at kick-off, the lines from commentate() with it (HARMONY_COMM may point at a copy with switches on).
 * Every pre-match, story, crowd, co-commentator and full-time line is checked against the game state worked out here
 * on its own (form, table, team news, referee, weather, next fixture) or, after full time, against the table the
 * game itself now holds; and the whole match through checkLines (C01 to C09) with the team sheet.
 */
async function ctxAuditDump(argv: string[]) {
  const N = Number(argv[0] ?? 24)
  const ad = await loadAdapter()
  if (!ad.start) { console.log(`ctxaudit: not run: ${ad.why}`); return }
  const { newGame } = await import('../src/game/newgame')
  const { processWeekAndAdvance, userFixtureThisWeek } = await import('../src/game/season')
  const { contextFromGame } = await import('../src/game/sim/context')
  const { sortTable } = await import('../src/game/schedule')
  const { refFor } = await import('../src/game/match/referee')
  const { careerRows } = await import('../src/game/model/players')
  const C = await loadComm() as { commentate: (r: SimResult, n: unknown, c?: unknown) => LineLike[]; render: (l: LineLike) => string; SUMMARY?: Set<string> }
  // (the commentary's own list of lines about the match so far, as the main run reads it)
  if (C.SUMMARY) for (const b of C.SUMMARY) SUMMARY_BASES.add(b)
  type G = Parameters<typeof processWeekAndAdvance>[0]
  type Fx = G['fixtures'][number]
  const faults: { label: string; key: string; n: number; msg: string }[] = []
  const seen = new Map<string, number>()
  const ORD = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen']
  const posOf = (k: unknown) => ORD.indexOf(String(k ?? '').replace(/^sim\.ord/, '').replace(/1$/, ''))
  const fmtN = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  let matches = 0, checkFails: Fail[] = []
  const t0 = Date.now()
  for (let i = 0; i < N; i++) {
    const club = ['leicester', 'toulouse', 'leinster', 'northampton'][i % 4]
    const g = newGame(club, 'T', 500 + i) as G
    for (let w = 0; w < 2 + (i * 5) % 18; w++) processWeekAndAdvance(g)
    let fx = userFixtureThisWeek(g) as Fx | undefined
    for (let w = 0; w < 12 && (!fx || fx.played); w++) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) as Fx | undefined }
    if (!fx) continue
    const label = `${club} seed ${500 + i} week ${g.week} (${g.clubs[fx.homeId]?.name} v ${g.clubs[fx.awayId]?.name})`
    const comp = g.comps[fx.compId]
    const before = comp?.table ? sortTable(comp.table.map(r => ({ ...r }))) : []
    // (each man's appearances, tries and career before the match: the game adds this match's at its own time)
    const snap = new Map(Object.values(g.players).map(pl => [pl.id, { apps: pl.stats.apps, tries: pl.stats.tries, injWeeks: pl.injLog?.[pl.injLog.length - 1]?.weeks, career: careerRows(pl).reduce((a, c) => a + c.apps, 0) + (pl.hist?.apps ?? 0) + pl.stats.apps }]))
    const ss = ad.start(g, fx, { assistantBench: true }) as Session & { kickoffTeams: [(number | null)[], (number | null)[]]; motm?: string; us?: 0 | 1 | null }
    const ctx = contextFromGame(g as never, fx as never, ss.kickoffTeams as never) as Record<string, unknown> & { men?: Record<string, { side: 0 | 1; shirt: number; apps: number; tries: number; careerApps: number; careerTries: number; careerPoints: number; kickMade?: number; kickAtt?: number }>; news?: { kind: string; side: 0 | 1; id?: string; name?: string; starts?: boolean; n?: number; why?: string }[]; attendance?: number }
    const run = (st: unknown) => { for (let k = 0; k < 300; k++) { ss.runUntil!(st); const pd = ss.pending; if (pd) ss.answer!(pd.options.includes('posts') ? 'posts' : 'corner'); else break } }
    for (let k = 0; k < 300 && !ss.done; k++) run({})
    ss.finish!()
    matches++
    const res = { ...ss.sim!.result(), motm: ss.motm } as SimResult & { motm?: string; managed?: 0 | 1; referee?: { name: string } ; conditions?: { weather: string } }
    const P = res.plays, ids2: [string, string] = [fx.homeId, fx.awayId]
    const names = new Map<string, string>()
    for (const s of [0, 1] as const) for (const id of ss.kickoffTeams[s]) if (id != null && g.players[id]) names.set(String(id), g.players[id].name)
    const byName = new Map([...names].map(([id, nm]) => [nm, id]))
    const lines = C.commentate(res, { teams: [g.clubs[fx.homeId].name, g.clubs[fx.awayId].name], player: (id: string) => names.get(id) ?? '' }, ctx)
    const fxAfter = g.fixtures.find(f => f.id === fx!.id)!
    // the game's own points for this match: the week played on (applyToTable), each club's points before and after;
    // the table the line means is the one before kick-off with only this match's points added (sortTable)
    const ptsBefore = new Map(before.map(r => [r.teamId, r.pts]))
    const fxClone = structuredClone(g); processWeekAndAdvance(fxClone)
    const compAfter = fxClone.comps[fx.compId]
    const gained = new Map([fx.homeId, fx.awayId].map(cid => [cid, (compAfter?.table.find(r => r.teamId === cid)?.pts ?? NaN) - (ptsBefore.get(cid) ?? NaN)]))
    const after = sortTable(before.map(r => { const gp = gained.get(r.teamId); if (gp == null) return { ...r }; const us = r.teamId === fx!.homeId ? 0 : 1, sc = ss.sim!.result().plays.at(-1)!.score; return { ...r, pts: r.pts + gp, p: r.p + 1, w: r.w + (sc[us] > sc[1 - us] ? 1 : 0), pf: r.pf + sc[us], pa: r.pa + sc[1 - us], tf: r.tf + ss.sim!.result().tries[us] } }))
    // the team sheet as a Match, for C01 to C09 and the named whistle lines
    const xv = [0, 1].map(s => new Set(ss.kickoffTeams[s].slice(0, 15).filter(x => x != null).map(String))) as [Set<string>, Set<string>]
    const bench = [0, 1].map(s => new Set(ss.kickoffTeams[s].slice(15, 23).filter(x => x != null).map(String))) as [Set<string>, Set<string>]
    const mt: Match = { label, seed: 500 + i, res, xv, bench, names, ctx: ctx as ClaimCtx, teams: [g.clubs[fx.homeId].name, g.clubs[fx.awayId].name] }
    checkFails = checkFails.concat(checkLines(mt, lines, C.render).map(f => ({ ...f, msg: `${label}: ${f.msg}` })))
    // ---- the truth, worked out here
    const formOf = (cid: string) => g.fixtures.filter(f => f.played && f.id !== fx!.id && f.week < fx!.week && (f.homeId === cid || f.awayId === cid) && f.compId !== 'fr').sort((a, b) => a.week - b.week).slice(-5)
      .map(f => { const us = f.homeId === cid ? f.homeScore : f.awayScore, th = f.homeId === cid ? f.awayScore : f.homeScore; return f.decider ? (f.decider.winner === cid ? 'W' : 'L') : us > th ? 'W' : us < th ? 'L' : 'D' }).join('')
    const posBefore = (cid: string) => before.findIndex(r => r.teamId === cid) + 1, posAfter = (cid: string) => after.findIndex(r => r.teamId === cid) + 1
    const tries: [number, number] = [0, 0]; for (const p of P) if (p.kind === 'try' || p.kind === 'penaltyTry') tries[p.side]++
    const fin = P[P.length - 1].score
    const bad = (l: LineLike, msg: string) => faults.push({ label, key: l.key, n: l.n, msg })
    const pid = (nm: unknown) => byName.get(String(nm ?? ''))
    // the co-commentator's spells: a new one starts after each play where he may speak (a score, or the drinks near 20
    // and 60 minutes, at least seven minutes since the last), and after half-time, whether or not a line is said
    const spellStart = new Map<number, number>()
    { let at = 0, drinks = 0, start = 0
      for (const q of P) {
        const clock = q.clock ?? q.t
        spellStart.set(q.n, start)
        const scored = q.kind === 'conversion' || q.kind === 'penaltyGoal' || q.kind === 'dropGoal'
        const dn = (q.kind === 'scrum' || q.kind === 'lineout' || q.kind === 'penalty') && ((drinks === 0 && clock >= 1200) || (drinks === 1 && clock >= 3600))
        if (q.kind === 'halfTime') { at = clock; start = q.n + 1 }
        else if ((scored || dn) && clock - at >= 420) { if (dn) drinks++; at = clock; start = q.n + 1 }
      } }
    for (const l of lines) {
      const base = l.key.replace(/^sim\./, '').replace(/\d+$/, ''), pr = (l.params ?? {}) as Record<string, unknown>, p = P[l.n]
      seen.set(base, (seen.get(base) ?? 0) + 1)
      const n = (k: string) => Number(pr[k])
      switch (base) {
        case 'preFull': case 'preCrowd': {
          const venue = fx.venue?.name ?? g.clubs[fx.homeId].stadium, cap = fx.venue?.capacity ?? g.clubs[fx.homeId].capacity
          if (pr.venue !== venue) bad(l, `venue ${pr.venue}; the game has ${venue}`)
          if (pr.att !== fmtN(fxAfter.att ?? -1)) bad(l, `crowd ${pr.att}; the fixture has ${fxAfter.att}`)
          if (base === 'preFull' && !((fxAfter.att ?? 0) >= 0.95 * cap)) bad(l, `says full: ${fxAfter.att} of ${cap}`)
          break
        }
        case 'preRound': if (pr.comp !== comp?.name || n('round') !== fx.round + 1 || n('rounds') !== comp?.rounds) bad(l, `round ${pr.round} of ${pr.rounds} in ${pr.comp}; the game: ${fx.round + 1} of ${comp?.rounds} in ${comp?.name}`); break
        case 'introTable': if (n('hp') !== posBefore(fx.homeId) || n('ap') !== posBefore(fx.awayId)) bad(l, `positions ${pr.hp} and ${pr.ap}; the table before: ${posBefore(fx.homeId)} and ${posBefore(fx.awayId)}`); break
        case 'preTop': { const r = before[0], s2 = before[1]; if (r?.teamId !== ids2[l.side!] || (pr.gap != null && n('gap') !== r.pts - s2.pts)) bad(l, `top by ${pr.gap}; the table: ${r?.teamId} ${r?.pts}, then ${s2?.pts}`); break }
        case 'preBottom': { const L = before.length, r = before[L - 1]; if (r?.teamId !== ids2[l.side!] || (pr.gap != null && n('gap') !== before[L - 2].pts - r.pts)) bad(l, `bottom by ${pr.gap}; the table says otherwise`); break }
        case 'preClose': { const a = before.find(r => r.teamId === fx!.homeId), b = before.find(r => r.teamId === fx!.awayId); if (!a || !b || Math.abs(a.pts - b.pts) > 3 || (pr.gap != null && n('gap') !== Math.abs(a.pts - b.pts))) bad(l, `close, gap ${pr.gap}; the table: ${a?.pts} and ${b?.pts}`); break }
        case 'preRunIn': { const left = (comp?.rounds ?? 0) - (fx.round + 1) + 1, pos = posBefore(ids2[l.side!]); if (n('left') !== left || posOf(pr.pos_k) !== pos) bad(l, `run-in: ${pr.left} left, position ${posOf(pr.pos_k)}; the game: ${left}, ${pos}`); break }
        case 'formAllWon': case 'formAllLost': case 'formSome': {
          const f = formOf(ids2[l.side!]), w = [...f].filter(x => x === 'W').length
          const kind = w === f.length ? 'formAllWon' : w === 0 && !f.includes('D') ? 'formAllLost' : 'formSome'
          if (n('n') !== f.length || n('w') !== w || kind !== base) bad(l, `form ${pr.w} of ${pr.n} (${base}); the results: ${f}`)
          break
        }
        case 'metHere': case 'metThere': case 'metDrew': {
          const met = g.fixtures.filter(f => f.played && f.id !== fx!.id && ((f.homeId === fx!.homeId && f.awayId === fx!.awayId) || (f.homeId === fx!.awayId && f.awayId === fx!.homeId))).sort((a, b) => b.week - a.week)[0]
          if (!met) { bad(l, 'a last meeting the fixtures do not have'); break }
          const hi = Math.max(met.homeScore, met.awayScore), lo2 = Math.min(met.homeScore, met.awayScore)
          if (n('a') !== hi || n('b') !== lo2 || n('week') !== met.week) bad(l, `last met ${pr.a}-${pr.b} in week ${pr.week}; the fixture: ${met.homeScore}-${met.awayScore} in week ${met.week}`)
          const winner = met.homeScore === met.awayScore ? undefined : g.clubs[met.homeScore > met.awayScore ? met.homeId : met.awayId].name
          if (pr.winner !== winner) bad(l, `winner ${pr.winner}; the fixture's winner ${winner}`)
          break
        }
        case 'newsDebutStart': case 'newsDebutBench': case 'newsClubStart': case 'newsClubBench': case 'newsMilestone': case 'newsOldClub': case 'newsReturn': {
          const id = pid(pr.player); if (!id) { bad(l, `names ${pr.player}, not in the 23`); break }
          const pl = g.players[Number(id)], k = ss.kickoffTeams[l.side!].map(x => (x == null ? '' : String(x))).indexOf(id)
          if (k < 0) { bad(l, `${pr.player} is not in this side's 23`); break }
          const starts = k < 15
          // (career and season as they were before the match: this match's appearance taken back off)
          const c0 = snap.get(Number(id))?.career ?? NaN
          if (base.startsWith('newsDebut') && c0 !== 0) bad(l, `a debut for ${pr.player}, who had ${c0} appearances`)
          if ((base === 'newsDebutStart' || base === 'newsClubStart') !== starts && !base.startsWith('newsMile') && !['newsOldClub', 'newsReturn'].includes(base)) bad(l, `${base} for ${pr.player}, shirt ${k + 1}`)
          if (base === 'newsMilestone' && (c0 + 1 !== n('n') || !starts)) bad(l, `milestone ${pr.n} for ${pr.player}, whose career was ${c0} before`)
          if (base === 'newsOldClub') { const opp = ids2[l.side === 0 ? 1 : 0]; if (!(pl.exClub === opp || careerRows(pl).some(r => r.clubId === opp && r.apps > 0))) bad(l, `${pr.player} never played for ${opp}`) }
          if (base === 'newsReturn') { const w = snap.get(Number(id))?.injWeeks; if (w !== n('n')) bad(l, `back after ${pr.n} weeks; his last injury before the match: ${w}`) }
          break
        }
        case 'newsAbsent': {
          const clubPs = g.clubs[ids2[l.side!]].players.map(x => g.players[x])
          const p2 = clubPs.find(x => x.name === pr.player)
          if (!p2) bad(l, `absent ${pr.player}, not at the club`)
          else if (ss.kickoffTeams[l.side!].includes(p2.id)) bad(l, `absent ${pr.player}, who is in the 23`)
          break
        }
        case 'preRef': if (pr.ref !== refFor(fx.id).name || pr.ref !== res.referee?.name) bad(l, `referee ${pr.ref}; the fixture's ${refFor(fx.id).name}`); break
        case 'wxDamp': case 'wxRain': case 'wxWind': case 'wxSnow': if (`wx${fxAfter.weather ?? res.conditions?.weather}` !== base) bad(l, `${base}; the fixture's weather ${fxAfter.weather}`); break
        case 'careerTry': case 'seasonTries': case 'droughtEnds': {
          const id = pid(pr.player), man = id ? ctx.men?.[id] : undefined
          if (!man || p?.kind !== 'try' || p.who !== id) { bad(l, `${base} for ${pr.player} at ${p?.kind}`); break }
          const today = P.slice(0, l.n + 1).filter(q => (q.kind === 'try' || q.kind === 'penaltyTry') && q.who === id).length
          const pl = g.players[Number(id)]
          void pl; const seasonBefore = snap.get(Number(id))?.tries ?? NaN
          if (base === 'seasonTries' && n('n') !== seasonBefore + today) bad(l, `${pr.n} tries this season; the stats: ${seasonBefore} before, ${today} today`)
          if (base === 'careerTry' && (n('n') !== man.careerTries + today || n('n') % 25 !== 0)) bad(l, `career try ${pr.n}; ${man.careerTries} before, ${today} today`)
          if (base === 'droughtEnds' && (seasonBefore !== 0 || today !== 1)) bad(l, `first of the season for ${pr.player}; he had ${seasonBefore}`)
          break
        }
        case 'debutFirst': case 'clubFirst': case 'returnFirst': case 'oldClubScores': {
          const id = pid(pr.player), kind = { debutFirst: 'debut', clubFirst: 'clubDebut', returnFirst: 'return', oldClubScores: 'oldClub' }[base]
          if (!ctx.news?.some(x => x.kind === kind && x.id === id)) bad(l, `${base} for ${pr.player}, not in the team news as ${kind}`)
          break
        }
        case 'crowdHomeRoar': case 'crowdHomeCheer': case 'crowdAway': {
          if (p?.kind !== 'try') bad(l, `${base} at ${p?.kind}`)
          else if ((base === 'crowdAway') !== (p.side === 1)) bad(l, `${base} for a try by side ${p.side}`)
          if (!(ctx.attendance ?? 0)) bad(l, `${base} with no crowd recorded`)
          break
        }
        case 'crowdHush': if (p?.kind !== 'penaltyGoal' || (ctx.attendance ?? 0) < 5000) bad(l, `${base} at ${p?.kind} with a crowd of ${ctx.attendance}`); break
        case 'crowdSiege': if (p?.kind !== 'ruck' || p.side !== 0 || (p.clock ?? p.t) < 4200) bad(l, `${base} at ${p?.kind} by side ${p?.side}`); break
        case 'bonusTry': if (!comp || comp.type !== 'league' || P.slice(0, l.n + 1).filter(q => (q.kind === 'try' || q.kind === 'penaltyTry') && q.side === l.side).length !== 4) bad(l, 'a bonus-point try that is not the fourth in a league match'); break
        case 'postUp': case 'postDown': case 'postStay': {
          const cid = ids2[l.side!], now = posAfter(cid), was = posBefore(cid), row = after.find(r => r.teamId === cid)
          if (posOf(pr.pos_k) !== now || n('pts') !== row?.pts) bad(l, `position ${posOf(pr.pos_k)} on ${pr.pts}; the game's table now: ${now} on ${row?.pts}`)
          const want = now < was ? 'postUp' : now > was ? 'postDown' : 'postStay'
          if (want !== base) bad(l, `${base}; the table moved ${was} to ${now}`)
          break
        }
        case 'postBonusTry': case 'postBonusLose': {
          const cid = ids2[l.side!], d = gained.get(cid) ?? NaN
          const us = fin[l.side!], th = fin[l.side === 0 ? 1 : 0], match = us > th ? 4 : us === th ? 2 : 0
          if (d - match < 1) bad(l, `${base}, but the game gave ${d} points for a ${us}-${th} result`)
          break
        }
        case 'postNext': {
          const cid = ids2[l.side!]
          const nx = g.fixtures.filter(x => !x.played && x.id !== fx!.id && x.week > fx!.week && (x.homeId === cid || x.awayId === cid)).sort((a, b) => a.week - b.week)[0]
          const opp = nx ? g.clubs[nx.homeId === cid ? nx.awayId : nx.homeId]?.name : undefined
          if (!nx || pr.opp !== opp || n('week') !== nx.week || (pr.where_k === 'sim.whereHome1') !== (nx.homeId === cid)) bad(l, `next ${pr.opp} week ${pr.week} ${pr.where_k}; the fixtures: ${opp} week ${nx?.week} ${nx && nx.homeId === cid ? 'home' : 'away'}`)
          break
        }
        case 'postStat': {
          const ws = l.side!, os2 = (ws === 0 ? 1 : 0) as 0 | 1, w = String(pr.what_k)
          const cnt = (s: 0 | 1) => w.includes('Breaks') ? P.filter(q => q.kind === 'lineBreak' && q.side === s).length : w.includes('Turnovers') ? P.filter(q => q.kind === 'ruck' && q.result === 'turnover' && q.side !== s).length : P.filter(q => q.kind === 'penalty' && q.side !== s).length
          // ("penalties conceded": penalties, not free kicks, as the words say)
          if (n('a') !== cnt(ws) || n('b') !== cnt(os2)) bad(l, `${w} ${pr.a} to ${pr.b}; the record ${cnt(ws)} to ${cnt(os2)}`)
          break
        }
        default:
          if (/^(ana|tip)/.test(base)) {
            if (base.startsWith('tip') && l.side !== res.managed) bad(l, `a pointer for side ${l.side}; the managed side is ${res.managed}`)
            // the spell since the last co-commentator word (or the half), counted here
            const from = spellStart.get(l.n) ?? 0, to = l.n
            const sp = P.slice(from, to + 1), s = l.side as 0 | 1, o = (s === 0 ? 1 : 0) as 0 | 1
            // (a carry here: one that was tackled, held up short, driven back or got over the line; not a knock-on or an offload)
            const car = sp.filter(q => q.kind === 'carry' && q.side === s && ['gainLine', 'held', 'drivenBack', 'overTheLine'].includes(q.result)), kicks = sp.filter(q => q.kind === 'kick' && q.side === s && q.result !== 'penaltyToTouch' && !q.kick?.startsWith('restart')).length
            const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
            if ((base === 'anaKicking' || base === 'anaHands') && !(near(n('k'), kicks, 1) && near(n('c'), car.length, 2))) bad(l, `${pr.k} kicks and ${pr.c} carries in the spell; the record ${kicks} and ${car.length} (plays ${from} to ${to})`)
            if (base === 'anaJackal') { const tw = sp.filter(q => q.kind === 'ruck' && q.result === 'turnover' && q.side === o).length; if (!near(n('n'), tw, 1)) bad(l, `${pr.n} turnovers won in the spell; the record ${tw}`) }
            if ((base === 'anaCollide' || base === 'anaStopped') && car.length) { const gl = car.filter(q => q.result === 'gainLine' || q.result === 'overTheLine').length; if (!near(n('pct'), Math.round(100 * gl / car.length), 8)) bad(l, `${pr.pct}% over the gain line; the record ${Math.round(100 * gl / car.length)}% of ${car.length}`) }
            if (base === 'anaPensRuck' || base === 'anaPensOffside') { const pens = sp.filter(q => (q.kind === 'penalty' || q.kind === 'freeKick') && q.side === o).length; if (!near(n('m'), pens, 1)) bad(l, `${pr.m} penalties in the spell; the record ${pens}`) }
          }
      }
    }
    if (matches % 6 === 0) console.error(`${matches} matches, ${Math.round((Date.now() - t0) / 1000)} s`)
  }
  console.log(`ctxaudit: ${matches} managed matches through the session, with the game's context${process.env.HARMONY_COMM ? ` (commentary from ${process.env.HARMONY_COMM})` : ''}`)
  console.log(`lines checked by kind: ${[...seen].filter(([k]) => /^(pre|intro|form|met|news|wx|surf|career|season|drought|oldClub|kick|crowd|ana|tip|duel|post|motm|debut|club|return|bonus|ref)/.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  const byKey = new Map<string, typeof faults>()
  for (const f of faults) { const b = f.key.replace(/^sim\./, '').replace(/\d+$/, ''); byKey.set(b, [...(byKey.get(b) ?? []), f]) }
  console.log(`fact faults: ${faults.length}`)
  for (const [k, F] of byKey) console.log(`  ${k}: ${F.length}; first ${F[0].label} play ${F[0].n}: ${F[0].msg}`)
  const byRule = new Map<string, Fail[]>()
  for (const f of checkFails) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f])
  console.log(`checkLines (C01 to C09, named whistle lines): ${checkFails.length} failures`)
  for (const [k, F] of byRule) console.log(`  ${k}: ${F.length}; first play ${F[0].n}: ${F[0].msg}`)
  const fsm = await import('node:fs')
  fsm.writeFileSync('scripts/tmp/harmony-ctxaudit.json', JSON.stringify({ when: new Date().toISOString(), matches, seen: Object.fromEntries(seen), faults, checkFails }))
}

async function main() {
  if (process.argv.includes('ctxaudit')) return ctxAuditDump(process.argv.slice(process.argv.indexOf('ctxaudit') + 1))
  if (process.argv.includes('overnight')) return overnightDump(process.argv.slice(process.argv.indexOf('overnight') + 1))
  if (process.argv.includes('cards')) return cardsDump(process.argv.slice(process.argv.indexOf('cards') + 1))
  if (process.argv.includes('wiring')) return wiringDump(process.argv.slice(process.argv.indexOf('wiring') + 1))
  if (process.argv.includes('season')) return seasonDump(process.argv.slice(process.argv.indexOf('season') + 1))
  if (process.argv.includes('clubs')) return clubsDump(process.argv.slice(process.argv.indexOf('clubs') + 1))
  if (process.argv.includes('spot')) return spotDump(process.argv.slice(process.argv.indexOf('spot') + 1))
  if (process.argv.includes('realism')) return realismDump(process.argv.slice(process.argv.indexOf('realism') + 1))
  if (process.argv.includes('levers')) return leversDump(process.argv.slice(process.argv.indexOf('levers') + 1))
  if (process.argv.includes('words')) return wordsDump(process.argv.slice(process.argv.indexOf('words') + 1))
  if (process.argv.includes('eyes')) return eyes()
  if (process.argv.includes('pace')) return paceDump(process.argv.slice(process.argv.indexOf('pace') + 1))
  if (process.argv.includes('moments')) return moments()
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
  let reals: Match[] = [], fixtures: RealFixture[] = []
  try { fixtures = await realFixtures(Array.from({ length: R }, (_, i) => 1 + i)); reals = fixtures.map(f => f.match) } catch (e) { crashed.push({ seed: -1, msg: `real fixtures: ${(e as Error).message}` }) }
  const all = [...matches, ...reals]

  // per-rule tallies
  const notRunWhy = new Map<string, string>()
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
  for (const m of all) add(m, [...checkRecord(m), ...checkRecordBounds(m)], [...matchRuleIds, 'B01-record-bounds'])

  for (const row of checkRates(all)) { const t = T.get(row.id)!; t.ran = true; t.failing = row.ok ? 0 : Math.max(1, row.failing); t.first = { label: 'all matches', seed: row.first?.seed ?? -1, n: row.first?.n ?? -1, msg: row.msg } }
  const dec = checkDecision(Array.from({ length: Math.min(100, N) }, (_, i) => 1 + i))
  { const t = T.get('R35-decision')!; t.ran = true; t.failing = dec.ok ? 0 : Math.max(1, dec.failing); t.first = { label: dec.first ? `seed ${dec.first.seed}` : '100 seeds', seed: dec.first?.seed ?? -1, n: dec.first?.n ?? -1, msg: dec.msg } }

  // the manager's hand on real sheets (8 fixtures; four runs of each)
  try {
    for (const row of await checkDecisionsReal(fixtures.slice(0, Number(process.argv.find(a => a.startsWith('--dec='))?.slice(6) ?? 8)))) {
      const t = T.get(row.id)!; t.ran = true; t.failing = row.ok ? 0 : Math.max(1, row.failing)
      t.first = { label: row.first ? `real ${row.first.seed}` : 'real fixtures', seed: row.first?.seed ?? -1, n: row.first?.n ?? -1, msg: row.msg }
    }
  } catch (e) { crashed.push({ seed: -1, msg: `decision checks: ${(e as Error).message}` }) }

  // commentary
  const notes: string[] = []
  try {
    const C = await loadComm() as unknown as { commentate?: (r: SimResult, names: { teams: [string, string]; player(id: string): string }) => LineLike[]; render?: (l: LineLike) => string }
    if (typeof C.commentate !== 'function') throw new Error('commentary.ts has no commentate()')
    const SUM = (C as unknown as { SUMMARY?: Set<string> }).SUMMARY
    if (SUM) for (const b of SUM) SUMMARY_BASES.add(b)
    const render = typeof C.render === 'function' ? C.render : (l: LineLike) => l.key
    const ids = RULES.filter(r => r.owner === 'COMMENTARY').map(r => r.id)
    let lines = 0
    // (the commentary is about 840 lines a match now: its truth checks run on the 20 real fixtures and the first 100 seeds; --words=all for every match)
    const wordsOn = process.argv.includes('--words=all') ? all : [...matches.slice(0, 100), ...reals]
    for (const m of wordsOn) {
      let ls: LineLike[]
      const names = { teams: m.teams ?? ['Home', 'Away'] as [string, string], player: (id: string) => m.names?.get(id) ?? '' }
      try { ls = C.commentate(m.res, names) } catch (e) { add(m, [{ rule: 'C01-line-play', n: -1, msg: `commentate threw: ${(e as Error).message}` }], ids); continue }
      lines += ls.length
      add(m, checkLines(m, ls, render), ids)
    }
    notes.push(`commentary: ${lines} lines over ${wordsOn.length} matches (${(lines / Math.max(1, wordsOn.length)).toFixed(0)} a match)`)
  } catch (e) { notes.push(`commentary: not checked (${(e as Error).message.split('\n')[0]})`) }

  // animation
  try {
    const A = await import('../src/ui/livepitch/fromRecord') as unknown as { schedule?: (plays: Play[], sides?: Match['sides']) => unknown }
    if (typeof A.schedule !== 'function') throw new Error('fromRecord.ts has no schedule()')
    // the bake is about 0.7 s and a lot of memory a match: a sample, half skeleton and half real
    const AN = Number(process.argv.find(a => a.startsWith('--anim='))?.slice(7) ?? 8)
    const sample = [...matches.slice(0, Math.ceil(AN / 2)), ...reals.slice(0, Math.floor(AN / 2))]
    const ids = ['A01-schedule-cover', 'A02-schedule-time', 'A03-fades']
    const totals: number[] = []
    let how = ''
    for (const m of sample) {
      try {
        const r = checkSchedule(m, A.schedule(m.res.plays, m.sides))
        how = r.how
        if (r.total != null) totals.push(r.total)
        add(m, r.fails, ids)
      } catch (e) { add(m, [{ rule: 'A01-schedule-cover', n: -1, msg: `schedule threw: ${(e as Error).message}` }], ids) }
    }
    void totals
    notes.push(`animation: schedule of ${sample.length} matches read (${how})`)
  } catch (e) { notes.push(`animation: not checked (${(e as Error).message.split('\n')[0]})`) }

  // ROUND 4: pace, smoothness, positions, words on the schedule, sameness
  const r4: string[] = []
  try {
    const A = await import('../src/ui/livepitch/fromRecord') as unknown as Pitch
    if (typeof A.bakeOf !== 'function' || typeof A.timeline !== 'function') throw new Error('fromRecord.ts has no bakeOf/timeline')
    // the sample: real fixtures, the closest and the widest at 75:00 first, then the rest (each bake is seconds)
    const PN = Number(process.argv.find(a => a.startsWith('--pace='))?.slice(7) ?? 6)
    const at75 = (m: Match) => { const q = m.res.plays.find(x => (x.clock ?? x.t) >= 4500 && m.res.plays.some(h => h.kind === 'halfTime' && h.n < x.n)); return q ? Math.abs(q.score[0] - q.score[1]) : 99 }
    const byMargin = [...reals].sort((a, b) => at75(a) - at75(b))
    const pick = [...byMargin.slice(0, Math.ceil(PN / 2)), ...byMargin.slice(-Math.floor(PN / 2))]
    // and the owner's own match (seed 4242: "a moment early on said the ball went dead")
    try { const own = await realFixtures([4242]); if (own[0]) pick.push(own[0].match) } catch { /* no fixture */ }
    const C = await loadComm().catch(() => null) as unknown as { commentate?: (r: SimResult, n: unknown) => LineLike[]; render?: (l: LineLike) => string; thin?: (l: LineLike[], s: unknown) => LineLike[] } | null
    const views: number[] = [], viewTries: number[] = []
    const bounds: Record<string, [number, number]> = {}
    let worstMan = 0
    const mStepFF: number[] = [], mStepN: number[] = [], bStepFF: number[] = [], bStepN: number[] = [], mJerk: number[] = [], bJerk: number[] = []
    const loads: LoadReport[] = [], rawLoads: LoadReport[] = [], tickers: string[] = []
    for (const m of pick) {
      const t0 = Date.now()
      let r: PitchReport
      try { r = checkPitch(A, m) } catch (e) { add(m, [{ rule: 'P01-length', n: -1, msg: `the pitch threw: ${(e as Error).message}` }], ['P01-length']); continue }
      if (m.seed === 4242) add(m, checkRecordBounds(m), ['B01-record-bounds'])
      views.push(r.view); viewTries.push(r.tries + m.res.plays.filter(q => q.kind === 'penaltyTry').length)
      // the boundaries on the picture
      const bd = checkPictureBounds(A, m)
      add(m, bd.fails, ['B02-picture-bounds'])
      for (const [k, [c, bad]] of Object.entries(bd.byKind)) { const t = bounds[k] ?? (bounds[k] = [0, 0]); t[0] += c; t[1] += bad }
      worstMan = Math.max(worstMan, r.worstFrame.px)
      const ids = ['P02-every-play', 'P03-key-1x', 'P04-buildup-1x', 'P05-ff', 'P06-close', 'P07-ease', 'S01-steps', 'S02-jitter', 'S03-positions']
      const f: Fail[] = []
      if (r.condensed || r.shown < r.plays) f.push({ rule: 'P02-every-play', n: -1, msg: `${r.condensed} plays condensed, ${r.plays - r.shown} with ball in play and no time on screen` })
      if (r.keySlow < r.keyPlays) f.push({ rule: 'P03-key-1x', n: r.keyWorst?.n ?? -1, msg: `${r.keyPlays - r.keySlow} of ${r.keyPlays} key moments not at clip pace (${fmt(clipRate(A), 2)}x, within 15%); worst play ${r.keyWorst?.n} ${m.res.plays[r.keyWorst?.n ?? 0]?.kind} at ${fmt(r.keyWorst?.rate ?? NaN)}x` })
      if (r.buildFast > 0) f.push({ rule: 'P04-buildup-1x', n: r.buildFastAt?.n ?? -1, msg: `${r.buildFast} of ${r.buildPlaysN} plays in ${r.tries - r.buildSlow} of ${r.tries} try build-ups run faster than ${BUILD_MAX_RATE}x; fastest play ${r.buildFastAt?.n} (${m.res.plays[r.buildFastAt?.n ?? 0]?.kind}/${m.res.plays[r.buildFastAt?.n ?? 0]?.result}) at ${fmt(r.buildFastAt?.rate ?? NaN)}x` })
      if (r.ffShare < 0.8) f.push({ rule: 'P05-ff', n: -1, msg: `only ${fmt(100 * r.ffShare, 0)}% of ordinary frames at 1.5x or more (median ${fmt(r.ffMedian)}x)` })
      if (r.close === 'close' && r.closeMax > 2.2) f.push({ rule: 'P06-close', n: -1, msg: `${r.margin}-point game at 75:00, but the finish runs up to ${fmt(r.closeMax)}x (median ${fmt(r.closeMedian)}x)` })
      if (r.close === 'blowout' && !(r.closeMedian > 2.2)) f.push({ rule: 'P06-close', n: -1, msg: `${r.margin}-point blow-out at 75:00 slowed to a median ${fmt(r.closeMedian)}x` })
      const jumpPerFrame = Math.exp(r.rateJump / VIEW_FPS) - 1
      if (r.rateJump > Math.log(1.1) * VIEW_FPS) f.push({ rule: 'P07-ease', n: r.rateJumpAt, msg: `speed changes ${fmt(100 * (Math.exp(r.rateJump / VIEW_FPS) - 1), 0)}% in one screen frame at play ${r.rateJumpAt} (${m.res.plays[r.rateJumpAt]?.kind}/${m.res.plays[r.rateJumpAt]?.result})` })
      void jumpPerFrame
      const p99 = pct(r.manStep.ff, 0.99), j99 = pct(r.manJerk, 0.99), b99 = pct([...r.ballStep.ff, ...r.ballStep.normal], 0.99)
      if (p99 > 5 || j99 > 1 || b99 > 14) f.push({ rule: 'S01-steps', n: -1, msg: `men step 99th pct ${fmt(p99)} px (fast forward), change in step 99th pct ${fmt(j99, 2)} px, ball 99th pct ${fmt(b99)} px; worst man ${fmt(r.worstFrame.px)} px at ${fmt(r.worstFrame.v)} s on screen, ${r.worstFrame.what}` })
      if (r.jitterMean >= 0.5 || r.jitter3 > 0.01) f.push({ rule: 'S02-jitter', n: r.jitterAt, msg: `${fmt(r.jitterMean, 2)} men shaking on average, 3 or more at once in ${fmt(100 * r.jitter3, 2)}% of screen frames, up to ${r.jitterMax} at play ${r.jitterAt} (${m.res.plays[r.jitterAt]?.kind}/${m.res.plays[r.jitterAt]?.result})` })
      if (r.odd && (r.odd.odd > 196 || r.odd.slide >= 5 || r.odd.wingShare >= 0.1 || r.odd.flat <= 0.8)) f.push({ rule: 'S03-positions', n: r.odd.slideAt, msg: `odd runs ${r.odd.odd} of ${r.odd.runs}, side slide ${fmt(r.odd.slide)} m (play ${r.odd.slideAt}), wings out of lane ${fmt(100 * r.odd.wingShare)}%, flat line ${fmt(100 * r.odd.flat, 0)}%` })
      if (!r.odd) f.push({ rule: 'S03-positions', n: -1, msg: 'fromRecord.ts has no oddRuns()' })
      add(m, f, ids)
      const cat = (to: number[], from: number[]) => { for (let i = 0; i < from.length; i += 7) to.push(from[i]) } // (every 7th, to keep memory down)
      cat(mStepFF, r.manStep.ff); cat(mStepN, r.manStep.normal); cat(bStepFF, r.ballStep.ff); cat(bStepN, r.ballStep.normal); cat(mJerk, r.manJerk); cat(bJerk, r.ballJerk)
      r4.push(`  ${m.label}: ${fmt(r.view / 60, 2)} min, ${r.close} (${r.margin} at 75:00), key ${r.keySlow}/${r.keyPlays} at 1x, build-ups ${r.buildSlow}/${r.tries} with no play over ${BUILD_MAX_RATE}x (${fmt(100 * r.buildClipShare, 0)}% of their frames at clip pace or a wound-on ruck), ff median ${fmt(r.ffMedian)}x (${fmt(100 * r.ffShare, 0)}% at 1.5x+), finish max ${fmt(r.closeMax)}x, speed change max ${fmt(100 * (Math.exp(r.rateJump / VIEW_FPS) - 1), 0)}% a frame, shaking ${fmt(r.jitterMean, 2)} men (3+ in ${fmt(100 * r.jitter3, 2)}% of frames, max ${r.jitterMax} at play ${r.jitterAt})${r.odd ? `, odd runs ${r.odd.odd}, slide ${fmt(r.odd.slide)} m, wings ${fmt(100 * r.odd.wingShare)}%, flat ${fmt(100 * r.odd.flat, 0)}%` : ''} [${((Date.now() - t0) / 1000).toFixed(1)} s]`)
      // the words on this schedule
      if (C?.commentate && C.render) {
        const sch = A.schedule(m.res.plays, m.sides)
        const raw = C.commentate(m.res, { teams: m.teams ?? ['Home', 'Away'], player: (id: string) => m.names?.get(id) ?? '' })
        // the feed as meant (commentary.ts thin() fits the lines to this schedule); the raw feed is reported beside it
        const ls = C.thin ? C.thin(raw, sch) : raw
        const L = checkLoad(m, ls, sch), L0 = checkLoad(m, raw, sch)
        rawLoads.push(L0)
        loads.push(L)
        const wf: Fail[] = []
        // the ticker (24 Nov)
        const tk = checkTicker(A, m, ls, C.render)
        const tf: Fail[] = []
        if (tk.buildSaid < tk.buildPlays) tf.push({ rule: 'T01-build-said', n: tk.buildMissed ?? -1, msg: `${tk.buildPlays - tk.buildSaid} of ${tk.buildPlays} plays in try build-ups have no line; first play ${tk.buildMissed} (${m.res.plays[tk.buildMissed ?? 0]?.kind}/${m.res.plays[tk.buildMissed ?? 0]?.result})` })
        if (tk.empty > 0 || tk.stale > 0) tf.push({ rule: 'T02-tick', n: tk.empty ? tk.emptyAt : tk.staleAt, msg: `${tk.empty} spells over ${TICK_GAP} s with the ball in play and nothing on screen (longest ${fmt(tk.emptyWorst)} s, at play ${tk.emptyAt} ${m.res.plays[tk.emptyAt]?.kind}/${m.res.plays[tk.emptyAt]?.result}); ${tk.stale} times one line up over ${STALE_S} s at clip pace (longest ${fmt(tk.staleWorst)} s, at play ${tk.staleAt} ${m.res.plays[tk.staleAt]?.kind}/${m.res.plays[tk.staleAt]?.result})` })
        if (tk.flashLines < tk.flashes || tk.flashShort > 0) tf.push({ rule: 'T03-flash', n: tk.flashDropped ?? tk.flashShortAt ?? -1, msg: `${tk.flashes - tk.flashLines} of ${tk.flashes} tries, goals and cards with no line${tk.flashDropped != null ? ` (first play ${tk.flashDropped})` : ''}; ${tk.flashShort} up for under ${FLASH_HOLD} s (shortest ${fmt(tk.holdMin, 2)} s${tk.flashShortAt != null ? `, play ${tk.flashShortAt}` : ''})` })
        if (tk.ahead > 0 || tk.behindShare > BEHIND_SHARE) tf.push({ rule: 'T04-in-step', n: tk.aheadAt ?? tk.behindAt ?? -1, msg: `line ahead of the picture in ${tk.ahead} samples (first: the line for play ${tk.aheadAt}); more than one play behind ${fmt(100 * tk.behindShare, 1)}% of the time${tk.behindAt != null ? ` (first at play ${tk.behindAt})` : ''}: ${fmt(100 * tk.behindFFShare, 1)}% of fast-forward time, ${fmt(100 * tk.behindClipShare, 1)}% at clip pace; ${fmt(100 * tk.behindInFF, 0)}% of it in fast forward` })
        if (tk.long > 0 || tk.flashLong > 0) tf.push({ rule: 'T05-short', n: -1, msg: `${tk.long} lines over their cap (ticker ${TICK_MAX_CHARS}, fuller ${FULL_MAX_CHARS}) and ${tk.flashLong} flash lines over ${FLASH_MAX_CHARS}; longest ${tk.longest}: "${tk.longestText}"` })
        add(m, tf, ['T01-build-said', 'T02-tick', 'T03-flash', 'T04-in-step', 'T05-short'])
        tickers.push(`  ticker ${m.label}: ${fmt(tk.linesPerSecFF, 2)} lines a s in ff, ${fmt(tk.linesPerSec1x, 2)} at clip pace; build-up plays said ${tk.buildSaid}/${tk.buildPlays}; nothing on screen over ${TICK_GAP} s in play ${tk.empty} (longest ${fmt(tk.emptyWorst)} s), one line over ${STALE_S} s at clip pace ${tk.stale} (longest ${fmt(tk.staleWorst)} s); flashes ${tk.flashLines}/${tk.flashes}, shortest hold ${fmt(tk.holdMin, 2)} s; ahead ${tk.ahead}, behind >1 play ${fmt(100 * tk.behindShare, 1)}% (fast forward ${fmt(100 * tk.behindFFShare, 1)}%, clip pace ${fmt(100 * tk.behindClipShare, 1)}%); longest line ${tk.longest} chars`)
        if (L.keyCovered < L.keyTotal) wf.push({ rule: 'W03-key-words', n: L.keyMissed ?? -1, msg: `${L.keyTotal - L.keyCovered} of ${L.keyTotal} key moments with no line on screen; first play ${L.keyMissed} (${m.res.plays[L.keyMissed ?? 0]?.kind}/${m.res.plays[L.keyMissed ?? 0]?.result})` })
        add(m, wf, ['W03-key-words'])
      }
    }
    if (views.length) {
      const mean = views.reduce((a, b) => a + b, 0) / views.length
      // more than 10 tries may run longer (owner, 24 Nov): only the 7 minute floor then
      // (owner, 25 Nov: "leave it": the length is reported, with a warning above 12 minutes)
      const out = views.filter(v => v > 720).length
      const t = T.get('P01-length')!; t.ran = true; t.failing = out
      t.first = { label: `${views.length} real fixtures`, seed: -1, n: -1, msg: `${views.map((v, i) => `${fmt(v / 60, 2)} (${viewTries[i]} tries)`).join(', ')} min (mean ${fmt(mean / 60, 2)})` }
    }
    r4.push(`  on screen, all ${pick.length}: men step px p50/p95/p99/max fast forward ${[0.5, 0.95, 0.99].map(q => fmt(pct(mStepFF, q))).join('/')}/${fmt(worstMan)}; normal ${[0.5, 0.95, 0.99].map(q => fmt(pct(mStepN, q))).join('/')}; ball fast forward ${[0.5, 0.95, 0.99].map(q => fmt(pct(bStepFF, q))).join('/')}, normal ${[0.5, 0.95, 0.99].map(q => fmt(pct(bStepN, q))).join('/')}; change in step men p95/p99 ${fmt(pct(mJerk, 0.95), 2)}/${fmt(pct(mJerk, 0.99), 2)}, ball ${fmt(pct(bJerk, 0.95), 2)}/${fmt(pct(bJerk, 0.99), 2)}`)
    r4.push(`  boundaries on screen (failing/checked): ${Object.entries(bounds).map(([k, [c, b]]) => `${k} ${b}/${c}`).join(', ')}`)
    r4.push(...tickers)
    if (rawLoads.length) r4.push(`  words before thin(): ${rawLoads.map(L => `${fmt(L.ffRate, 2)} a s in ff, busiest 10 s ${L.busiest10}`).join('; ')}`)
    if (loads.length) r4.push(`  words on screen after thin(): ${loads.map(L => `${fmt(L.ffRate, 2)}/${fmt(L.normalRate, 2)} lines a s (ff/1x), busiest 10 s ${L.busiest10} (play ${L.busyPlay}), longest gap ${fmt(L.longestGap)} s (from play ${L.gapAt}), key moments with words ${L.keyCovered}/${L.keyTotal}`).join('; ')}`)
  } catch (e) { r4.push(`  pace and smoothness not checked: ${(e as Error).message.split('\n')[0]}`) }

  // THE MANAGER'S LEVERS (24 Nov: "this can't be a preset result"), on fixture 1's pairing over paired seeds
  try {
    // (a few pairs here: enough to see each lever leaves the past alone and changes the future; which way and how much is `harmonycheck.ts levers 80`)
    const NL = Number(process.argv.find(a => a.startsWith('--levers='))?.slice(9) ?? 4)
    if (fixtures[0] && NL > 0) {
      const rows = await checkLevers(fixtures[0], NL)
      const bad = rows.filter(r => r.prefixBroken > 0 || r.moved === 0)
      const t = T.get('M01-levers')!; t.ran = true; t.failing = bad.length
      t.first = { label: `fixture 1, ${NL} pairs`, seed: -1, n: -1, msg: bad.length ? bad.map(r => `${r.lever}: ${r.prefixBroken ? `${r.prefixBroken} changed before the call; ` : ''}${r.moved === 0 ? 'NOTHING CHANGED after it' : ''}${r.note ? `; ${r.note}` : ''}`).join(' | ') : `all ${rows.length} levers leave the past alone and change the match after the call (direction and size: harmonycheck.ts levers 80)` }
      r4.push(`  levers, fixture 1 (${fixtures[0].match.teams?.join(' v ')}), ${NL} paired seeds (too few for direction: see harmonycheck.ts levers 80):`)
      for (const r of rows) r4.push(`    ${r.verdict.padEnd(7)} ${r.lever} (from ${r.from}): ${r.measure} ${fmt(r.base, 2)} -> ${fmt(r.with, 2)} (${r.diff >= 0 ? '+' : ''}${fmt(r.diff, 2)} a match; changed after in ${r.moved}/${r.pairs}; paired t ${fmt(r.t, 1)}, wanted ${r.want}: ${r.verdict}; changed before in ${r.prefixBroken})${r.note ? ` [${r.note}]` : ''}`)
    }
    const cc = cardCost(all)
    const t2 = T.get('M02-card-cost')!; t2.ran = true; t2.failing = cc.inBin < cc.outBin ? 0 : 1
    t2.first = { label: `${cc.cards} yellow cards`, seed: -1, n: -1, msg: `carded side's points margin a minute: ${cc.inBin >= 0 ? '+' : ''}${fmt(cc.inBin, 3)} in the bin, ${cc.outBin >= 0 ? '+' : ''}${fmt(cc.outBin, 3)} out of it (${fmt(cc.minutesIn, 0)} minutes in the bin)` }
  } catch (e) { r4.push(`  levers not checked: ${(e as Error).message.split('\n')[0]}`) }

  // THE WIRING (round 8): loaded when the adapter exists; "not run" until then
  {
    const ad = await loadAdapter()
    const put = (row: RateRow) => { const t = T.get(row.id)!; if (row.failing < 0) { t.ran = false; notRunWhy.set(row.id, row.msg); return } t.ran = true; t.failing = row.ok ? 0 : Math.max(1, row.failing); t.first = { label: 'wiring', seed: row.first?.seed ?? -1, n: row.first?.n ?? -1, msg: row.msg } }
    try { put(await checkStored(ad)) } catch (e) { notRunWhy.set('W01-stored', `threw: ${(e as Error).message.split('\n')[0]}`) }
    try { put(await checkSessionDecisions(ad)) } catch (e) { notRunWhy.set('W02-session-decisions', `threw: ${(e as Error).message.split('\n')[0]}`) }
    try { put(await checkRestUntouched(ad)) } catch (e) { notRunWhy.set('W03-rest-untouched', `threw: ${(e as Error).message.split('\n')[0]}`) }
    try { put(await checkScreenSession(ad)) } catch (e) { notRunWhy.set('W07-screen-session', `threw: ${(e as Error).message.split('\n')[0]}`) }
    put(await checkFingerprint())
    // W05 and W06 come from the last `harmonycheck.ts season` run (several minutes), if it had the new engine
    try {
      const { readFileSync } = await import('node:fs')
      const j = JSON.parse(readFileSync('scripts/tmp/harmony-season.json', 'utf8')) as { notRun?: string; when: string; seasons?: number; compare?: { k: string; old: number; new: number; rel: number; flag: boolean }[]; saveFail?: string | null; ratings?: Record<string, { old: { n: number; mean: number; sd: number }; new: { n: number; mean: number; sd: number } }> }
      if (j.notRun) { notRunWhy.set('W05-season', `last season run (${j.when}): ${j.notRun}`); notRunWhy.set('W06-ratings', `last season run (${j.when}): ${j.notRun}`) }
      else {
        if ((j as { perSeason?: Record<string, Record<string, number>[]> }).perSeason) j.compare = seasonCompare((j as unknown as { perSeason: Record<string, Record<string, number>[]> }).perSeason, true)
        const off = (j.compare ?? []).filter(c => c.flag)
        put({ id: 'W05-season', ok: !off.length && !j.saveFail, failing: off.length + (j.saveFail ? 1 : 0), msg: `season run ${j.when}: ${off.length ? off.map(c => `${c.k} ${fmt(c.old, 1)} -> ${fmt(c.new, 1)}`).join('; ') : 'no figure off by 10% beyond the noise'}${(j.compare ?? []).some(c => (c as { over10?: boolean }).over10 && !c.flag) ? ` (over 10% but within the noise of ${j.seasons ?? '?'} seasons: ${(j.compare ?? []).filter(c => (c as { over10?: boolean }).over10 && !c.flag).map(c => `${c.k} ${fmt(c.old, 1)} -> ${fmt(c.new, 1)}`).join(', ')})` : ''}${j.saveFail ? `; ${j.saveFail}` : ''}` })
        const badPos = Object.entries(j.ratings ?? {}).filter(([, r]) => r.new.n && (Math.abs(r.new.mean - r.old.mean) > 0.1 * r.old.mean || r.new.sd > 1.25 * r.old.sd || r.new.sd < 0.75 * r.old.sd))
        put({ id: 'W06-ratings', ok: !badPos.length, failing: badPos.length, msg: badPos.length ? badPos.map(([p, r]) => `${p}: ${fmt(r.old.mean, 2)}±${fmt(r.old.sd, 2)} old, ${fmt(r.new.mean, 2)}±${fmt(r.new.sd, 2)} new`).join('; ') : 'every position within 10% on mean and 25% on spread' })
      }
    } catch { notRunWhy.set('W05-season', 'no season run yet (npx vite-node scripts/harmonycheck.ts season 3)'); notRunWhy.set('W06-ratings', 'no season run yet') }
  }

  // FUNDAMENTALS against the sources, on a balanced set of league fixtures (`realism 120` for a steadier table)
  let balanced: RealFixture[] = []
  try { balanced = await balancedFixtures(Number(process.argv.find(a => a.startsWith('--balanced='))?.slice(11) ?? 30)) } catch (e) { crashed.push({ seed: -1, msg: `balanced fixtures: ${(e as Error).message}` }) }
  {
    const set = balanced.length ? balanced.map(f => f.match) : reals
    for (const m of set) add(m, [...checkRecord(m), ...checkRecordBounds(m)], [...matchRuleIds, 'B01-record-bounds'])
    const r = realism(ourRates(set), TARGETS)
    const t = T.get('F01-realism')!; t.ran = true; t.failing = r.misses.length
    t.first = { label: `${set.length} ${balanced.length ? 'league fixtures, none managed' : 'real fixtures'}`, seed: -1, n: -1, msg: r.misses.length ? `${r.misses.length} of ${TARGETS.filter(x => x.lo != null).length} sourced figures out of line: ${r.misses.map(x => x.split(':')[0]).join('; ')}` : 'all sourced figures in line' }
    r4.push(`  realism (${set.length} ${balanced.length ? 'balanced league fixtures' : 'real fixtures'}):`, ...r.misses.map(x => `    ${x}`))
  }

  // SAMENESS: within each match, across 20 pairings, across 20 matches of one pairing
  try {
    const C = await loadComm() as unknown as { commentate: (r: SimResult, n: unknown) => LineLike[]; render: (l: LineLike) => string }
    const linesOf = (m: Match) => C.commentate(m.res, { teams: m.teams ?? ['Home', 'Away'], player: (id: string) => m.names?.get(id) ?? '' })
    const shapes: MatchShape[] = []
    let worstRep = { share: 0, label: '', run: 0, key: '', top: '', topN: 0 }
    // different pairings: 20 different clubs' fixtures from the balanced set (the 20 Leicester fixtures share a side)
    const diffSet = balanced.length >= 20 ? balanced.slice(0, 20).map(f => f.match) : reals
    for (const m of diffSet) {
      const ls = linesOf(m), sh = shapeOf(m, ls, C.render)
      shapes.push(sh)
      const w = repeatWithin(sh, m)
      // word for word: the whole sentence, names and all
      const seen = new Set<string>(); let exact = 0
      for (const tx of sh.texts) { if (seen.has(tx)) exact++; seen.add(tx) }
      const share = sh.texts.length ? exact / sh.texts.length : 0
      const f: Fail[] = []
      if (share > 0.15 || w.tmplRun > 2) f.push({ rule: 'W04-repeat', n: -1, msg: `${fmt(100 * share, 0)}% of lines word for word repeats (${fmt(100 * w.repeatShare, 0)}% the same wording with other names); the wording "${w.tmplRunText}" ${w.tmplRun} times running (line key ${w.runKey} ${w.longestRun} times running); most used: "${w.topRepeat}" x${w.topCount}` })
      add(m, f, ['W04-repeat'])
      if (share > worstRep.share) worstRep = { share, label: m.label, run: w.longestRun, key: w.runKey, top: w.topRepeat, topN: w.topCount }
    }
    const diff = sameness(shapes)
    // one pairing, twenty matches: the first balanced fixture's two clubs on twenty match seeds
    const f1 = balanced[0] ?? fixtures[0]
    const same: MatchShape[] = []
    if (f1) for (let sd = 1; sd <= 20; sd++) {
      const res = simSkeleton({ seed: 1000 + sd, world: f1.build().world })
      const m2: Match = { ...f1.match, label: `pairing 1, seed ${1000 + sd}`, seed: 1000 + sd, res }
      same.push(shapeOf(m2, linesOf(m2), C.render))
    }
    const one = sameness(same)
    const t = T.get('W05-sameness')!; t.ran = true
    t.failing = (diff.score > 60 ? 1 : 0) + (one.score > 70 ? 1 : 0)
    t.first = { label: '20 pairings / 1 pairing', seed: -1, n: -1, msg: `${fmt(diff.score)} / ${fmt(one.score)}` }
    const part = (x: Sameness) => `tries ${fmt(100 * x.tries, 0)}, run of play ${fmt(100 * x.play, 0)}, words ${fmt(100 * x.words, 0)}, scoring ${fmt(100 * x.scoring, 0)}`
    r4.push(`  sameness, 20 different pairings: ${fmt(diff.score)} (${part(diff)}); one pairing (${f1?.match.teams?.join(' v ')}) x20: ${fmt(one.score)} (${part(one)}); on the play alone (tries, run of play, scoring) ${fmt(100 * (diff.tries + diff.play + diff.scoring) / 3)} v ${fmt(100 * (one.tries + one.play + one.scoring) / 3)}`)
    // what a watcher would notice: the try origins over all 20 pairings, and the most used line wordings
    const origins = new Map<string, number>(); for (const sh of shapes) for (const [k, v] of sh.tries) origins.set(k, (origins.get(k) ?? 0) + v)
    const allT = [...origins.values()].reduce((a, b) => a + b, 0)
    r4.push(`  tries over 20 pairings (${allT}): ${[...origins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${fmt(100 * v / allT, 0)}%`).join(', ')}`)
    const tm = new Map<string, number>(); for (const sh of shapes) for (const [k, v] of sh.tmpl) tm.set(k, (tm.get(k) ?? 0) + v)
    r4.push(`  most used wordings over 20 matches: ${[...tm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `"${k}" ${(v / 20).toFixed(1)} a match`).join('; ')}`)
    const scorings = shapes.map(sh => sh.scoring.split(' ').slice(0, 3).join(' '))
    r4.push(`  worst repeat in a match: ${worstRep.label}, ${fmt(100 * worstRep.share, 0)}% word for word; scoring openings: ${[...new Set(scorings)].length} different first three scores in 20 matches`)
  } catch (e) { r4.push(`  sameness not checked: ${(e as Error).message.split('\n')[0]}`) }

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
    const why = t.first ? t.first.msg : !t.ran ? notRunWhy.get(r.id) ?? '' : r.title
    console.log(pad(r.id, 22) + pad(r.owner, 11) + pad(st, 9) + pad(first, 36) + why)
  }
  {
    // R31's distribution, for the owner to set the band
    const pens = all.map(m => countMatch(m.res).pens).sort((a, b) => a - b)
    const h = new Map<number, number>(); for (const v of pens) h.set(v, (h.get(v) ?? 0) + 1)
    const q = (f: number) => pens[Math.min(pens.length - 1, Math.floor(f * pens.length))]
    notes.push(`penalties and free kicks a match (${pens.length} matches): ${[...h.entries()].map(([v, c]) => `${v}:${c}`).join(' ')}; 5th percentile ${q(0.05)}, median ${q(0.5)}, 95th ${q(0.95)}`)
  }
  for (const n of notes) console.log(n)
  console.log('round 4 detail:\n' + r4.join('\n'))
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
