/**
 * ---- THE OPPOSITION REPORT AND THE RESPONSE PLAN (#181, pillar 2) ----
 *
 * The owner's loop: scout the opponent, write the report, pick a plan for this
 * match, play it, read the findings, and carry what was learned into the next
 * report. Nearly every piece already existed on its own - the analyst's read of
 * the soft spot (analyst.ts), the dugout's character and its week's plan against
 * the manager (oppcoach.ts), the philosophy dials and the assistant's counter
 * (philosophy.ts), the playbook's call counts (playbook.ts), the scouting ranges
 * (scout.ts). This module only JOINS them.
 *
 * Three rules it obeys:
 *
 *   NO NEW ENGINE MODIFIERS. A plan is a bundle of levers the manager could set
 *     by hand on the Tactics screen: the dials, the week's prep, a set-piece call,
 *     the replacements' brief. Choosing one writes those values and nothing else,
 *     so whatever the plan is worth on the day is exactly what the engine already
 *     pays for those settings. The analyst's homework edge still needs his read to
 *     be sound AND the prep he named to be set, as it always did.
 *
 *   NO RNG. Every fuzz is a hash of (seed, week, opponent, field), so looking
 *     twice never rerolls a report and nothing here can move the match stream.
 *     The fingerprint's AI-vs-AI world never calls any of it.
 *
 *   KEYS, NOT SENTENCES. A report line is an i18n key and its values; the words
 *     are built at render, so a report read in French is French.
 *
 * ACCURACY is the briefing suite and the assistant (analystSkill, the same
 * number that decides whether the analyst's read is sound) plus how well the
 * scouts know the men in their fifteen. A vague report gives wide ranges and
 * holds back what it cannot see; a sharp one is narrow and names the coach's
 * habits. Either can still be wrong: the dial reads carry a hashed error that
 * shrinks with accuracy but never quite vanishes, and the soft spot is the
 * analyst's read, which is right about as often as analystSkill says.
 */
import type { Club, GameState, MatchPrep, Tactic, Fixture } from './model'
import { analystRead, analystSkill, readOdds, sureBand, type AnalystRead } from './analyst'
import { tapeLine } from './armsrace'
import { lineupFor, teamUnits } from './matchEngine'
import { fuzzedCa, knowledge, margin } from './scout'
import { analystShift, archetypeOf } from './oppcoach'
import { COUNTER, philosophyOf } from './philosophy'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, playbookOf, routineEffect } from './playbook'
import { benchSeats } from './bench'
import { clamp, hashString } from './rng'
import { MATCHUP, atkName, defName, stylesOf } from './styles'

export type Unit = AnalystRead['unit']

// ---------------------------------------------------------------------------
// What the save keeps
// ---------------------------------------------------------------------------

export type PlanId = 'exploit' | 'counter' | 'lesson' | 'finish'
export const PLAN_IDS: readonly PlanId[] = ['exploit', 'counter', 'lesson', 'finish']

/** The levers a plan sets. Every field is an existing control. */
export interface PlanLevers {
  prep?: MatchPrep
  dials?: Partial<Pick<Tactic, 'style' | 'tempo' | 'kicking' | 'aggression' | 'defLine'>>
  kickStyle?: NonNullable<Tactic['kickStyle']>
  lineoutCall?: string
  scrumCall?: string
  /** one brief for every replacement's seat */
  brief?: 'impact' | 'shore' | 'manage'
}

export type FindingCat = 'tactical' | 'physical' | 'setpiece' | 'player' | 'strategic'

/** One finding, as a key and its values. tone: +1 good for us, -1 bad, 0 level. */
export interface Finding {
  cat: FindingCat
  k: string
  v?: Record<string, string | number>
  tone: -1 | 0 | 1
}

export type PlanVerdict = 'worked' | 'partly' | 'failed'

export interface FindingsRecord {
  fxId: number
  season: number
  week: number
  oppId: string
  us: number
  them: number
  items: Finding[]
  /** the set-piece contest worth remembering for next time (their side of it) */
  recall?: { unit: 'scrum' | 'lineout'; pct: number }
  plan?: { id: PlanId; target: Unit | 'style' | 'late' | null; followed: boolean; verdict: PlanVerdict } | null
}

