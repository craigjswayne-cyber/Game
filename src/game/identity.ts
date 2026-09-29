/**
 * ---- WHAT KIND OF CLUB THIS IS BECOMING ----
 *
 * Owner's brief: a club's identity should EMERGE from how it is run - the
 * dials, the recruitment, the academy, the books - and then colour everything
 * else a little: who will talk to you, what the academy sends up, what the
 * terraces and the board expect, what sponsors pay, what the Wire writes.
 * Connections, not a screen.
 *
 * FOUR AXES, each -100..+100, each read from state the game already keeps:
 *
 *   play     running rugby (+) against a kicking game (-): the tactic dials,
 *            averaged over the analysts' tendency window where there is one
 *   pack     forward power (+) against back-line flair (-): where the squad's
 *            quality sits (philosophy.packTilt) plus the aggression and style
 *            dials
 *   recruit  academy-first (+) against the chequebook (-): senior minutes
 *            given to homegrown and young men, against transfer fees paid
 *            this season and last, both measured against the wage bill
 *   purse    prudence (+) against living beyond the means (-): the balance
 *            and its trend over the season, against the wage bill
 *
 * SLOW BY CONSTRUCTION. The stored value is a moving average stepped once per
 * settled club match (ALPHA of the gap each time, about two thirds of the way
 * in a season), and a label needs the axis past ON to form and back under OFF
 * to fade. One label changes per step at most. So a manager who switches from
 * kicking to running mid-season sees the Wire notice it the season after, not
 * the Saturday after.
 *
 * NOTHING HERE DRAWS RNG and nothing here is read by the match engine or by
 * any AI club: identity is the user's club's alone, and AI-vs-AI results
 * (scripts/fingerprint.ts) cannot see it.
 *
 * Every effect is small and bounded, and each is listed where it is applied:
 *   interest     a player whose profile fits takes the call from IDENTITY_GAP
 *                more reputation points further down (interest.ts)
 *   academy      an academy club's intake is rolled INTAKE_BONUS quality
 *                points higher (rollover.ts rollIntakeClass)
 *   sponsors     offers carry up to SPONSOR_MAX over the market for a brand
 *                that sells (commercial.ts offersFor)
 *   supporters   an academy club's crowd objects to a big fee spent in a
 *                homegrown regular's shirt (ai.ts executeTransfer)
 *   board/fans   at season's end, an identity sets an expectation that is met
 *                or missed by a couple of points (rollover.ts)
 *   media        the Wire files a story when a label forms or fades
 */
import type { Club, GameState, Player } from './model'
import { absWeek } from './model'
import { clamp } from './rng'
import { tIn, type Vars } from './i18n'
import { isForward } from './bench'
import { packTilt } from './philosophy'
import { memoryLog, remember } from './memory'

export type Axis = 'play' | 'pack' | 'recruit' | 'purse'
export const AXES: Axis[] = ['play', 'pack', 'recruit', 'purse']

export type IdLabel =
  | 'running' | 'kicking'
  | 'pack' | 'flair'
  | 'academy' | 'spenders'
  | 'prudent' | 'stretched'

/** [label when the axis is high, label when it is low] */
const POLES: Record<Axis, [IdLabel, IdLabel]> = {
  play: ['running', 'kicking'],
  pack: ['pack', 'flair'],
  recruit: ['academy', 'spenders'],
  purse: ['prudent', 'stretched'],
}

export interface ClubIdentity {
  /** the club this identity belongs to: a new job starts a new one */
  clubId: string
  v: Record<Axis, number>
  labels: IdLabel[]
  /** absolute week of the last supporters' objection, so one window does not
   *  file five of them */
  objAt?: number
}

/** Share of the gap to the raw read closed per settled club match. */
export const ALPHA = 0.035
/** Hysteresis: an axis must pass ON to earn its label and fall under OFF to
 *  lose it, so a label near the line does not flicker week to week. */
export const ON = 35
export const OFF = 22
/** A club seen for the first time (a new career, an old save, a new job) is
 *  seeded at this share of its raw read: the reputation is half-formed. */
const SEED = 0.5

