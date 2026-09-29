// ---- DEVELOPMENT AS A PROJECT (1.8.2, "mastery") ----
//
// Owner's brief: the player should master the simulation, with uncertainty,
// judgement and consequence; never show hidden numbers, show what the staff
// believe. For a young player that means four things this file owns:
//
//   HOW HE LEARNS. Every man has a hidden learning profile, a pure function of
//   (world seed, id) like the late bloomer and the hidden consistency: a tempo
//   (an early developer, the ordinary curve, or the existing late bloomer) and
//   up to one group of skills he picks up unusually quickly and one he is slow
//   at. Nothing is stored, so every save already has one and there is nothing
//   in the file to find. The summer's attribute shift leans towards the quick
//   group and away from the slow one (zero-sum on the rating, so it changes
//   what kind of player he becomes, never how good the game thinks he is), a
//   programme aimed at the quick group lands more often, and the tempo moves
//   when his growth comes.
//
//   WHAT DRIVES IT, WEEK BY WEEK. devDrive is one bounded multiplier on the
//   weekly growth chances (the in-season bump every club's youngsters take,
//   the development focus and the personal plans): minutes, confidence (read
//   off his last three match ratings, nothing stored), playing in his own
//   position, whether his game suits the side's style, and the Centre of
//   Excellence for the under-21s. Each term is small and the whole clamped.
//   On top of that the weeks come in spells (devPhase): a flat month where
//   little sticks, a month where everything does, mostly ordinary ones. The
//   spell is a hash of (seed, id, four-week block), mean one.
//
//   A CEILING THAT MOVES. At the end of each season (seasonReview, called from
//   the rollover's stats archive, while the season's numbers still exist) a
//   young man's true potential can drift a point or two: a breakthrough season
//   or a late bloomer lifts it, a stalled or benched one lowers it, an early
//   developer's closes in. Bounded to PA_DRIFT_MAX either side of where it
//   started (p.pa0, written the first time it moves) and never below his
//   rating. Every club's players, so the world is run by the same rules.
//
//   WHAT THE STAFF SAY. The coaches learn his profile by working with him
//   (weeks at the club, matches for it, the assistant and the Centre of
//   Excellence shorten it) and say so in plain words. The ceiling of your own
//   young player is an estimate until about 23 (scout.ts paRange), and the
//   season review writes a compact timeline for the manager's own players:
//   season, rating at its end, and the moments (debut, breakthrough, stall,
//   long injury, the staff raising or lowering their sights).
//
// Balance: every weekly term is centred on the world's mean, measured, and
// scripts/devprojectprobe.ts, growthprobe, gapprobe and releasesim hold it.

import type { Attrs, Club, GameState, Player, Pos, TrainingFocus } from './model'
import { absWeek, SEASON_WEEKS, XV_SLOTS } from './model'
import { attrWeight, benchDrag, isLateBloomer } from './attributes'
import { clamp, mulberry32 } from './rng'

type K = keyof Attrs

export type Group = 'defence' | 'attack' | 'physical' | 'setpiece' | 'kicking' | 'reading'
export const GROUPS: Group[] = ['defence', 'attack', 'physical', 'setpiece', 'kicking', 'reading']
export const GROUP_ATTRS: Record<Group, K[]> = {
  defence: ['tac', 'pos', 'ruc'],
  attack: ['han', 'pas'],
  physical: ['pac', 'agi', 'sta', 'str'],
  setpiece: ['scr', 'lin'],
  kicking: ['kic', 'goa'],
  reading: ['vis', 'dec'],
}
/** Which learning group a training programme works on. */
export const FOCUS_GROUP: Record<TrainingFocus, Group | null> = {
  balanced: null, scrum: 'setpiece', lineout: 'setpiece', attack: 'attack',
  defence: 'defence', fitness: 'physical', kicking: 'kicking',
}

export type Tempo = 'early' | 'steady' | 'late'
export interface Learning { tempo: Tempo; quick: Group | null; slow: Group | null }

/** One uniform 0..1 per (seed, id, salt, n): no rng draw is spent. */
export function devHash(seed: number, id: number, salt: number, n = 0): number {
  return mulberry32((seed ^ Math.imul(id + 1, 0x7feb352d) ^ Math.imul(salt + 1, 0x846ca68b) ^ Math.imul(n + 7, 0x9e3779b1)) >>> 0)()
}

