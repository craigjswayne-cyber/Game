import { capBill } from './ai'
import { userCap } from './grants'
import { fmtMoney, fmtWage, type Club, type GameState } from './model'
import { t } from './i18n'

/**
 * ---- THE SALARY CAP (F6) ----
 *
 * The game already told the manager there was one. Designating a marquee player
 * said his wage "now sits outside the salary cap", the handbook explained how the
 * cap worked, and capBill() carefully excluded academy men and two marquee
 * players from a total that nothing ever compared against anything. The promise
 * was real and the rule was not.
 *
 * This is the rule.
 *
 * ---- why the number is measured, not written down ----
 *
 * The real Premier Division cap is a figure in pounds, and quoting it here would mean
 * nothing: this game's wage scale is its own, and a squad costs what the squad
 * costs. Measured at the start of a career, a Premier Division bill runs from £192k to
 * £316k a week. A cap of "£6.4m a season" would either be unreachable or
 * irrelevant, and which one would depend on data changes nobody would connect to
 * it later.
 *
 * So the cap is derived from the league it governs: a shade above the median club.
 * That gives it the shape a cap is supposed to have - most of the division has
 * room and the biggest spenders are pressed right up against it. It calibrates
 * itself for every division, including the ones nobody measured, and it survives
 * the squad data being updated.
 *
 * ---- but NOBODY STARTS IN BREACH ----
 *
 * This used to read "one or two are over on day one and have to do something about
 * it", and that was the deliberate intent. It is not any more, and the reason is a
 * measurement rather than a preference. On the 2025/26 data the median rule put the
 * Premier Division cap at £283k, and exactly one club was over it: Bath, at £292k, 103%.
 * Bath is one of the two clubs actually being played in this house. So a new
 * manager picked the most famous squad in the game and was refused every signing
 * from her first week, for a squad she inherited, before she had been told a cap
 * existed.
 *
 * That is the same trap the marquee designation below already avoids, and for the
 * same reason: a rule you are in breach of on arrival is not a decision, it is a
 * wall. So at world creation only, the cap is floored so the richest club in each
 * division starts at OPENING_HEADROOM of it - tight, no room to spend, one
 * departure away from comfort, but not blocked.
 *
 * It costs the cap about 5% of its bite for the whole save, because the cap never
 * falls. That is the price, it is known, and it buys a first season that punishes
 * ambition rather than inheritance. Every summer after this one uses the median
 * rule untouched, so the constraint tightens against wage inflation as designed.
 *
 * ---- and it never falls ----
 *
 * Wages inflate over a long career, so a cap fixed at its opening value would
 * quietly stop mattering by season ten. It is recomputed every summer from the
 * same rule and takes the higher of that and last year's figure, so it tracks the
 * sport upward and never drops a club into breach for something it did not do.
 */

/** A shade above the median club: most have room, the top of the league does not. */
const CAP_OVER_MEDIAN = 1.16

/**
 * At world creation, the richest club in a division sits at most this far up its
 * cap. 0.98 is deliberately mean: no room to sign anybody, one wage off the line,
 * and every refusal it hands out is honest - but it is a squad to manage rather
 * than a breach to serve. See the header for what this costs and why.
 */
const OPENING_HEADROOM = 0.98

/** Two marquee men sit outside it, as they do in the real game. */
export const MARQUEE_SLOTS = 2

/** Breach it twice running and the board loses the transfer market for a year. */
export const EMBARGO_SEASONS = 1

