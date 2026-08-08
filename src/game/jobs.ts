// The managerial merry-go-round: vacancies, applications, resignations.
// FM Mobile format - wait for the right job, or take what's available.

import type { GameState } from './model'
import { mgrReputation } from './model'
import { sortTable } from './schedule'
import { autoSelect } from './matchEngine'
import { clamp, mulberry32, type Rng } from './rng'
import { regenName } from './nations'
import { inheritStaff } from './staff'
import { newCoachPhilosophy, seedPhilosophies } from './philosophy'

/** Chance an application succeeds, from reputation vs club stature. */
export function jobChance(state: GameState, clubId: string): number {
  const club = state.clubs[clubId]
  if (!club) return 0
  const rep = mgrReputation(state)
  return clamp(0.92 - (club.rep - rep) / 32, 0.05, 0.95)
}

/** Keep a rolling set of 2-4 vacancies, biased towards struggling clubs. */
export function refreshVacancies(state: GameState, rng: Rng) {
  // expire stale vacancies (filled behind the scenes by a new name)
  state.vacancies = state.vacancies.filter(v => {
    const keep = state.week - v.week < 5 && state.clubs[v.clubId]
    if (!keep && state.clubs[v.clubId] && v.clubId !== state.userClubId) {
      state.clubs[v.clubId].coach = regenName(rng, state.clubs[v.clubId].country)
      // F23: the new man brings his own idea of how to play, which is why a club
      // you have had the measure of for three seasons can start kicking at you.
      newCoachPhilosophy(state, state.clubs[v.clubId])
    }
    return keep
  })

  if (state.vacancies.length >= 3 || rng() > (state.unemployed ? 0.55 : 0.22)) return

  // struggling sides sack managers: weight by league position from the bottom
  const candidates: { clubId: string; w: number }[] = []
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const order = sortTable(comp.table).map(r => r.teamId)
    order.forEach((clubId, i) => {
      if (clubId === state.userClubId && !state.unemployed) return
      if (state.vacancies.some(v => v.clubId === clubId)) return
      const fromBottom = order.length - i
      candidates.push({ clubId, w: fromBottom <= 4 ? 5 : fromBottom <= 8 ? 2 : 0.4 })
    })
  }
  if (!candidates.length) return
  const total = candidates.reduce((s, c) => s + c.w, 0)
  let r = rng() * total
  for (const c of candidates) {
    r -= c.w
    if (r <= 0) {
      state.vacancies.push({ clubId: c.clubId, week: state.week })
      const club = state.clubs[c.clubId]
      const exCoach = club.coach ?? 'their head coach'
      club.coach = undefined
      const pos = sortTable(state.comps[club.leagueId]?.table ?? []).findIndex(x => x.teamId === c.clubId) + 1
      const ord = pos <= 0 ? 'poor' : `${pos}${pos % 10 === 1 && pos !== 11 ? 'st' : pos % 10 === 2 && pos !== 12 ? 'nd' : pos % 10 === 3 && pos !== 13 ? 'rd' : 'th'}-placed`
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `${club.short} part company with ${exCoach}`,
        body: `${club.name} are searching for a new Director of Rugby after a ${ord} run of form. The position is open.`,
      })
      break
    }
  }

  // headhunters approach a good unemployed manager directly
  if (state.unemployed && state.vacancies.length && rng() < 0.35) {
    const v = state.vacancies[Math.floor(rng() * state.vacancies.length)]
    const club = state.clubs[v.clubId]
    if (club && mgrReputation(state) >= club.rep - 12) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: `${club.short} want to talk`,
        body: `Your phone rings: ${club.name} are keen on you for their vacant post. Apply from the Job Centre - the door is open.`,
      })
    }
  }

  // the tap on the shoulder: a bigger club with an empty dugout courts a
  // manager who is doing well WHERE HE IS - the oldest dilemma in the game
  if (!state.unemployed && state.week >= 4 && state.week <= 42 && rng() < 0.35) {
    const abs = state.season * 100 + state.week
    if (abs - (state.courtedAt ?? -999) >= 12) {
      const mine = state.clubs[state.userClubId]
      const suitor = state.vacancies
        .map(v => state.clubs[v.clubId])
        .filter(c => c && c.id !== mine.id && c.rep >= mine.rep + 5 &&
          mgrReputation(state) >= c.rep - 10)
        .sort((a, b) => b.rep - a.rep)[0]
      if (suitor && mine.boardConfidence >= 55) {
        state.courtedAt = abs
        state.courtedBy = suitor.id
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
          subject: `🤝 ${suitor.short} are watching you`,
          body: `The back pages have put your name at the top of ${suitor.name}'s shortlist for their empty dugout, and for once the back pages are right - their people have made discreet contact. A bigger club, a bigger budget, somebody else's project. Apply from the Job Centre if your head is turned; say nothing and the story dies by Friday. Your chairman has read the papers too, and he is watching how long you take to deny it.`,
        })
      }
    }
  }
}