/** Does this group mean anything in this position? A winger's scrummaging
 *  and a prop's goal kicking are not a learning profile worth having. */
function groupFits(pos: Pos, g: Group): boolean {
  const ks = GROUP_ATTRS[g].filter(k => k !== 'goa')
  return ks.reduce((s, k) => s + attrWeight(pos, k), 0) / ks.length >= 0.3
}

/** Early developers, one in twelve, like the late bloomers (attributes.ts),
 *  and never both. */
export const EARLY_RATE = 0.085

/** His hidden learning profile. Pure: the same answer on every screen and in
 *  every save, nothing stored. */
export function learning(seed: number, p: Pick<Player, 'id' | 'pos'>): Learning {
  const tempo: Tempo = isLateBloomer(seed, p.id) ? 'late'
    : devHash(seed, p.id, 1) < EARLY_RATE ? 'early' : 'steady'
  const opts = GROUPS.filter(g => groupFits(p.pos, g))
  const pick = (u: number, not: Group | null) => {
    const o = opts.filter(g => g !== not)
    return o.length ? o[Math.floor(u * o.length) % o.length] : null
  }
  const quick = devHash(seed, p.id, 2) < 0.55 ? pick(devHash(seed, p.id, 3), null) : null
  const slow = devHash(seed, p.id, 4) < 0.45 ? pick(devHash(seed, p.id, 5), quick) : null
  return { tempo, quick, slow }
}

// ------------------------------------------------------------------
// The tempo: when the growth comes
// ------------------------------------------------------------------

/** How the tempo scales a growth chance at this age. An early developer grows
 *  fast to 20 and slowly after; a late bloomer (whose summer clock rollover.ts
 *  already runs slow) is a little behind as a teenager. About mean one across
 *  a career, measured on the world. */
export function tempoF(t: Tempo, age: number): number {
  if (t === 'early') return age <= 20 ? 1.3 : age <= 23 ? 0.7 : 1
  if (t === 'late') return age <= 20 ? 0.85 : 1
  return 1
}

// ------------------------------------------------------------------
// The weekly drivers
// ------------------------------------------------------------------

/** The position a man is in on his club's current team sheet (XV only), or null. */
export function sheetPos(state: GameState, p: Player): Pos | null {
  const club = p.clubId ? state.clubs[p.clubId] : null
  const lu = club?.tactic?.lineup
  if (!lu) return null
  const i = lu.indexOf(p.id)
  return i >= 0 && i < 15 ? XV_SLOTS[i]?.pos ?? null : null
}

/** The mean match rating the world plays to: confidence reads a man's last
 *  three against it. Measured, not assumed: every rating in every man's last
 *  ten at the end of three seasons, seed 777, averaged 6.09, 6.08 and 6.09. */
export const CONF_CENTRE = 6.1

/**
 * Confidence, -1..1, from what he has actually done lately: his last three
 * match ratings against the world's mean, fading once he has not played for a
 * few weeks (and gone with the summer's wipe of the week he last played).
 * Nothing stored: every man in the world has one and it costs the save
 * nothing.
 */
export function confidence(state: GameState, p: Player): number {
  const rs = p.ratings
  if (!rs?.length || p.lastWk == null) return 0
  const recent = rs.slice(-3)
  const r = recent.reduce((a, b) => a + b, 0) / recent.length
  const since = state.week - p.lastWk
  const fade = since <= 2 ? 1 : since <= 6 ? 0.5 : 0
  return clamp((r - CONF_CENTRE) / 1.1, -1, 1) * fade
}

/** A heavy load of senior rugby for a young body: an under-22 senior who has
 *  started most of the matches he was available for, a dozen or more. */
export function heavyLoad(p: Player): boolean {
  if (p.acad || p.age > 21) return false
  const avail = p.avail ?? 0
  return avail >= 10 && p.stats.starts >= 12 && p.stats.starts >= avail * 0.8
}

/** Styles the side plays, off the club's own dials: which learning groups it
 *  rewards. A forward-oriented, physical side rewards the set piece and the
 *  body; an expansive, fast one the hands and the reading of the game; a
 *  kicking side the boot; a rush defence the defensive system. */