function median(ns: number[]): number {
  if (!ns.length) return 0
  const s = [...ns].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/**
 * Work out this season's cap for every division and store it.
 *
 * Called at world creation and again each summer. Leagues with fewer than four
 * clubs get no cap: there is no meaningful median to take, and a cap nobody can
 * be measured against is worse than none.
 */
export function refreshCaps(state: GameState, includeUser = false) {
  state.caps ??= {}
  // Every AI club names its two marquee men before the cap is measured, because
  // that is what a club does: the allowance exists to keep the star you could not
  // otherwise afford, and no board leaves it unused. Without this, a fifth of the
  // world sat in breach on day one purely for not having filled in the form, and
  // the summer audit would have fined and embargoed twenty-two clubs a season.
  // The manager picks his own two - his slots are never touched here.
  for (const c of Object.values(state.clubs)) {
    // `includeUser` is set once, at world creation: a manager inherits a squad
    // whose marquee designations are already lodged with the league, and starting
    // him in breach of a rule nobody had explained yet would be a trap rather
    // than a decision. From then on his two slots are his to move.
    if (c.id === state.userClubId && !includeUser) continue
    const seniors = c.players
      .map(id => state.players[id])
      .filter(p => p && (!p.acad || p.demoted))  // a hand-demoted senior still counts - demotion is not a cap dodge
      .sort((a, b) => b.wage - a.wage)
    c.marquee = seniors.slice(0, MARQUEE_SLOTS).map(p => p.id)
  }
  const byLeague = new Map<string, number[]>()
  for (const c of Object.values(state.clubs)) {
    if (!c.leagueId) continue
    const bill = capBill(state, c)
    if (!Number.isFinite(bill)) continue
    const list = byLeague.get(c.leagueId) ?? []
    list.push(bill)
    byLeague.set(c.leagueId, list)
  }
  for (const [leagueId, bills] of byLeague) {
    if (bills.length < 4) continue
    let fresh = Math.round((median(bills) * CAP_OVER_MEDIAN) / 1_000) * 1_000
    // AT CREATION ONLY: lift the line clear of the division's biggest spender, so
    // no club begins the game in breach of a rule it has not yet been told about.
    // `includeUser` is the creation flag; every later summer keeps the median rule
    // exactly as it was.
    if (includeUser) {
      const top = Math.max(...bills)
      fresh = Math.max(fresh, Math.ceil((top / OPENING_HEADROOM) / 1_000) * 1_000)
    }
    // never downward: a club must not fall into breach because the league got
    // poorer around it
    state.caps[leagueId] = Math.max(state.caps[leagueId] ?? 0, fresh)
  }
}

export interface CapPosition {
  /** the ceiling for this club's division, or null where the division has none */
  cap: number | null
  /** what the squad costs against it, marquee men and academy excluded */
  bill: number
  /** room left, negative when over */
  headroom: number
  over: boolean
  /** how close to the line, 0-1+, for a bar that can overfill */
  used: number
  marquee: number[]
  /** seasons of transfer embargo still to serve, 0 for none */
  embargo: number
}

export function capPosition(state: GameState, clubId: string): CapPosition {
  const club = state.clubs[clubId]
  // userCap is the till's one adjustment (v1.1.0): the Charter lifts the
  // user's ceiling for good, an injection's allowance rents bounded room for
  // the season. AI clubs pass through untouched - the law still applies to
  // them - and ai.ts's own capOf() calls the same function, so the Finances
  // bar and the negotiating table can never disagree about the ceiling.
  const cap = userCap(state, clubId, (club?.leagueId && state.caps?.[club.leagueId]) || null)
  const bill = club ? capBill(state, club) : 0
  const headroom = cap == null ? 0 : cap - bill
  return {
    cap,
    bill,
    headroom,
    over: cap != null && bill > cap,
    used: cap ? bill / cap : 0,
    marquee: (club?.marquee ?? []).slice(0, MARQUEE_SLOTS),
    embargo: Math.max(0, (club?.capEmbargoUntil ?? -1) - state.season + 1),
  }
}

/** Is this club barred from the market for a cap breach? */
export function underEmbargo(state: GameState, clubId: string): boolean {
  return capPosition(state, clubId).embargo > 0
}

/**
 * Would adding this weekly wage put the club over its cap?
 *
 * Returns null when it is fine, or the sentence to show the manager when it is
 * not. The wage of a man already on the books can be passed as `replacing` so a
 * renewal is measured as the change it really is rather than as a second salary.
 */
export function capRefusal(state: GameState, clubId: string, wage: number, replacing = 0): string | null {
  const pos = capPosition(state, clubId)
  if (pos.cap == null) return null
  const after = pos.bill - replacing + wage
  if (after <= pos.cap) return null
  return t('reply.capRefusal', { over: fmtMoney(after - pos.cap), cap: fmtMoney(pos.cap), n: MARQUEE_SLOTS })
}

/**
 * An AI club sells its way back under the line before the auditors arrive.
 *
 * This is what actually happens in a capped league, and without it the rule was
 * unfair in two directions at once. A fifth of the world starts above the median
 * spend, AI clubs never trim, and the cap never falls - so those clubs would have
 * been fined every summer for ever, and once the fine became an embargo they
 * would have been frozen out of the transfer market permanently. Meanwhile the
 * embargo only ever gated the manager's own deals, so the sanction bit him and
 * nobody else.
 *
 * Now the highest earners go, in order, until the bill fits. They leave as free
 * agents rather than vanishing, which is the point: every summer the cap puts
 * real players on the market for whoever has room for them. A squad is never cut
 * below a fieldable size, and only three men can go in one summer - beyond that
 * the club takes the fine, which is also true to life.
 */
function trimToCap(state: GameState, club: Club) {
  const cap = club.leagueId ? state.caps?.[club.leagueId] : null
  if (typeof cap !== 'number' || cap <= 0) return
  const marquee = new Set((club.marquee ?? []).slice(0, MARQUEE_SLOTS))
  let released = 0
  while (released < 3 && capBill(state, club) > cap) {
    const seniors = club.players
      .map(id => state.players[id])
      .filter(p => p && !p.acad && !marquee.has(p.id) && !p.loanFrom)
      .sort((a, b) => b.wage - a.wage)
    if (club.players.length <= 30 || !seniors.length) break
    const going = seniors[0]
    club.players = club.players.filter(id => id !== going.id)
    club.tactic.lineup = club.tactic.lineup.map(id => (id === going.id ? null : id))
    if (club.captain === going.id) club.captain = null
    if (club.vice === going.id) club.vice = null
    going.clubId = null
    going.transferListed = false
    released++
  }
}

/**
 * The summer audit. Anyone over the cap answers for it.
 *
 * A first breach is a fine and a cold boardroom. A second in a row costs the
 * transfer market for a season, which is the sanction that actually changes how
 * the next year is played - a fine is only money, and a club over the cap
 * generally has some.
 */
export function auditCaps(state: GameState) {
  for (const club of Object.values(state.clubs)) {
    if (club.id !== state.userClubId) trimToCap(state, club)
    const pos = capPosition(state, club.id)
    if (pos.cap == null) continue
    if (!pos.over) { club.capBreaches = 0; continue }

    const over = pos.bill - pos.cap
    club.capBreaches = (club.capBreaches ?? 0) + 1
    const repeat = club.capBreaches >= 2
    // three weeks of the overspend, which scales with how far over they went
    const fine = Math.round(over * 3)
    club.balance -= fine
    if (repeat) club.capEmbargoUntil = state.season + EMBARGO_SEASONS

    if (club.id !== state.userClubId) continue
    club.boardConfidence = Math.max(0, club.boardConfidence - (repeat ? 14 : 7))
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: repeat ? `⚖ Salary cap: transfer embargo` : `⚖ Salary cap: the club is fined`,
      body: repeat
        ? `A second breach in two seasons. The league fine ${club.name} ${fmtMoney(fine)} and impose a transfer embargo for next season: no signings, in or out of the window, until the wage bill is back inside ${fmtWage(pos.cap)}/wk. The board are furious, and they are right to be. Bring the bill down or the sanction repeats.`
        : `${club.name} finished the season ${fmtWage(over)}/wk over the ${fmtWage(pos.cap)}/wk salary cap. The league fine the club ${fmtMoney(fine)} and put it on notice: breach it again next season and the punishment is a transfer embargo. Two men can be named marquee and taken out of the calculation, and academy players never counted.`,
      k: repeat ? 'news.capEmbargo' : 'news.capFine',
      v: { club: club.name, fine: fmtMoney(fine), cap: fmtMoney(pos.cap ?? 0), over: fmtMoney(over) },
    })
  }
}

