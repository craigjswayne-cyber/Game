/**
 * ---- THE BRITISH & IRISH ISLES XV: THE HARDEST JOB IN THE GAME ----
 *
 * Owner, 7 Sep: "the pinnacle of the game should be coaching the British and
 * Irish Lions but we cant call them that so maybe British & Irish Isles XV...
 * This is the hardest job to be offered and it is knly offer only, only if you
 * have reputation of 95+, are coachin internationally and won something,
 * assistant takes over of national team while you do this job."
 *
 * Four conditions, and they are the whole feature. Before this, ANY coach of
 * England, Ireland, Scotland or Wales took the tour automatically, in the same
 * breath as taking the national job - which made the pinnacle of a career a
 * side effect of a job you already had.
 *
 * WHY 95 IS THE RIGHT NUMBER AND NOT AN ARBITRARY ONE. mgrReputation is capped
 * at 95: `Math.min(95, ...)`. So "reputation of 95+" is not a high bar, it is
 * THE bar - the top of the scale, reachable only with a real record and several
 * trophies behind it. The owner picked the ceiling, and this is the only thing
 * in the game that asks for it.
 *
 * OFFER ONLY. There is no apply, no shortlist and no way to ask. The four
 * unions choose, and either the letter arrives or it does not. That is how the
 * real job works and it is the reason it reads as an honour rather than a
 * transfer.
 *
 * AND THE COUNTRY DOES NOT COACH ITSELF. A man cannot prepare a Test series
 * eleven thousand miles away and run his own national side in the same summer,
 * so his assistant takes the country for the duration - the same arrangement
 * the real tour has always used, and the reason accepting costs something.
 */
import type { GameState } from './model'
import { mgrReputation } from './model'
import { isLionsSeason, isWomensTourSeason } from './schedule'
import { genderOf, W } from './gender'
import type { Competition } from './model'
import { TOUR_WEEKS } from './calendar'
import { TOUR_ROLES, type TourRole } from './natcamp'
import { tIn } from './i18n'
import { NAT_SQUAD_FLOOR } from './nations'

/** The four unions the touring side draws from. */
const HOME_UNIONS = ['ENG', 'IRE', 'SCO', 'WAL'] as const

/** The reputation the unions want. It is the top of the scale, deliberately. */
const ISLES_REP = 95

/** The week the letter arrives - late enough to have been earned, early enough
 *  to be a decision rather than an ambush. */
const ISLES_OFFER_WEEK = 36

/**
 * Would the unions consider him at all? Every clause of the owner's sentence,
 * and nothing else.
 */
/** Is there a tour this summer in THIS world? The two games tour in different
 *  years - men 2029, 2033; women 2031, 2035 - so the question has to be asked
 *  of the world the save is in, not of the men's calendar. */
export function isTourSeason(state: GameState): boolean {
  return genderOf(state) === 'w' ? isWomensTourSeason(state.season) : isLionsSeason(state.season)
}

/** This world's Isles tour, whichever world it is. The men's is 'lions' and
 *  the women's 'w:lions'; code that read comps['lions'] alone never saw the
 *  women's tour, so a series won there was neither credited nor called one. */
export function isleTour(state: GameState): Competition | undefined {
  return state.comps[genderOf(state) === 'w' ? W + 'lions' : 'lions']
}

export function islesEligible(state: GameState): { ok: boolean; why: string } {
  if (!isTourSeason(state)) return { ok: false, why: 'isles.whyNoTour' }
  // NO CLUB IS NO BAR (1.9.16). `unemployed` means "no club", and a man who
  // coaches England and nothing else is exactly who the owner's sentence
  // describes. This clause used to turn him away, so the international start
  // could never reach the job it is sold as the road to.
  // "are coachin internationally" - and one of the four, since it is their team
  const nat = state.natTeam
  if (!nat || !(HOME_UNIONS as readonly string[]).includes(nat)) return { ok: false, why: 'isles.whyNotIntl' }
  // "won something"
  if ((state.mgr?.trophies?.length ?? 0) < 1) return { ok: false, why: 'isles.whyNoTrophy' }
  // "reputation of 95+"
  if (mgrReputation(state) < ISLES_REP) return { ok: false, why: 'isles.whyRep' }
  // ONLY AFTER A GOOD TOUR (owner, 21 Nov 2026: "Only if you did a good job
  // may you be potentially invited back 4 years later")
  const last = state.islesPast?.[state.islesPast.length - 1]
  if (last && !(last.won || last.decider)) return { ok: false, why: 'isles.whyNotBack' }
  return { ok: true, why: 'isles.whyYes' }
}

