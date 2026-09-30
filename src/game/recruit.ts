/**
 * ---- RECRUITMENT AS DETECTIVE WORK (1.8.2) ----
 *
 * Owner's mastery brief: uncertainty, judgement, consequence. Never show a
 * hidden number; show what the staff believe.
 *
 * The scouting fog (scout.ts) already turned attributes and the ceiling into
 * ranges. What it never did was READ them for the manager: a page of eighteen
 * ranges is data, not a report. So this file writes the report a chief scout
 * would hand over, and it is built only from what the club can see:
 *
 *   strengths and concerns   the scouts' own estimate of each attribute, which
 *                            sits inside the range on the attributes tab but
 *                            can be well off the truth while that range is wide
 *   personality              only once the full file is in (persKnown)
 *   level and ceiling        bands, never a number, until he is fully known
 *   tactical fit             his estimated profile against what YOUR side asks
 *   agent                    your record with his agent's stable (memory.ts)
 *   rival interest           what the scouts have heard, and whether they think
 *                            it is real; the truth under it is the AI market's
 *                            own shopping list (ai.ts aiShoppingTarget)
 *   confidence               how much of this to believe, from knowledge
 *
 * Reports can be wrong. At low knowledge the estimate is allowed anywhere in
 * the displayed range, so a man's "strength" can be the scouts' misreading.
 * The error shrinks as knowledge grows and is gone at a full file, and
 * scripts/recruitprobe.ts measures that it does.
 *
 * AI clubs never read any of this. Everything here is a pure lens, keyed on
 * hashes, and draws nothing from the shared rng: the fingerprint holds.
 */
import type { Attrs, GameState, Personality, Player, Pos } from './model'
import { ATTR_KEYS, absWeek } from './model'
import { attrWeight } from './attributes'
import { isForward } from './bench'
import { aiShoppingTarget, askingPrice, embargoed } from './ai'
import { recall } from './memory'
import { attrRange, fuzzedCa, knowledge, margin, paRange, persKnown, reportStage, type ReportStage } from './scout'
import { clamp, hashString, mulberry32 } from './rng'
import { atkName, defName, stylesOf, type AtkStyle, type DefStyle } from './styles'

type Key = keyof Attrs
export type Confidence = 'high' | 'medium' | 'low'
export type Fit = 'excellent' | 'good' | 'doubtful'
export type AgentTone = 'warm' | 'neutral' | 'cool'
export type TalkRead = 'genuine' | 'unsure' | 'agent'
export type Upside = 'limited' | 'some' | 'big'
export type Risk = 'low' | 'medium' | 'high'

/** A note in the report: the attribute (or a record-based concern) it is about. */
export type Note = Key | 'highBall' | 'discipline' | 'durability'

export interface RivalTalk {
  clubId: string
  /** what our scout makes of it */
  read: TalkRead
}

/** What the scouts say they cannot tell yet. */
export type Unknown = 'character' | 'conditions' | 'paceFade' | 'durability' | 'ceiling' | 'fit'

export interface ScoutReport {
  stage: ReportStage
  confidence: Confidence
  /** share of his attributes the report has exactly right (confidencePct) */
  confPct: number
  /** the "still unknown" line */
  unknown: Unknown[]
  strengths: Note[]
  concerns: Note[]
  /** null until the full file */
  pers: Personality | null
  level: [number, number]
  ceiling: [number, number] | null
  upside: Upside | null
  risk: Risk
  /** null while there is not even a weekend of tape */
  fit: Fit | null
  agent: AgentTone
  talk: RivalTalk | null
}

const rand = (s: string) => mulberry32(hashString(s))()

// ---------------------------------------------------------------------------
// confidence
// ---------------------------------------------------------------------------

/** How far the scouts trust their own file. Knowledge is the whole of it:
 *  the error the report can carry (reportEstimate) is a function of the same
 *  margin, so the word is honest by construction and measured in the probe. */
export function confidenceOf(k: number): Confidence {
  return k >= 75 ? 'high' : k >= 45 ? 'medium' : 'low'
}