/** Plain words for the cap bar, so the number is never on its own. */
export function capWord(pos: CapPosition): string {
  if (pos.cap == null) return t('finances.capNoCap')
  if (pos.embargo > 0) return t('finances.capEmbargo')
  if (pos.over) return t('finances.capOver', { amount: fmtMoney(-pos.headroom) })
  if (pos.used > 0.96) return t('finances.capRightUp')
  if (pos.used > 0.85) return t('finances.capRoomLeft', { amount: fmtMoney(pos.headroom) })
  return t('finances.capClear', { amount: fmtMoney(pos.headroom) })
}

/**
 * ---- THE MULTI-YEAR ROSTER GRID (F10) ----
 *
 * How many men will still be here in three summers, and in which shirts? The
 * squad screen answers it a player at a time, which is the wrong shape for the
 * question: nobody plans a front row by scrolling a list of expiry years.
 *
 * This is the answer as a grid - positions down, seasons across, one number in
 * each cell - so a hole two years out is visible before it becomes a crisis.
 */
export const ROSTER_GROUPS: { label: string; pos: string[] }[] = [
  { label: 'finances.unitFrontRow', pos: ['LP', 'HK', 'TP'] },
  { label: 'finances.unitBackFive', pos: ['LK', 'FL', 'N8'] },
  { label: 'finances.unitHalves', pos: ['SH', 'FH'] },
  { label: 'finances.unitMidfield', pos: ['CE'] },
  { label: 'finances.unitBackThree', pos: ['WG', 'FB'] },
]

