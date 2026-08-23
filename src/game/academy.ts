// The A League: the academy is a team, not a shelf (feedback 10G).
//
// User: "Teams academy should be a squad of 27. They should also play games but
// managed by academy coach. Results should be reported and fixtures/table should
// be in an academy section."
//
// Two halves to that. The squad is newgame.ts and rollover.ts: ACADEMY_SIZE men in
// ACAD_SHAPE, a positional spread that can field a XV and cover it, rather than the
// four named prospects the academy used to be. This file is the other half - a real
// double round-robin among the academy sides of the user's league, played every
// league week under the academy coach, with a table, a results feed and a report.
//
// THREE DELIBERATE LIMITS, each of which is the reason this is affordable:
//
//   The user's league only. All 101 clubs carry a 27-man academy, because a squad
//   has to be right everywhere the user might move to and because the seniors raid
//   it in a crisis. A world-wide A League would be ~1,100 extra fixtures a season;
//   one league is ~90. The competition is rebuilt at rollover for whatever league
//   the manager is in that season, so taking a job in the Elite 14 gets you the Espoirs.
//
//   Its own sim, not simMatch. The senior engine is 2,200 lines wired into gate
//   receipts, board confidence, milestone ledgers, Test call-ups and a points-per-game
//   band held to a tenth. Sending an academy fixture through it would be slow and
//   would put every one of those ledgers at risk for a result nobody's job depends on.
//   The model here is a scoreline generator calibrated to the senior distribution,
//   and it touches nothing but the academy players' own apps, form and development.
//
//   Its own store, not state.comps. An 'acad' Competition would appear in the World
//   screens, the fixture lists, the knockout builder and the champion history, and
//   every one of those would need a special case. state.academy is invisible until
//   the Academy screen asks for it.
import type { Club, GameState, Player, Pos, TableRow } from './model'
import { clamp, mulberry32, type Rng } from './rng'
import { facLevel, XV_SLOTS } from './model'
// A League fixtures share the senior league's match weeks: in the real game the A
// side plays the Friday before the first team's Saturday. Imported rather than
// redeclared so the two calendars can never drift apart.
import { LEAGUE_WEEKS } from './schedule'
import { buildPlayer } from './attributes'
import { regenName, worldNames } from './nations'

/** A senior squad is 38. An academy is 27: a XV, a bench, and cover for the
 *  half of them who are away with age-group sides or carrying something. */
export const ACADEMY_SIZE = 27

/** The shirts an academy signs, in order. Named rather than filled
 *  thinnest-first: a thinnest-first academy inherits the SENIOR squad's gaps
 *  and ends up six locks deep with no scrum-half, which is fine as senior cover
 *  and useless as a team. Front row 6, back five 9, halves 4, backs 8. */
export const ACAD_SHAPE: Pos[] = [
  'LP', 'LP', 'HK', 'HK', 'TP', 'TP',
  'LK', 'LK', 'LK', 'FL', 'FL', 'FL', 'FL', 'N8', 'N8',
  'SH', 'SH', 'FH', 'FH',
  'CE', 'CE', 'CE', 'WG', 'WG', 'WG', 'FB', 'FB',
]

/** The quality an academy recruit is signed at, shared by the fresh world, the
 *  summer intake and the save migration so the three can never drift apart.
 *
 *  Weighted hard on club reputation - the first cut of this leaned on the random
 *  term and produced a world where every academy in the Premier Division sat inside
 *  three points of every other, which made the A League a coin toss and made
 *  building a Centre of Excellence pointless. Same mean, four times the spread. */
export function acadQuality(club: Club, rng: Rng): number {
  return 28 + Math.floor(rng() * 16) + Math.floor(club.rep / 6)
}

export interface AcadFixture {
  round: number
  week: number
  homeId: string
  awayId: string
  played: boolean
  homeScore: number
  awayScore: number
  homeTries: number
  awayTries: number
  /** the academy men who crossed, for the user's side only - the rest of the
   *  league gets a scoreline, which is all a results page ever shows anyway */
  scorers?: number[]
}