export const IDENTITY_GAP = 4
export const INTAKE_BONUS = 2
export const SPONSOR_MAX = 1.03
/** a fee this size in a homegrown regular's position is a big-money signing */
export const BIG_FEE = 1_000_000

const user = (state: GameState): Club | undefined => state.clubs[state.userClubId]

/** The dials the club plays to. When SEEDING, a manager's current sliders
 *  count only once the analysts' window holds three matches of them: a new
 *  career's first touch of the tactics screen is a choice, not a history. */
function dials(state: GameState, club: Club, seeding = false) {
  const w = state.tendency ?? []
  if (seeding && w.length < 3) return { style: 50, tempo: 50, kicking: 50, aggression: 50 }
  if (w.length) {
    const m = (k: 'style' | 'tempo' | 'kicking' | 'aggression') => w.reduce((s, e) => s + e[k], 0) / w.length
    return { style: m('style'), tempo: m('tempo'), kicking: m('kicking'), aggression: m('aggression') }
  }
  const t = club.tactic
  return { style: t.style, tempo: t.tempo, kicking: t.kicking, aggression: t.aggression }
}

function seniors(state: GameState, club: Club): Player[] {
  return club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.acad)
}

/** The world's middle pack tilt, read once a season: it walks the whole
 *  world's squads, and the identity steps every club match. */
const medianMemo = new WeakMap<GameState, { season: number; m: number }>()
function tiltMedian(state: GameState): number {
  const hit = medianMemo.get(state)
  if (hit && hit.season === state.season) return hit.m
  const gaps = Object.values(state.clubs).filter(c => c.players.length).map(c => packTilt(state, c, 0)).sort((a, b) => a - b)
  const mid = gaps.length >> 1
  const m = !gaps.length ? 0 : gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
  medianMemo.set(state, { season: state.season, m })
  return m
}

/** The raw read of the club as it stands today, before any smoothing. Pure. */
export function rawIdentity(state: GameState, seeding = false): Record<Axis, number> {
  const club = user(state)
  if (!club) return { play: 0, pack: 0, recruit: 0, purse: 0 }
  const d = dials(state, club, seeding)

  const play = (d.style - 50) * 0.8 + (d.tempo - 50) * 0.5 - (d.kicking - 50)
  const pack = packTilt(state, club, tiltMedian(state)) * 40 + (d.aggression - 50) * 0.5 - (d.style - 50) * 0.5

  const sq = seniors(state, club)
  let tot = 0, hg = 0, young = 0, wages = 0
  for (const p of sq) {
    const w = p.stats.apps + 1
    tot += w
    if (p.homegrown) hg += w
    if (p.age <= 21) young += w
    wages += p.wage
  }
  const annual = Math.max(1, wages * 52)
  const mine = (b: GameState['books']) => (b && b.clubId === club.id ? b : undefined)
  const spend = -((mine(state.books)?.lines.buys ?? 0) + (mine(state.booksPrev)?.lines.buys ?? 0))
  const recruit = tot
    ? (hg / tot) * 220 + (young / tot) * 80 - (spend / annual) * 250 - 10
    : 0

  const opening = mine(state.books)?.opening ?? club.balance
  // the trend is capped: one big summer of spending out of a full account is
  // the recruit axis's business, not a sign the club is living beyond its means
  const purse = (club.balance / annual) * 120 + clamp((club.balance - opening) / annual, -0.4, 0.4) * 150

  const c = (x: number) => (Number.isFinite(x) ? clamp(Math.round(x), -100, 100) : 0)
  return { play: c(play), pack: c(pack), recruit: c(recruit), purse: c(purse) }
}

function labelsFor(v: Record<Axis, number>, held: IdLabel[] = []): IdLabel[] {
  const out: IdLabel[] = []
  for (const a of AXES) {
    const [hi, lo] = POLES[a]
    if (v[a] >= ON || (held.includes(hi) && v[a] >= OFF)) out.push(hi)
    else if (v[a] <= -ON || (held.includes(lo) && v[a] <= -OFF)) out.push(lo)
  }
  return out
}

/** The user's club identity: the stored one, or a fresh read seeded from the
 *  current state for a save or a job that has none yet. Pure. */
