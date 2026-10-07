/**
 * ---- WHAT KIND OF JOB, AND WHAT KIND OF MAN UPSTAIRS ----
 *
 * Two things the Job Centre never said: what a club IS, and who runs it.
 * Every vacancy read as a crest, a league and a budget, and every board, once
 * you were inside, reacted to the same results by the same arithmetic. Two
 * clubs of equal stature were the same job.
 *
 * THE JOB PROFILE is read from the club's own data, never assigned:
 *
 *   giant      a rich club at the top of its league: it expects titles
 *   fallen     a big ground or a trophy history, and a side that no longer
 *              lives up to either: big expectations, a squad not up to them
 *   academy    a small club whose academy is better than everything around it
 *   newcomer   money well beyond its standing and no silverware: a board in
 *              a hurry
 *   troubled   in the red or in administration
 *   minnow     one of the smallest clubs in its league: survival is the job
 *   steady     everything else
 *
 * It moves the board's stated aim one step up or down the ladder (the title,
 * the top two, the top four, the play-offs, the top half, survival, not
 * bottom), and each profile has one standing demand judged every summer.
 *
 * THE CHAIRMAN is hidden and never shown as a stat. Each club's chair is one
 * of four kinds of man, fixed per club and save (a takeover seats a new one):
 *
 *   stability   calmer about results, fond of steady progress and sound books,
 *               readier to give a manager time and slower to open the purse
 *   ambition    louder about every result, quicker with transfer money,
 *               slower with time, and wants silverware
 *   youth       wants academy debuts and homegrown regulars, and backs the
 *               backroom
 *   commercial  wants full grounds and a profit, and backs building
 *
 * He is felt, not read: in how far a win or a defeat moves the boardroom, in
 * which of the Boardroom's four asks he is readier to grant, in a line of the
 * monthly memo, and in the one wish he makes each season and judges in May.
 *
 * WHAT IT NEVER TOUCHES: the honeymoon, the three weeks on the floor, the
 * second press, any AI club. Only the manager's own board confidence moves,
 * and by a few points at most.
 */
import type { Club, GameState } from './model'
import { boardObjective, leagueTier } from './model'
import { leaguePos } from './schedule'
import { isWomensId } from './gender'
import { ARC_OFF, arcHash, arcOf, type Conduct } from './arcbook'
import type { BoardAsk } from './boardroom'
import type { Vars } from './i18n'

export type JobProfile = 'giant' | 'fallen' | 'academy' | 'newcomer' | 'troubled' | 'minnow' | 'steady'
export type ChairType = 'stability' | 'ambition' | 'youth' | 'commercial'
export const CHAIR_TYPES: ChairType[] = ['stability', 'ambition', 'youth', 'commercial']

const median = (xs: number[]): number => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** The world's clubs in the same game as this one. */
function worldOf(state: GameState, clubId: string): Club[] {
  const w = isWomensId(clubId)
  return Object.values(state.clubs).filter(c => isWomensId(c.id) === w && c.players.length > 0)
}

/** Titles this club has on the world's record (league and cup). */
function honours(state: GameState, clubId: string): number {
  return state.history.filter(h => h.champion === clubId).length
}

/** What kind of job this club is. Pure: read from the club as it stands. */
export function jobProfile(state: GameState, clubId: string): JobProfile {
  const club = state.clubs[clubId]
  if (!club) return 'steady'
  if (club.balance < 0 || (club.admin && club.admin.season >= state.season)) return 'troubled'
  const league = worldOf(state, clubId).filter(c => c.leagueId === club.leagueId)
  const lgBudget = median(league.map(c => c.budget))
  const lgRep = median(league.map(c => c.rep))
  const lgCap = median(league.map(c => c.capacity0 ?? c.capacity))
  // what a club of this standing usually has to spend, across the whole world
  const peers = worldOf(state, clubId).filter(c => c.id !== clubId && Math.abs(c.rep - club.rep) <= 4)
  const usual = median(peers.map(c => c.budget)) || club.budget
  const titles = honours(state, clubId)
  if (club.budget >= usual * 1.8 && titles === 0 && club.rep < 80) return 'newcomer'
  if (club.rep >= 84 && club.budget >= lgBudget) return 'giant'
  const cap = club.capacity0 ?? club.capacity
  const pedigree = (cap >= lgCap * 2 && cap >= 12000) || titles >= 2
  if (pedigree && (club.rep <= lgRep - 2 || leagueTier(club.leagueId) >= 2)) return 'fallen'
  const f = club.facilities ?? {}
  const vals = Object.values(f).filter((x): x is number => typeof x === 'number')
  const mean = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0
  if ((f.academy ?? 0) - mean >= 0.8 && club.rep <= 76) return 'academy'
  const reps = league.map(c => c.rep).sort((a, b) => a - b)
  if (reps.length >= 4 && club.rep <= reps[Math.floor(reps.length / 4)]) return 'minnow'
  return 'steady'
}