/**
 * THE SCOUT'S CONFIDENCE AS A PERCENTAGE, and it is a promise: the share of
 * this man's attributes the report has exactly right. Measured, not guessed:
 * at each margin the estimate's spread (reportEstimate) lands on the true
 * value this often, for the weakest and the best chief scout, and the probe
 * holds the stated figure to the measured one within a few points.
 */
const CONF_PCT: Record<number, [number, number]> = { 0: [100, 100], 1: [50, 66], 2: [25, 33], 3: [17, 22], 4: [13, 17] }
export function confidencePct(state: GameState, p: Player): number {
  const [lo, hi] = CONF_PCT[margin(knowledge(state, p))]
  return Math.round(lo + (hi - lo) * clamp(state.staff?.scout ?? 0, 0, 3) / 3)
}

// ---------------------------------------------------------------------------
// the scouts' estimate of one attribute
// ---------------------------------------------------------------------------

/**
 * What the scouts believe one attribute is. Inside the displayed range, always,
 * so the report never contradicts the attributes tab, but anywhere inside it:
 * a wide range means the estimate can be three or four points off in either
 * direction. A better chief scout pulls it a little nearer the middle of what
 * he saw. Fixed for a man and a report stage, so it does not flicker week to
 * week, and revised when the next stage of the report comes in.
 */
export function reportEstimate(state: GameState, p: Player, key: Key): number {
  const [lo, hi] = attrRange(state, p, key)
  if (lo === hi) return lo
  const c = (lo + hi) / 2
  const m = (hi - lo) / 2
  const r = rand(`rep|${p.id}|${key}|${reportStage(state, p)}`) * 2 - 1
  const sharp = 1 - 0.08 * clamp(state.staff?.scout ?? 0, 0, 3)
  return clamp(c + r * m * sharp, lo, hi)
}

// ---------------------------------------------------------------------------
// position baselines (a population statistic, not any one man's number)
// ---------------------------------------------------------------------------

const baseCache = new WeakMap<GameState, { key: string; means: Record<string, Record<Key, number>> }>()

/** Mean of each attribute at each position across the world's senior players.
 *  What "good at breakdown work" means for a flanker is not what it means for
 *  a wing. Cached a season at a time: the world's shape barely moves. */
export function posBaselines(state: GameState): Record<string, Record<Key, number>> {
  const key = `${state.season}`
  const hit = baseCache.get(state)
  if (hit && hit.key === key) return hit.means
  const sums: Record<string, { n: number; s: Record<Key, number> }> = {}
  for (const p of Object.values(state.players)) {
    if (!p.clubId || p.acad) continue
    const b = (sums[p.pos] ??= { n: 0, s: Object.fromEntries(ATTR_KEYS.map(k => [k, 0])) as Record<Key, number> })
    b.n++
    for (const k of ATTR_KEYS) b.s[k] += p.a[k]
  }
  const means: Record<string, Record<Key, number>> = {}
  for (const [pos, b] of Object.entries(sums)) {
    means[pos] = Object.fromEntries(ATTR_KEYS.map(k => [k, b.n ? b.s[k] / b.n : 10])) as Record<Key, number>
  }
  baseCache.set(state, { key, means })
  return means
}

/** The attributes a position is judged on: the ones its template leans on. */
function relevant(pos: Pos, k: Key): boolean {
  return attrWeight(pos, k) >= 0.45
}

// ---------------------------------------------------------------------------
// strengths and concerns
// ---------------------------------------------------------------------------

/**
 * Strengths and concerns from a set of attribute values (the scouts' estimate
 * for the report; the truth only in the probe, to mark the report against).
 * A strength is an attribute that matters for his position and stands well
 * above what the position usually has; a concern stands well below. The two
 * record-based concerns read what is public: his injury history and his cards.
 */