export function styleGroups(club: Club | null | undefined): Group[] {
  const tc = club?.tactic
  if (!tc) return []
  const out: Group[] = []
  if (tc.style <= 40) out.push('setpiece')
  if (tc.style >= 60) out.push('attack')
  if (tc.tempo >= 62) out.push('reading')
  if (tc.aggression >= 60 && tc.style <= 50) out.push('physical')
  if (tc.kicking >= 60) out.push('kicking')
  if ((tc.defLine ?? 50) >= 62) out.push('defence')
  return out
}

/** Tactical fit: +1 when the side's style rewards what he learns quickly,
 *  -1 when it leans on what he is slow at, 0 otherwise. */
export function styleFit(state: GameState, p: Player): -1 | 0 | 1 {
  const club = p.clubId ? state.clubs[p.clubId] : null
  const gs = styleGroups(club)
  if (!gs.length) return 0
  const l = learning(state.seed, p)
  const up = l.quick != null && gs.includes(l.quick)
  const down = l.slow != null && gs.includes(l.slow)
  return up && !down ? 1 : down && !up ? -1 : 0
}

/** The world's mean Centre of Excellence level, which the u21 term is centred
 *  on (measured on fresh worlds, both genders: 1.9, the same figure devFactor
 *  centres the academy estate on). */
export const COE_MEAN = 1.9

export interface DriveParts {
  minutes: number
  conf: number
  position: number
  fit: number
  coe: number
}

/** The weekly drivers, each as its signed share of the multiplier. */
export function driveParts(state: GameState, p: Player): DriveParts {
  const out: DriveParts = { minutes: 0, conf: 0, position: 0, fit: 0, coe: 0 }
  const club = p.clubId ? state.clubs[p.clubId] : null
  if (!club) return out
  // MINUTES: first-team rugby teaches a young senior; weeks on the outside
  // do not (a professional loses less of it, attributes.ts benchDrag). The
  // academy's own games are academy.ts's business.
  if (!p.acad && p.age <= 22) {
    const since = p.lastWk == null ? 99 : state.week - p.lastWk
    if (since <= 2) out.minutes = 0.14
    else if (since >= 5 && state.week >= 6) out.minutes = -0.08 * benchDrag(p)
    // and the centring: measured over the world's young seniors (seed 777,
    // three seasons, every fourth week) the two terms averaged +0.037, so
    // the world's mean young man grows exactly as he did and what moves is
    // WHO grows: the ones playing
    out.minutes -= 0.037
  }
  out.conf = 0.1 * confidence(state, p)
  // POSITION: learning a trade in another man's shirt
  const at = sheetPos(state, p)
  if (at && at !== p.pos && (p.lastWk ?? -9) >= state.week - 2) {
    out.position = p.alt.includes(at) ? -0.05 : -0.2
  }
  out.fit = 0.06 * styleFit(state, p)
  if (p.age <= 21) out.coe = ((club.facilities?.academy ?? 0) - COE_MEAN) * 0.04
  return out
}

/** The weekly growth multiplier, clamped: nothing stacks past it. */
export function devDrive(state: GameState, p: Player): number {
  const d = driveParts(state, p)
  const f = 1 + d.minutes + d.conf + d.position + d.fit + d.coe
  return clamp(f * tempoF(learning(state.seed, p).tempo, p.age), 0.6, 1.45)
}

export type Phase = 'stall' | 'normal' | 'surge'
/** The spell he is in this month: a fifth of months flat, a fifth flying. */
export function devPhase(state: GameState, p: Pick<Player, 'id'>, week = state.week): Phase {
  const block = Math.floor(absWeek(state.season, week) / 4)
  const u = devHash(state.seed, p.id, 11, block)
  return u < 0.2 ? 'stall' : u >= 0.8 ? 'surge' : 'normal'
}
export const PHASE_F: Record<Phase, number> = { stall: 0.25, normal: 1, surge: 1.75 }

/** The whole weekly factor: drivers times the month's spell. */
export function weekGrowth(state: GameState, p: Player): number {
  return devDrive(state, p) * PHASE_F[devPhase(state, p)]
}

/** How much more (or less) often a programme on this group lands for him. */
export function planAffinity(seed: number, p: Pick<Player, 'id' | 'pos'>, plan: TrainingFocus | null | undefined): number {
  const g = plan ? FOCUS_GROUP[plan] : null
  if (!g) return 1
  const l = learning(seed, p)
  return g === l.quick ? 1.35 : g === l.slow ? 0.7 : 1
}