export interface ChosenPlan {
  /** season*100+week, like the analyst's read */
  abs: number
  oppId: string
  id: PlanId
  target: Unit | 'style' | 'late' | null
  levers: PlanLevers
}

export interface TacLoop {
  plan?: ChosenPlan | null
  findings: FindingsRecord[]
}

/** how many post-match reads the save keeps: enough to remember a side met in
 *  the autumn by the spring, without the file growing a season at a time */
export const FINDINGS_CAP = 6

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export type ReportCat = 'style' | 'form' | 'setpiece' | 'players' | 'coach' | 'soft' | 'history' | 'calls'

export interface ReportLine {
  cat: ReportCat
  k: string
  /** values; any whose name ends in _k is itself a key, translated at render */
  v?: Record<string, string | number>
  /** HIDDEN: whether this line is true. Never shown; the probe measures it. */
  ok?: boolean
  /** how sure the analyst is of it (1.8.2): his own estimate of the odds
   *  it is true, in the three words of his soft-spot read. Only on the lines
   *  that can be wrong; the probe holds the words to the hit rate. */
  conf?: 'high' | 'mid' | 'low'
}

export interface OppReport {
  oppId: string
  abs: number
  /** a Test side: no club record, so no dials, no playbook and no plans */
  test: boolean
  accuracy: number
  band: 'vague' | 'fair' | 'sharp'
  lines: ReportLine[]
  /** the soft spot, from the analyst's read (clubs) or the same roll (Tests) */
  soft: { unit: Unit; right: boolean; confidence: number } | null
  /** the last time we met, if the save remembers it */
  last: FindingsRecord | null
}

const absWeek = (s: GameState) => s.season * 100 + s.week

function h(state: GameState, oppId: string, salt: string): number {
  return hashString(`${state.seed}:${absWeek(state)}:${oppId}:${salt}`)
}
/** a deterministic value in -1..1 */
const wobble = (state: GameState, oppId: string, salt: string) => (h(state, oppId, salt) % 2001) / 1000 - 1

/** The side the manager is facing in this fixture, or null when he is not in it. */
export function opponentIn(state: GameState, fx: Fixture): string | null {
  const mine = [state.userClubId, state.natTeam, 'LIO'].filter(Boolean) as string[]
  if (mine.includes(fx.homeId)) return fx.awayId
  if (mine.includes(fx.awayId)) return fx.homeId
  return null
}

/** Is this a club fixture of the manager's, where the Tactics levers apply? */
export const isClubFixture = (state: GameState, fx: Fixture) =>
  fx.homeId === state.userClubId || fx.awayId === state.userClubId

/** How much of the truth the report can see, 0..1. */
export function reportAccuracy(state: GameState, oppId: string): number {
  // analystSkill runs 0.3 (bare club) to 0.78 (a full suite and a gold assistant)
  const skill = clamp((analystSkill(state) - 0.3) / 0.48, 0, 1)
  const xv = lineupFor(state, oppId).slice(0, 15)
    .map(id => (id != null ? state.players[id] : null)).filter(Boolean)
  const know = xv.length ? xv.reduce((s, p) => s + knowledge(state, p!), 0) / xv.length / 100 : 0.2
  return clamp(0.12 + skill * 0.58 + know * 0.28, 0.1, 0.95)
}

export const bandOf = (acc: number): OppReport['band'] => (acc >= 0.66 ? 'sharp' : acc >= 0.4 ? 'fair' : 'vague')

const DIALS = ['style', 'tempo', 'kicking', 'aggression', 'defLine'] as const

/** The soft spot. A club's comes from the analyst's own read, so the report and
 *  his card can never disagree; a Test side has no club record for him to file
 *  against, so the same roll is made here, unsaved. */
export function softSpot(state: GameState, oppId: string): OppReport['soft'] {
  if (state.clubs[oppId]) {
    const r = analystRead(state, oppId)
    return r ? { unit: r.unit, right: r.right, confidence: r.confidence } : null
  }
  const lu = lineupFor(state, oppId)
  if (lu.slice(0, 15).filter(id => id != null).length < 15) return null
  // the same odds and the same sense of them as the analyst's own read
  const o = readOdds(state, oppId, teamUnits(state, lu), absWeek(state))
  return { unit: o.right ? o.sorted[0][0] : o.sorted[o.sorted.length - 1][0], right: o.right, confidence: o.confidence }
}