export function notesFrom(
  pos: Pos, vals: Record<Key, number>, base: Record<Key, number>, maxS: number, maxC: number,
  record?: { durability: boolean; discipline: boolean },
): { strengths: Note[]; concerns: Note[] } {
  const devs = ATTR_KEYS.filter(k => relevant(pos, k))
    .map(k => ({ k, d: (vals[k] - base[k]) * (0.6 + 0.4 * attrWeight(pos, k)) }))
  const strengths = devs.filter(x => x.d >= 1.2).sort((a, b) => b.d - a.d || a.k.localeCompare(b.k))
    .slice(0, maxS).map(x => x.k as Note)
  const concerns: Note[] = []
  if (record?.durability) concerns.push('durability')
  if (record?.discipline || (vals.agg >= 16 && vals.agg - base.agg >= 3)) concerns.push('discipline')
  for (const x of devs.filter(x => x.d <= -1.2 && x.k !== 'agg').sort((a, b) => a.d - b.d || a.k.localeCompare(b.k))) {
    if (concerns.length >= maxC) break
    concerns.push(x.k === 'han' && !isForward(pos) ? 'highBall' : x.k)
  }
  return { strengths, concerns: concerns.slice(0, maxC) }
}

/** What the public record says: games lost to injury, and cards. */
function publicRecord(state: GameState, p: Player): { durability: boolean; discipline: boolean } {
  const log = p.injLog ?? []
  const weeks = log.reduce((s, e) => s + e.weeks, 0)
  const seasons = log.length ? Math.max(1, state.season - log[0].s + 1) : 1
  const cards = (p.stats?.yc ?? 0) + 2 * (p.stats?.rc ?? 0)
  return { durability: weeks / seasons >= 6, discipline: cards >= 3 }
}

// ---------------------------------------------------------------------------
// tactical fit
// ---------------------------------------------------------------------------

/**
 * WHAT YOUR SIDE ASKS OF A PLAYER, attribute by attribute, as a tilt about
 * zero: positive where your way of playing leans on it harder than a neutral
 * side would, negative where it leans on it less.
 *
 * Two parts since the styles landed (1.8.2, game/styles.ts). The STYLES the
 * side plays, with the ball and without it, each ask for their own men
 * (STYLE_TILT: the wide game pace and passing out wide, the choke tackle
 * strong upright tacklers in the pack); and the dials that fine-tune them
 * lean it further, as they always did. Picking a style sets its dials too,
 * so the two agree unless the manager has tuned against his own style.
 * fitFrom and the report only ever see the tilt.
 */
type Tilt = { fwd: Partial<Record<Key, number>>; back: Partial<Record<Key, number>> }
const STYLE_TILT: Record<AtkStyle | DefStyle, Tilt> = {
  direct: { fwd: { str: 0.8, han: 0.3, scr: 0.3, ruc: 0.3 }, back: { str: 0.6, han: 0.3, vis: -0.2 } },
  pods: { fwd: { han: 0.3, ruc: 0.3, wor: 0.2 }, back: { dec: 0.2 } },
  width: { fwd: { pac: 0.3, han: 0.4, sta: 0.3 }, back: { pac: 0.7, pas: 0.5, vis: 0.3 } },
  kick: { fwd: { lin: 0.3, wor: 0.3 }, back: { kic: 0.8, pos: 0.4, pac: 0.2 } },
  offload: { fwd: { han: 0.6, agi: 0.4, sta: 0.4 }, back: { han: 0.5, agi: 0.4, sta: 0.3 } },
  drift: { fwd: { sta: 0.3 }, back: { pos: 0.5, tac: 0.3, pac: 0.3 } },
  blitz: { fwd: { pac: 0.3, sta: 0.4, wor: 0.3 }, back: { pac: 0.4, dec: 0.3, sta: 0.3 } },
  pendulum: { fwd: {}, back: { pos: 0.2 } },
  man: { fwd: { tac: 0.3, agi: 0.2 }, back: { tac: 0.4, agi: 0.3 } },
  choke: { fwd: { str: 0.6, tac: 0.5, ruc: 0.2 }, back: { tac: 0.3, str: 0.2 } },
}
/** how hard the styles lean against the dials' own tilt */
const STYLE_TILT_W = 0.6

