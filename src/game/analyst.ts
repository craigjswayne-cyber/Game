// The analyst's read on the opposition (8-batch feedback: "analyst pre-match
// insight into how to beat them - it helps, but it is not a given"). He studies
// their last month of rugby, names the soft spot and recommends a week's work.
// Follow a correct read and you get a real edge; follow a wrong one and you
// have spent the week preparing for a problem they do not have.
import { logDecision, type GameState, type MatchPrep } from './model'
import { teamUnits, lineupFor } from './matchEngine'
import { t } from './i18n'
import { subjectVar } from './gender'

export interface AnalystRead {
  /** absolute week (season*100+week) this read was filed for */
  abs: number
  oppId: string
  /** the unit he thinks is soft */
  unit: 'scrum' | 'lineout' | 'defence' | 'attack' | 'kicking'
  /** the week's work he recommends */
  prep: MatchPrep
  /** whether he has actually got it right - hidden until the match */
  right: boolean
  /** The sentence, as English, exactly as it was filed.
   *
   *  Kept because it is already inside every save written before the read was
   *  split into its parts: analystClaim() rebuilds the line from `unit`,
   *  `confidence` and `man` when they are there, and falls back to this when
   *  they are not, so an old career still reads properly rather than showing a
   *  raw key. New reads set both. */
  claim: string
  /** the man he would test, so the line can be rebuilt in any language */
  man?: string
  /** how sure he sounded, 0-1 */
  confidence: number
  /** his record has already been updated for this read */
  settled?: boolean
}

/** The week's prep that works on each soft spot. One table for the club read
 *  here and the report's plans (oppreport.ts planOptions). */
export const UNIT_PREP: Record<AnalystRead['unit'], MatchPrep> = {
  scrum: 'setpiece',
  lineout: 'setpiece',
  defence: 'attack',
  attack: 'defence',
  kicking: 'attack',
}

/** THE UNIT OF OURS THAT GOES AFTER THEIR SOFT SPOT (1.8.1). Their defence is
 *  beaten by our attack and their attack by our defence; a scrum or a lineout
 *  is beaten by ours. A loose kicking game is punished by counter-attack, which
 *  is why he recommends an attacking week for it, so the homework lands on the
 *  attack too: the unit that benefits is the one the recommended week trains. */
export const EXPLOITED_BY: Record<AnalystRead['unit'], AnalystRead['unit']> = {
  scrum: 'scrum',
  lineout: 'lineout',
  defence: 'attack',
  attack: 'defence',
  kicking: 'attack',
}

/** How good his homework is: the analysis suite, the assistant, and knowing them. */
export function analystSkill(state: GameState): number {
  const club = state.clubs[state.userClubId]
  const suite = club?.facilities?.briefing ?? 0
  const assistant = state.staff.assistant ?? 0
  // (The cap is a guard: a level-5 suite and a level-3 assistant reach 0.75,
  // so today it never binds.)
  // Capped at 0.78, not 0.92. Measured over 20 seasons the analyst was right
  // 221 times against 50 wrong - 82% - which with a maxed briefing suite made
  // following him close to free. The feature exists to create a judgement
  // ("he helps, but he is not a given"), and a read you can trust four times
  // in five is not a judgement. A good setup now lands near three in four,
  // which is worth having and still worth doubting.
  return Math.min(0.78, 0.3 + suite * 0.06 + assistant * 0.05)
}

function hash(seed: number, abs: number, oppId: string): number {
  let h = (seed ^ Math.imul(abs, 2654435761)) >>> 0
  for (let i = 0; i < oppId.length; i++) h = Math.imul(h ^ oppId.charCodeAt(i), 16777619) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return (h >>> 0) % 1000
}

/** The read's roll, as a pure function, so the probe can measure the
 *  MECHANISM directly instead of holding a frozen career panel to a binomial
 *  band it never obeyed (the panel's triples are deterministic constants -
 *  see analystprobe for the whole story). Exactly the computation
 *  analystRead performs. */
export function rollIsRight(seed: number, abs: number, oppId: string, skill: number): boolean {
  return hash(seed, abs, oppId) % 100 < Math.round(skill * 100)
}

/**
 * ---- HOW SURE HE IS, AND WHY IT MEANS SOMETHING (1.8.2, owner brief B) ----
 *
 * Until 1.8.2 the analyst's confidence was a number off the same hash as his
 * verdict and unrelated to it: "I would stake my job on this" was right
 * exactly as often as "it is a hunch". Now both come from one place:
 *
 *   THE ODDS. A soft spot that stands out (their weakest unit well below the
 *   next) is easy to read and one that barely does is not, so the chance his
 *   read is sound is his skill moved up or down by how plainly the weakness
 *   shows: CLARITY is the gap between their weakest and next-weakest unit,
 *   against their average, over six per cent reading as plain as it gets
 *   (measured over 428 first XVs: median 2.8%, 90th percentile 5.9%). Across
 *   the world it averages out to his skill, so his record is what it was.
 *
 *   HIS SENSE OF THEM. His confidence is his own estimate of those odds,
 *   blurred by how good he is: a bare club's analyst guesses at how sure to
 *   be (twenty-odd points of blur either way), a full suite with a gold
 *   assistant knows within five. So "confident" means what it says, and the
 *   suite and the assistant raise both how often he is right and how well he
 *   knows when he is.
 *
 * Deterministic: two hashes of (seed, week, opponent), no shared rng.
 */