/** The profile of the job the manager holds: the one he took, not whatever
 *  it has drifted into since (a club in the red is still the fallen giant he
 *  went to rebuild). Any other club reads live. */
export function profileOf(state: GameState, clubId: string): JobProfile {
  const cur = state.arc?.cur
  if (cur && cur.c === clubId && clubId === state.userClubId && cur.prof) return cur.prof as JobProfile
  return jobProfile(state, clubId)
}

/** The man in the chair. Hidden. Fixed per club and save; a takeover seats a new one. */
export function chairmanOf(state: GameState, clubId: string): ChairType {
  const salt = state.arc?.chairSalt?.[clubId] ?? 0
  return CHAIR_TYPES[arcHash(`${state.seed}|${clubId}|chair|${salt}`) % CHAIR_TYPES.length]
}

// ---------------------------------------------------------------- demands ---

/** The board's aims, best first. `pos` is the finish that meets each. */
function ladder(teams: number): { text: string; pos: number }[] {
  const n = Math.max(2, Math.round(teams))
  return [
    { text: 'objectives.boardTitle', pos: 1 },
    { text: 'arc.aimTop2', pos: 2 },
    { text: 'arc.aimTop4', pos: 4 },
    { text: 'objectives.boardPlayoffs', pos: 6 },
    { text: 'objectives.boardTopHalf', pos: 7 },
    { text: 'objectives.boardSurvive', pos: Math.max(1, n - 2) },
    { text: 'arc.aimNotBottom', pos: Math.max(1, n - 1) },
  ].map(r => ({ ...r, pos: Math.min(r.pos, n) }))
}

const SHIFT: Record<JobProfile, number> = { giant: -1, fallen: -1, newcomer: -1, academy: 1, troubled: 1, minnow: 0, steady: 0 }

/**
 * What this board demands of the manager this season: the stature aim of
 * boardObjective, one step up or down for the kind of job it is. Every
 * reader of the aim for the manager's own club comes through here.
 */
export function demandedFinish(state: GameState, clubId: string, teams = 14): { text: string; pos: number } {
  const club = state.clubs[clubId]
  const base = boardObjective(club?.rep ?? 60, teams)
  if (ARC_OFF.on || !club) return base
  const steps = ladder(teams)
  const i = steps.findIndex(s => s.text === base.text)
  if (i < 0) return base
  let j = Math.max(0, Math.min(steps.length - 1, i + SHIFT[profileOf(state, clubId)]))
  // A BOARD THAT HAS LOOKED AT ITS OWN SQUAD (owner, 1.8.14: "expect a bit
  // less"). Stature alone set the aim, so Leicester's board asked a new man
  // for the top four with the eighth-best squad in a league of ten, and a
  // manager who changed nothing was sacked in six first seasons of eight.
  // When the squad ranks three or more places below the aim, the aim drops
  // one step. The terraces do not lower theirs (season.ts, terraces.ts).
  const rank = squadRank(state, clubId)
  if (rank && rank - steps[j].pos >= 3) j = Math.min(steps.length - 1, j + 1)
  return j === i ? base : steps[j]
}

/** Where a club's squad stands in its league on paper: the mean current
 *  ability of its best 23 senior men, ranked. Null outside a league. */
export function squadRank(state: GameState, clubId: string): number | null {
  const club = state.clubs[clubId]
  const ids = state.comps[club?.leagueId ?? '']?.teamIds
  if (!club || !ids?.includes(clubId)) return null
  const depth = (id: string) => {
    const ca = (state.clubs[id]?.players ?? []).map(pid => state.players[pid]).filter(p => p && !p.acad).map(p => p.ca).sort((a, b) => b - a).slice(0, 23)
    return ca.length ? ca.reduce((a, b) => a + b, 0) / ca.length : 0
  }
  const mine = depth(clubId)
  return 1 + ids.filter(id => id !== clubId && depth(id) > mine).length
}