export function sideDemands(state: GameState, clubId = state.userClubId): Record<'fwd' | 'back', Partial<Record<Key, number>>> {
  const tac = state.clubs[clubId]?.tactic
  const d = (v: number | undefined) => ((v ?? 50) - 50) / 50
  const s = d(tac?.style), te = d(tac?.tempo), k = d(tac?.kicking), a = d(tac?.aggression)
  const dl = d(tac?.defLine), dw = d(tac?.defWidth), rc = d(tac?.ruckCommit), rx = d(tac?.ruckContest)
  const out: Tilt = {
    fwd: {
      han: 0.8 * s, pas: 0.5 * s, pac: 0.5 * s + 0.3 * te, agi: 0.3 * s,
      scr: -0.7 * s + 0.2 * a, str: -0.5 * s + 0.5 * a + 0.4 * rc, lin: -0.3 * s + 0.2 * k,
      sta: 0.8 * te + 0.3 * dw, wor: 0.5 * te + 0.3 * dl,
      tac: 0.4 * a + 0.4 * dl, agg: 0.6 * a + 0.3 * rx,
      ruc: 0.6 * rc + 0.6 * rx - 0.2 * s, pos: -0.3 * dl + 0.3 * dw,
    },
    back: {
      han: 0.7 * s - 0.2 * k, pas: 0.7 * s - 0.2 * k, pac: 0.5 * s + 0.4 * te + 0.4 * dl, agi: 0.5 * s,
      vis: 0.6 * s, str: -0.4 * s + 0.4 * a, kic: 0.9 * k, goa: 0.2 * k,
      pos: 0.5 * k - 0.4 * dl + 0.3 * dw, sta: 0.6 * te + 0.3 * dw, dec: 0.3 * te - 0.3 * dl + 0.2 * k,
      tac: 0.4 * a + 0.4 * dl, agg: 0.3 * a, wor: 0.3 * te,
    },
  }
  const sty = stylesOf(state, state.clubs[clubId])
  if (sty) for (const id of [sty.atk, sty.def]) for (const half of ['fwd', 'back'] as const) {
    for (const [key, v] of Object.entries(STYLE_TILT[id][half]) as [Key, number][]) {
      out[half][key] = (out[half][key] ?? 0) + STYLE_TILT_W * v
    }
  }
  return out
}

/** Our way of playing in two words, attack and defence, for the fit line:
 *  the styles by name (1.8.2). */
export function sideStyleKeys(state: GameState, clubId = state.userClubId): [string, string] {
  const sty = stylesOf(state, state.clubs[clubId]) ?? { atk: 'pods', def: 'pendulum' }
  return [atkName(sty.atk), defName(sty.def)]
}

/** The fit score: how far his profile, shape rather than quality, leans the
 *  way the side does. Deviations from the position's mean have his own mean
 *  deviation taken out, so a better player is not a better fit by default. */
export function fitScore(pos: Pos, vals: Record<Key, number>, base: Record<Key, number>, dem: ReturnType<typeof sideDemands>): number {
  const tilt = isForward(pos) ? dem.fwd : dem.back
  const keys = ATTR_KEYS.filter(k => relevant(pos, k))
  const dev = keys.map(k => vals[k] - base[k])
  const mean = dev.reduce((s, x) => s + x, 0) / Math.max(1, dev.length)
  let sc = 0, w = 0
  keys.forEach((k, i) => { const t = tilt[k] ?? 0; sc += t * (dev[i] - mean); w += Math.abs(t) })
  return w > 0.3 ? sc / w : 0
}

export const FIT_CUT = 0.45
export const fitWord = (score: number): Fit => score >= FIT_CUT ? 'excellent' : score <= -FIT_CUT ? 'doubtful' : 'good'

// ---------------------------------------------------------------------------
// the agent
// ---------------------------------------------------------------------------

/** The stable a man's agent works for. Nine agencies share the world's
 *  players; they are not named, but they remember. */
export const agentStable = (playerId: number): number => hashString(`agent|${playerId}`) % 9

