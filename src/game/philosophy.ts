// F23: every dugout has an idea of how the game should be played.
//
// Before this, the 96 clubs you are not managing all sat on style 50, tempo 50,
// kicking 50, aggression 50 - the exact middle of every dial the match engine
// reads. Facing Toulouse and facing Newcastle felt the same because tactically
// it WAS the same: only the players changed. There was nothing to prepare for,
// no reason for a game plan to be right against one side and wrong against the
// next, and the four sliders you spend time on had no counterpart on the other
// touchline.
//
// A philosophy is a head coach's standing instruction. It belongs to the coach,
// not the club: sack him and the next man brings his own, which is why a club
// you have played for years can suddenly start kicking at you.
//
// ---- why the eight come in mirrored pairs -------------------------------
//
// Every dial the engine reads is multiplied into a unit score, and all four
// mappings are linear about 50 (see matchEngine's `f`). So a WORLD whose dials
// average 50 on each axis plays to the same aggregate as a world of flat 50s -
// the same points, tries, home-win share. That neutrality is the whole reason
// this can be added to a calibrated engine without re-tuning it.
//
// The eight philosophies are therefore four PAIRS, and each pair reflects
// exactly about 50 on all four dials (26/74, 42/58 and so on). Assign the pair
// by hash and the member by which half of the squad is stronger, and the world
// average stays on 50 while each individual club plays to what it has got.
// scripts/philprobe.ts measures the realised averages rather than trusting the
// arithmetic, because a lopsided world would drift them.
//
// ---- and a warning for whoever widens these next -----------------------
//
// TEMPO is the dangerous dial. Measured one axis at a time on a fixed seed, with
// the other three pinned to 50, style/kicking/aggression each moved world scoring
// by 0.1 points or less; tempo alone moved it by 0.4. It has the most leverage in
// the engine (tempoF carries 0.22 against 0.05-0.10 for the rest) and it pushes
// attack up while pulling defence down, so a fast side's games get higher-scoring
// from both ends at once. The pooled nine-world result is neutral at the spreads
// below, but widening tempo is not the same as widening the others, and anybody
// stretching 78/22 further should re-measure before believing it is free.
import { isForward } from './bench'
import type { Club, GameState, Tactic } from './model'

export interface Philosophy {
  id: string
  /** the pair this belongs to; the two members mirror about 50 */
  pair: string
  name: string
  /** how they play, one line, for the opposition briefing */
  blurb: string
  /** what it leaves open - the analyst's angle */
  soft: string
  /** All six dials the engine reads (20C added the without-ball pair). The
   *  defensive two obey the same law as the attacking four: each pair mirrors
   *  exactly about 50, so the world's average stays where the engine was
   *  calibrated. defLine is linear in the engine exactly like the attack
   *  dials; defWidth is a kick-off matchup against the OPPONENT'S style, and
   *  its world mean holds because who you play is uncorrelated with your own
   *  width - measured, not assumed (see the 20C fingerprint note). */
  dials: { style: number; tempo: number; kicking: number; aggression: number; defLine: number; defWidth: number }
  /** true if this member of the pair suits a forward-heavy squad */
  packSide: boolean
}

export const PHILOSOPHIES: Philosophy[] = [
  {
    id: 'pack', pair: 'A', name: 'Forward Dominance', packSide: true,
    blurb: 'They want a shoving match. Maul off the lineout, pick and go, squeeze at the scrum.',
    soft: 'Slow their ball down and the width outside them is decoration.',
    dials: { style: 26, tempo: 42, kicking: 60, aggression: 62, defLine: 56, defWidth: 38 },
  },
  {
    id: 'width', pair: 'A', name: 'Width and Offloads', packSide: false,
    blurb: 'Ball to the edges early and often, with the offload always on in contact.',
    soft: 'Front up in the collisions and their handling starts costing them.',
    dials: { style: 74, tempo: 58, kicking: 40, aggression: 38, defLine: 44, defWidth: 62 },
  },
  {
    id: 'tempo', pair: 'B', name: 'Fast Hands, Fast Feet', packSide: false,
    blurb: 'Tap and go, quick rucks, no time to reset. They want you out of breath by fifty.',
    soft: 'Keep your shape for an hour and the pace they set is the pace they die at.',
    dials: { style: 62, tempo: 78, kicking: 38, aggression: 50, defLine: 58, defWidth: 56 },
  },
  {
    id: 'squeeze', pair: 'B', name: 'Territory and Squeeze', packSide: true,
    blurb: 'Field position first. Long kicks, corner pins, and pressure on your exits.',
    soft: 'Beat the first chaser and there is acres behind their kicking game.',
    dials: { style: 38, tempo: 22, kicking: 62, aggression: 50, defLine: 42, defWidth: 44 },
  },
  {
    id: 'blitz', pair: 'C', name: 'Blitz Defence', packSide: true,
    blurb: 'Up and at you off the line, then kick the turnover long. Built to strangle.',
    soft: 'Go behind the rush rather than into it and the line is stretched thin.',
    dials: { style: 42, tempo: 40, kicking: 66, aggression: 58, defLine: 72, defWidth: 46 },
  },
  {
    id: 'counter', pair: 'C', name: 'Counter-Punch', packSide: false,
    blurb: 'Happy without the ball. They soak it up and strike the moment it breaks loose.',
    soft: 'Hold on to it, build phases, and give them nothing to run at.',
    dials: { style: 58, tempo: 60, kicking: 34, aggression: 42, defLine: 28, defWidth: 54 },
  },
  {
    id: 'chaos', pair: 'D', name: 'Controlled Chaos', packSide: true,
    blurb: 'Fast, physical and loose on purpose. They back themselves in a scramble.',
    soft: 'Discipline. They give away more than they win when it gets messy.',
    dials: { style: 66, tempo: 70, kicking: 44, aggression: 66, defLine: 62, defWidth: 60 },
  },
  {
    id: 'structure', pair: 'D', name: 'Structure and Discipline', packSide: false,
    blurb: 'Patient phase play off a set plan, and they will not hand you penalties.',
    soft: 'Force them off script early. Improvising is not what they practise.',
    dials: { style: 34, tempo: 30, kicking: 56, aggression: 34, defLine: 38, defWidth: 40 },
  },
]