/** How far a result moves this boardroom, beside everything else it weighs. */
export function chairSwing(state: GameState): number {
  if (ARC_OFF.on || state.unemployed) return 1
  const ch = chairmanOf(state, state.userClubId)
  const f = ch === 'stability' ? 0.9 : ch === 'ambition' ? 1.1 : 1
  return profileOf(state, state.userClubId) === 'newcomer' ? f * 1.12 : f
}

/** The chairman's leaning on each of the Boardroom's asks. */
export function chairAskTilt(state: GameState, ask: BoardAsk): number {
  if (ARC_OFF.on || state.unemployed) return 0
  const ch = chairmanOf(state, state.userClubId)
  const T: Record<ChairType, Partial<Record<BoardAsk, number>>> = {
    stability: { time: 0.08, funds: -0.05 },
    ambition: { funds: 0.08, time: -0.08 },
    youth: { staff: 0.08 },
    commercial: { facilities: 0.08, funds: -0.05 },
  }
  return T[ch][ask] ?? 0
}

// ------------------------------------------------------------ the wish ---

const WISHES: Record<ChairType, [string, string]> = {
  stability: ['steady', 'black'],
  ambition: ['silver', 'topfour'],
  youth: ['debuts', 'homegrown'],
  commercial: ['crowd', 'profit'],
}

/** The one thing the chairman wants this season, as a key. */
export function chairWish(state: GameState): string | null {
  if (ARC_OFF.on || state.unemployed || !state.clubs[state.userClubId]) return null
  const ch = chairmanOf(state, state.userClubId)
  const pair = WISHES[ch]
  return pair[arcHash(`${state.seed}|${state.userClubId}|wish|${state.season}`) % 2]
}

/** Was the wish met? Read at the year end, before anything is wiped. */
export function wishMet(state: GameState, wish: string, row: { pos: number; deb: number } | null): boolean {
  const club = state.clubs[state.userClubId]
  if (!club) return false
  const comp = state.comps[club.leagueId]
  const pos = row?.pos || leaguePos(comp?.table, club.id)
  const books = state.books && state.books.clubId === club.id ? state.books : null
  const drift = books ? club.balance - books.opening - (state.injectedThisSeason ?? 0) : 0
  switch (wish) {
    case 'steady': {
      const prev = [...state.mgr.finishes].reverse().find(f => f.clubId === club.id && f.season === state.season - 1)
      const aim = demandedFinish(state, club.id, comp?.table.length ?? 14).pos
      // progress is a climb; standing still counts only where the board
      // wanted him to be. "pos <= prev" read last of twelve, twice, as
      // "steady progress up the table, and got it" (1.8.5 career QA)
      return pos > 0 && (prev && prev.leagueId === club.leagueId ? pos < prev.pos || (pos === prev.pos && pos <= aim) : pos <= aim)
    }
    case 'black': return club.balance - (state.injectedThisSeason ?? 0) >= 0 && drift >= 0
    case 'silver': return state.mgr.trophies.some(x => x.season === state.season) ||
      state.fixtures.some(f => f.stage === 'F' && f.played && (f.homeId === club.id || f.awayId === club.id))
    case 'topfour': return pos > 0 && pos <= 4
    case 'debuts': return (row?.deb ?? 0) >= 3
    case 'homegrown': return club.players.map(id => state.players[id])
      .filter(p => p && !p.acad && p.homegrown && p.stats.apps >= 8).length >= 3
    case 'crowd': return (state.fanMood ?? 60) >= 65
    case 'profit': return drift >= 0
    default: return false
  }
}