const CLARITY_GAP = 0.06
const CLARITY_K = 0.36
const CLARITY_MEAN = 0.5

export interface ReadOdds {
  /** the units weakest first, by strength against their average */
  sorted: [AnalystRead['unit'], number][]
  clarity: number
  /** the chance his read is sound */
  p: number
  right: boolean
  /** his estimate of p, 0.3..0.97 */
  confidence: number
}

export function readOdds(state: GameState, oppId: string, units: Record<AnalystRead['unit'], number>, abs: number): ReadOdds {
  const scores: [AnalystRead['unit'], number][] = [
    ['scrum', units.scrum], ['lineout', units.lineout],
    ['defence', units.defence], ['attack', units.attack], ['kicking', units.kicking],
  ]
  const avg = scores.reduce((s, [, v]) => s + v, 0) / scores.length || 1
  const sorted = scores.map(([u, v]) => [u, v / avg] as [AnalystRead['unit'], number]).sort((a, b) => a[1] - b[1])
  const clarity = Math.max(0, Math.min(1, (sorted[1][1] - sorted[0][1]) / CLARITY_GAP))
  const skill = analystSkill(state)
  const p = Math.max(0.08, Math.min(0.95, skill + CLARITY_K * (clarity - CLARITY_MEAN)))
  const right = rollIsRight(state.seed, abs, oppId, p)
  // his blur: 0.3 of skill is a bare club, 0.78 the best there is
  const sNorm = Math.max(0, Math.min(1, (skill - 0.3) / 0.48))
  const blur = 0.05 + 0.25 * (1 - sNorm)
  const u = hash(state.seed ^ 0x5bd1e995, abs, oppId) / 1000
  const confidence = Math.max(0.3, Math.min(0.97, p + (u * 2 - 1) * blur))
  return { sorted, clarity, p, right, confidence }
}

/** The unit his read names. A correct read names the genuine weakness; a
 *  wrong one names something else. It used to name their STRENGTH every
 *  time, which the unit numbers on the preview give away, so a careful
 *  manager could tell a wrong read from a right one without trusting his
 *  analyst at all. Which of the other four is on a hash, so the read still
 *  costs no shared rng. The club read and a Test side's report (oppreport.ts
 *  softSpot) both name theirs here, so the two cannot drift apart again. */
export function readUnit(state: GameState, oppId: string, abs: number, o: Pick<ReadOdds, 'sorted' | 'right'>): AnalystRead['unit'] {
  const { sorted, right } = o
  return right ? sorted[0][0] : sorted[1 + (hash(state.seed, abs, oppId) % (sorted.length - 1))][0]
}

/** the band a confidence reads as, the same three words everywhere */
export const sureBand = (c: number): 'high' | 'mid' | 'low' => (c >= 0.85 ? 'high' : c >= 0.7 ? 'mid' : 'low')

/**
 * File (or fetch) this week's read. Deterministic per (seed, week, opponent):
 * revisiting the screen never rerolls it, and it costs no shared rng.
 */
export function analystRead(state: GameState, oppId: string): AnalystRead | null {
  const abs = state.season * 100 + state.week
  const cached = state.analyst
  if (cached && cached.abs === abs && cached.oppId === oppId) return cached
  const opp = state.clubs[oppId]
  if (!opp) return null
  const units = teamUnits(state, lineupFor(state, oppId))
  const xv = lineupFor(state, oppId).slice(0, 15).map(id => id != null ? state.players[id] : null)
  // the true soft spot, by unit strength relative to the rest of their game,
  // and the odds he reads it, and how sure he is (readOdds); then the unit he
  // names, right or wrong (readUnit)
  const odds = readOdds(state, oppId, units, abs)
  const { right, confidence } = odds
  const unit = readUnit(state, oppId, abs, odds)

  // a name to hang it on: the man in that area of their side
  const slotFor: Record<AnalystRead['unit'], number[]> = {
    scrum: [0, 1, 2], lineout: [3, 4], defence: [5, 6, 11, 12],
    attack: [9, 10, 13], kicking: [9, 14],
  }
  const cand = slotFor[unit].map(i => xv[i]).filter(Boolean)
  const man = cand.sort((a, b) => (a!.ca) - (b!.ca))[0]
  const wordFor: Record<AnalystRead['unit'], string> = {
    scrum: 'their scrum goes backwards under pressure',
    lineout: 'their lineout is a lottery beyond the front pod',
    defence: 'their defensive line comes up in ones and twos',
    attack: 'they have no shape once the first phase breaks down',
    kicking: 'their kicking game hands territory back every time',
  }
  const how: Record<AnalystRead['unit'], string> = {
    scrum: 'Live scrummaging all week. Squeeze them and the penalties come.',
    lineout: 'Set-piece work: contest their throw and the platform collapses.',
    defence: 'Attacking shapes. Move them side to side and holes appear.',
    kicking: 'Attacking shapes and quick counters off their loose kicks.',
    attack: 'Defensive drills. Squeeze the space and let them run out of ideas.',
  }
  const sure = confidence >= 0.85 ? 'I would stake my job on this' : confidence >= 0.7 ? 'I am fairly confident' : 'It is a hunch, but a decent one'
  const read: AnalystRead = {
    abs, oppId, unit, prep: UNIT_PREP[unit], right, confidence,
    man: man?.name,
    claim: `${sure}: ${wordFor[unit]}${man ? `, and ${man.name} is the one to test` : ''}. ${how[unit]}`,
  }
  state.analyst = read
  return read
}