const DEALING: Partial<Record<string, number>> = {
  'promise-kept': 1.5, 'promise-broken': -2.5, 'released': -1, 'let-go': -0.5,
  'request-granted': 0.5, 'request-refused': -0.75, 'sold': 0.5, 'academy-debut': 0.25,
}

/**
 * Warm, neutral or cool: your record with this man's agent's stable, read off
 * the manager's memory. A kept promise to one of their clients counts for you,
 * a broken one counts twice as hard against, and a release lands badly.
 * Recent dealings weigh more than old ones, and a broken promise to anybody in
 * the last year travels (agents talk to each other: memory.ts agentWariness).
 */
export function agentScore(state: GameState, p: Player): number {
  const stable = agentStable(p.id)
  let sc = 0
  for (const e of recall(state, {})) {
    const v = DEALING[e.kind]
    if (v == null || e.playerId == null) continue
    const age = state.season - e.season
    const w = age <= 0 ? 1 : age <= 2 ? 0.6 : 0.3
    if (agentStable(e.playerId) === stable) sc += v * w
    else if (e.kind === 'promise-broken' && age <= 1) sc -= 0.5
  }
  return sc
}

export function agentTone(state: GameState, p: Player): AgentTone {
  const s = agentScore(state, p)
  return s >= 1.5 ? 'warm' : s <= -1.5 ? 'cool' : 'neutral'
}

/** The consequence: a warm agent opens a little lower, a cool one higher. */
export function agentTermsLift(state: GameState, p: Player): number {
  const tone = agentTone(state, p)
  return tone === 'warm' ? 0.96 : tone === 'cool' ? 1.05 : 1
}

// ---------------------------------------------------------------------------
// rival interest: the truth, and what we hear of it
// ---------------------------------------------------------------------------

const suitorCache = new WeakMap<GameState, { key: string; map: Map<number, string> }>()

/** Every AI club's shopping target this week, as player id to club id. */
function shoppingMap(state: GameState): Map<number, string> {
  const key = `${state.season}|${state.week}|${state.nextId}`
  const hit = suitorCache.get(state)
  if (hit && hit.key === key) return hit.map
  const map = new Map<number, string>()
  const clubs = Object.values(state.clubs)
    .filter(c => c.id !== state.userClubId && c.budget >= 800_000 && !embargoed(state, c.id))
    .sort((a, b) => b.rep - a.rep || a.id.localeCompare(b.id))
  for (const c of clubs) {
    const t = aiShoppingTarget(state, c)?.target
    if (t && !map.has(t.id)) map.set(t.id, c.id)
  }
  suitorCache.set(state, { key, map })
  return map
}

/**
 * THE TRUTH: the AI club that would really sign him, or null. Exactly the two
 * ways aiTransfers moves a man between AI clubs: he is some club's shopping
 * target this week, or he is unsettled (listed, unhappy, or out of contract)
 * and a club could afford him. If you wait, the next window can take him.
 */
export function realSuitor(state: GameState, p: Player): string | null {
  if (!p.clubId || p.clubId === state.userClubId || p.onLoan || p.loanFrom || p.retiring) return null
  const shop = shoppingMap(state).get(p.id)
  if (shop) return shop
  if (!(p.transferListed || p.morale < 4 || p.contractEnds <= state.season) || p.ca < 62) return null
  const ask = askingPrice(state, p)
  const c = Object.values(state.clubs)
    .filter(c => c.id !== state.userClubId && c.id !== p.clubId && c.budget >= 200_000 && !embargoed(state, c.id) &&
      p.ca <= c.rep + 12 && ask <= c.budget)
    .sort((a, b) => b.budget - a.budget || a.id.localeCompare(b.id))[0]
  return c?.id ?? null
}

/** Six-week spells: agent talk comes and goes on this clock. */
const phaseOf = (week: number) => Math.floor(week / 6)

/** The knowledge at which the report is the full file (scout.reportStage 3). */
export const FULL_FILE = 90