/** The last findings the save holds against this side. */
export function lastMeeting(state: GameState, oppId: string): FindingsRecord | null {
  const list = state.tacLoop?.findings ?? []
  for (let i = list.length - 1; i >= 0; i--) if (list[i].oppId === oppId) return list[i]
  return null
}

function formLines(state: GameState, oppId: string): ReportLine[] {
  const played = state.fixtures
    .filter(f => f.played && f.compId !== 'fr' && (f.homeId === oppId || f.awayId === oppId))
    .slice(-5)
  if (!played.length) return [{ cat: 'form', k: 'oppreport.formNone', ok: true }]
  let w = 0, d = 0, l = 0, pf = 0, pa = 0
  for (const f of played) {
    const us = f.homeId === oppId ? f.homeScore : f.awayScore
    const them = f.homeId === oppId ? f.awayScore : f.homeScore
    pf += us; pa += them
    if (us > them) w++; else if (us < them) l++; else d++
  }
  const n = played.length
  return [{ cat: 'form', k: 'oppreport.form', v: { n, w, d, l, pf: Math.round(pf / n), pa: Math.round(pa / n) }, ok: true }]
}

function styleLines(state: GameState, club: Club, acc: number): ReportLine[] {
  const out: ReportLine[] = []
  const ph = philosophyOf(club)
  if (ph && acc >= 0.35) out.push({ cat: 'style', k: 'oppreport.philosophy', v: { name_k: ph.name }, ok: true })
  else out.push({ cat: 'style', k: 'oppreport.styleUnclear' })
  // THE STYLES (1.8.2): how they attack and how they defend, by name, which
  // the tape shows at any accuracy; and how each meets ours, off the matchup
  // table, so the report says in words what the Styles view draws
  const theirs = stylesOf(state, club)
  const ours = stylesOf(state, state.clubs[state.userClubId])
  if (theirs) {
    out.push({ cat: 'style', k: 'styles.oppStyles', v: { atk_k: atkName(theirs.atk), def_k: defName(theirs.def) }, ok: true })
    if (ours) {
      const edge = (m: number) => (m > 0 ? 'good' : m < 0 ? 'bad' : 'even')
      out.push({ cat: 'style', k: `styles.edgeAtk_${edge(MATCHUP[ours.atk][theirs.def])}`, v: { mine_k: atkName(ours.atk), theirs_k: defName(theirs.def) }, ok: true })
      out.push({ cat: 'style', k: `styles.edgeDef_${edge(-MATCHUP[theirs.atk][ours.def])}`, v: { mine_k: defName(ours.def), theirs_k: atkName(theirs.atk) }, ok: true })
    }
  }
  // the dials as the tape shows them: a hashed error that shrinks with accuracy
  const err = (1 - acc) * 34
  const half = Math.max(3, Math.round((1 - acc) * 20))
  const seen = DIALS.map(d => {
    const truth = club.tactic[d] ?? 50
    const read = clamp(Math.round(truth + wobble(state, club.id, d) * err), 0, 100)
    return { d, truth, read }
  })
    .filter(x => Math.abs(x.read - 50) >= 12)
    .sort((a, b) => Math.abs(b.read - 50) - Math.abs(a.read - 50))
    .slice(0, 2)
  for (const x of seen) {
    const hi = x.read > 50
    // HOW SURE (1.8.2): he knows how far off his tape can be (err), so a read
    // well past the line with a small error is a near certainty and one just
    // over it with a big error is a coin: the odds the truth is past 56 (or
    // under 44) with the error spread evenly either side of what he saw
    const past = hi ? x.read - 56 : 44 - x.read
    const p = err > 0 ? clamp((past / err + 1) / 2, 0, 1) : past >= 0 ? 1 : 0
    out.push({
      cat: 'style', k: `oppreport.dial_${x.d}_${hi ? 'hi' : 'lo'}`,
      v: { lo: clamp(x.read - half, 0, 100), hi: clamp(x.read + half, 0, 100) },
      // true when the habit really leans the way the tape says it does
      ok: hi ? x.truth >= 56 : x.truth <= 44,
      conf: sureBand(p),
    })
  }
  return out
}