/**
 * The edge, applied at kickoff. A correct read that the manager actually
 * prepared for is worth a few percent - never more, because the opposition
 * are professionals too.
 */
export function analystEdge(state: GameState, oppId: string): { unit: AnalystRead['unit']; right: boolean } | null {
  const r = state.analyst
  if (!r || r.oppId !== oppId) return null
  if (r.abs !== state.season * 100 + state.week) return null
  if (state.matchPrep !== r.prep) return null
  return { unit: r.unit, right: r.right }
}

/** Book the verdict once the match is played, so his record is public. */
export function settleAnalyst(state: GameState, oppId: string) {
  const r = state.analyst
  if (!r || r.oppId !== oppId || state.matchPrep !== r.prep) return
  if (r.settled) return // a replayed match must not inflate his record
  r.settled = true
  state.analystRecord ??= { right: 0, wrong: 0 }
  if (r.right) state.analystRecord.right++
  else state.analystRecord.wrong++
  // his week-to-week record lives on the Match Prep card. Only the reads he
  // sold hardest go in the decisions ledger, or a match every week would
  // crowd out the boardroom, the market and the courses.
  if (r.confidence >= 0.85) {
    const opp = state.clubs[oppId]?.short ?? 'them'
    logDecision(state, r.right ? 'dec.analystRight' : 'dec.analystWrong',
      { opp, unit_k: `analyst.unit${r.unit[0].toUpperCase()}${r.unit.slice(1)}`, ...subjectVar(state.analystGender) }, r.right)
  }
}

export const analystForm = (state: GameState) => {
  const rec = state.analystRecord
  if (!rec || rec.right + rec.wrong === 0) return t('analyst.noReadsYet')
  const n = rec.right + rec.wrong
  return t('analyst.followedReads', { n, right: rec.right, wrong: rec.wrong, ...subjectVar(state.analystGender) })
}

/** The analyst's line, in the language the screen is in.
 *
 *  Built at render rather than at generation because a read is SAVED: a claim
 *  translated when it was filed would be stuck in whatever language the manager
 *  happened to be using that week. */
export function analystClaim(r: AnalystRead): string {
  if (r.man === undefined && r.claim) return r.claim  // filed before the split
  const cap = (u: string) => u[0].toUpperCase() + u.slice(1)
  const sure = t(r.confidence >= 0.85 ? 'analyst.sureStake'
    : r.confidence >= 0.7 ? 'analyst.sureFairly' : 'analyst.sureHunch')
  return t('analyst.claim', {
    sure,
    weakness: t(`analyst.weak${cap(r.unit)}`),
    who: r.man ? t('analyst.andTest', { name: r.man }) : '',
    how: t(`analyst.how${cap(r.unit)}`),
  })
}

/** UI labels. The engine's own UNIT_LABEL below stays English because it is
 *  written into stored news bodies, which are English wherever they are read. */
export const unitLabel = (u: AnalystRead['unit']) => t(`analyst.unit${u[0].toUpperCase()}${u.slice(1)}`)
export const prepLabel = (p: MatchPrep) => t(`analyst.prep${p[0].toUpperCase()}${p.slice(1)}`)

/** Slot labels, for the UI. */
export const UNIT_LABEL: Record<AnalystRead['unit'], string> = {
  scrum: 'Scrum', lineout: 'Lineout', defence: 'Defence', attack: 'Attack', kicking: 'Kicking game',
}
export const PREP_LABEL: Record<MatchPrep, string> = {
  attack: 'Attacking Shapes', defence: 'Defensive Drills', setpiece: 'Set-Piece Work',
  fitness: 'Conditioning', recovery: 'Recovery Week',
}