/** The summer's lean, in attribute points, towards what he learns quickly and
 *  away from what he is slow at: while he is still growing (to 24), zero-sum
 *  on the rating scale so his
 *  rating is exactly what it was. Goal kicking sits outside the rating and
 *  takes its share for free. */
export function learnTilt(seed: number, p: Pick<Player, 'id' | 'pos' | 'age'>): Partial<Record<K, number>> {
  if (p.age > 24) return {}
  const l = learning(seed, p)
  if (!l.quick && !l.slow) return {}
  const LEVEL: K[] = ['tac', 'str', 'scr', 'lin', 'ruc', 'han', 'pas', 'kic', 'pac', 'sta', 'agi', 'vis', 'dec', 'pos', 'agg', 'wor']
  const slope = (k: K) => (0.45 + 0.55 * attrWeight(p.pos, k)) / 5
  // on ageShape's scale (rating points per attribute, before the slope): a
  // teenager's pace grows 1.5 a summer on it, so 2.5 is a clear lean that
  // shows on the sheet over four or five summers, not a new player
  const T = 2.5
  const r: Partial<Record<K, number>> = {}
  if (l.quick) for (const k of GROUP_ATTRS[l.quick]) if (k !== 'goa') r[k] = (r[k] ?? 0) + T
  if (l.slow) for (const k of GROUP_ATTRS[l.slow]) if (k !== 'goa') r[k] = (r[k] ?? 0) - T
  // centre over the rated attributes, so the level (attrLevel) cannot move
  const net = LEVEL.reduce((s, k) => s + (r[k] ?? 0), 0) / LEVEL.length
  const out: Partial<Record<K, number>> = {}
  for (const k of LEVEL) out[k] = ((r[k] ?? 0) - net) * slope(k)
  // goal kicking: the kicking learner's boot, off the rating's books
  if (l.quick === 'kicking') out.goa = 0.2
  if (l.slow === 'kicking') out.goa = -0.2
  return out
}

// ------------------------------------------------------------------
// The season review: the ceiling that moves, and the timeline
// ------------------------------------------------------------------

/** How far a ceiling may drift from where it started, either way. */
export const PA_DRIFT_MAX = 6

/** Timeline moment flags, one bit each (Player.tl). */
export const TL = {
  debut: 1, breakthrough: 2, stall: 4, injury: 8, joined: 16, up: 32, down: 64, plan: 128,
} as const
export const TL_MAX = 12

/** Is a man still young enough for his ceiling to be in question? */
export const driftAge = (seed: number, p: Pick<Player, 'id' | 'age'>) =>
  p.age <= (isLateBloomer(seed, p.id) ? 25 : 22)

export interface ReviewOut { d: number; gain: number; flags: number }

/**
 * One man's season, reviewed at the stats archive (rollover.ts), before the
 * season's numbers are wiped and before his summer growth. Moves his true
 * ceiling (every club, the same rules) and, for the manager's own men, writes
 * the timeline row. Hash-rolled: no rng draw is spent, so the summer's rolls
 * are the same rolls.
 */