function setPieceLines(club: Club, acc: number): ReportLine[] {
  if (acc < 0.45) return [{ cat: 'setpiece', k: 'oppreport.spNoFootage' }]
  const pb = club.playbook
  const used = pb?.used ?? {}
  const pick = (kind: 'lo_' | 'sc_', dflt: string) => {
    const calls = Object.entries(used).filter(([id]) => id.startsWith(kind))
    const total = calls.reduce((s, [, n]) => s + n, 0)
    if (total < 3) return { id: dflt, share: 0, total }
    calls.sort((a, b) => b[1] - a[1])
    return { id: calls[0][0], share: calls[0][1] / total, total }
  }
  const lo = pick('lo_', club.tactic.lineoutCall ?? DEFAULT_LINEOUT)
  const sc = pick('sc_', club.tactic.scrumCall ?? DEFAULT_SCRUM)
  const out: ReportLine[] = [{
    cat: 'setpiece', k: 'oppreport.spCalls',
    v: { lo_k: `playbook.${lo.id}`, sc_k: `playbook.${sc.id}` }, ok: true,
  }]
  if (Math.max(lo.share, sc.share) >= 0.6 && lo.total + sc.total >= 6) {
    out.push({ cat: 'setpiece', k: 'oppreport.spPredictable', ok: true })
  }
  return out
}

function keyMenLine(state: GameState, oppId: string): ReportLine | null {
  const xv = lineupFor(state, oppId).slice(0, 15)
    .map(id => (id != null ? state.players[id] : null)).filter(Boolean)
  if (!xv.length) return null
  const ranked = [...xv].sort((a, b) => fuzzedCa(state, b!) - fuzzedCa(state, a!))
  const byRead = ranked.slice(0, 3)
  const best = [...xv].sort((a, b) => b!.ca - a!.ca)[0]
  // HOW SURE (1.8.2): the scouts' error on these men (scout.ts margin, three
  // rating points a step) against the room between the third man he names
  // and the fourth he does not: known men far apart are a certainty
  const noise = xv.reduce((s, p) => s + margin(knowledge(state, p!)) * 3, 0) / xv.length
  const room = ranked.length > 3 ? fuzzedCa(state, ranked[2]!) - fuzzedCa(state, ranked[3]!) : 99
  const p = noise <= 0 ? 1 : clamp(0.62 + room / (4 * noise) - noise / 40, 0, 1)
  return {
    cat: 'players', k: 'oppreport.keyMen',
    v: { names: byRead.map(p => `${p!.name} (${p!.pos})`).join(', ') },
    ok: byRead.includes(best),
    conf: sureBand(p),
  }
}

function coachLines(state: GameState, club: Club, acc: number): ReportLine[] {
  const out: ReportLine[] = []
  if (acc >= 0.55) {
    const arch = archetypeOf(club.id, club.rep)
    out.push({ cat: 'coach', k: `oppreport.coach_${arch}`, ok: true })
    const shift = analystShift(state, club.id)
    if (shift) out.push({ cat: 'coach', k: 'oppreport.readingYou', ok: true })
  } else {
    out.push({ cat: 'coach', k: 'oppreport.coachUnknown' })
  }
  // a plan written against the manager this week is public knowledge (the
  // pre-match report already says so), so it shows at any accuracy
  const v = club.vsUser
  if (v) {
    out.push(v.unit
      ? { cat: 'coach', k: 'oppreport.respectUnit', v: { unit_k: `oppreport.u_${v.unit}` }, ok: true }
      : { cat: 'coach', k: 'oppreport.respect', ok: true })
  }
  return out
}

function historyLines(last: FindingsRecord | null): ReportLine[] {
  if (!last) return []
  const res = last.us > last.them ? 'W' : last.us < last.them ? 'L' : 'D'
  const out: ReportLine[] = [{
    cat: 'history', k: `oppreport.lastMet${res}`, v: { us: last.us, them: last.them }, ok: true,
  }]
  if (last.recall) {
    const theyStruggled = last.recall.pct >= 50
    out.push({
      cat: 'history', k: theyStruggled ? 'oppreport.recallWeak' : 'oppreport.recallStrong',
      v: { unit_k: `oppreport.u_${last.recall.unit}`, pct: last.recall.pct }, ok: true,
    })
  }
  if (last.plan) {
    out.push({ cat: 'history', k: `oppreport.lastPlan_${last.plan.verdict}`, v: { plan_k: `oppreport.plan_${last.plan.id}` }, ok: true })
  }
  return out
}