/** Apply for a vacancy. Returns the outcome message. */
export function applyForJob(state: GameState, clubId: string): string {
  const v = state.vacancies.find(x => x.clubId === clubId)
  const club = state.clubs[clubId]
  if (!v || !club) return 'That position has been filled.'
  if (v.applied) return 'They have your application. Be patient.'
  v.applied = true
  const rng = mulberry32(state.seed ^ (state.week * 31 + club.rep))
  if (rng() < jobChance(state, clubId)) {
    // hired!
    const oldClubId = state.userClubId
    // loan-ins belong to the OLD project - send them home
    for (const p of Object.values(state.players)) {
      if (p.loanFrom && p.clubId === oldClubId && state.clubs[p.loanFrom]) {
        const oldClub = state.clubs[oldClubId]
        oldClub.players = oldClub.players.filter(id => id !== p.id)
        oldClub.tactic.lineup = oldClub.tactic.lineup.map(id => (id === p.id ? null : id))
        state.clubs[p.loanFrom].players.push(p.id)
        p.clubId = p.loanFrom
        p.loanFrom = null
      }
    }
    if (!state.unemployed && oldClubId !== clubId) {
      // walking out - old club becomes vacant
      state.vacancies.push({ clubId: oldClubId, week: state.week })
    }
    state.userClubId = clubId
    state.unemployed = false
    club.coach = undefined
    // F23: the previous coach's standing instruction is not yours, so it comes
    // off the club the moment you walk in and the dials on your tactics screen
    // are only ever what you set them to.
    //
    // The seed call is for the club you have LEFT (or were sacked by, which is
    // where userClubId sits while you are out of work). It has been carrying
    // your dials, and nothing else would ever take them off it: refreshVacancies
    // deliberately does not appoint over the top of userClubId.
    club.philosophy = undefined
    seedPhilosophies(state)
    state.vacancies = state.vacancies.filter(x => x.clubId !== clubId)
    club.boardConfidence = 66
    state.devFocus = []
    state.intakeClass = null // the class previewed at the old club stays there
    state.newOwnerUntil = null // the old club's owner is not your problem now
    state.derbyBook = {} // new town, new rivals, blank ledger
    state.vsBook = {} // and a blank book against everyone else too
    state.gateRecord = null // a new ground sets its own bar
    state.tryOfSeason = null // the old club keeps its own best try
    state.facilityBuild = null // the old club's builders finish without you
    state.facilityAskCooldown = 0 // a new board hears you out fresh
    // a new club, a new backroom: the department here is what it is
    state.staffSalt = (state.staffSalt ?? 0) + 1
    inheritStaff(state)
    state.expandedSeason = undefined // a new ground, a new planning application
    state.decisions = [] // a fresh ledger at a new club
    state.commission = null // the old club's scout finishes his brief for them
    state.scoutFinds = null
    state.tenureStart = state.season // the clock on your era starts today
    for (const id of club.players) {
      const p = state.players[id]
      if (p) p.sc = 100
    }
    club.tactic.lineup = autoSelect(state, club.players.map(id => state.players[id]).filter(Boolean))
    // 'I am going nowhere', he said. The quote travels better than the van
    const brokeVow = (state.vowedAt ?? 0) > 0 &&
      state.season * 100 + state.week - (state.vowedAt ?? 0) <= 10 && oldClubId !== clubId
    if (brokeVow) {
      club.boardConfidence = clamp(club.boardConfidence - 8, 0, 100)
      state.vowedAt = 0
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
        subject: `🗞 'I am going nowhere' - a quote that aged badly`,
        body: `Every paper runs the same clip: ${state.managerName}, weeks ago, hand on heart, going nowhere. The move is done and nobody can undo it, but your new board noted how cheaply the last promise was sold, and the away end has a new song ready for your return.`,
      })
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `Appointed: ${state.managerName} takes over at ${club.name}`,
      body: `A new chapter. The board expects steady progress, the dressing room is watching, and the ${club.stadium} faithful will judge you soon enough. Your transfer budget is £${(club.budget / 1e6).toFixed(1)}m.`,
    })
    return `You're in. Welcome to ${club.name}.`
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${club.short} go in a different direction`,
    body: `${club.name} thank you for your interest but have decided to pursue other candidates.`,
  })
  return `${club.short} passed. Their loss - probably.`
}

/** Walk away from the current job. */
/** The era in one line: years served, record, silverware, legend status.
 *  Used by both exits - the resignation and the sack. */
export function eraSummary(state: GameState): string {
  const club = state.clubs[state.userClubId]
  if (!club) return ''
  const tenure = state.season - (state.tenureStart ?? state.season) + 1
  const era = (state.annals ?? []).filter(a => a.clubName === club.name).slice(-tenure)
  let w = era.reduce((s, a) => s + a.overall.w, 0)
  let l = era.reduce((s, a) => s + a.overall.l, 0)
  let cups = era.reduce((s, a) => s + a.trophies.length, 0)
  // the current part-season is part of the story too
  for (const f of state.fixtures) {
    if (!f.played || (f.homeId !== club.id && f.awayId !== club.id)) continue
    const us = f.homeId === club.id ? f.homeScore : f.awayScore
    const them = f.homeId === club.id ? f.awayScore : f.homeScore
    if (us > them) w++
    else if (us < them) l++
  }
  const legend = (state.legendOf ?? []).includes(club.id)
  return `The era in numbers: ${tenure} ${tenure === 1 ? 'season' : 'seasons'}, ${w} wins, ${l} defeats, ${cups} ${cups === 1 ? 'trophy' : 'trophies'}.${legend ? ' The legend status stays - that was voted, not loaned.' : ''}`
}

export function resignJob(state: GameState) {
  const club = state.clubs[state.userClubId]
  state.unemployed = true
  state.vacancies.push({ clubId: club.id, week: state.week })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `${state.managerName} resigns at ${club.name}`,
    body: `You clear your desk on your own terms. ${eraSummary(state)} The rumour mill starts turning immediately - where next?`,
  })
}