export function seasonReview(state: GameState, p: Player, planned = false): ReviewOut {
  const seed = state.seed
  const gain = p.ca - (p.ca0 ?? p.ca)
  const apps = p.stats.apps
  const avg = apps ? p.stats.ratingSum / apps : 0
  const room = p.pa - p.ca
  const l = learning(seed, p)
  let flags = 0
  let d = 0
  if (driftAge(seed, p) && p.clubId) {
    const u = (n: number) => devHash(seed, p.id, 20 + n, state.season)
    let up = 0, down = 0
    // the season he arrived: a dozen starts at a decent standard
    if (!p.acad && p.stats.starts >= 10 && avg >= CONF_CENTRE + 0.6) { up += u(0) < 0.3 ? 1 : 0; flags |= TL.breakthrough }
    else if (gain >= 5) { up += u(1) < 0.15 ? 1 : 0; flags |= TL.breakthrough }
    // stalled: a whole season and nothing to show for it, with room to grow
    if (gain <= 0 && room >= 6) { down += u(2) < 0.35 ? 1 : 0; flags |= TL.stall }
    // parked: a young senior who hardly played
    if (!p.acad && p.age >= 19 && p.stats.starts <= 2) down += u(3) < 0.25 * benchDrag(p) ? 1 : 0
    // a season that shook him
    if (apps >= 6 && avg < CONF_CENTRE - 0.5) down += u(4) < 0.2 ? 1 : 0
    // the tempo: the late bloomer's upside keeps arriving, the early
    // developer's closes in
    if (l.tempo === 'late' && p.age >= 21) up += u(5) < 0.4 ? 1 : 0
    if (l.tempo === 'early' && p.age >= 21) down += u(6) < 0.4 ? 1 : 0
    // and the unexplained: some lads just kick on, some do not
    up += u(7) < 0.03 ? 1 : 0
    down += u(8) < 0.07 ? 1 : 0
    // the top is hard in this direction too (the elite damping in agePlayers):
    // a ceiling of 88 rises half as often, one of 92 not at all
    if (up && p.pa >= 92) up = 0
    else if (up && p.pa >= 88 && u(9) < 0.5) up -= 1
    d = clamp(up - down, -2, 2)
    if (d) {
      const pa0 = p.pa0 ?? p.pa
      const next = clamp(p.pa + d, Math.max(p.ca, pa0 - PA_DRIFT_MAX), Math.min(99, pa0 + PA_DRIFT_MAX))
      if (next !== p.pa) {
        p.pa0 = pa0
        d = next - p.pa
        p.pa = next
      } else d = 0
    }
  }
  if (p.clubId === state.userClubId) {
    if (apps > 0 && p.career.every(c => c.apps === 0) && !(p.hist?.apps)) flags |= TL.debut
    const seasonStart = absWeek(state.season, 1)
    if (p.joinedAt != null && p.joinedAt >= seasonStart) flags |= TL.joined
    const hurt = (p.injLog ?? []).filter(e => e.s === state.season).reduce((s, e) => s + e.weeks, 0)
    if (hurt >= 8) flags |= TL.injury
    if (planned) flags |= TL.plan
    if (!driftAge(seed, p)) flags &= ~(TL.breakthrough | TL.stall)
    const row: [number, number, number] = [state.season, p.ca, flags]
    p.tl = [...(p.tl ?? []), row].slice(-TL_MAX)
  }
  return { d, gain, flags }
}

/** After the summer, the staff's sights for the manager's own young men: the
 *  estimate's middle now against before, written onto the season's row as
 *  "raised" or "lowered" when it moved by two or more. */
export function markSights(p: Player, before: number | null, after: number | null) {
  if (before == null || after == null || !p.tl?.length) return
  const row = p.tl[p.tl.length - 1]
  if (after - before >= 2) row[2] |= TL.up
  else if (before - after >= 2) row[2] |= TL.down
}

// ------------------------------------------------------------------
// What the staff know, and say
// ------------------------------------------------------------------

/** Weeks the coaches have had him: since he joined, or since the world began
 *  for a man who was always here; plus a week for every match for the club. */
export function staffWeeks(state: GameState, p: Player): number {
  if (p.clubId !== state.userClubId) return 0
  const now = absWeek(state.season, state.week)
  const since = p.joinedAt != null ? now - p.joinedAt : now - absWeek(0, 1) + SEASON_WEEKS
  return Math.max(0, since) + p.stats.apps
}

/** How much quicker the staff read him: the assistant's badge and, for the
 *  under-21s the Centre of Excellence works with, its level. */
export function staffSight(state: GameState, p: Player): number {
  const club = state.clubs[state.userClubId]
  const coe = p.age <= 21 ? (club?.facilities?.academy ?? 0) : 0
  return 1 + (state.staff?.assistant ?? 0) * 0.15 + coe * 0.1
}

/** The weeks it takes the staff to see each part of his profile: hashed per
 *  man, so two lads signed the same day are read at different times. */
function needWeeks(seed: number, id: number, what: number): number {
  const u = devHash(seed, id, 30 + what)
  return what === 0 ? 10 + u * 16 : what === 1 ? 18 + u * 22 : 24 + u * 16
}

export interface DevLine { k: string; v?: Record<string, string | number> }

/**
 * The staff's read of how he learns, in plain words. The manager's own men
 * only, and only what the coaches have had time to see: the quick group
 * first, the slow one later, the tempo only once his age can show it (an
 * early developer from 21, a late bloomer from 23). Never a label, never a
 * number.
 */