/** The report for the side the manager meets in this fixture. Deterministic. */
export function buildReport(state: GameState, oppId: string): OppReport {
  const club = state.clubs[oppId]
  const acc = reportAccuracy(state, oppId)
  const last = lastMeeting(state, oppId)
  const soft = softSpot(state, oppId)
  const lines: ReportLine[] = []
  lines.push(...formLines(state, oppId))
  if (club) lines.push(...styleLines(state, club, acc))
  const men = keyMenLine(state, oppId)
  if (men) lines.push(men)
  if (club) lines.push(...setPieceLines(club, acc))
  if (club) lines.push(...coachLines(state, club, acc))
  // THE ARMS RACE (1.8.2): what their analysts have on OUR calls, and whether
  // this coach sets up for it (armsrace.ts); our own count, so always true
  const tape = club ? tapeLine(state, oppId, acc) : null
  if (tape) lines.push({ cat: 'calls', ...tape, ok: true })
  if (soft) {
    lines.push({
      cat: 'soft', k: 'oppreport.soft',
      v: { unit_k: `oppreport.u_${soft.unit}`, sure_k: soft.confidence >= 0.85 ? 'oppreport.sureHigh' : soft.confidence >= 0.7 ? 'oppreport.sureMid' : 'oppreport.sureLow' },
      ok: soft.right, conf: sureBand(soft.confidence),
    })
  }
  lines.push(...historyLines(last))
  return { oppId, abs: absWeek(state), test: !club, accuracy: acc, band: bandOf(acc), lines, soft, last }
}

// ---------------------------------------------------------------------------
// The response plan
// ---------------------------------------------------------------------------

export interface PlanOption {
  id: PlanId
  target: ChosenPlan['target']
  levers: PlanLevers
}

const nudge = (v: number | undefined, by: number) => clamp(Math.round((v ?? 50) + by), 0, 100)

/** a call is only worth making if the pack has actually drilled it */
function drilledEnough(club: Club, id: string): boolean {
  playbookOf(club)
  return routineEffect(club, id).drilled >= 55
}

/** The levers for going after one unit. The prep is the analyst's own mapping,
 *  so a sound read followed through a plan earns exactly the homework edge the
 *  engine already pays for following him. */
export function leversFor(state: GameState, unit: Unit, prep: MatchPrep): PlanLevers {
  const club = state.clubs[state.userClubId]
  const tac = club.tactic
  switch (unit) {
    case 'scrum':
      return { prep, dials: { style: nudge(tac.style, -5) }, ...(drilledEnough(club, 'sc_shove') ? { scrumCall: 'sc_shove' } : {}) }
    case 'lineout':
      return { prep, kickStyle: 'territory', ...(drilledEnough(club, 'lo_maul') ? { lineoutCall: 'lo_maul' } : {}) }
    case 'defence':
      return { prep, dials: { style: nudge(tac.style, 6) } }
    case 'attack':
      return { prep, dials: { defLine: nudge(tac.defLine, 6) } }
    case 'kicking':
      return { prep, dials: { kicking: nudge(tac.kicking, -6) } }
  }
}

const UNIT_PREP: Record<Unit, MatchPrep> = {
  scrum: 'setpiece', lineout: 'setpiece', defence: 'attack', attack: 'defence', kicking: 'attack',
}

/** Two or three plans, from the report. Club fixtures only: a Test side trains
 *  in the union's camp, where the club's dials, prep and calls do not reach. */
export function planOptions(state: GameState, fx: Fixture): PlanOption[] {
  if (!isClubFixture(state, fx)) return []
  const oppId = opponentIn(state, fx)
  const opp = oppId ? state.clubs[oppId] : null
  if (!oppId || !opp) return []
  const out: PlanOption[] = []
  const read = analystRead(state, oppId)
  if (read) out.push({ id: 'exploit', target: read.unit, levers: leversFor(state, read.unit, read.prep) })
  // the lesson of the last meeting, when it points somewhere the analyst does not
  const last = lastMeeting(state, oppId)
  if (last?.recall && last.recall.pct >= 55 && last.recall.unit !== read?.unit) {
    out.push({ id: 'lesson', target: last.recall.unit, levers: leversFor(state, last.recall.unit, UNIT_PREP[last.recall.unit]) })
  }
  const ph = philosophyOf(opp)
  const ctr = ph ? COUNTER[ph.id] : null
  if (ph && ctr) {
    const attacking = ['width', 'tempo', 'chaos', 'structure'].includes(ph.id)
    out.push({ id: 'counter', target: 'style', levers: { prep: attacking ? 'defence' : 'attack', dials: { ...ctr.dials } } })
  }
  out.push({ id: 'finish', target: 'late', levers: { prep: 'fitness', brief: 'impact' } })
  return out.slice(0, 3)
}