export interface AcadLeague {
  /** the season this was built for - a stale one is rebuilt at rollover */
  season: number
  /** the senior league it mirrors */
  leagueId: string
  name: string
  short: string
  rounds: number
  fixtures: AcadFixture[]
  table: TableRow[]
  champion?: string
}

/** Refill a club's academy to ACADEMY_SIZE in ACAD_SHAPE, shirt by shirt.
 *
 *  Academies recruit every summer, and they have to: graduation at 22 and the AI's
 *  "he is ready, promote him" rule take five to nine men out of every academy in
 *  the world each year, against an intake of two to four. A four-man academy could
 *  live with that churn. A 27-man one that has to field a XV every week cannot, and
 *  without this the A League would be down to eleven-a-side inside five seasons.
 *
 *  Used by the rollover AND by the save migration, so a career started before the
 *  A League existed gets exactly the same academy as a new one. */
export function topUpAcademy(state: GameState, club: Club, rng: Rng, seedBase = 0): number {
  const have: Partial<Record<Pos, number>> = {}
  for (const id of club.players) {
    const p = state.players[id]
    if (p?.acad) have[p.pos] = (have[p.pos] ?? 0) + 1
  }
  const want: Partial<Record<Pos, number>> = {}
  for (const pos of ACAD_SHAPE) want[pos] = (want[pos] ?? 0) + 1
  let made = 0
  for (const pos of Object.keys(want) as Pos[]) {
    for (let k = have[pos] ?? 0; k < (want[pos] ?? 0); k++) {
      const p = buildPlayer({
        name: regenName(rng, club.country === 'EUR' ? 'ENG' : club.country, worldNames(state)),
        pos,
        age: 17 + Math.floor(rng() * 3),
        nat: club.country === 'EUR' ? 'ENG' : club.country,
        q: acadQuality(club, rng),
        gk: (pos === 'FH' || pos === 'FB') && rng() < 0.3,
      }, club.id, seedBase + club.players.length * 31 + made, state.season)
      p.youth = true
      p.acad = true
      state.players[p.id] = p
      club.players.push(p.id)
      made++
    }
  }
  return made
}

const emptyRow = (teamId: string): TableRow =>
  ({ teamId, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, tf: 0, ta: 0, bp: 0, pts: 0 })

/** Every academy man on the books. Excludes anyone away on loan: he is playing
 *  his rugby somewhere else, which is the whole point of sending him. */
export function academySquad(state: GameState, club: Club): Player[] {
  return club.players
    .map(id => state.players[id])
    .filter((p): p is Player => !!p && !!p.acad && !p.onLoan)
}

/** The side the academy coach picks: best available in each shirt, natural
 *  position first, then anyone who lists it as an alternative.
 *
 *  `rot` is the round number, and it is the whole difference between a development
 *  side and a first team. Picking the strongest XV every week gave the same fifteen
 *  men eighteen games and the other twelve none, which is the exact failure the
 *  academy exists to prevent - a lad who never plays never develops, and ACAD_SHAPE
 *  is built two deep in every shirt precisely so he does not have to wait. So each
 *  shirt alternates between its first and second choice week by week. Over a season
 *  every one of the 27 gets a dozen starts, the better man still gets more, and
 *  because both sides in a fixture rotate on the same round it costs the balance
 *  nothing. */
export function academyXV(state: GameState, club: Club, rot = 0): Player[] {
  const pool = academySquad(state, club).filter(p => !p.injury && p.bans === 0)
  const used = new Set<number>()
  const xv: Player[] = []
  XV_SLOTS.forEach(({ pos: slot }, i) => {
    const ranked = pool
      .filter(p => !used.has(p.id) && p.pos === slot)
      .sort((a, b) => b.ca + b.form - (a.ca + a.form))
    const alts = ranked.length ? ranked : pool
      .filter(p => !used.has(p.id) && p.alt.includes(slot))
      .sort((a, b) => b.ca + b.form - (a.ca + a.form))
    const list = alts.length ? alts : pool
      .filter(p => !used.has(p.id))
      .sort((a, b) => b.ca - a.ca)
    // the shirt index shifts the phase, so the whole XV does not swap out at once
    const pick = list[list.length > 1 ? (rot + i) % 2 : 0]
    if (!pick) return
    used.add(pick.id)
    xv.push(pick)
  })
  return xv
}