export function identityOf(state: GameState): ClubIdentity {
  const id = state.identity
  if (id && id.clubId === state.userClubId) return id
  // the seed reads the whole world's pack tilt, and the Transfer Centre asks
  // once per player it lists: remember it for the week
  const key = `${state.userClubId}|${state.season}|${state.week}`
  const hit = seedMemo.get(state)
  if (hit && hit.key === key) return hit.id
  const raw = rawIdentity(state, true)
  const v = { play: 0, pack: 0, recruit: 0, purse: 0 }
  for (const a of AXES) v[a] = Math.round(raw[a] * SEED)
  const fresh: ClubIdentity = { clubId: state.userClubId, v, labels: labelsFor(v) }
  seedMemo.set(state, { key, id: fresh })
  return fresh
}
const seedMemo = new WeakMap<GameState, { key: string; id: ClubIdentity }>()

export const hasLabel = (state: GameState, l: IdLabel): boolean =>
  !state.unemployed && identityOf(state).labels.includes(l)

/**
 * HELD, NOT FILED. News, players and fixtures share state.nextId and a
 * fixture's dice are seeded from its id, so a story that took an id mid-settle
 * would move every later draw and change AI results. Identity's stories wait in
 * memory.ts's queue and take a fractional id in flushMemoryNews() at the end of
 * the settle, which never advances the counter.
 */
function wire(state: GameState, k: string, v: Vars, type: 'gossip' | 'board' = 'gossip', playerId?: number, summer = false) {
  ;(memoryLog(state).queue ??= []).push({
    week: summer ? 1 : state.week,
    season: summer ? state.season + 1 : state.season,
    type, read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v, playerId,
  })
}

/**
 * Step the identity once, after a settled club match (season.ts, next to
 * recordTendency). Moves each axis ALPHA of the way to the raw read, then lets
 * at most ONE label form or fade, and the Wire writes it up.
 */
export function stepIdentity(state: GameState) {
  const club = user(state)
  if (!club || state.unemployed) return
  const cur = identityOf(state)
  const raw = rawIdentity(state)
  const v = { ...cur.v }
  for (const a of AXES) v[a] = clamp(Math.round((v[a] + (raw[a] - v[a]) * ALPHA) * 10) / 10, -100, 100)
  const want = labelsFor(v, cur.labels)
  const gained = want.filter(l => !cur.labels.includes(l))
  const lost = cur.labels.filter(l => !want.includes(l))
  let labels = cur.labels
  // one change per step: a lost label goes first, so a club swinging from
  // kicking to running is written up as leaving one before arriving at the other
  if (lost.length) {
    labels = labels.filter(l => l !== lost[0])
    wire(state, 'identity.fades', { club: club.short, label_k: `identity.label.${lost[0]}` })
    remember(state, { kind: 'identity-faded', clubId: club.id, payload: { label: lost[0] }, sal: 2 })
  } else if (gained.length) {
    labels = [...labels, gained[0]]
    wire(state, `identity.forms.${gained[0]}`, { club: club.short })
    remember(state, { kind: 'identity-formed', clubId: club.id, payload: { label: gained[0] }, sal: 2 })
  }
  state.identity = { ...cur, v, labels }
}

// ---------------------------------------------------------------- effects

/** Which of the club's labels this player's profile answers to, if any. */
export function identityFit(state: GameState, p: Player): IdLabel | null {
  if (state.unemployed || !user(state)) return null
  const a = p.a
  for (const l of identityOf(state).labels) {
    switch (l) {
      case 'academy': if (p.age <= 21) return l; break
      case 'running':
      case 'flair': if (!isForward(p.pos) && (a.pac + a.agi + a.han) / 3 >= 13.5) return l; break
      case 'kicking': if (['SH', 'FH', 'FB'].includes(p.pos) && (a.kic + a.goa) / 2 >= 13.5) return l; break
      case 'pack': if (isForward(p.pos) && (a.scr + a.str + a.ruc) / 3 >= 13.5) return l; break
      case 'spenders': if (p.pers === 'Mercenary' || p.pers === 'Ambitious') return l; break
      case 'prudent': if (p.pers === 'Loyal' || p.pers === 'Professional') return l; break
      default: break
    }
  }
  return null
}

