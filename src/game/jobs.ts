// The managerial merry-go-round: vacancies, applications, resignations.
// FM Mobile format - wait for the right job, or take what's available.

import type { GameState } from './model'
import { fmtMoney, mgrReputation, poss } from './model'
import { sortTable } from './schedule'
import { autoSelect } from './matchEngine'
import { clamp, mulberry32, type Rng } from './rng'
import { nationByCode, regenName } from './nations'
import { inheritStaff } from './staff'
import { newCoachPhilosophy, seedPhilosophies } from './philosophy'
import { t, tIn } from './i18n'

/** Chance an application succeeds, from reputation vs club stature.
 *
 *  THE SECOND CHANCE. Reputation alone made the market a snob: a manager who
 *  resigned early carried a reputation near the floor, so even a modest second
 *  division board rolled him at twenty percent and the Job Centre read Long
 *  shot on every card (user: "ive resigned from a job and trying to get a job
 *  but no-one is interested - we need to make it so a lower level team will
 *  give a second chance"). An out-of-work manager is also a bargain, and a
 *  club with little standing is buying experience, not a name. So while
 *  unemployed, matches managed substitute for reputation and the smaller the
 *  club the more they substitute, with a floor so even a rookie gets a fair
 *  hearing from a modest board. Big clubs are unmoved: the floor and the
 *  bonus both scale to nothing as club stature rises, so a giant still says
 *  no politely. */
export function jobChance(state: GameState, clubId: string): number {
  const club = state.clubs[clubId]
  if (!club) return 0
  const rep = mgrReputation(state)
  // THE SEAT YOU ARE SITTING IN IS THE LOUDEST LINE ON THE CV (owner, v1.1.12:
  // "if you are head coach of a national team and of a top team, other jobs a
  // lot below them should be 100% a chance not a long shot").
  //
  // jobChance read the manager's REPUTATION against the club's standing and
  // nothing else, and reputation is a slow, earned number: a coach appointed at
  // Northampton (rep 86) on day one still carries rep 22, so a rep 38
  // second-division board rolled him at 42% and the card said Outside shot. No
  // board on earth interviews the Northampton head coach for Sedgley Park and
  // wonders whether he is good enough - they wonder whether he is serious.
  //
  // So the post held SUBSTITUTES for reputation rather than adding to it - the
  // bigger of the club on your desk and the nation you coach, discounted by
  // twenty because holding a seat is not the same as having earned it. A Test
  // job is worth at least the standing of a very good club whichever nation it
  // is, which is what makes it the pinnacle rather than a badge. The
  // substitution only ever helps, so nothing below gets worse, and against a
  // club as big as your own it changes almost nothing: a giant still says no.
  const natRep = state.natTeam ? Math.max(80, nationByCode(state.natTeam)?.rep ?? 80) : 0
  const clubRep = state.unemployed ? 0 : (state.clubs[state.userClubId]?.rep ?? 0)
  const cv = Math.max(rep, Math.max(natRep, clubRep) - 20)
  let c = 0.92 - (club.rep - cv) / 32
  // FRESH SILVERWARE IS ITS OWN CV (user: "Ive just won the double with
  // Northampton - I shouldn't be a long shot for jobs like la rochelle").
  // Reputation already counts trophies, but slowly and forever; a board
  // filling a dugout TODAY cares most about what you lifted this season and
  // last. Each recent pot is worth thirteen points of chance, capped at two
  // pots - a double-winner walks into most interviews as the favourite.
  const fresh = state.mgr.trophies.filter(t => t.season >= state.season - 1).length
  c += Math.min(0.26, fresh * 0.13)
  if (state.unemployed) {
    // rep 70+ boards unmoved; rep 30 boards fully receptive
    const modesty = clamp((70 - club.rep) / 40, 0, 1)
    // two seasons in a dugout is proven enough for the lower leagues,
    // whatever the win rate was
    const experience = Math.min(1, state.mgr.m / 80)
    c += 0.35 * experience * modesty
    // the floor scales entirely with modesty: a rep 30 board takes the flyer
    // more often than not, a rep 50 second division board is a real chance
    // rather than a Long shot, and at rep 70+ the floor is zero so the giants
    // keep their cold shoulder (the probe caught a flat +0.18 leaking to
    // Leinster before the scaling)
    c = Math.max(c, modesty * 0.62)
  }
  return clamp(c, 0.05, 0.95)
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
      // A coach's NAME is data; "their head coach" is a sentence. The two
      // cannot share a variable, or a French reader gets "Setagaya se sépare
      // de their head coach" - which is exactly what they got.
      const exCoach = club.coach ?? tIn('en', 'news.theirHeadCoach')
      const coachK = club.coach ? 'news.coachNamed' : 'news.theirHeadCoach'
      club.coach = undefined
      const pos = sortTable(state.comps[club.leagueId]?.table ?? []).findIndex(x => x.teamId === c.clubId) + 1
      const ord = pos <= 0 ? 'poor' : `${pos}${pos % 10 === 1 && pos !== 11 ? 'st' : pos % 10 === 2 && pos !== 12 ? 'nd' : pos % 10 === 3 && pos !== 13 ? 'rd' : 'th'}-placed`
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `${club.short} part company with ${exCoach}`,
        body: `${club.name} are searching for a new Director of Rugby after a ${ord} run of form. The position is open.`,
        k: pos <= 0 ? 'news.coachOutPoor' : 'news.coachOut',
        v: { short: club.short, club: club.name, coach: exCoach, coach_k: coachK, pos_o: pos },
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
        k: 'news.jobCall', v: { short: club.short, club: club.name },
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
          body: `The back pages have put your name at the top of ${poss(suitor.name)} shortlist for their empty dugout, and for once the back pages are right - their people have made discreet contact. A bigger club, a bigger budget, somebody else's project. Apply from the Job Centre if your head is turned; say nothing and the story dies by Friday. Your chairman has read the papers too, and he is watching how long you take to deny it.`,
          k: 'news.courted', v: { short: suitor.short, poss: poss(suitor.name) },
        })
      }
    }
  }
}