/** How good this academy side is, 0-100ish.
 *
 *  The XV's ability is most of it. The rest is the two things a manager actually
 *  controls: the coach he appointed and the centre of excellence he built. A gold
 *  academy coach at a level 5 centre is worth about six points of team ability,
 *  which over a season is the difference between mid-table and a title race - and
 *  is the only reason to spend money on either. */
export function academyStrength(state: GameState, club: Club, rot = 0): number {
  const xv = academyXV(state, club, rot)
  if (!xv.length) return 30
  const ability = xv.reduce((s, p) => s + p.ca, 0) / xv.length
  const user = club.id === state.userClubId
  // AI clubs get a standing from reputation rather than staff records they do
  // not keep: a Leicester academy is better resourced than a Newcastle one.
  const coach = user ? (state.staff?.academyCoach ?? 0) : clamp((club.rep - 55) / 15, 0, 3)
  const coe = user ? facLevel(state, 'academy') : clamp(Math.round((club.rep - 50) / 10), 0, 5)
  return ability + coach * 1.2 + coe * 0.45
}

/** Berger round robin, doubled. Local rather than schedule.ts's because that one
 *  writes Fixture rows into state.fixtures, which is exactly what this must not do. */
function pairings(ids: string[], rng: Rng): [string, string][][] {
  const list = [...ids].sort(() => rng() - 0.5)
  if (list.length % 2 === 1) list.push('')
  const m = list.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < m - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < m / 2; i++) {
      const a = list[i]
      const b = list[m - 1 - i]
      if (a && b) round.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(round)
    list.splice(1, 0, list.pop()!)
  }
  return [...rounds, ...rounds.map(r => r.map(([h, a]) => [a, h] as [string, string]))]
}

/** Build (or rebuild) the A League for whichever league the manager is in.
 *  Returns null if he has no club, or his league has too few sides to be one. */