/** Reputation points of extra reach for a player who fits (interest.ts). */
export function identityInterestLift(state: GameState, p: Player): number {
  return identityFit(state, p) ? IDENTITY_GAP : 0
}

/** Quality points added to the user's academy intake (rollIntakeClass). */
export function identityIntakeBonus(state: GameState): number {
  return hasLabel(state, 'academy') ? INTAKE_BONUS : 0
}

/** A sponsor's multiplier for the club's image: entertaining rugby, a club
 *  that brings its own through, and tidy books each sell a little, capped at
 *  SPONSOR_MAX. Never below the market: a club in the red is already paying
 *  for it in the boardroom, and the offer bands are calibrated from 1. */
export function identitySponsorFit(state: GameState): number {
  if (state.unemployed) return 1
  const ls = identityOf(state).labels
  let f = 1
  if (ls.includes('running')) f += 0.015
  if (ls.includes('academy')) f += 0.01
  if (ls.includes('prudent')) f += 0.01
  return Math.min(f, SPONSOR_MAX)
}

/**
 * The terraces at an academy club, when a big fee is spent on a man who plays
 * where one of their own has been playing (ai.ts executeTransfer, user side).
 * Fan mood -3, the homegrown man's morale -1, and the Wire says so. Once a
 * window at most.
 */
export function identitySigning(state: GameState, p: Player, fee: number) {
  const club = user(state)
  if (!club || fee < BIG_FEE || !hasLabel(state, 'academy')) return
  const now = absWeek(state.season, state.week)
  const id = identityOf(state)
  if (id.objAt != null && now - id.objAt < 12) return
  const own = seniors(state, club)
    .filter(x => x.id !== p.id && x.homegrown && x.pos === p.pos && x.stats.apps >= 3)
    .sort((a, b) => b.stats.apps - a.stats.apps)[0]
  if (!own) return
  state.fanMood = clamp((state.fanMood ?? 60) - 3, 5, 98)
  own.morale = clamp(own.morale - 1, 1, 10)
  state.identity = { ...id, objAt: now }
  wire(state, 'identity.fansObject', { club: club.short, player: p.name, own: own.name }, 'gossip', p.id)
}

/**
 * The summer verdict (rollover.ts, before the season's stats and books are
 * wiped). Each held label is an expectation; the season either kept it or
 * did not. At most +/-2 board confidence and +/-2 fan mood per label.
 */
export function identitySeasonEnd(state: GameState) {
  const club = user(state)
  if (!club || state.unemployed) return
  const ls = identityOf(state).labels
  const sq = seniors(state, club)
  if (ls.includes('academy')) {
    const regulars = sq.filter(p => p.homegrown && p.stats.apps >= 8).length
    if (regulars >= 3) {
      state.fanMood = clamp((state.fanMood ?? 60) + 2, 5, 98)
      wire(state, 'identity.academyKept', { club: club.short, n: regulars }, 'gossip', undefined, true)
    } else if (regulars === 0) {
      state.fanMood = clamp((state.fanMood ?? 60) - 2, 5, 98)
      club.boardConfidence = clamp(club.boardConfidence - 1, 0, 100)
      wire(state, 'identity.academyStalled', { club: club.short }, 'board', undefined, true)
    }
  }
  const b = state.books && state.books.clubId === club.id ? state.books : null
  if (b && (ls.includes('prudent') || ls.includes('stretched'))) {
    const wages = Math.max(1, sq.reduce((s, p) => s + p.wage, 0) * 52)
    const drift = (club.balance - b.opening) / wages
    if (ls.includes('prudent') && drift < -0.1) {
      club.boardConfidence = clamp(club.boardConfidence - 2, 0, 100)
      wire(state, 'identity.prudenceBroken', { club: club.short }, 'board', undefined, true)
    } else if (ls.includes('stretched') && drift > 0.05) {
      club.boardConfidence = clamp(club.boardConfidence + 2, 0, 100)
      wire(state, 'identity.stretchedMending', { club: club.short }, 'board', undefined, true)
    }
  }
}