/** The absolute week this six-week spell of talk began: the inside word is
 *  stamped with it, so it lasts exactly as long as the talk it resolved. */
export function talkSpell(state: GameState): number {
  return absWeek(state.season, phaseOf(state.week) * 6)
}

/** Has the inside word been bought on this man for this spell of talk? */
export function insideWord(state: GameState, p: Player): boolean {
  const seen = state.rewarded?.insideSeen
  return !!seen && typeof seen === 'object' && seen[p.id] === talkSpell(state)
}

/**
 * Agent talk: a club "keen" on him that is not, put about to lift the price.
 * Keyed on the man, the season and the six-week spell, so it lasts a while
 * and then fades if nobody bites. Not everybody's agent does it.
 */
export function agentTalkClub(state: GameState, p: Player): string | null {
  if (!p.clubId || p.clubId === state.userClubId || p.ca < 60 || p.onLoan || p.loanFrom || p.retiring) return null
  const seller = state.clubs[p.clubId]
  if (!seller) return null
  const ph = phaseOf(state.week)
  // what an agent can sell: a deal running down and a name people know. Not
  // his personality, which would let the rumour mill leak what the full file
  // is for (recruitprobe checks that it does not)
  const pushy = (p.contractEnds <= state.season + 1 ? 0.08 : 0) + (p.intl ? 0.06 : 0)
  if (rand(`talk|${p.id}|${state.season}|${ph}`) >= 0.12 + pushy) return null
  const pool = Object.values(state.clubs)
    .filter(c => c.id !== state.userClubId && c.id !== seller.id && c.rep >= seller.rep - 6 && c.rep <= seller.rep + 15)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (!pool.length) return null
  return pool[Math.floor(rand(`talkclub|${p.id}|${state.season}|${ph}`) * pool.length) % pool.length].id
}

/** The truth under a rumour, for the probe and nothing on screen. */
export function talkTruth(state: GameState, p: Player): { clubId: string; genuine: boolean } | null {
  const real = realSuitor(state, p)
  if (real) return { clubId: real, genuine: true }
  const fake = agentTalkClub(state, p)
  return fake ? { clubId: fake, genuine: false } : null
}

/**
 * What the manager hears. The scouts only pick up talk about men they are
 * watching (knowledge 35 or a shortlist place), and not all of the genuine
 * interest reaches them. Then the chief scout gives his read, and he is right
 * more often the better he knows the man and the better he is at his job: at
 * a weekend of tape it is little better than a coin, at a full file he is
 * rarely fooled.
 */
export function rivalTalk(state: GameState, p: Player): RivalTalk | null {
  // THE AGENT'S INSIDE WORD (1.8.2, rewarded.ts): for this spell of talk the
  // line reads as the chief scout would read it at the full file, which is
  // what his knowledge would otherwise take weeks to reach. Only the line
  // moves: the rumour itself, and the premium it costs, are the same.
  const k = insideWord(state, p) ? Math.max(FULL_FILE, knowledge(state, p)) : knowledge(state, p)
  if (k < 35 && !state.shortlist.includes(p.id)) return null
  const truth = talkTruth(state, p)
  if (!truth) return null
  const ph = phaseOf(state.week)
  if (truth.genuine && rand(`heard|${p.id}|${truth.clubId}|${state.season}|${ph}`) > 0.45 + 0.55 * k / 100) return null
  const scoutLvl = clamp(state.staff?.scout ?? 0, 0, 3)
  const right = clamp(0.35 + 0.55 * k / 100 + 0.04 * scoutLvl, 0.4, 0.93)
  const r = rand(`read|${p.id}|${truth.clubId}|${state.season}|${ph}`)
  const correct: TalkRead = truth.genuine ? 'genuine' : 'agent'
  const wrong: TalkRead = truth.genuine ? 'agent' : 'genuine'
  const read: TalkRead = r < right ? correct : r < right + (1 - right) * 0.6 ? 'unsure' : wrong
  return { clubId: truth.clubId, read }
}