/** Each profile's standing demand, judged in May: +/- confidence and a line. */
function profileDemand(state: GameState, prof: JobProfile, row: { pos: number; deb: number } | null): { k: string; d: number } | null {
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const comp = state.comps[club.leagueId]
  const pos = row?.pos || leaguePos(comp?.table, club.id)
  const prev = [...state.mgr.finishes].reverse().find(f => f.clubId === club.id && f.season === state.season - 1)
  switch (prof) {
    case 'giant': {
      const recent = state.mgr.trophies.filter(x => x.clubId === club.id && x.season >= state.season - 1).length
      const tenure = state.season - (state.tenureStart ?? state.season) + 1
      if (state.mgr.trophies.some(x => x.clubId === club.id && x.season === state.season)) return { k: 'arc.demGiantWon', d: 2 }
      return tenure >= 2 && recent === 0 ? { k: 'arc.demGiantEmpty', d: -3 } : null
    }
    case 'fallen':
      if (!prev || prev.leagueId !== club.leagueId || pos <= 0) return null
      return pos < prev.pos ? { k: 'arc.demFallenRise', d: 2 } : pos > prev.pos ? { k: 'arc.demFallenSlide', d: -2 } : null
    case 'academy':
      return (row?.deb ?? 0) >= 2 ? { k: 'arc.demAcademyKept', d: 2 } : (row?.deb ?? 0) === 0 ? { k: 'arc.demAcademyIdle', d: -2 } : null
    case 'newcomer': {
      const aim = demandedFinish(state, club.id, comp?.table.length ?? 14).pos
      return pos > 0 && pos <= aim ? { k: 'arc.demNewcomerMet', d: 2 } : pos > 0 ? { k: 'arc.demNewcomerMissed', d: -3 } : null
    }
    case 'troubled': {
      const books = state.books && state.books.clubId === club.id ? state.books : null
      if (!books) return null
      return club.balance - (state.injectedThisSeason ?? 0) >= books.opening ? { k: 'arc.demTroubledMended', d: 3 } : { k: 'arc.demTroubledWorse', d: -2 }
    }
    default: return null
  }
}

/**
 * The summer verdict (arc.ts, from the rollover while the season's facts are
 * still standing): the chairman's wish and the job's standing demand, each a
 * few points of confidence either way, told in one letter. Returns the rows
 * for the letter, or null when there is nothing to say.
 */
export function boardSummer(state: GameState, row: { pos: number; deb: number } | null): Vars[] | null {
  if (ARC_OFF.on || state.unemployed) return null
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const rows: Vars[] = []
  let delta = 0
  const wish = chairWish(state)
  if (wish) {
    const met = wishMet(state, wish, row)
    delta += met ? 3 : -3
    rows.push({ k: met ? 'arc.wishMet' : 'arc.wishMissed', wish_k: `arc.wish.${wish}` })
  }
  const dem = profileDemand(state, profileOf(state, club.id), row)
  if (dem) { delta += dem.d; rows.push({ k: dem.k }) }
  club.boardConfidence = Math.max(5, Math.min(100, club.boardConfidence + delta))
  return rows.length ? rows : null
}

/**
 * ---- HOW, NOT ONLY WHAT ----
 *
 * The board judged the finish, the books and the chairman's one wish, and
 * never the way the season was run: a broken promise cost a player's morale
 * and an agent's trust but not a word upstairs. Now the May letter reads the
 * season's conduct row (repute.ts conductRow) as well, each man in the chair
 * through his own eyes:
 *
 *   any chairman   promises broken (-1 each, -2 at most), promises kept (+1),
 *                  debt grown on the manager's watch (-1), hard calls with an
 *                  unhappy room (-1)
 *   stability      a winning side hard to beat (+1); spending within means
 *                  (+2); debt grown (-2 rather than -1)
 *   commercial     spending within means (+2); debt grown (-2)
 *   ambition       a winning side that scores (+1); the money spent boldly,
 *                  and the club still in the black (+1)
 *   youth          academy debuts (+2); spending within means, the books
 *                  level without selling men to level them (+1, as any
 *                  chairman but an ambitious one; said of the wage bill too
 *                  when it ran under budget, or under the league's own share)
 *   any chairman   a busy touchline in a winning season (+1); in a losing
 *                  one, -1 from a stability chairman
 *
 * And said without points: the signings the salary cap or an embargo refused.
 *
 * What the chairman's wish already judged this season (the books, the debuts)
 * is not judged twice. The sum is held to METHOD_CAP either way, and the
 * letter names the one or two that weighed most. The points are returned, not
 * applied: the rollover adds them AFTER the summer pull toward the finish,
 * which would otherwise halve them (rollover.ts, the boardroom reset).
 */
export const METHOD_CAP = 4