export function learningLines(state: GameState, p: Player, scoutFull = false): DevLine[] {
  const l = learning(state.seed, p)
  const out: DevLine[] = []
  if (p.clubId !== state.userClubId) {
    // another club's man: only the full file says anything, and hedged
    if (!scoutFull) return out
    if (l.quick) out.push({ k: `dev.scoutQuick.${l.quick}` })
    return out
  }
  const w = staffWeeks(state, p) * staffSight(state, p)
  if (l.quick && w >= needWeeks(state.seed, p.id, 0)) out.push({ k: `dev.quick.${l.quick}` })
  if (l.slow && w >= needWeeks(state.seed, p.id, 1)) out.push({ k: `dev.slow.${l.slow}` })
  if (l.tempo === 'early' && p.age >= 21 && w >= needWeeks(state.seed, p.id, 2)) out.push({ k: 'dev.tempoEarly' })
  if (l.tempo === 'late' && p.age >= 23 && w >= needWeeks(state.seed, p.id, 2)) out.push({ k: 'dev.tempoLate' })
  if (!out.length && p.age <= 23 && (l.quick || l.slow)) out.push({ k: 'dev.learningPending' })
  return out
}

/** What is helping or holding him back this month, strongest first, at most
 *  three, as the staff would put it. */
export function driverLines(state: GameState, p: Player): DevLine[] {
  if (p.clubId !== state.userClubId || p.age > 23) return []
  const d = driveParts(state, p)
  const c = confidence(state, p)
  const rows: { k: string; w: number }[] = []
  if (d.position < 0) rows.push({ k: 'dev.wrongPos', w: -d.position })
  if (heavyLoad(p)) rows.push({ k: 'dev.heavyLoad', w: 0.19 })
  else if (d.minutes > 0.05) rows.push({ k: 'dev.minutesGood', w: d.minutes })
  else if (d.minutes < -0.03) rows.push({ k: 'dev.minutesNone', w: -d.minutes })
  if (c >= 0.45) rows.push({ k: 'dev.confHigh', w: d.conf })
  else if (c <= -0.45) rows.push({ k: 'dev.confLow', w: -d.conf })
  // the style fit is only said once the staff know what he learns quickly
  const lines = learningLines(state, p).map(x => x.k)
  if (d.fit > 0 && lines.some(k => k.startsWith('dev.quick.'))) rows.push({ k: 'dev.fitGood', w: d.fit })
  if (d.fit < 0 && lines.some(k => k.startsWith('dev.slow.'))) rows.push({ k: 'dev.fitPoor', w: -d.fit })
  if (p.age <= 21) {
    const coe = state.clubs[state.userClubId]?.facilities?.academy ?? 0
    if (coe >= 3) rows.push({ k: 'dev.coeHelp', w: d.coe })
    else if (coe <= 1) rows.push({ k: 'dev.coeLack', w: -d.coe })
  }
  const ph = devPhase(state, p)
  if (ph === 'stall') rows.push({ k: 'dev.phaseStall', w: 0.12 })
  else if (ph === 'surge') rows.push({ k: 'dev.phaseSurge', w: 0.12 })
  return rows.sort((a, b) => b.w - a.w).slice(0, 3).map(r => ({ k: r.k }))
}

/** How the season is going against what the staff expected of him: one
 *  line, for a man young enough for the question to matter. `band` is the
 *  staff's estimate of his ceiling (scout.ts paRange). */
export function outlookLine(state: GameState, p: Player, band: [number, number] | null): DevLine | null {
  if (p.clubId !== state.userClubId || p.age > 23) return null
  const last = p.tl?.[p.tl.length - 1]
  const fresh = last && last[0] === state.season - 1 && state.week <= 16
  if (band && band[1] - p.ca <= 1) return { k: 'dev.outlookNear' }
  if (fresh && (last[2] & TL.up)) return { k: 'dev.outlookUp' }
  if (fresh && (last[2] & TL.down)) return { k: 'dev.outlookDown' }
  const gain = p.ca - (p.ca0 ?? p.ca)
  if (state.week >= 12) {
    if (gain <= 0 && band && band[0] - p.ca >= 4) return { k: 'dev.outlookStalled' }
    if (gain >= 3) return { k: 'dev.outlookTop' }
  }
  return { k: 'dev.outlookSteady' }
}

/** The month on a man's programme, as the Training screen says it. */
export function monthKey(state: GameState, p: Player): string {
  const g = weekGrowth(state, p)
  return g < 0.55 ? 'dev.monthStall' : g >= 1.4 ? 'dev.monthSurge' : 'dev.monthSteady'
}