/** Talk costs you either way: a camp that can point at another club opens
 *  higher. Genuine or not, the premium holds while the talk does, which is
 *  the judgement: pay it now, or wait for agent talk to fade and risk the
 *  real thing taking him. */
export function talkPremium(state: GameState, p: Player): number {
  return talkTruth(state, p) ? 1.06 : 1
}

// ---------------------------------------------------------------------------
// the report
// ---------------------------------------------------------------------------

/** The level band: his current standard as the scouts would put it. */
export function levelBand(state: GameState, p: Player): [number, number] {
  const m = margin(knowledge(state, p)) * 1.5
  const c = fuzzedCa(state, p)
  return [clamp(Math.round(c - m), 1, 99), clamp(Math.round(c + m), 1, 99)]
}

export function scoutReport(state: GameState, p: Player): ScoutReport {
  const k = knowledge(state, p)
  const stage = reportStage(state, p)
  const confidence = confidenceOf(k)
  const base = posBaselines(state)[p.pos]
  const est = Object.fromEntries(ATTR_KEYS.map(key => [key, reportEstimate(state, p, key)])) as Record<Key, number>
  const record = publicRecord(state, p)
  const maxS = stage === 0 ? 0 : stage === 1 ? 2 : 3
  const maxC = stage === 0 ? 0 : stage === 1 ? 1 : 2
  const notes = base ? notesFrom(p.pos, est, base, maxS, maxC, record)
    : { strengths: [] as Note[], concerns: [] as Note[] }
  // the public record is a concern at any stage: anybody can read it
  if (stage === 0) {
    if (record.durability) notes.concerns.push('durability')
    if (record.discipline) notes.concerns.push('discipline')
  }
  const level = levelBand(state, p)
  const ceiling = stage >= 1 ? paRange(state, p) : null
  const upside: Upside | null = ceiling
    ? ((ceiling[0] + ceiling[1]) / 2 - (level[0] + level[1]) / 2 >= 12 ? 'big'
      : (ceiling[0] + ceiling[1]) / 2 - (level[0] + level[1]) / 2 >= 5 ? 'some' : 'limited')
    : null
  const pers = persKnown(state, p) ? p.pers : null
  let rs = confidence === 'low' ? 2 : confidence === 'medium' ? 1 : 0
  if (p.age <= 21) rs += 1
  if (ceiling && ceiling[1] - ceiling[0] >= 14) rs += 1
  if (notes.concerns.includes('durability')) rs += 1
  if (pers === 'Temperamental') rs += 1
  const risk: Risk = rs >= 3 ? 'high' : rs >= 2 ? 'medium' : 'low'
  const fit = stage >= 1 && base ? fitWord(fitScore(p.pos, est, base, sideDemands(state))) : null
  // STILL UNKNOWN: what the file cannot answer yet, said plainly rather than
  // left as a blank. Each clears at the stage that would answer it.
  const unknown: Unknown[] = []
  if (!pers) unknown.push('character')
  if (stage < 2) unknown.push('conditions')
  if (stage < 3 && p.age >= 29 && attrWeight(p.pos, 'pac') >= 0.5) unknown.push('paceFade')
  if (stage < 2 && !(p.injLog?.length) && !notes.concerns.includes('durability')) unknown.push('durability')
  if (!ceiling) unknown.push('ceiling')
  if (!fit) unknown.push('fit')
  return {
    stage, confidence, confPct: confidencePct(state, p), unknown, strengths: notes.strengths, concerns: notes.concerns, pers, level, ceiling, upside, risk,
    fit, agent: agentTone(state, p), talk: rivalTalk(state, p),
  }
}

/** For the probe: the same report computed off the truth, to mark it against. */
export function trueNotes(state: GameState, p: Player, maxS = 3, maxC = 2): { strengths: Note[]; concerns: Note[]; fit: Fit } {
  const base = posBaselines(state)[p.pos]
  const n = notesFrom(p.pos, p.a, base, maxS, maxC)
  return { ...n, fit: fitWord(fitScore(p.pos, p.a, base, sideDemands(state))) }
}