export function boardMethod(state: GameState, row: Conduct | null): { d: number; rows: Vars[] } {
  const none = { d: 0, rows: [] }
  if (ARC_OFF.on || state.unemployed || !row) return none
  const club = state.clubs[state.userClubId]
  if (!club || row.c !== club.id) return none
  const ch = chairmanOf(state, club.id)
  const wish = chairWish(state)
  const books = state.books && state.books.clubId === club.id ? state.books : null
  const drift = books ? club.balance - books.opening - (state.injectedThisSeason ?? 0) : 0
  const careful = ch === 'stability' || ch === 'commercial'
  const spend = row.wages > 0 ? row.buy / row.wages : 0
  const parts: { k: string; d: number }[] = []
  if (row.broke > 0) parts.push({ k: 'arc.meth.broke', d: -Math.min(2, row.broke) })
  else if (row.kind >= 3) parts.push({ k: 'arc.meth.kept', d: 1 })
  if (books && drift < 0 && club.balance < 0) parts.push({ k: 'arc.meth.debt', d: careful ? -2 : -1 })
  else if (books && drift >= 0 && spend < 0.25 && wish !== 'black' && wish !== 'profit') {
    // THE CAREFUL MANAGER IS CREDITED BY MORE THAN THE CAREFUL CHAIRMAN (1.8.5
    // career QA: a manager who kept the bill under budget for eight seasons
    // under a youth chairman never read a word of it). A careful chair as
    // before; any other, a point, for a bill held under its budget as well
    // (an ambitious one excepted: he wanted the money used)
    // (and books kept level by selling his men are a seller's, not a careful
    // man's: those go unremarked by any but the careful chair)
    const under = (row.wr ?? 0) > 0 && (row.wr ?? 0) <= Math.max(92, row.wrl ?? 0)
    const sold = row.wages > 0 ? (row.sell ?? 0) / row.wages : 0
    if (careful) parts.push({ k: under ? 'arc.meth.prudentWages' : 'arc.meth.prudent', d: 2 })
    else if (ch !== 'ambition' && sold < 0.3) parts.push({ k: under ? 'arc.meth.prudentWages' : 'arc.meth.prudent', d: 1 })
  }
  if (row.hard >= 5 && row.mor < 6) parts.push({ k: 'arc.meth.hard', d: -1 })
  if (ch === 'youth' && row.deb >= 2 && wish !== 'debuts') parts.push({ k: 'arc.meth.academy', d: 2 })
  if (ch === 'ambition' && row.lg > 0 && row.w > row.l && row.pf / row.lg >= 1.15) parts.push({ k: 'arc.meth.attack', d: 1 })
  if (ch === 'ambition' && spend >= 0.45 && club.balance >= 0) parts.push({ k: 'arc.meth.spent', d: 1 })
  if (ch === 'stability' && row.lg > 0 && row.w > row.l && row.pa / row.lg <= 0.85) parts.push({ k: 'arc.meth.defence', d: 1 })
  // THE TOUCHLINE (1.8.5 career QA): a season of changed plans and half-time
  // answers, which the board reads by what it brought. Winning, a point from
  // anybody; losing, a point off a chairman who likes things steady.
  const busy = (row.pl ?? 0) >= 4 || (row.m > 0 && (row.chg ?? 0) / row.m >= 0.25)
  if (busy && row.w > row.l) parts.push({ k: 'arc.meth.tacWorked', d: 1 })
  else if (busy && ch === 'stability') parts.push({ k: 'arc.meth.tacRestless', d: -1 })
  // WHAT HELD HIM BACK (1.8.5 career QA: a manager the cap refused 26 times
  // in ten seasons and an embargo 13 was never told so in one place). Said,
  // not scored: the rule is the league's, and the board knows it.
  const said: Vars[] = []
  if ((row.embb ?? 0) >= 1) said.push({ k: 'arc.meth.embargo' })
  else if ((row.capb ?? 0) >= 2) said.push({ k: 'arc.meth.capHeld' })
  if (!parts.length) return { d: 0, rows: said }
  const d = Math.max(-METHOD_CAP, Math.min(METHOD_CAP, parts.reduce((s, x) => s + x.d, 0)))
  const told = [...parts].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 2)
  return { d, rows: [...told.map(x => ({ k: x.k })), ...said] }
}

/** A line for the monthly memo: what the chairman made of it, in his own terms. */
export function chairMemoRow(state: GameState): Vars | null {
  if (ARC_OFF.on || state.unemployed) return null
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const ch = chairmanOf(state, club.id)
  const good = club.boardConfidence >= 55
  return { k: `arc.memo.${ch}${good ? 'Good' : 'Poor'}`, wish_k: `arc.wish.${chairWish(state) ?? 'steady'}` }
}

/** Is the chairman's type one a probe can read? Only for the probe and the arc. */
export const chairOf = (state: GameState): ChairType | null =>
  state.unemployed || !state.clubs[state.userClubId] ? null : chairmanOf(state, state.userClubId)

/** A takeover seats a different kind of man in the chair (arc.ts, weekly). */
export function newChairman(state: GameState, clubId: string): void {
  const a = arcOf(state)
  a.chairSalt[clubId] = (a.chairSalt[clubId] ?? 0) + 1
}