/** Put a plan's levers on the club, and remember which plan it was. */
export function applyPlan(state: GameState, fx: Fixture, opt: PlanOption): void {
  const club = state.clubs[state.userClubId]
  const oppId = opponentIn(state, fx)
  if (!club || !oppId) return
  const tac = club.tactic
  const L = opt.levers
  if (L.prep) state.matchPrep = L.prep
  if (L.dials) Object.assign(tac, L.dials)
  if (L.kickStyle) tac.kickStyle = L.kickStyle
  if (L.lineoutCall) tac.lineoutCall = L.lineoutCall
  if (L.scrumCall) tac.scrumCall = L.scrumCall
  if (L.brief) tac.briefs = benchSeats(club).map(() => L.brief!)
  const loop = (state.tacLoop ??= { findings: [] })
  loop.plan = { abs: absWeek(state), oppId, id: opt.id, target: opt.target, levers: JSON.parse(JSON.stringify(L)) }
}

/** This week's chosen plan against this side, if there is one. */
export function currentPlan(state: GameState, oppId: string): ChosenPlan | null {
  const p = state.tacLoop?.plan
  return p && p.abs === absWeek(state) && p.oppId === oppId ? p : null
}

/** Whether the club is still carrying the plan's levers. A dial moved more than
 *  a few points, another prep, another call: the plan was not followed. */
export function planFollowed(state: GameState, plan: ChosenPlan): boolean {
  const club = state.clubs[state.userClubId]
  if (!club) return false
  const tac = club.tactic
  const L = plan.levers
  if (L.prep && state.matchPrep !== L.prep) return false
  for (const [k, v] of Object.entries(L.dials ?? {})) {
    if (Math.abs((tac[k as keyof NonNullable<PlanLevers['dials']>] ?? 50) - (v as number)) > 4) return false
  }
  if (L.kickStyle && (tac.kickStyle ?? 'balanced') !== L.kickStyle) return false
  if (L.lineoutCall && (tac.lineoutCall ?? DEFAULT_LINEOUT) !== L.lineoutCall) return false
  if (L.scrumCall && (tac.scrumCall ?? DEFAULT_SCRUM) !== L.scrumCall) return false
  if (L.brief && !(tac.briefs ?? []).some(b => b === L.brief)) return false
  return true
}

/** Is this option the plan the club is carrying right now? */
export const isCurrent = (state: GameState, oppId: string, opt: PlanOption) => {
  const p = currentPlan(state, oppId)
  return !!p && p.id === opt.id && planFollowed(state, p)
}

// ---------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------

/** Keep a findings record, one per fixture, capped. */
export function keepFindings(state: GameState, rec: FindingsRecord): void {
  const loop = (state.tacLoop ??= { findings: [] })
  if (loop.findings.some(f => f.fxId === rec.fxId && f.season === rec.season)) return
  loop.findings = [...loop.findings, rec].slice(-FINDINGS_CAP)
}

/** Heal whatever an older or damaged save carries. An absent loop stays absent. */
export function migrateTacLoop(s: GameState): void {
  const raw = s.tacLoop as unknown
  if (raw == null) return
  if (typeof raw !== 'object' || Array.isArray(raw)) { delete s.tacLoop; return }
  const loop = raw as Partial<TacLoop>
  const list = Array.isArray(loop.findings) ? loop.findings : []
  loop.findings = list.filter(f => !!f && typeof f === 'object'
    && typeof f.fxId === 'number' && typeof f.oppId === 'string' && Array.isArray(f.items))
    .slice(-FINDINGS_CAP)
  const p = loop.plan
  if (p && (typeof p !== 'object' || typeof p.abs !== 'number' || typeof p.oppId !== 'string'
    || !PLAN_IDS.includes(p.id) || !p.levers || typeof p.levers !== 'object')) loop.plan = null
}
