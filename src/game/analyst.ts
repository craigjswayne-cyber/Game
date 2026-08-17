// The analyst's read on the opposition (8-batch feedback: "analyst pre-match
// insight into how to beat them - it helps, but it is not a given"). He studies
// their last month of rugby, names the soft spot and recommends a week's work.
// Follow a correct read and you get a real edge; follow a wrong one and you
// have spent the week preparing for a problem they do not have.
import { logDecision, type GameState, type MatchPrep } from './model'
import { teamUnits, lineupFor } from './matchEngine'

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
  claim: string
  /** how sure he sounded, 0-1 */
  confidence: number
  /** his record has already been updated for this read */
  settled?: boolean
}

const UNIT_PREP: Record<AnalystRead['unit'], MatchPrep> = {
  scrum: 'setpiece',
  lineout: 'setpiece',
  defence: 'attack',
  attack: 'defence',
  kicking: 'attack',
}

/** How good his homework is: the analysis suite, the assistant, and knowing them. */
export function analystSkill(state: GameState): number {
  const club = state.clubs[state.userClubId]
  const suite = club?.facilities?.briefing ?? 0
  const assistant = state.staff.assistant ?? 0
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
  const h = hash(state.seed, abs, oppId)
  const skill = analystSkill(state)
  const right = rollIsRight(state.seed, abs, oppId, skill)

  // the true soft spot, by unit strength relative to the rest of their game
  const scores: [AnalystRead['unit'], number][] = [
    ['scrum', units.scrum], ['lineout', units.lineout],
    ['defence', units.defence], ['attack', units.attack], ['kicking', units.kicking],
  ]
  const avg = scores.reduce((s, [, v]) => s + v, 0) / scores.length
  const sorted = [...scores].sort((a, b) => a[1] / avg - b[1] / avg)
  // a correct read names the genuine weakness; a wrong one names their strength
  const unit = right ? sorted[0][0] : sorted[sorted.length - 1][0]
  const confidence = 0.45 + (h % 55) / 100

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
    logDecision(state, r.right
      ? `Backed the analyst's strongest read at ${opp} (${UNIT_LABEL[r.unit].toLowerCase()}): he had it right, and it showed.`
      : `Backed the analyst's strongest read at ${opp} (${UNIT_LABEL[r.unit].toLowerCase()}): he was wrong, and the week was wasted.`, r.right)
  }
}

export const analystForm = (state: GameState) => {
  const rec = state.analystRecord
  if (!rec || rec.right + rec.wrong === 0) return 'No reads followed yet this era.'
  const n = rec.right + rec.wrong
  return `Followed ${n} of his reads: right ${rec.right}, wrong ${rec.wrong}.`
}

/** Slot labels, for the UI. */
export const UNIT_LABEL: Record<AnalystRead['unit'], string> = {
  scrum: 'Scrum', lineout: 'Lineout', defence: 'Defence', attack: 'Attack', kicking: 'Kicking game',
}
export const PREP_LABEL: Record<MatchPrep, string> = {
  attack: '⚡ Attacking Shapes', defence: '🛡 Defensive Drills', setpiece: '🏗 Set-Piece Work',
  fitness: '🏃 Conditioning', recovery: '🧖 Recovery Week',
}