/** Is he actually taking the tour this summer? */
export function islesCoach(state: GameState): boolean {
  return isTourSeason(state) && state.isles?.season === state.season && state.isles.answer === 'yes'
}

/** The letter, once a season, and only when every condition is met. */
export function offerIsles(state: GameState): boolean {
  if (state.isles?.season === state.season) return false
  if (state.week !== ISLES_OFFER_WEEK) return false
  if (!islesEligible(state).ok) return false
  state.isles = { season: state.season, answer: 'open' }
  return true
}

/** An invitation left unanswered lapses a fortnight before the party leaves. */
export function lapseIsles(state: GameState): boolean {
  if (state.isles?.season !== state.season || state.isles.answer !== 'open') return false
  if (state.week !== TOUR_WEEKS[0] - 2) return false
  state.isles.answer = 'no'
  return true
}

export function answerIsles(state: GameState, yes: boolean): boolean {
  if (state.isles?.season !== state.season || state.isles.answer !== 'open') return false
  state.isles.answer = yes ? 'yes' : 'no'
  return true
}

// ---- THE TOUR OFFICE (1.9.16) ----
//
// Owner, 21 Nov 2026: "it should open empty. You should pick coaches from
// around the game - all players. Every announcement is a big thing. This is
// the pinnacle of the game - make features that feel like it is the only
// place you get this."
//
// Three things he does nowhere else, each announced once and each an
// occasion: the coaching team (three head coaches borrowed from the game's
// clubs), the tour party (named from an empty sheet, from every eligible
// player in the four unions wherever he plays), and the tour captain.

/** The head coaches he can ask: every club that has one, best known first.
 *  Not his own club's (that is him), and nobody twice. */
export function tourCoaches(state: GameState): { clubId: string; name: string; club: string }[] {
  return Object.values(state.clubs)
    .filter(c => !!c.coach && (state.unemployed || c.id !== state.userClubId))
    .sort((a, b) => b.rep - a.rep || (a.id < b.id ? -1 : 1))
    .slice(0, 40)
    .map(c => ({ clubId: c.id, name: c.coach!, club: c.short }))
}

/** Give a role to a club's head coach, or clear it with null. A coach holds
 *  one role; the team is fixed once announced. */
export function setTourCoach(state: GameState, role: TourRole, clubId: string | null): boolean {
  const i = state.isles
  if (!i || i.season !== state.season || i.answer !== 'yes' || i.staffOut) return false
  const st = (i.staff ??= {})
  if (clubId == null) { delete st[role]; return true }
  if (!state.clubs[clubId]?.coach) return false
  for (const r of TOUR_ROLES) if (st[r] === clubId) delete st[r]
  st[role] = clubId
  return true
}

const occasion = (state: GameState, hk: string, hv: Record<string, string | number>, sk: string, sv: Record<string, string | number>) => {
  const cel = { headline: tIn('en', hk, hv), sub: tIn('en', sk, sv), icon: 'trophy', hk, hv, sk, sv }
  if (state.celebration) state.celebrationNext = cel
  else state.celebration = cel
}
const tourName = (state: GameState) => isleTour(state)?.name ?? ''

/** Announce the coaching team: all three named, once. */
export function announceTourStaff(state: GameState): boolean {
  const i = state.isles
  const st = i?.staff
  if (!i || i.season !== state.season || i.answer !== 'yes' || i.staffOut || !st || !TOUR_ROLES.every(r => st[r] && state.clubs[st[r]!]?.coach)) return false
  i.staffOut = true
  const who = (r: TourRole) => state.clubs[st[r]!].coach!
  const club = (r: TourRole) => state.clubs[st[r]!].short
  const v = { manager: state.managerName, tour: tourName(state), a: who('fwd'), ca: club('fwd'), b: who('atk'), cb: club('atk'), c: who('def'), cc: club('def') }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', 'news.islesStaffSubj', v), body: tIn('en', 'news.islesStaff', v), k: 'news.islesStaff', v,
  })
  occasion(state, 'cel.islesStaff', {}, 'cel.islesStaffSub', { a: v.a, b: v.b, c: v.c })
  return true
}

/** How the party splits across the four unions. */
export function partyCount(state: GameState): Record<'ENG' | 'IRE' | 'SCO' | 'WAL', number> {
  const out = { ENG: 0, IRE: 0, SCO: 0, WAL: 0 }
  for (const id of state.natSquads['LIO'] ?? []) {
    const n = state.players[id]?.nat
    if (n === 'ENG' || n === 'IRE' || n === 'SCO' || n === 'WAL') out[n]++
  }
  return out
}