export const PHILOSOPHY_BY_ID: Record<string, Philosophy> = Object.fromEntries(
  PHILOSOPHIES.map(p => [p.id, p]),
)

const PAIRS = ['A', 'B', 'C', 'D']

/** Deterministic on (seed, club, coach generation). No shared rng. */
function hash(seed: number, key: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return (h >>> 0) % 1000
}

/**
 * The raw gap between what this club has up front and what it has out wide,
 * averaged over whoever is on the books, on the attributes each half is judged
 * on. Positive leans towards the pack.
 */
function rawTilt(state: GameState, club: Club): number {
  let fw = 0, fwN = 0, bk = 0, bkN = 0
  for (const id of club.players) {
    const p = state.players[id]
    if (!p) continue
    if (isForward(p.pos)) {
      fw += (p.a.scr + p.a.lin + p.a.ruc + p.a.str) / 4
      fwN++
    } else {
      bk += (p.a.pac + p.a.han + p.a.vis + p.a.agi) / 4
      bkN++
    }
  }
  if (!fwN || !bkN) return 0
  return fw / fwN - bk / bkN
}

/**
 * The middle of the raw gaps across the whole world.
 *
 * This exists because of a measured failure, not a theory. The first cut asked
 * whether the raw gap was above zero, and 67% of clubs came out pack-heavy: the
 * attributes a forward is judged on simply generate a couple of points higher
 * than the ones a back is judged on, so zero is not the middle of anything. Two
 * dugouts in three took the pack-side idea, and the world averages drifted to
 * style 47.5 and aggression 53.4 - a quietly tighter, dirtier world than the one
 * the engine was calibrated against.
 *
 * Comparing against the world's own median puts half the clubs each side by
 * construction, which is what mean-neutrality needs, and it says something truer
 * anyway: not "strong up front" but "stronger up front THAN MOST".
 */
function worldTiltMedian(state: GameState): number {
  const gaps: number[] = []
  for (const c of Object.values(state.clubs)) {
    if (!c.players.length) continue
    gaps.push(rawTilt(state, c))
  }
  if (!gaps.length) return 0
  gaps.sort((a, b) => a - b)
  const mid = gaps.length >> 1
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
}

/**
 * How far this club leans towards its pack compared with the rest of the world.
 * Positive means stronger up front than most, negative stronger out wide.
 */
export function packTilt(state: GameState, club: Club, median?: number): number {
  return rawTilt(state, club) - (median ?? worldTiltMedian(state))
}

/**
 * The philosophy a new head coach at this club brings with him.
 *
 * `gen` counts how many coaches this club has been through, so the man who
 * replaces a sacked coach does not simply arrive with the same ideas.
 */
export function pickPhilosophy(state: GameState, club: Club, gen = 0, median?: number): string {
  const pair = PAIRS[hash(state.seed, `${club.id}|${gen}`) % PAIRS.length]
  const members = PHILOSOPHIES.filter(p => p.pair === pair)
  // the tilt decides which way round: a squad stronger up front than most gets
  // the pack-side idea. A dead-level squad falls to the hash rather than always
  // one side, which is what would quietly bias the world average.
  const tilt = packTilt(state, club, median)
  const wantPack = tilt === 0 ? hash(state.seed, `${club.id}|${gen}|t`) % 2 === 0 : tilt > 0
  return (members.find(p => p.packSide === wantPack) ?? members[0]).id
}