export interface RosterCell {
  /** men under contract for that season */
  count: number
  /** the thinnest a unit should ever be, for colouring */
  need: number
}

/** How many bodies each group needs to field a matchday squad without a shoehorn. */
const GROUP_NEED: Record<string, number> = {
  'Front row': 6, 'Back five': 8, 'Halves': 4, 'Midfield': 3, 'Back three': 5,
}

/**
 * Contract cover by unit for this season and the next three.
 *
 * A player counts for a season if his deal runs to the end of it or beyond.
 * Academy men are counted: they are exactly who fills a hole three years out.
 */
export function rosterGrid(state: GameState, clubId: string): { seasons: number[]; rows: { label: string; need: number; cells: RosterCell[] }[] } {
  const club = state.clubs[clubId]
  const seasons = [0, 1, 2, 3].map(n => state.season + n)
  const squad = (club?.players ?? []).map(id => state.players[id]).filter(Boolean)
  const rows = ROSTER_GROUPS.map(g => {
    const need = GROUP_NEED[g.label] ?? 4
    const cells = seasons.map(season => ({
      need,
      count: squad.filter(p => g.pos.includes(p.pos) && p.contractEnds >= season).length,
    }))
    return { label: g.label, need, cells }
  })
  return { seasons, rows }
}

/** The club's own view of whether it is short anywhere in the next three summers. */
export function rosterWarnings(state: GameState, clubId: string): string[] {
  const { seasons, rows } = rosterGrid(state, clubId)
  const out: string[] = []
  for (const row of rows) {
    for (let i = 1; i < row.cells.length; i++) {
      const cell = row.cells[i]
      if (cell.count >= cell.need) continue
      out.push(t('finances.rosterWarn', { unit: t(row.label), count: cell.count, year: 2026 + seasons[i], need: cell.need }))
      break // one warning per unit, at the first summer it bites
    }
  }
  return out
}

/** Used by the probe and by any caller that wants the raw bill for a club. */
export function billOf(state: GameState, club: Club): number {
  return capBill(state, club)
}