/** Apply for a vacancy. Returns the outcome message. */
export function applyForJob(state: GameState, clubId: string): string {
  const v = state.vacancies.find(x => x.clubId === clubId)
  const club = state.clubs[clubId]
  // the four sentences this function RETURNS land in a card on the Job Centre and
  // are never filed anywhere, so they follow the reader; the news items it pushes
  // are a career's paperwork and stay as written (docs/i18n.md)
  if (!v || !club) return t('world.jbFilled')
  if (v.applied) return t('world.jbPatient')
  v.applied = true
  const rng = mulberry32(state.seed ^ (state.week * 31 + club.rep))
  if (rng() < jobChance(state, clubId)) {
    // hired!
    const oldClubId = state.userClubId
    // any bid still waiting on the old desk is not this manager's to answer
    state.offers = []
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
    state.boardAsks = undefined // and holds none of the old board's grudges
    state.fundsAskedSeason = undefined // the funds ask resets with the desk
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
        k: 'news.brokeVow', v: { manager: state.managerName },
      })
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `Appointed: ${state.managerName} takes over at ${club.name}`,
      body: `A new chapter. The board expects steady progress, the dressing room is watching, and the ${club.stadium} faithful will judge you soon enough. Your transfer budget is ${fmtMoney(club.budget)}.`,
      k: 'news.appointed',
      v: { manager: state.managerName, club: club.name, stadium: club.stadium, budget: fmtMoney(club.budget) },
    })
    return t('world.jbHired', { club: club.name })
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${club.short} go in a different direction`,
    body: `${club.name} thank you for your interest but have decided to pursue other candidates.`,
    k: 'news.jobRejected', v: { short: club.short, club: club.name },
  })
  return t('world.jbPassed', { club: club.short })
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
  return t('reply.eraInNumbers', {
    n: tenure, seasons_k: tenure === 1 ? 'count.seasonOne' : 'count.seasonMany',
    w, wins_k: w === 1 ? 'count.winOne' : 'count.winMany',
    l, defeats_k: l === 1 ? 'count.defeatOne' : 'count.defeatMany',
    cups, cups_k: cups === 1 ? 'count.trophyOne' : 'count.trophyMany',
    legend_k: legend ? 'reply.legendStays' : 'common.nothing',
  })
}

export function resignJob(state: GameState) {
  const club = state.clubs[state.userClubId]
  state.unemployed = true
  // bids for the old club's players die with the job - they were addressed to
  // the manager of that club, and answering one from a new desk sold Alex
  // Mitchell out of Northampton while the user managed somewhere else
  // (round 25, from a screenshot)
  state.offers = []
  state.vacancies.push({ clubId: club.id, week: state.week })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `${state.managerName} resigns at ${club.name}`,
    body: `You clear your desk on your own terms. ${eraSummary(state)} The rumour mill starts turning immediately - where next?`,
    k: 'news.resigned', v: { manager: state.managerName, club: club.name, era: eraSummary(state) },
  })
}

/** The board's side of the same door. One template for every dismissal,
 *  whatever earned it - the collapsed-confidence sack in season.ts and the
 *  pushed-once-too-often sack of the board-request escalation both come
 *  through here, so the mechanics (offers die with the job, the vacancy
 *  opens, the letter lands) can never drift apart between reasons. `k` names
 *  the letter; `extraV` adds anything its text needs beyond the standard
 *  club/manager/era. */
export function sackManager(state: GameState, k: string, extraV: Record<string, string | number> = {}) {
  const club = state.clubs[state.userClubId]
  state.unemployed = true
  // bids for the old club's players go with the job (see resignJob)
  state.offers = []
  state.vacancies.push({ clubId: club.id, week: state.week })
  const v = { club: club.name, manager: state.managerName, era: eraSummary(state), ...extraV }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v),
    k, v,
  })
  // AND SAY IT OUT LOUD (v1.2.1). The letter above is the record; this is the
  // moment. The app draws a breaking-news card over whatever screen the
  // manager is on and holds him there until he has given the cameras a line -
  // see GameState.sacked. Every dismissal in the game comes through this
  // function, so there is no route out of a job that can forget to announce
  // itself.
  state.sacked = { club: club.name, k, v, said: null }
}