/** Write a philosophy onto a club: the id it is remembered by, and the dials. */
export function applyPhilosophy(club: Club, id: string) {
  const ph = PHILOSOPHY_BY_ID[id]
  if (!ph) return
  club.philosophy = id
  club.tactic.style = ph.dials.style
  club.tactic.tempo = ph.dials.tempo
  club.tactic.kicking = ph.dials.kicking
  club.tactic.aggression = ph.dials.aggression
  club.tactic.defLine = ph.dials.defLine
  club.tactic.defWidth = ph.dials.defWidth
}

/** Give every dugout but yours an idea. Used at kickoff of a career and on load. */
export function seedPhilosophies(state: GameState) {
  const median = worldTiltMedian(state)   // measured once, not once per club
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    if (club.philosophy && PHILOSOPHY_BY_ID[club.philosophy]) {
      // a save from before 20C has the coach's attacking idea but not his
      // defensive one: re-applying is idempotent on the four old dials and
      // fills in the two new ones, so old saves defend with an identity too
      if (club.tactic.defLine == null) applyPhilosophy(club, club.philosophy)
      continue
    }
    applyPhilosophy(club, pickPhilosophy(state, club, club.coachGen ?? 0, median))
  }
}

/** A new man in the chair: he brings his own, and it is not always different. */
export function newCoachPhilosophy(state: GameState, club: Club) {
  club.coachGen = (club.coachGen ?? 0) + 1
  applyPhilosophy(club, pickPhilosophy(state, club, club.coachGen))
}

/** Reading the opposition: what they do, and where it leaves them open. */
export function philosophyOf(club: Club | undefined): Philosophy | null {
  if (!club?.philosophy) return null
  return PHILOSOPHY_BY_ID[club.philosophy] ?? null
}

/**
 * What the assistant would do about it.
 *
 * A philosophy you can read but not answer is decoration, so every one of the
 * eight has a counter: the dials the assistant recommends and the reason in one
 * line. This is advice, not an instruction - the sliders stay yours, and the
 * counter is a starting point rather than a solved problem, because it cannot
 * see whether you have the pack to back it up.
 */
export interface Counter {
  line: string
  dials: { style: number; tempo: number; kicking: number; aggression: number }
}

export const COUNTER: Record<string, Counter> = {
  pack: {
    line: 'Meet them up front. Go wide off slow ball against that pack and they will eat you at the breakdown.',
    dials: { style: 34, tempo: 44, kicking: 62, aggression: 62 },
  },
  width: {
    line: 'Pin them in their own half and make them play from deep, where all that width costs them more than it gains.',
    dials: { style: 40, tempo: 40, kicking: 68, aggression: 56 },
  },
  tempo: {
    line: 'Slow it down. Every reset is a breather you take and they do not want.',
    dials: { style: 38, tempo: 30, kicking: 64, aggression: 44 },
  },
  squeeze: {
    line: 'Run it back at them. A side that lives on field position hates chasing.',
    dials: { style: 62, tempo: 60, kicking: 30, aggression: 46 },
  },
  blitz: {
    line: 'Go round the rush rather than into it, and keep the penalty count clean so they get no easy exits.',
    dials: { style: 66, tempo: 56, kicking: 44, aggression: 44 },
  },
  counter: {
    line: 'Give them nothing loose. Build phases and kick only when the chase is set.',
    dials: { style: 44, tempo: 44, kicking: 58, aggression: 52 },
  },
  chaos: {
    line: 'Be the disciplined side and let them give it away. Do not join the scrap.',
    dials: { style: 40, tempo: 36, kicking: 60, aggression: 34 },
  },
  structure: {
    line: 'Rush them off their script early. Speed and pressure beat a plan they have rehearsed all week.',
    dials: { style: 60, tempo: 68, kicking: 40, aggression: 58 },
  },
}

export const counterTo = (id: string | undefined): Counter | null => (id ? COUNTER[id] ?? null : null)

/** The dials as a one-line readout, for the briefing card. All six now: how
 *  a side defends is public knowledge too - you can watch them (20C). */
export function dialLine(t: Tactic): string {
  const band = (v: number, lo: string, mid: string, hi: string) => (v >= 62 ? hi : v <= 38 ? lo : mid)
  return [
    band(t.style, 'tight', 'even', 'wide'),
    band(t.tempo, 'slow', 'steady', 'quick'),
    band(t.kicking, 'ball in hand', 'mixed', 'kick-heavy'),
    band(t.aggression, 'clean', 'firm', 'abrasive'),
    band(t.defLine ?? 50, 'passive line', 'measured line', 'blitzing line'),
    band(t.defWidth ?? 50, 'narrow defence', 'balanced defence', 'spread defence'),
  ].join(' · ')
}