/** Can the party be announced? Named to the floor, and not yet announced. */
export function canAnnounceParty(state: GameState): boolean {
  const i = state.isles
  return !!i && i.season === state.season && i.answer === 'yes' && !i.partyOut && (state.natSquads['LIO'] ?? []).length >= NAT_SQUAD_FLOOR
}

/**
 * Announce the tour party. He picks who he likes: there is no quota (owner:
 * "remove the at least 3 from every union - make it a press story line. Its
 * always a talking point"). So the press counts the unions for him, and the
 * headline is whichever of the four has most to say about it.
 */
export function announceTourParty(state: GameState): boolean {
  if (!canAnnounceParty(state)) return false
  const i = state.isles!
  i.partyOut = true
  const ids = state.natSquads['LIO'] ?? []
  const c = partyCount(state)
  const total = ids.length
  const order = (['ENG', 'IRE', 'SCO', 'WAL'] as const).slice().sort((x, y) => c[x] - c[y])
  const least = order[0], most = order[3]
  const kind = c[least] === 0 ? 'None' : c[least] <= 2 ? 'Few' : c[most] >= total * 0.55 ? 'Many' : 'Even'
  const nat = kind === 'Many' ? most : least
  const v = { manager: state.managerName, tour: tourName(state), total, n: c[nat], nat: nat, nat_n: nat, eng: c.ENG, ire: c.IRE, sco: c.SCO, wal: c.WAL }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', `news.islesParty${kind}Subj`, v), body: tIn('en', `news.islesParty${kind}`, v), k: `news.islesParty${kind}`, v,
  })
  // the proudest phone call in rugby, made by him this time
  for (const id of ids) {
    const p = state.players[id]
    if (!p) continue
    p.lions = (p.lions ?? 0) + 1
    p.morale = Math.max(1, Math.min(10, p.morale + 0.5))
  }
  occasion(state, 'cel.islesParty', {}, 'cel.islesPartySub', { n: total, eng: c.ENG, ire: c.IRE, sco: c.SCO, wal: c.WAL })
  return true
}

/** Announce the tour captain: a man in the party, after the party is out. */
export function announceTourCaptain(state: GameState): boolean {
  const i = state.isles
  const capId = state.natPlan?.nat === 'LIO' ? state.natPlan.captain : null
  if (!i || i.season !== state.season || i.answer !== 'yes' || !i.partyOut || i.capOut || capId == null) return false
  const p = state.players[capId]
  if (!p || !(state.natSquads['LIO'] ?? []).includes(capId)) return false
  i.capOut = true
  p.morale = Math.max(1, Math.min(10, p.morale + 1))
  const v = { manager: state.managerName, tour: tourName(state), player: p.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', 'news.islesCapSubj', v), body: tIn('en', 'news.islesCap', v), k: 'news.islesCap', v,
  })
  occasion(state, 'cel.islesCap', { player: p.name.toUpperCase() }, 'cel.islesCapSub', { tour: v.tour })
  return true
}

/**
 * THE JOB ENDS WITH THE TOUR (owner, 21 Nov 2026: "You do the job, complete
 * it and leave"). Filed once, when the party is released: how it went, which
 * is what the four unions read in four years' time.
 */
export function closeTour(state: GameState): void {
  const i = state.isles
  const tour = isleTour(state)
  if (!i || i.season !== state.season || i.answer !== 'yes' || !tour) return
  if (state.islesPast?.some(t => t.season === state.season)) return
  const tests = state.fixtures.filter(f => f.compId === tour.id && !f.tourMatch && f.played).sort((a, b) => a.week - b.week || a.id - b.id)
  const lead = (f: (typeof tests)[number]) => Math.sign((f.homeId === 'LIO' ? f.homeScore - f.awayScore : f.awayScore - f.homeScore))
  const won = tour.champion === 'LIO'
  // level going into the last Test: the series was alive on the final day
  const decider = tests.length >= 3 && lead(tests[0]) + lead(tests[1]) === 0
  ;(state.islesPast ??= []).push({ season: state.season, won, decider })
  const v = { tour: tour.name, result_k: won || decider ? 'news.islesOverGood' : 'news.islesOverBad' }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', 'news.islesOverSubj', v), body: tIn('en', 'news.islesOver', v), k: 'news.islesOver', v,
  })
}