export function buildAcademyLeague(state: GameState, seed: number): AcadLeague | null {
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const teams = Object.values(state.clubs).filter(c => c.leagueId === club.leagueId).map(c => c.id)
  if (teams.length < 4) return null
  const comp = state.comps[club.leagueId]
  const rng = mulberry32(seed ^ 0x5ACADE)
  const rounds = pairings(teams, rng)
  const fixtures: AcadFixture[] = []
  rounds.forEach((pairs, r) => {
    // more rounds than league weeks (a 14-side double RR is 26) simply wraps:
    // two A-League games in a week is a normal week for a development side
    const week = LEAGUE_WEEKS[r % LEAGUE_WEEKS.length]
    for (const [h, a] of pairs) {
      fixtures.push({
        round: r, week, homeId: h, awayId: a,
        played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  return {
    season: state.season,
    leagueId: club.leagueId,
    name: `${comp?.short ?? 'League'} A League`,
    short: 'A League',
    rounds: rounds.length,
    fixtures,
    table: teams.map(emptyRow),
  }
}

/** Ensure the A League exists and belongs to this season and this league. Called
 *  on the way into the week and on the way into the screen, so a mid-season club
 *  move or an old save both land on a correct competition without a migration. */
export function ensureAcademyLeague(state: GameState): AcadLeague | null {
  const club = state.clubs[state.userClubId]
  const cur = state.academy
  if (cur && cur.season === state.season && club && cur.leagueId === club.leagueId) return cur
  state.academy = buildAcademyLeague(state, state.seed + state.season * 7919) ?? undefined
  return state.academy ?? null
}

/** Poisson by inversion. The senior engine reaches a try count by simulating
 *  eighty minutes; here the count IS the model, so it has to have the right
 *  shape - a Poisson tail is what gives you the occasional 50-3 hiding without
 *  making the average score silly. */
function pois(rng: Rng, mean: number): number {
  const m = clamp(mean, 0.05, 12)
  let l = Math.exp(-m)
  let k = 0
  let p = rng()
  while (p > l && k < 14) {
    p *= rng()
    k++
  }
  return k
}

// Calibrated against the senior world's healthy band, and measured there:
// 52.75 combined points, 6.00 combined tries, 55.1% home wins, 2.43% draws over
// 300,000 fixtures at real world strengths (scripts/acadprobe.ts holds the tripwire).
// The A League reads like rugby because it IS the same distribution - a development
// league that ran to 45-3 scorelines would look broken however defensible the model.
const TRY_MEAN = 3.0
const HOME_TRIES = 0.22
const PENS_MEAN = 3.1
const CONV_BASE = 0.66
/** points of team ability per extra try - 15 points of gap is about 1.2 tries */
const ABILITY_PER_TRY = 12.5

/** The scoreline model, and nothing else: two team strengths in, a result out.
 *
 *  Exported so scripts/acadprobe.ts can run a hundred thousand of these against
 *  real world strengths. Ninety fixtures a season is far too small a sample to
 *  calibrate on - the same dials measured 51% home wins one season and 64% the
 *  next, both of them noise around the same true number, and tuning against that
 *  is how you chase your own tail for an afternoon. */
export function acadScoreline(hs: number, as: number, rng: Rng) {
  const edge = (hs - as) / ABILITY_PER_TRY
  const ht = pois(rng, TRY_MEAN + HOME_TRIES + edge / 2)
  const at = pois(rng, TRY_MEAN - HOME_TRIES - edge / 2)
  // conversions, then the penalties and drop goals that make up the rest of a
  // scoreline. Academy kickers miss more than senior ones, which is the point.
  //
  // The kicking rate is centred on THIS MATCH's average strength, not on a fixed
  // 50. Against a fixed reference, total scoring drifted with how good academies
  // happened to be in a given world - a two-point rise in the average academy
  // moved combined points by four tenths, which is enough to walk the A League
  // out of the band without a single dial being touched. Centred, only the gap
  // between the two sides can move a result, which is the whole intent.
  const mid = (hs + as) / 2
  const kick = (tries: number, str: number) => {
    let pts = tries * 5
    const rate = clamp(CONV_BASE + (str - mid) * 0.006, 0.48, 0.86)
    for (let i = 0; i < tries; i++) if (rng() < rate) pts += 2
    const pens = pois(rng, PENS_MEAN)
    for (let i = 0; i < pens; i++) if (rng() < rate + 0.08) pts += 3
    if (rng() < 0.07) pts += 3
    return pts
  }
  return { ht, at, hp: kick(ht, hs), ap: kick(at, as) }
}

/** One A League match: a scoreline, and who scored it for the user's side. */
function playAcad(state: GameState, fx: AcadFixture, rng: Rng) {
  const home = state.clubs[fx.homeId]
  const away = state.clubs[fx.awayId]
  if (!home || !away) { fx.played = true; return }
  const hs = academyStrength(state, home, fx.round)
  const as = academyStrength(state, away, fx.round)
  const { ht, at, hp, ap } = acadScoreline(hs, as, rng)
  fx.homeTries = ht
  fx.awayTries = at
  fx.homeScore = hp
  fx.awayScore = ap
  fx.played = true

  // who crossed, for the user's team sheet. The XV is picked by the coach, and a
  // back is likelier than a prop, which is why the weights lean on the shirt.
  const mine = fx.homeId === state.userClubId ? 'home' : fx.awayId === state.userClubId ? 'away' : null
  if (mine) {
    const xv = academyXV(state, state.clubs[state.userClubId], fx.round)
    const count = mine === 'home' ? ht : at
    const scorers: number[] = []
    const BACKS: Pos[] = ['SH', 'FH', 'CE', 'WG', 'FB']
    const weights = xv.map(p => (BACKS.includes(p.pos) ? 2.4 : p.pos === 'N8' || p.pos === 'FL' ? 1.4 : 0.7))
    const total = weights.reduce((s, w) => s + w, 0)
    for (let i = 0; i < count && total > 0; i++) {
      let r = rng() * total
      for (let k = 0; k < xv.length; k++) {
        r -= weights[k]
        if (r <= 0) { scorers.push(xv[k].id); break }
      }
    }
    fx.scorers = scorers
  }

  // the XV banks a game: apps for the record, and the development that is the
  // reason the fixture exists. Kept small - a season of A League is worth about
  // a point and a half of ability, on top of whatever training gives him.
  for (const teamId of [fx.homeId, fx.awayId]) {
    const club = state.clubs[teamId]
    if (!club) continue
    const won = teamId === fx.homeId ? fx.homeScore > fx.awayScore : fx.awayScore > fx.homeScore
    const user = teamId === state.userClubId
    const coach = user ? (state.staff?.academyCoach ?? 0) : clamp((club.rep - 55) / 15, 0, 3)
    for (const p of academyXV(state, club, fx.round)) {
      p.stats.apps++
      p.sharp = clamp(p.sharp + 6, 0, 100)
      p.form = clamp(p.form + (won ? 0.35 : -0.2), 1, 10)
      // minutes make players. Ceiling-aware, so a limited lad does not become a
      // Test player by playing thirty A League games.
      if (p.ca < p.pa && rng() < 0.16 + coach * 0.035) p.ca = Math.min(p.pa, p.ca + 1)
      // and playing beats not playing: an academy man in the side is a happy one
      if (p.morale < 7.5) p.morale = clamp(p.morale + 0.12, 1, 10)
    }
  }
}

function applyAcadTable(l: AcadLeague, fx: AcadFixture) {
  const row = (id: string) => l.table.find(r => r.teamId === id)
  const h = row(fx.homeId)
  const a = row(fx.awayId)
  if (!h || !a) return
  // the same four points, try bonus and losing bonus the senior league runs on
  for (const [me, ms, ts, mt, tt] of [
    [h, fx.homeScore, fx.awayScore, fx.homeTries, fx.awayTries],
    [a, fx.awayScore, fx.homeScore, fx.awayTries, fx.homeTries],
  ] as [TableRow, number, number, number, number][]) {
    me.p++
    me.pf += ms
    me.pa += ts
    me.tf += mt
    me.ta += tt
    const b = (mt - tt >= 3 ? 1 : 0) + (ms < ts && ts - ms <= 7 ? 1 : 0)
    me.bp += b
    if (ms > ts) { me.w++; me.pts += 4 + b } else if (ms === ts) { me.d++; me.pts += 2 + b } else { me.l++; me.pts += b }
  }
}

export function acadStandings(l: AcadLeague): TableRow[] {
  return [...l.table].sort((a, b) =>
    b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.teamId.localeCompare(b.teamId))
}

const clubName = (state: GameState, id: string) => state.clubs[id]?.short ?? id

/** Play the week's A League card and report the user's result.
 *
 *  Called from processWeekAndAdvance AFTER the senior fixtures, so an academy man
 *  pulled up to the seniors this week has already played his senior game and is
 *  not double-counted into the A League XV by accident: academyXV reads p.acad,
 *  and a promoted man has had that flag cleared. */
export function playAcademyWeek(state: GameState, rng: Rng) {
  const l = ensureAcademyLeague(state)
  if (!l) return
  const card = l.fixtures.filter(f => f.week === state.week && !f.played)
  if (!card.length) return
  for (const fx of card) {
    playAcad(state, fx, rng)
    applyAcadTable(l, fx)
  }
  if (state.unemployed) return

  const mine = card.filter(f => f.homeId === state.userClubId || f.awayId === state.userClubId)
  if (!mine.length) return
  const coachName = state.staffPeople?.academyCoach?.name
  const pos = acadStandings(l).findIndex(r => r.teamId === state.userClubId) + 1
  const lines: string[] = []
  for (const fx of mine) {
    const homeMine = fx.homeId === state.userClubId
    const oppId = homeMine ? fx.awayId : fx.homeId
    const ms = homeMine ? fx.homeScore : fx.awayScore
    const ts = homeMine ? fx.awayScore : fx.homeScore
    const verdict = ms > ts ? 'Won' : ms === ts ? 'Drew' : 'Lost'
    lines.push(`${verdict} ${ms}-${ts} ${homeMine ? 'at home to' : 'away at'} ${clubName(state, oppId)} A.`)
    const names = (fx.scorers ?? []).map(id => state.players[id]?.name).filter(Boolean) as string[]
    if (names.length) {
      const tally = new Map<string, number>()
      for (const n of names) tally.set(n, (tally.get(n) ?? 0) + 1)
      lines.push(`Tries: ${[...tally].map(([n, c]) => (c > 1 ? `${n} (${c})` : n)).join(', ')}.`)
    }
  }
  const won = mine.some(f => (f.homeId === state.userClubId ? f.homeScore > f.awayScore : f.awayScore > f.homeScore))
  const ids = [...new Set(mine.flatMap(f => f.scorers ?? []))]
  // Eighteen of these land a season, so the sign-off rotates by ROUND rather than
  // repeating one line eighteen times. Gated on the round, never the match rng -
  // flavour must not be able to move the sim stream (the ES/EK lesson).
  const sign = won ? WON_LINES : LOST_LINES
  const tail = sign[mine[0].round % sign.length]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
    subject: `🎓 A League: ${mine.map(f => {
      const homeMine = f.homeId === state.userClubId
      return `${homeMine ? f.homeScore : f.awayScore}-${homeMine ? f.awayScore : f.homeScore} v ${clubName(state, homeMine ? f.awayId : f.homeId)}`
    }).join(', ')}`,
    body: [
      `${coachName ? `${coachName} has` : 'The academy coach has'} filed his A League report.`,
      ...lines,
      pos > 0 ? `That leaves the A side ${ordinal(pos)} in the ${l.name}.` : '',
      tail,
    ].filter(Boolean).join('\n'),
    playerIds: ids.slice(0, 6),
  })
}

// What the academy coach says at the bottom of his report. Six of each, picked by
// round, because the same closing line eighteen weeks running reads like a form
// letter - and a form letter is what stops a manager reading his own inbox.
const WON_LINES = [
  'Results at this level are not the point, but a winning habit at nineteen is worth having.',
  'He was more pleased with the last twenty minutes than the scoreline, which tells you plenty.',
  'A win, and more importantly nobody came off holding anything.',
  'The coach says the front row grew up a fortnight in eighty minutes.',
  'Two of them will train with the seniors this week off the back of that.',
  'He signed off with one line: "That is the standard now."',
]
const LOST_LINES = [
  'The scoreline matters less than the minutes. Every one of them went into a young man who needed them.',
  'A beating, and the coach is not remotely bothered. They learned more today than in a month of drills.',
  'He wants you to know which three kept going at 20 down, because those are the three who will make it.',
  'Chastening, and useful. The video session will be quiet and long.',
  'Nobody hid. That was his whole report, and it is the one thing he cares about.',
  'The coach reckons they were beaten by bigger men, and that bigger men are a matter of time.',
]

const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`

/** The champion, once the card is done. Called at rollover before the rebuild so
 *  the season's A League winner makes the news the way a senior title would. */
export function closeAcademySeason(state: GameState) {
  const l = state.academy
  if (!l || l.fixtures.some(f => !f.played)) return
  const order = acadStandings(l)
  const top = order[0]
  if (!top) return
  l.champion = top.teamId
  const mine = top.teamId === state.userClubId
  const pos = order.findIndex(r => r.teamId === state.userClubId) + 1
  if (state.unemployed) return
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
    subject: mine ? `🏆 Your academy win the ${l.name}` : `🎓 ${clubName(state, top.teamId)} take the ${l.name}`,
    body: mine
      ? `The A side finish top of the ${l.name}: ${top.w} wins from ${top.p}, ${top.pf} points scored. Nobody hangs a flag for it, and every coach in the building knows what it means - the pipeline is working, and the men who won it are the ones you will be picking in three years.`
      : `${state.clubs[top.teamId]?.name ?? top.teamId} win the ${l.name} with ${top.pts} points from ${top.p} games.${pos > 0 ? ` Your academy finished ${ordinal(pos)}.` : ''} Development tables are not league tables, but the clubs at the top of them tend to be the clubs producing players.`,
  })
}
