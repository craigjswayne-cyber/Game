import type { Competition, Fixture, GameState, Player, Pos, TableRow } from './model'
import { addGrudge, fixtureDayOff, fmtMoney, grudgeBetween, mgrReputation, SEASON_WEEKS, seasonLabel } from './model'
import { simMatch, autoSelect, teamShort, teamUnits, rosterOf } from './matchEngine'
import { emptyRow, sortTable, AUTUMN_WEEKS, PNC_WEEKS, SIX_NATIONS_WEEKS, TOUR_WEEKS, TRC_WEEKS, WC_KO_WEEKS } from './schedule'
import { aiPreContractPoach, aiRenewals, aiTransfers, askingPrice } from './ai'
import { generatePress } from './media'
import { generateGossip } from './gossip'
import { buildPlayer, playerValue, playerWage } from './attributes'
import { scoutOpponent, weeklyScouting } from './scout'
import { updateAgency } from './agency'
import { OBJECTIVE_DEFS } from './objectives'
import { derbyName, isDerby } from './rivalries'
import { nationByCode, regenName } from './nations'
import { STAFF_INFO } from './model'
import { clamp, mulberry32, shuffled, type Rng } from './rng'
import { rebuildSeason, rollIntakeClass } from './rollover'
import { loanTargets } from './loans'
import { refreshVacancies } from './jobs'

export function weekRng(state: GameState): Rng {
  return mulberry32(state.seed ^ (state.season * 131 + state.week * 7919))
}

// ------------------------------------------------------------------
// Tables & knockouts
// ------------------------------------------------------------------

function applyToTable(comp: Competition, fx: Fixture) {
  if (fx.stage) return // knockout games don't affect tables
  const h = comp.table.find(r => r.teamId === fx.homeId)
  const a = comp.table.find(r => r.teamId === fx.awayId)
  if (!h || !a) return
  h.p++; a.p++
  h.pf += fx.homeScore; h.pa += fx.awayScore
  a.pf += fx.awayScore; a.pa += fx.homeScore
  h.tf += fx.homeTries; h.ta += fx.awayTries
  a.tf += fx.awayTries; a.ta += fx.homeTries
  if (fx.homeScore > fx.awayScore) { h.w++; a.l++; h.pts += 4 }
  else if (fx.homeScore < fx.awayScore) { a.w++; h.l++; a.pts += 4 }
  else { h.d++; a.d++; h.pts += 2; a.pts += 2 }
  // bonus points
  if (fx.homeTries >= 4) { h.bp++; h.pts++ }
  if (fx.awayTries >= 4) { a.bp++; a.pts++ }
  if (fx.homeScore < fx.awayScore && fx.awayScore - fx.homeScore <= 7) { h.bp++; h.pts++ }
  if (fx.awayScore < fx.homeScore && fx.homeScore - fx.awayScore <= 7) { a.bp++; a.pts++ }
}

/** In knockout rugby there are no draws - nudge a golden-point winner. */
export function resolveKnockoutDraw(state: GameState, fx: Fixture, rng: Rng) {
  if (fx.homeScore !== fx.awayScore) return
  const hs = teamUnits(state, autoLineup(state, fx.homeId)).overall
  const as = teamUnits(state, autoLineup(state, fx.awayId)).overall
  const pHome = hs / (hs + as) + 0.05
  if (rng() < pHome) fx.homeScore += 3
  else fx.awayScore += 3
}

function autoLineup(state: GameState, teamId: string) {
  const pool = rosterOf(state, teamId).map(id => state.players[id]).filter(p => p && !p.injury && p.bans === 0)
  return autoSelect(state, pool)
}

function poolStandings(state: GameState, comp: Competition): string[][] {
  const pools = comp.pools ?? [comp.teamIds]
  return pools.map(pool => {
    const rows: TableRow[] = pool.map(emptyRow)
    for (const fx of state.fixtures) {
      if (fx.compId !== comp.id || !fx.played || fx.stage) continue
      if (!pool.includes(fx.homeId)) continue
      const mini: Competition = { ...comp, table: rows, pools: undefined }
      applyToTable(mini, fx)
    }
    return sortTable(rows).map(r => r.teamId)
  })
}

/** Create knockout fixtures for a competition when the calendar reaches them. */
function maybeCreateKnockouts(state: GameState, comp: Competition, rng: Rng) {
  if (!comp.playoffTeams) return
  const cupLike = comp.type === 'cup' || !!comp.pools
  const koFx = (stage: string) => state.fixtures.filter(f => f.compId === comp.id && f.stage === stage)
  const mkFx = (stage: string, week: number, home: string, away: string) => {
    state.fixtures.push({
      id: state.nextId++, compId: comp.id, round: 99, week, homeId: home, awayId: away,
      played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage,
    })
    // the draw is news when you're in the hat
    const mine = [state.userClubId, state.natTeam].filter(Boolean)
    if (mine.includes(home) || mine.includes(away)) {
      const us = mine.includes(home) ? home : away
      const opp = us === home ? away : home
      const stg = { QF: 'quarter-final', SF: 'semi-final', F: 'FINAL', BAR: 'playoff barrage', R16: 'last sixteen' }[stage] ?? stage
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🎟 The ${comp.short} ${stg} draw: ${teamShort(state, opp)}`,
        body: us === home
          ? `The balls have been drawn. You host ${teamShort(state, opp)} in the ${comp.name} ${stg} - win, and the road continues. ${stg === 'FINAL' ? 'One match. Everything on it.' : 'Get the place rocking.'}`
          : `The balls have been drawn. You travel to ${teamShort(state, opp)} for the ${comp.name} ${stg}. ${stg === 'FINAL' ? 'One match. Everything on it.' : 'Quiet the crowd early and anything is possible.'}`,
      })
    }
  }
  const regularDone = state.fixtures
    .filter(f => f.compId === comp.id && !f.stage)
    .every(f => f.played)
  if (!regularDone) return

  // Knockout ties are created as soon as the previous round is complete -
  // never lazily on their own match week, or the user's tie would be
  // simmed away before the MatchDay screen ever saw it.
  const ko = comp.koWeeks
  if (cupLike) {
    // pool competitions (Champions Cup, World Cup): QF ko[0], SF ko[1], F ko[2]
    if (koFx('QF').length === 0) {
      const pools = poolStandings(state, comp)
      const winners = pools.map(p => p[0])
      const runners = pools.map(p => p[1])
      const seeds = [...winners, ...shuffled(rng, runners)]
      mkFx('QF', ko[0], seeds[0], seeds[7])
      mkFx('QF', ko[0], seeds[3], seeds[4])
      mkFx('QF', ko[0], seeds[1], seeds[6])
      mkFx('QF', ko[0], seeds[2], seeds[5])
    }
    const qf = koFx('QF')
    if (koFx('SF').length === 0 && qf.length === 4 && qf.every(f => f.played)) {
      const w = qf.map(winnerOf)
      mkFx('SF', ko[1], w[0], w[1])
      mkFx('SF', ko[1], w[2], w[3])
    }
    const sf = koFx('SF')
    if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
      mkFx('F', ko[2], winnerOf(sf[0]), winnerOf(sf[1]))
    }
  } else {
    // league playoffs
    const order = sortTable(comp.table).map(r => r.teamId)
    const n = comp.playoffTeams
    if (n === 4) {
      const [sfW, fW] = ko
      if (koFx('SF').length === 0) {
        mkFx('SF', sfW, order[0], order[3])
        mkFx('SF', sfW, order[1], order[2])
      }
      const sf = koFx('SF')
      if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
        mkFx('F', fW, winnerOf(sf[0]), winnerOf(sf[1]))
      }
    } else {
      const [r1W, sfW, fW] = ko
      const r1Stage = n === 6 ? 'BAR' : 'QF'
      if (koFx(r1Stage).length === 0) {
        if (n === 6) {
          mkFx('BAR', r1W, order[2], order[5])
          mkFx('BAR', r1W, order[3], order[4])
        } else {
          mkFx('QF', r1W, order[0], order[7])
          mkFx('QF', r1W, order[3], order[4])
          mkFx('QF', r1W, order[1], order[6])
          mkFx('QF', r1W, order[2], order[5])
        }
      }
      const r1 = koFx(r1Stage)
      if (koFx('SF').length === 0 && r1.length && r1.every(f => f.played)) {
        const w = r1.map(winnerOf)
        if (n === 6) {
          mkFx('SF', sfW, order[0], w[1])
          mkFx('SF', sfW, order[1], w[0])
        } else {
          mkFx('SF', sfW, w[0], w[1])
          mkFx('SF', sfW, w[2], w[3])
        }
      }
      const sf = koFx('SF')
      if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
        mkFx('F', fW, winnerOf(sf[0]), winnerOf(sf[1]))
      }
    }
  }
}

const winnerOf = (fx: Fixture) => (fx.homeScore >= fx.awayScore ? fx.homeId : fx.awayId)

// ------------------------------------------------------------------
// Internationals
// ------------------------------------------------------------------

interface Window { start: number; end: number; nations: string[]; size: number }

/** Call-up windows for the competitions that actually exist this season. */
function activeWindows(state: GameState): Window[] {
  const out: Window[] = []
  if (state.comps['wc']) {
    out.push({ start: 1, end: WC_KO_WEEKS[WC_KO_WEEKS.length - 1], nations: state.comps['wc'].teamIds, size: 28 })
  }
  if (state.comps['trc']) {
    out.push({ start: TRC_WEEKS[0] - 1, end: TRC_WEEKS[TRC_WEEKS.length - 1], nations: ['NZL', 'RSA', 'AUS', 'ARG'], size: 26 })
  }
  if (state.comps['pnc']) {
    out.push({ start: PNC_WEEKS[0] - 1, end: PNC_WEEKS[PNC_WEEKS.length - 1], nations: state.comps['pnc'].teamIds, size: 26 })
  }
  if (state.comps['aut']) {
    out.push({ start: AUTUMN_WEEKS[0] - 1, end: AUTUMN_WEEKS[AUTUMN_WEEKS.length - 1], nations: ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA', 'NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'JPN'], size: 26 })
  }
  if (state.comps['sn']) {
    out.push({ start: SIX_NATIONS_WEEKS[0] - 1, end: SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1], nations: ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA'], size: 26 })
  }
  if (state.comps['tour']) {
    out.push({ start: TOUR_WEEKS[0] - 1, end: TOUR_WEEKS[TOUR_WEEKS.length - 1], nations: state.comps['tour'].teamIds, size: 26 })
  }
  if (state.comps['lions']) {
    out.push({ start: TOUR_WEEKS[0] - 1, end: TOUR_WEEKS[TOUR_WEEKS.length - 1], nations: state.comps['lions'].teamIds, size: 30 })
  }
  return out
}

function manageInternationals(state: GameState, rng: Rng) {
  for (const w of activeWindows(state)) {
    if (state.week === w.start) {
      // call-ups
      const userCalls: Player[] = []
      for (const nat of w.nations) {
        const HOME4 = ['ENG', 'IRE', 'SCO', 'WAL']
        const pool = Object.values(state.players)
          .filter(p => (nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat) &&
            p.clubId && !p.injury && !p.onLoan && p.ca >= 68)
          .sort((a, b) => b.ca - a.ca)
          .slice(0, w.size)
        // emerging nations field home-based internationals our club world
        // doesn't carry - generate them so no squad ever turns up empty
        if (nat !== 'LIO' && pool.length < Math.max(23, Math.floor(w.size * 0.8))) {
          const natRep = nationByCode(nat)?.rep ?? 55
          const POS_CYCLE = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB'] as const
          let i = 0
          while (pool.length < w.size && i < 40) {
            const q = clamp(Math.round(natRep - 26 + rng() * 12), 40, 68)
            const hp = buildPlayer(
              {
                name: regenName(rng, nat), pos: POS_CYCLE[i % POS_CYCLE.length],
                age: 22 + Math.floor(rng() * 9), nat, q,
                gk: (POS_CYCLE[i % POS_CYCLE.length] === 'FH') && rng() < 0.5,
              },
              null, state.seed + state.week * 131 + i * 17, state.season)
            state.players[hp.id] = hp
            pool.push(hp)
            i++
          }
        }
        state.natSquads[nat] = pool.map(p => p.id)
        for (const p of pool) {
          p.natSquad = true
          p.morale = clamp(p.morale + 0.5, 1, 10) // the proudest phone call in rugby
          if (p.clubId === state.userClubId) userCalls.push(p)
        }
        // the national coach announces HIS squad - a proper occasion
        if (nat === state.natTeam || (nat === 'LIO' && state.natTeam != null && HOME4.includes(state.natTeam))) {
          const FWD = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8']
          const fwd = pool.filter(p => FWD.includes(p.pos))
          const bks = pool.filter(p => !FWD.includes(p.pos))
          const line = (p: Player) => `${p.name}${(p.caps ?? 0) > 0 ? ` (${p.caps})` : ' (uncapped)'}${p.clubId ? ` - ${state.clubs[p.clubId]?.short ?? ''}` : ''}`
          const newCaps = pool.filter(p => (p.caps ?? 0) === 0).length
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `📋 Your ${nationByCode(nat)?.name ?? nat} squad is announced`,
            body: [
              `The federation has published your ${pool.length}-man squad for the window. ${newCaps ? `${newCaps} uncapped name${newCaps > 1 ? 's' : ''} in the room.` : 'A fully capped group.'}`,
              '',
              `FORWARDS: ${fwd.map(line).join('; ')}`,
              '',
              `BACKS: ${bks.map(line).join('; ')}`,
              '',
              'Pick your Test XV from the International Rugby screen before each match.',
            ].join('\n'),
          })
        }
      }
      if (userCalls.length) {
        // several windows can open the same week - one combined item, not two
        const names = userCalls.map(p => `${p.name} (${p.nat})`).join(', ')
        const existing = state.news.find(n =>
          n.week === state.week && n.season === state.season && n.subject === 'International call-ups')
        if (existing) {
          existing.body += ` Also called up: ${names}.`
        } else {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `International call-ups`,
            body: `The following players have been called up and will be unavailable during the international window: ${names}.`,
          })
        }
      }
    }
    if (state.week === w.end + 1) {
      if (state.natLineup && w.nations.includes(state.natLineup.team)) state.natLineup = null
      const returnedMine: string[] = []
      for (const nat of w.nations) {
        for (const id of state.natSquads[nat] ?? []) {
          const p = state.players[id]
          if (p) {
            p.natSquad = false
            // Test rugby empties the tank - returning internationals need
            // managing, not flogging
            p.cond = clamp(p.cond - 10, 20, 100)
            if (p.clubId === state.userClubId) returnedMine.push(p.name)
          }
        }
        delete state.natSquads[nat]
      }
      if (returnedMine.length) {
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: `Internationals return - leggy`,
          body: `Back in club colours: ${returnedMine.join(', ')}. The medical staff's advice is blunt: Test rugby empties the tank, and none of them are at full freshness this week. Rotate or risk it - your call.`,
        })
      }
    }
  }
}

// ------------------------------------------------------------------
// Training & recovery
// ------------------------------------------------------------------

function weeklyTraining(state: GameState, rng: Rng) {
  const focusMap: Record<string, (keyof Player['a'])[]> = {
    balanced: [], scrum: ['scr', 'str'], lineout: ['lin'], attack: ['han', 'pas', 'vis'],
    defence: ['tac', 'pos'], fitness: ['sta'], kicking: ['kic', 'goa'],
  }
  // which specialist coach amplifies which training focus
  const coachFor: Record<string, keyof GameState['staff'] | null> = {
    balanced: null, scrum: 'scrumCoach', lineout: 'scrumCoach', attack: 'attack',
    defence: 'defence', fitness: 'assistant', kicking: 'kicking',
  }
  // a winning run carries a dressing room; a losing one drags it under
  {
    const uid = state.userClubId
    const last3 = state.fixtures
      .filter(f => f.played && (f.homeId === uid || f.awayId === uid))
      .slice(-3)
      .map(f => {
        const us = f.homeId === uid ? f.homeScore : f.awayScore
        const them = f.homeId === uid ? f.awayScore : f.homeScore
        return us > them ? 'W' : us < them ? 'L' : 'D'
      })
    if (last3.length === 3 && (last3.every(r => r === 'W') || last3.every(r => r === 'L'))) {
      const up = last3[0] === 'W'
      for (const id of state.clubs[uid].players) {
        const p = state.players[id]
        if (p) p.morale = clamp(p.morale + (up ? 0.25 : -0.3), 1, 10)
      }
    }
  }

  // mentor pairs dissolve when either man leaves the building
  if (state.mentors?.length) {
    state.mentors = state.mentors.filter(mp => {
      const s2 = state.players[mp.senior]
      const k2 = state.players[mp.kid]
      const ok = s2 && k2 && s2.clubId === state.userClubId && k2.clubId === state.userClubId
      if (!ok && k2 && k2.clubId === state.userClubId) {
        k2.morale = clamp(k2.morale - 0.5, 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
          subject: `${k2.name.split(' ').slice(-1)[0]} loses his mentor`,
          body: `With ${s2 ? s2.name : 'his mentor'} gone, ${k2.name} is training alone again. The academy coach will keep an eye on him - but it isn't the same.`,
          playerId: k2.id,
        })
      }
      return !!ok
    })
  }

  // turnaround: a Sunday game followed by a Friday game leaves 5 days'
  // recovery, not 7 - the whole squad freshens up slower that week
  const lastFx = state.fixtures.find(f =>
    f.week === state.week - 1 && f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const nextFx = state.fixtures.find(f =>
    f.week === state.week && !f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const gapDays = lastFx && nextFx ? 7 + fixtureDayOff(nextFx.id) - fixtureDayOff(lastFx.id) : 7
  const turnF = gapDays / 7 // 5-day turnaround = 71% recovery; 9 days = 128%

  // the skipper's mood is contagious: a happy leader settles the room,
  // a miserable one drags it down with him
  if (!state.unemployed) {
    const capId = state.clubs[state.userClubId].captain
    const cap = capId != null ? state.players[capId] : null
    if (cap && cap.a.lea >= 13) {
      const pull = cap.morale >= 7 ? 0.04 : cap.morale <= 4 ? -0.05 : 0
      if (pull) {
        for (const id of state.clubs[state.userClubId].players) {
          const p = state.players[id]
          if (p && p.id !== cap.id) p.morale = clamp(p.morale + pull, 1, 10)
        }
      }
    }
  }

  // an agent smells a payday: an underpaid star performer demands new terms
  if (!state.unemployed && rng() < 0.12) {
    const squad = state.clubs[state.userClubId].players.map(id => state.players[id]).filter(Boolean)
    const cands = squad.filter(p =>
      !p.acad && !p.loanFrom && p.stats.apps >= 8 &&
      p.stats.ratingSum / Math.max(1, p.stats.apps) >= 7.15 &&
      p.wage < playerWage(p.ca, p.age) * 0.85 &&
      !(p.wantsDeal ?? 0) && p.contractEnds > state.season && p.age <= 32)
    if (cands.length) {
      const p = cands[Math.floor(rng() * cands.length)]
      p.wantsDeal = state.week
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
        subject: `💼 ${p.name} wants improved terms`,
        body: `${p.name}'s agent has been on the phone: his client is playing the house down (avg ${(p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2)}) on ${fmtMoney(p.wage)}/week, and the market rate is well north of that. He has ${p.contractEnds - state.season} year${p.contractEnds - state.season > 1 ? 's' : ''} left, but leave it unresolved and his head will drop - and other clubs will smell it. Offer a new deal from his player page.`,
        playerId: p.id,
      })
    }
  }

  for (const club of Object.values(state.clubs)) {
    const isUser = club.id === state.userClubId
    for (const id of club.players) {
      const p = state.players[id]
      if (!p) continue
      // recovery - rusty players take longer to freshen up
      const gym = isUser ? (state.facilities?.gym ?? 0) * 1.5 : 0
      p.cond = clamp(p.cond + Math.round((((p.rust ?? 0) > 0 ? 16 : 22) + gym) * (isUser ? turnF : 1)), 20, 100)
      p.sharp = clamp(p.sharp - 4, 0, 100)
      if ((p.rust ?? 0) > 0) p.rust = (p.rust ?? 1) - 1
      if (p.injury && state.week >= p.injury.until) {
        const weeksOut = p.injury.weeks ?? 2
        p.injury = null
        p.specialist = false
        p.cond = 70
        p.sharp = 40
        // a spell of match rust: playable, but rushing him back risks re-injury
        p.rust = weeksOut >= 8 ? 3 : weeksOut >= 3 ? 2 : 1
        if (isUser) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
            subject: `${p.name} back in training`,
            body: `${p.name} has recovered and is available for selection - but the medical team rate him RUSTY for ${p.rust} week${p.rust > 1 ? 's' : ''}. Pick him now and he could break down again; ease him back and he'll be right.`,
            playerId: p.id,
          })
        }
      }
      // gentle in-season growth for youngsters, drift for user's training
      // focus. Damped near the top: without it the whole world's best 23
      // converge on 99 by season 12 and elite means nothing
      const growBoost = isUser ? 1 + state.staff.assistant * 0.25 : 1
      const eliteF = p.ca >= 94 ? 0.15 : p.ca >= 88 ? 0.5 : 1
      if (p.age <= 24 && p.ca < p.pa && rng() < 0.06 * growBoost * eliteF) p.ca += 1
      if (isUser && state.training !== 'balanced') {
        const coach = coachFor[state.training]
        const coachLvl = coach ? (state.staff[coach] ?? 0) : 0
        if (rng() < 0.03 * (1 + state.staff.assistant * 0.5 + coachLvl * 0.45 + (state.facilities?.paddock ?? 0) * 0.35)) {
          for (const k of focusMap[state.training]) p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
      }
      // FM-style morale: everything drifts toward 'Good' unless events
      // keep pushing it - form runs and game time do most of the work
      if (isUser) {
        p.morale += (6.5 - p.morale) * 0.06
        const played = (p.lastWk ?? -9) >= state.week - 1
        const frozen = !played && (p.lastWk ?? -9) < state.week - 3 && !p.injury && !p.acad && !p.natSquad && p.stats.apps + 3 < state.week
        if (played) p.morale = clamp(p.morale + 0.1, 1, 10)
        else if (frozen) p.morale = clamp(p.morale - (p.pers === 'Mercenary' || p.pers === 'Ambitious' ? 0.35 : 0.2), 1, 10)
      }
      // an unresolved contract demand sours by the week
      if (isUser && (p.wantsDeal ?? 0) > 0) {
        p.morale = clamp(p.morale - 0.12, 1, 10)
        if (state.week - (p.wantsDeal ?? 0) === 8 && (p.pers === 'Mercenary' || p.pers === 'Ambitious')) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
            subject: `💼 ${p.name}'s agent goes public`,
            body: `Two months of silence from the club, so the agent has taken it to the papers: "${p.name} is one of the best-performing players in the league and the club knows our position." Rival clubs will have noticed. Sort a new deal on his player page - or brace for bids.`,
            playerId: p.id,
          })
        }
      }
      // a good mentor is worth an extra coach: paired kids learn faster
      if (isUser && p.acad && (state.mentors ?? []).some(mp => mp.kid === p.id)) {
        if (rng() < 0.045) {
          const keys = Object.keys(p.a) as (keyof Player['a'])[]
          const k = keys[Math.floor(rng() * keys.length)]
          p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
        const pair = (state.mentors ?? []).find(mp => mp.kid === p.id)!
        const senior = state.players[pair.senior]
        if (senior && rng() < 0.008 && p.pers !== senior.pers) {
          p.pers = senior.pers
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
            subject: `${p.name.split(' ').slice(-1)[0]} is turning into his mentor`,
            body: `The coaches have noticed it in the little things - the extras after training, the way he talks in the huddle. ${p.name} is starting to carry himself like ${senior.name}. Character: now ${senior.pers.toLowerCase()}.`,
            playerId: p.id,
          })
        }
      }
      // the academy coach quietly builds tomorrow's team
      if (isUser && p.acad && rng() < 0.025 + state.staff.academyCoach * 0.025) {
        const keys = Object.keys(p.a) as (keyof Player['a'])[]
        const k = keys[Math.floor(rng() * keys.length)]
        p.a[k] = clamp(p.a[k] + 1, 1, 20)
      }
      if (isUser && state.staff.physio > 0) p.cond = clamp(p.cond + state.staff.physio * 3, 20, 100)
      // the medical room earns its money: injured men can come back early
      if (isUser && p.injury && p.injury.until - state.week >= 2 && rng() < 0.06 + state.staff.physio * 0.02) {
        p.injury.until -= 1
        if (p.injury.until - state.week <= 0) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
            subject: `${p.name} ahead of schedule`,
            body: `Good news from the treatment table: ${p.name} (${p.injury.desc}) has smashed his rehab targets and is available again this week - earlier than anyone dared hope.`,
            playerId: p.id,
          })
        }
      }
      // a recovery week puts petrol back in every tank
      if (isUser && state.matchPrep === 'recovery') p.cond = clamp(p.cond + 3.5, 20, 100)
      p.value = playerValue(p.ca, p.age, p.pa)
    }
  }
}

// ------------------------------------------------------------------
// Finances & board
// ------------------------------------------------------------------

function weeklyFinance(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  const wages = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  club.balance -= wages
  // backroom staff wages
  club.balance -= (Object.keys(STAFF_INFO) as (keyof typeof STAFF_INFO)[])
    .reduce((s, k) => s + state.staff[k] * STAFF_INFO[k].wage, 0)
  // sponsorship + broadcast, weekly share by reputation
  club.balance += Math.round(club.rep * 1800 + 40_000)
  // gate receipts from this week's home fixture
  const home = state.fixtures.find(f =>
    f.week === state.week && f.played && f.homeId === club.id && f.att)
  if (home?.att) club.balance += Math.round(home.att * 30)
  // weekly balance snapshot for the season chart
  ;(state.finHist ??= []).push({ w: state.week, b: club.balance })
  if (state.finHist.length > 50) state.finHist = state.finHist.slice(-50)
  if (club.balance < -2_000_000 && state.week % 6 === 0) {
    club.boardConfidence = clamp(club.boardConfidence - 5, 0, 100)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: 'Board concerned by finances',
      body: `The club is ${fmtMoney(Math.abs(club.balance))} in the red. The board urges you to balance the books - consider player sales.`,
    })
  }
}

function matchReport(state: GameState, fx: Fixture) {
  // the engine already filed a full report for matches played in detail -
  // a second VICTORY/DEFEAT item on the same result is just noise
  if (fx.events?.length) return
  const comp = state.comps[fx.compId]
  const isHome = fx.homeId === state.userClubId
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const verdict = us > them ? 'VICTORY' : us < them ? 'DEFEAT' : 'DRAW'
  const scorers = (fx.events ?? [])
    .filter(e => e.type === 'TRY' && e.playerName)
    .map(e => `${e.playerName} (${e.min}')`)
  const motm = fx.motm != null ? state.players[fx.motm] : null
  const lines = [
    `${teamShort(state, fx.homeId)} ${fx.homeScore} - ${fx.awayScore} ${teamShort(state, fx.awayId)}`,
    fx.att ? `Att: ${fx.att.toLocaleString()} at ${state.clubs[fx.homeId]?.stadium ?? 'a neutral venue'}` : '',
    scorers.length ? `Tries: ${scorers.join(', ')}` : 'No tries scored.',
    motm ? `Player of the match: ${motm.name}` : '',
  ].filter(Boolean)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'result', read: false,
    subject: `${verdict}: ${us}-${them} ${us >= them ? 'over' : 'to'} ${teamShort(state, isHome ? fx.awayId : fx.homeId)} (${comp?.short})`,
    body: lines.join('\n'),
    fixtureId: fx.id,
  })
}

function milestones(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  for (const id of club.players) {
    const p = state.players[id]
    // only the week he actually crossed the number - never a repeat salute
    if (!p || !p.stats.apps || p.lastWk !== state.week) continue
    const totApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const totTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const totPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    const hits: string[] = []
    if ([50, 100, 150, 200, 250].includes(totApps)) hits.push(`${totApps} career appearances`)
    if ([25, 50, 75, 100].includes(totTries)) hits.push(`${totTries} career tries`)
    if ([250, 500, 1000, 1500].includes(totPts)) hits.push(`${totPts} career points`)
    for (const h of hits) {
      const body = `${p.name} has reached ${h}. A presentation is made before training.`
      // a player parked exactly on a number (no tries this week) must not
      // be saluted again - one presentation per milestone
      if (state.news.some(n => n.body === body)) continue
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `Milestone: ${p.name}`,
        body,
        playerId: p.id,
      })
    }
  }
}

function leagueRoundUp(state: GameState) {
  const leagueId = state.clubs[state.userClubId].leagueId
  const round = state.fixtures.filter(f =>
    f.compId === leagueId && f.week === state.week && f.played &&
    f.homeId !== state.userClubId && f.awayId !== state.userClubId)
  if (!round.length) return
  const lines = round.map(f =>
    `${teamShort(state, f.homeId)} ${f.homeScore}-${f.awayScore} ${teamShort(state, f.awayId)}`)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${state.comps[leagueId]?.short} round-up`,
    body: lines.join('\n'),
  })
}

/** The dugout counts too: round numbers on the manager's own record.
 *  The win check only fires on a win, or it would repeat while the
 *  counter sits on the mark through defeats. */
function mgrMilestones(state: GameState, won: boolean) {
  const m = state.mgr
  const winMarks = [50, 100, 250, 500, 750, 1000]
  const gameMarks = [100, 250, 500, 750, 1000]
  const pct = m.m > 0 ? Math.round((m.w / m.m) * 100) : 0
  if (won && winMarks.includes(m.w)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `🏅 Career win number ${m.w}`,
      body: `That was the ${m.w}th win of your managerial career - ${m.w} from ${m.m} matches (${pct}%), with ${m.trophies.length} ${m.trophies.length === 1 ? 'trophy' : 'trophies'} in the cabinet. The staff mark it with a quiet round of applause in the corridor. Back to work.`,
    })
  }
  if (gameMarks.includes(m.m)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `📇 Match ${m.m} in the dugout`,
      body: `You have now taken charge of ${m.m} matches: ${m.w} won, ${m.d} drawn, ${m.l} lost (${pct}%). Very few last this long in the job. The trick, as ever, is the next one.`,
    })
  }
}

function boardReaction(state: GameState, fx: Fixture) {
  const club = state.clubs[state.userClubId]
  const isHome = fx.homeId === club.id
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const oppRep = state.clubs[isHome ? fx.awayId : fx.homeId]?.rep ?? 70
  const diff = (oppRep - club.rep) / 25
  const derbyF = fx.derby ? 1.8 : 1 // derbies echo in the boardroom
  // a new owner watches every result like it is a referendum on you
  const ownerF = state.newOwnerUntil != null && state.week <= state.newOwnerUntil ? 1.4 : 1
  if (us > them) club.boardConfidence = clamp(club.boardConfidence + (2.5 + diff * 2) * derbyF * ownerF, 0, 100)
  else if (us < them) club.boardConfidence = clamp(club.boardConfidence - (2.5 - diff * 2) * derbyF * ownerF, 0, 100)
  // the derby ledger: every meeting with a rival is written down forever
  if (fx.derby) {
    const oppId = isHome ? fx.awayId : fx.homeId
    const book = (state.derbyBook ??= {})
    const rec = (book[oppId] ??= { w: 0, d: 0, l: 0 })
    if (us > them) rec.w += 1
    else if (us < them) rec.l += 1
    else rec.d += 1
  }
  // manager career record
  state.mgr.m += 1
  if (us > them) state.mgr.w += 1
  else if (us === them) state.mgr.d += 1
  else state.mgr.l += 1
  mgrMilestones(state, us > them)

  // the terraces have longer memories and shorter fuses than the board
  const before = state.fanMood ?? 60
  const heat = fx.derby || grudgeBetween(state, fx.homeId, fx.awayId) ? 1.7 : 1
  let mood = before + (us > them ? 4 * heat : us < them ? -(5 * heat + (isHome ? 1.5 : 0)) : -1)
  mood += (55 - mood) * 0.03 // everything fades toward "fine"
  state.fanMood = clamp(mood, 5, 98)
  if (before < 80 && state.fanMood >= 80) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `🎶 The terraces are in full voice`,
      body: `The songs have new verses and away allocations are selling out. The supporters believe in this team - and ${state.clubs[state.userClubId].stadium} is becoming a genuinely hard place to visit.`,
    })
  } else if (before > 30 && state.fanMood <= 30) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `😤 Boos at full-time`,
      body: `Sections of the support turned on the team this week. Banners are being painted and the phone-ins are merciless. Results are the only medicine - and until they come, home games will feel colder.`,
    })
  }
}

// ------------------------------------------------------------------
// Weekly processing
// ------------------------------------------------------------------

export function userFixtureThisWeek(state: GameState): Fixture | undefined {
  return state.fixtures.find(f =>
    f.week === state.week && !f.played &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId))
}

/** Idle-week friendly: a home run-out against another idle club. Sharpness
 *  and combinations for the squad - but the injury risk is real. */
export function arrangeFriendly(state: GameState, oppId: string): string {
  if (userFixtureThisWeek(state)) return 'You already have a match this week.'
  const opp = state.clubs[oppId]
  if (!opp) return 'No such club.'
  const busy = state.fixtures.some(f => f.week === state.week && !f.played && (f.homeId === oppId || f.awayId === oppId))
  if (busy) return `${opp.short} have a fixture of their own this week.`
  state.fixtures.push({
    id: state.nextId++, compId: 'fr', round: 0, week: state.week,
    homeId: state.userClubId, awayId: oppId,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
  })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `🤝 Friendly arranged: ${opp.short} this week`,
    body: `${opp.name} have agreed to a run-out at your place. Minutes for the fringe men, sharpness for the returners - just don't get anyone hurt.`,
  })
  return `Friendly arranged against ${opp.name} this week.`
}

/** The national side's fixture this week, when the user also coaches one.
 *  A home-nations coach also takes the Lions in a tour year. */
export function natFixtureThisWeek(state: GameState): Fixture | undefined {
  if (!state.natTeam) return undefined
  const teams = [state.natTeam]
  if (['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam)) teams.push('LIO')
  return state.fixtures.find(f =>
    f.week === state.week && !f.played &&
    (teams.includes(f.homeId) || teams.includes(f.awayId)))
}

/**
 * Process everything for the current week EXCEPT the user's fixture
 * (which the UI plays via the MatchDay screen first).
 * Then move to next week.
 */
export function processWeekAndAdvance(state: GameState) {
  const rng = weekRng(state)

  // internationals squad management happens before matches
  manageInternationals(state, rng)

  // knockout creation for this week (before playing)
  for (const comp of Object.values(state.comps)) maybeCreateKnockouts(state, comp, rng)

  // play all unplayed fixtures for this week (user's should already be played)
  const thisWeek = state.fixtures.filter(f => f.week === state.week && !f.played)
  for (const fx of thisWeek) {
    simMatch(state, fx, rng, false)
    const comp = state.comps[fx.compId]
    if (comp) {
      if (fx.stage) resolveKnockoutDraw(state, fx, rng)
      applyToTable(comp, fx)
      fx.tableApplied = true
    }
  }
  // DEADLINE DAY: the last week of each window is a circus - panic
  // listings appear at cut prices and nobody's star is safe
  if ((state.week === 7 || state.week === 27) && !state.unemployed) {
    const bargains: string[] = []
    const pool = Object.values(state.players).filter(p =>
      p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId] &&
      !p.transferListed && !p.onLoan && !p.loanFrom && !p.injury &&
      p.ca >= 70 && p.ca <= 84 && p.age >= 24)
    for (let k = 0; k < 3 && pool.length; k++) {
      const p = pool.splice(Math.floor(rng() * pool.length), 1)[0]
      p.transferListed = true
      bargains.push(`${p.name} (${p.pos}, ${state.clubs[p.clubId!]?.short}) - ${fmtMoney(askingPrice(state, p))}`)
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: `🚨 DEADLINE DAY - the window slams shut this week`,
      body: [
        `Phones are running hot across the league. Clubs are cutting prices to move bodies before the deadline${bargains.length ? ':' : '.'}`,
        ...bargains.map(b => `• ${b}`),
        `Move fast if you're buying - and don't be shocked if someone comes for one of yours before midnight.`,
      ].join('\n'),
    })
  }

  // the morning after deadline day: the window is shut, here is the rundown
  if ((state.week === 8 || state.week === 28) && !state.unemployed) {
    const deals = state.news.filter(n => n.type === 'transfer' && n.season === state.season &&
      n.week === state.week - 1 && n.subject.includes(' joins ') && n.playerId != null)
    if (deals.length >= 2) {
      const TIMES = ['08:10', '09:45', '11:30', '13:05', '14:40', '16:15', '18:00', '19:35', '21:10', '22:55']
      const lines: string[] = []
      deals.slice(0, 8).forEach((n, i) => {
        const p = state.players[n.playerId!]
        const to = p?.clubId ? state.clubs[p.clubId] : null
        if (!p || !to) return
        const fee = n.body.match(/for a fee of (.+?)\. The /)?.[1] ?? 'an undisclosed fee'
        const mine = to.id === state.userClubId || n.body.includes(`from ${state.clubs[state.userClubId].name}`)
        lines.push(`${TIMES[i]} - DONE DEAL: ${p.name} (${p.pos}) to ${to.short}, ${fee}.${mine ? ' Your business.' : ''}`)
      })
      const flop = Object.values(state.players)
        .filter(p => p.clubId && p.clubId !== state.userClubId && p.ca >= 76 && p.transferListed)
        .sort((a, b) => b.ca - a.ca)[0]
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `📻 Deadline day, as it happened`,
        body: [
          `The window is shut. ${deals.length} deals crossed the line on the final day - the rundown:`,
          ...lines,
          ...(flop ? [`23:40 - COLLAPSED: ${flop.name}'s move fell apart at the medical. He stays at ${state.clubs[flop.clubId!]?.short} - for now.`] : []),
          `Business is done until the window reopens. Back to rugby.`,
        ].join('\n'),
      })
    }
  }

  // promises fall due: the squad keeps the receipts on what you said
  // in the office, and settles them - kept or broken - at the due week
  if (state.pledges?.length) {
    const remain: typeof state.pledges = []
    for (const pl of state.pledges) {
      const p = state.players[pl.playerId]
      // void quietly if the season rolled, either of you moved on, or you
      // were shown the door - a new regime owes the squad nothing. A player
      // who signed a pre-contract elsewhere made his own choice: no promise
      // survives his signature on someone else's paper
      if (pl.season !== state.season || !p || p.clubId !== state.userClubId || state.unemployed ||
        (state.preContracts ?? []).some(pc => pc.playerId === p.id)) continue
      if (state.week < pl.due) { remain.push(pl); continue }
      const gap = p.stats.apps - pl.baseApps
      const kept = pl.kind === 'plans' ? gap >= 2
        : pl.kind === 'minutes' ? gap >= 1
        : p.contractEnds > state.season
      const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
      if (kept) {
        p.morale = clamp(p.morale + 1.1, 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
          subject: `🤝 Word kept: ${p.name}`,
          body: pl.kind === 'plans' ? `You told ${p.name} he was in your plans, and the team sheets backed it up. He has not forgotten the conversation - and neither has the dressing room. Trust like that is worth points.`
            : pl.kind === 'minutes' ? `${p.name} got the minutes you promised him. The academy coach is purring: "That is how you grow one." The kid would run through a wall for you now.`
            : `${p.name} has his new deal, just as you said he would. The senior pros noticed: this is a club where a handshake still means something.`,
          playerId: p.id,
        })
      } else {
        p.morale = clamp(p.morale - (sulky ? 2.2 : 1.5), 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
          subject: `💔 Promise broken: ${p.name}`,
          body: pl.kind === 'plans' ? `You told ${p.name} he was in your plans ${state.week - pl.week} weeks ago. He has barely seen the pitch since. The conversation has leaked to the squad, and his agent is already briefing that "the manager's word means nothing at this club."`
            : pl.kind === 'minutes' ? `${p.name} was promised minutes and got none. He trained with headphones in all week, and the academy coach has stopped defending you in the canteen.`
            : `${p.name} is still waiting for the deal you as good as promised him. He held off other offers on your word - now he feels strung along, and the older heads in the squad are watching how this ends.`,
          playerId: p.id,
        })
      }
    }
    state.pledges = remain
  }

  // the physio's red flag: a position group stripped below cover gets an
  // assistant's alert with names, timelines and the loan-market options
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    // 'need' is the number of starting shirts the group fills: an alert
    // means the XV cannot be fielded from fit specialists at all
    const GROUPS: { key: string; label: string; pos: Pos[]; need: number }[] = [
      { key: 'prop', label: 'the props', pos: ['LP', 'TP'], need: 2 },
      { key: 'hook', label: 'hooker', pos: ['HK'], need: 1 },
      { key: 'lock', label: 'the second row', pos: ['LK'], need: 2 },
      { key: 'back5', label: 'the back row', pos: ['FL', 'N8'], need: 3 },
      { key: 'nine', label: 'scrum-half', pos: ['SH'], need: 1 },
      { key: 'ten', label: 'fly-half', pos: ['FH'], need: 1 },
      { key: 'centre', label: 'the centres', pos: ['CE'], need: 2 },
      { key: 'back3', label: 'the back three', pos: ['WG', 'FB'], need: 3 },
    ]
    const squad = club.players.map(id => state.players[id]).filter(Boolean)
    state.crisisAt ??= {}
    for (const grp of GROUPS) {
      const all = squad.filter(p => grp.pos.includes(p.pos) && !p.acad)
      const fit = all.filter(p => !p.injury && p.bans === 0)
      if (fit.length >= grp.need || all.length <= grp.need) continue
      if (state.week - (state.crisisAt[grp.key] ?? -99) < 6) continue
      state.crisisAt[grp.key] = state.week
      const down = all.filter(p => p.injury || p.bans > 0)
        .map(p => p.injury ? `${p.name} (back wk ${p.injury.until})` : `${p.name} (suspended)`)
      const cover = loanTargets(state).filter(p => grp.pos.includes(p.pos)).slice(0, 3)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
        subject: `🚑 Injury crisis: ${grp.label}`,
        body: [
          `The physio's board makes grim reading at ${grp.label}: ${fit.length} fit of ${all.length} on the books.${down.length ? ` Out: ${down.join(', ')}.` : ''}`,
          cover.length
            ? `The assistant has three calls he could make tonight - loan cover available: ${cover.map(p => `${p.name} (${p.pos}, ${p.age}, ${state.clubs[p.clubId!]?.short})`).join(', ')}. Transfers screen, Loans tab.`
            : `The loan market has nothing suitable this week. Youth, patience, or a positional reshuffle - your call.`,
        ].join('\n'),
      })
    }
  }

  // Six Nations lore: the Slam and the Spoon are bigger than the table
  {
    const sn = state.comps['sn']
    const lastWk = SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1]
    const penultWk = SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 2]
    if (sn && state.week === penultWk) {
      const leader = sortTable(sn.table)[0]
      if (leader && leader.w === 4 && leader.d === 0 && leader.l === 0) {
        const name = nationByCode(leader.teamId)?.name ?? leader.teamId
        const yours = state.natTeam === leader.teamId
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `⚡ ${name} are 80 minutes from a Grand Slam`,
          body: yours
            ? `Four from four, one to play. Your side stand one win from a Grand Slam - the week every coach dreams about and none sleeps through. Handle the occasion, not just the opposition.`
            : `${name} have won all four and go into the final round with a Grand Slam on the table. The whole championship stops to watch.`,
        })
      }
    }
    if (sn && state.week === lastWk) {
      const fx = state.fixtures.filter(f => f.compId === 'sn')
      if (fx.length && fx.every(f => f.played)) {
        const rows = sortTable(sn.table)
        const top = rows[0]
        const bottom = rows[rows.length - 1]
        if (top && top.w === 5) {
          const name = nationByCode(top.teamId)?.name ?? top.teamId
          const yours = state.natTeam === top.teamId
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `👑 GRAND SLAM: ${name} win them all`,
            body: yours
              ? `Five from five. A GRAND SLAM for ${name}, and your name goes on it forever. Titles are won most years; Slams are remembered in decades. Enjoy every minute of the week that follows.`
              : `${name} complete the Grand Slam - five wins from five. The rest of the championship applauds through gritted teeth.`,
          })
        }
        if (bottom && bottom.w === 0 && bottom.d === 0) {
          const name = nationByCode(bottom.teamId)?.name ?? bottom.teamId
          const yours = state.natTeam === bottom.teamId
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `🥄 The Wooden Spoon goes to ${name}`,
            body: yours
              ? `Five defeats from five. The Wooden Spoon is ${name}'s - and yours. The union's review lands next week, and the press will not be gentle. Something has to change, starting with the result.`
              : `${name} finish the championship without a win and take the Wooden Spoon home. Their review will be brutal.`,
          })
        }
      }
    }
  }

  // the World Cup post-mortem: the seed said one thing - what did the
  // tournament say back?
  {
    const wcFinal = state.fixtures.find(f => f.compId === 'wc' && f.stage === 'F' && f.played && f.week === state.week)
    const nat = state.natTeam
    if (wcFinal && nat) {
      const seeds = state.comps['wc']?.seeds ?? []
      const seed = seeds.indexOf(nat) + 1
      const won = (wcFinal.homeId === nat && wcFinal.homeScore > wcFinal.awayScore) ||
        (wcFinal.awayId === nat && wcFinal.awayScore > wcFinal.homeScore)
      const inFinal = wcFinal.homeId === nat || wcFinal.awayId === nat
      const wcFx = state.fixtures.filter(f => f.compId === 'wc' && f.played && (f.homeId === nat || f.awayId === nat))
      const deepest = wcFx.some(f => f.stage === 'F') ? (won ? 1 : 2)
        : wcFx.some(f => f.stage === 'SF') ? 4
        : wcFx.some(f => f.stage === 'QF') ? 8
        : 16
      const name = nationByCode(nat)?.name ?? nat
      const finishWord = deepest === 1 ? 'WORLD CHAMPIONS' : deepest === 2 ? 'beaten finalists'
        : deepest === 4 ? 'semi-finalists' : deepest === 8 ? 'quarter-finalists' : 'out in the pools'
      const parWord = seed > 0 && deepest < seed ? 'You over-delivered on the seeding, and the country knows it.'
        : seed > 0 && deepest === seed ? 'Par on the seeding. The review will be fair, if unsentimental.'
        : seed > 0 ? 'Short of the seeding - expect the post-mortem to use your name.'
        : ''
      if (wcFx.length) {
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: deepest === 1 ? `🏆 ${name}: CHAMPIONS OF THE WORLD` : `🌍 World Cup post-mortem: ${name}`,
          body: [
            `${name} finish the World Cup as ${finishWord}${seed > 0 ? `, having gone in seeded ${seed} of 20` : ''}.`,
            deepest === 1 ? `Whatever else happens in your career, they can never take this away.` : parWord,
          ].filter(Boolean).join(' '),
        })
      }
    }
  }

  // derby week: the buildup starts the moment the previous weekend ends
  if (!state.unemployed) {
    const next = state.fixtures.find(f => !f.played && f.week === state.week + 1 &&
      (f.homeId === state.userClubId || f.awayId === state.userClubId) &&
      isDerby(f.homeId, f.awayId))
    if (next) {
      const oppId = next.homeId === state.userClubId ? next.awayId : next.homeId
      const opp = state.clubs[oppId]
      const home = next.homeId === state.userClubId
      const rec = state.derbyBook?.[oppId]
      const pl = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
      const recLine = rec && rec.w + rec.d + rec.l > 0
        ? `Your record against them since you took charge: ${pl(rec.w, 'win')}, ${pl(rec.d, 'draw')}, ${pl(rec.l, 'defeat')}.`
        : `Your first meeting with them in this job. First impressions last a lifetime in fixtures like this.`
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🔥 DERBY WEEK: ${derbyName(next.homeId, next.awayId)}`,
        body: [
          `${opp?.name ?? 'The old enemy'} ${home ? 'come to' : 'await at'} ${home ? state.clubs[state.userClubId].stadium : opp?.stadium ?? 'their place'} on Saturday, and the town already knows it. Tickets went an hour after release. Training gates will be busier than usual this week.`,
          recLine,
          `Nobody remembers the league position of a derby winner. Everybody remembers the score.`,
        ].join('\n'),
        fixtureId: next.id,
      })
    }
  }

  // the academy coach has watched next summer's class all season - his
  // preview is honest because the class it describes is already fixed
  if (state.week === 30 && !state.unemployed && !state.intakeClass?.length) {
    const cls = rollIntakeClass(state, rng)
    if (cls.length) {
      state.intakeClass = cls
      const best = Math.max(...cls.map(c => c.pa))
      const grade = cls.some(c => c.wonder) || best >= 88 ? 'A' : best >= 81 ? 'B' : best >= 73 ? 'C' : best >= 65 ? 'D' : 'E'
      const star = cls.reduce((a, b) => (b.pa > a.pa ? b : a))
      const GROUP: Record<string, string> = {
        LP: 'the front row', HK: 'the front row', TP: 'the front row', LK: 'the second row',
        FL: 'the back row', N8: 'the back row', SH: 'half-back', FH: 'half-back',
        CE: 'midfield', WG: 'the back three', FB: 'the back three',
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `🎓 Academy preview: next summer's class`,
        body: [
          `The academy coach's end-of-tour report is in. ${cls.length} boys will step up at the end of the season.`,
          grade === 'A' ? `His verdict: "There is a special one in this group. I would stake my job on it."`
            : grade === 'B' ? `His verdict: "A strong year. One or two of these will play first-team rugby."`
            : grade === 'C' ? `His verdict: "Honest, coachable kids. Do not expect fireworks."`
            : grade === 'D' ? `His verdict: "A lean year. We will need to buy young instead."`
            : `His verdict: "Between us? Start scouting elsewhere."`,
          `The strength of the class is in ${GROUP[star.pos] ?? 'the pack'}. Names on intake day.`,
        ].join('\n'),
      })
    }
  }

  // the Scouting Agency refreshes its world rankings every four weeks
  if (state.week % 4 === 2) updateAgency(state)

  // half-term: the board grades the season so far, in writing
  if (state.week === 24 && !state.unemployed) {
    const club = state.clubs[state.userClubId]
    const comp = state.comps[club.leagueId]
    const posNow = comp ? sortTable(comp.table).findIndex(r => r.teamId === club.id) + 1 : 0
    const pred = state.preds?.[club.id]
    const diff = pred && posNow ? pred - posNow : 0
    const objs = (state.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
    const met = objs.filter(o => o!.met(state)).length
    const grade = diff >= 3 ? 'A' : diff >= 1 ? 'B' : diff === 0 ? 'C' : diff >= -2 ? 'D' : 'E'
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `🏛 Half-term report card: grade ${grade}`,
      body: [
        `The board's mid-season review has landed on your desk.`,
        posNow ? `League: ${posNow}${posNow === 1 ? 'st' : posNow === 2 ? 'nd' : posNow === 3 ? 'rd' : 'th'}${pred ? ` (pundits predicted ${pred}${pred === 1 ? 'st' : pred === 2 ? 'nd' : pred === 3 ? 'rd' : 'th'})` : ''}.` : '',
        objs.length ? `Season objectives: ${met}/${objs.length} on track.` : '',
        `Boardroom confidence: ${Math.round(club.boardConfidence)}%.`,
        grade === 'A' ? 'Verdict: "Exceptional. Whatever you are doing, keep doing it."'
          : grade === 'B' ? 'Verdict: "Ahead of expectations. The room is pleased."'
          : grade === 'C' ? 'Verdict: "On par. The second half of the season will define you."'
          : grade === 'D' ? 'Verdict: "Below where we should be. Improvement is expected, not hoped for."'
          : 'Verdict: "Unacceptable. The board will be watching the next two months very closely."',
      ].filter(Boolean).join('\n'),
    })
  }

  // monthly awards in the user's league: every four weeks the league names
  // its player and manager of the month - small prizes, big feelings
  if (state.week % 4 === 0 && !state.unemployed) {
    const leagueId = state.clubs[state.userClubId].leagueId
    const comp = state.comps[leagueId]
    if (comp?.type === 'league') {
      const from = state.week - 3
      // manager of the month: best league results in the window
      let bestClub: string | null = null
      let bestPts = -1
      for (const r of comp.table) {
        let pts = 0
        for (const f of state.fixtures) {
          if (f.compId !== leagueId || !f.played || f.week < from || f.week > state.week) continue
          if (f.homeId !== r.teamId && f.awayId !== r.teamId) continue
          const us = f.homeId === r.teamId ? f.homeScore : f.awayScore
          const them = f.homeId === r.teamId ? f.awayScore : f.homeScore
          pts += us > them ? 3 : us === them ? 1 : 0
        }
        if (pts > bestPts) { bestPts = pts; bestClub = r.teamId }
      }
      // player of the month: hottest form among men who featured this window
      const cands = comp.table.flatMap(r => (state.clubs[r.teamId]?.players ?? [])
        .map(id => state.players[id])
        .filter(p => p && (p.lastWk ?? -9) >= from))
      const pom = cands.sort((a, b) => b!.form - a!.form || b!.stats.ratingSum - a!.stats.ratingSum)[0]
      if (pom && bestClub && bestPts >= 0) {
        pom.morale = clamp(pom.morale + 0.6, 1, 10)
        const userWon = bestClub === state.userClubId
        if (userWon) {
          state.mgr.moms = (state.mgr.moms ?? 0) + 1
          const club = state.clubs[state.userClubId]
          club.boardConfidence = clamp(club.boardConfidence + 4, 0, 100)
          state.fanMood = clamp((state.fanMood ?? 60) + 4, 5, 98)
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
          subject: userWon
            ? `🥇 Manager of the Month: YOU`
            : pom.clubId === state.userClubId
              ? `🥇 ${comp.short} awards: ${pom.name} is Player of the Month`
              : `🥇 ${comp.short} monthly awards`,
          body: [
            `Manager of the Month: ${userWon ? `${state.managerName} (${state.clubs[state.userClubId].short})` : `${state.clubs[bestClub]?.coach ?? 'The coach'} (${state.clubs[bestClub]?.short})`} - ${bestPts} pts from the window.`,
            `Player of the Month: ${pom.name} (${state.clubs[pom.clubId!]?.short ?? '-'}), form ${pom.form.toFixed(1)}.`,
            userWon ? 'The board notice these things - and so does the crowd.' : pom.clubId === state.userClubId ? 'A proud week for the club and a lift for the man himself.' : '',
          ].filter(Boolean).join('\n'),
          playerId: pom.id,
        })
      }
    }
  }

  // knockout heartbreak breeds a grudge: losing a semi or a final puts the
  // winner on your dartboard for the next couple of seasons
  for (const fx of state.fixtures.filter(f =>
    f.week === state.week && f.played && (f.stage === 'SF' || f.stage === 'F') &&
    state.clubs[f.homeId] && state.clubs[f.awayId])) {
    const winner = fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId
    const loser = winner === fx.homeId ? fx.awayId : fx.homeId
    const comp = state.comps[fx.compId]
    addGrudge(state, loser, winner,
      `they broke our hearts in the ${comp?.short ?? 'cup'} ${fx.stage === 'F' ? 'final' : 'semi-final'}`)
  }

  // the user's fixture was played in detail by the MatchDay screen -
  // apply its table effects exactly once here (club match or Test match)
  const userFx = state.fixtures.find(f =>
    f.week === state.week && f.played && !f.tableApplied &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId ||
     (state.natTeam != null && (f.homeId === state.natTeam || f.awayId === state.natTeam ||
       (['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam) && (f.homeId === 'LIO' || f.awayId === 'LIO'))))))
  if (userFx) {
    const isClubMatch = userFx.homeId === state.userClubId || userFx.awayId === state.userClubId
    const comp = state.comps[userFx.compId]
    if (comp) {
      if (userFx.stage) resolveKnockoutDraw(state, userFx, rng)
      applyToTable(comp, userFx)
      userFx.tableApplied = true
    }
    if (isClubMatch && userFx.compId === 'fr') {
      // a friendly: sharpness banked, no board or career consequences
      scoutOpponent(state, userFx.homeId === state.userClubId ? userFx.awayId : userFx.homeId)
    } else if (isClubMatch) {
      boardReaction(state, userFx)
      matchReport(state, userFx)
      milestones(state, rng)
      leagueRoundUp(state)
      // you learn a lot about the men you just faced
      scoutOpponent(state, userFx.homeId === state.userClubId ? userFx.awayId : userFx.homeId)
    } else {
      // Test match: national duty counts on the manager's record
      const mySide = userFx.homeId === state.natTeam || userFx.homeId === 'LIO' ? userFx.homeId : userFx.awayId
      const us = userFx.homeId === mySide ? userFx.homeScore : userFx.awayScore
      const them = userFx.homeId === mySide ? userFx.awayScore : userFx.homeScore
      state.mgr.m += 1
      if (us > them) state.mgr.w += 1
      else if (us === them) state.mgr.d += 1
      else state.mgr.l += 1
      mgrMilestones(state, us > them)
      matchReport(state, userFx)
    }
  }

  // board pressure: warnings, then the sack
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    if (club.boardConfidence <= 10 && club.boardConfidence > 3 && state.week % 3 === 0) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: 'FINAL WARNING from the board',
        body: 'The chairman has made it plain: results must turn around immediately, or the club will seek a new Director of Rugby.',
      })
    }
    if (club.boardConfidence <= 3 && state.week > 8) {
      state.unemployed = true
      state.vacancies.push({ clubId: club.id, week: state.week })
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: `SACKED: ${club.name} part company with ${state.managerName}`,
        body: `A brutal end - but not the end. Your reputation travels with you. Watch the Job Centre: struggling boards make changes every few weeks, and one of them will gamble on you.`,
      })
    }
  }

  // rounds completed this week may unlock the next knockout stage -
  // create those ties NOW so the user's match exists before its week starts
  for (const comp of Object.values(state.comps)) maybeCreateKnockouts(state, comp, rng)

  // finals crown champions
  for (const comp of Object.values(state.comps)) {
    if (comp.champion) continue
    const final = state.fixtures.find(f => f.compId === comp.id && f.stage === 'F' && f.played)
    if (final) {
      comp.champion = winnerOf(final)
      state.history.push({ season: state.season, compId: comp.id, champion: comp.champion })
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `${teamShort(state, comp.champion)} win the ${comp.name}!`,
        body: `${teamShort(state, comp.champion)} defeated ${teamShort(state, final.homeId === comp.champion ? final.awayId : final.homeId)} ${Math.max(final.homeScore, final.awayScore)}-${Math.min(final.homeScore, final.awayScore)} in the ${comp.name} final.`,
      })
      if (comp.champion === state.userClubId || (state.natTeam != null && comp.champion === state.natTeam)) {
        state.celebration = {
          headline: comp.champion === state.userClubId ? `${teamShort(state, state.userClubId).toUpperCase()} ARE CHAMPIONS` : `CHAMPIONS OF THE ${comp.name.toUpperCase()}`,
          sub: `${comp.name} · ${seasonLabel(state.season)} · ${state.managerName}`,
          icon: '🏆',
        }
        state.mgr.trophies.push({ compId: comp.id, season: state.season })
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
          subject: `🏆 CHAMPIONS! The ${comp.name} is yours`,
          body: `Scenes of pure joy as ${state.clubs[state.userClubId].name} lift the ${comp.name}. The city will talk about this night for years - and the board have noted exactly who delivered it.`,
        })
        state.clubs[state.userClubId].boardConfidence = clamp(state.clubs[state.userClubId].boardConfidence + 20, 0, 100)
      }
    }
    // pure round-robin comps (6N, TRC, National 1): champion = table top when all played
    if (!comp.champion && (comp.type === 'intl' || (comp.type === 'league' && !comp.playoffTeams)) && comp.table.length) {
      const all = state.fixtures.filter(f => f.compId === comp.id)
      if (all.length && all.every(f => f.played)) {
        comp.champion = sortTable(comp.table)[0].teamId
        state.history.push({ season: state.season, compId: comp.id, champion: comp.champion })
        if (comp.type === 'league' && comp.champion === state.userClubId) {
          state.mgr.trophies.push({ compId: comp.id, season: state.season })
          state.celebration = {
            headline: `${teamShort(state, state.userClubId).toUpperCase()} ARE CHAMPIONS`,
            sub: `${comp.name} · ${seasonLabel(state.season)} · ${state.managerName}`,
            icon: '🏆',
          }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `🏆 CHAMPIONS! The ${comp.name} title is yours`,
            body: `${state.clubs[state.userClubId].name} finish top of the pile. Promotion won, history made - the town will remember this season.`,
          })
          state.clubs[state.userClubId].boardConfidence = clamp(state.clubs[state.userClubId].boardConfidence + 20, 0, 100)
        }
        const lionsWin = comp.id === 'lions' && comp.champion === 'LIO' &&
          state.natTeam != null && ['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam)
        if ((state.natTeam != null && comp.champion === state.natTeam) || lionsWin) {
          state.mgr.trophies.push({ compId: comp.id, season: state.season })
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `🏆 CHAMPIONS! You've won the ${comp.name} with ${comp.champion}`,
            body: `A nation celebrates. Your name goes into the record books as the coach who delivered the ${comp.name}.`,
          })
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `${teamShort(state, comp.champion)} win the ${comp.name}`,
          body: `${teamShort(state, comp.champion)} have been crowned ${comp.name} champions.`,
        })
      }
    }
  }

  // career milestone salutes for your own men
  const MILESTONES = new Set([50, 100, 150, 200, 250, 300, 400, 500])
  for (const id of state.clubs[state.userClubId]?.players ?? []) {
    const p = state.players[id]
    if (!p || p.lastWk !== state.week || state.unemployed) continue
    const total = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const cTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const cPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    // tries/points can park exactly on a number for weeks - salute once only
    const trySubj = `🏉 ${p.name}: ${cTries} career tries`
    const ptsSubj = `🎯 ${p.name}: ${cPts.toLocaleString()} career points`
    if ((cTries === 50 || cTries === 100) && !state.news.some(n => n.subject === trySubj)) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: trySubj,
        body: `The weekend brought up try number ${cTries} of ${p.name}'s career. The video team has already cut the montage.`,
        playerId: p.id,
      })
    } else if ((cPts === 500 || cPts === 1000) && !state.news.some(n => n.subject === ptsSubj)) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: ptsSubj,
        body: `A milestone from the tee: ${p.name} passed ${cPts.toLocaleString()} career points at the weekend. Metronomes get remembered too.`,
        playerId: p.id,
      })
    }
    if (MILESTONES.has(total)) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `👏 ${p.name}: ${total} career appearances`,
        body: `A guard of honour at training this week - ${p.name} brought up his ${total}th senior appearance at the weekend. ${total >= 200 ? 'A one-club legend in the making.' : 'The first big number of many, the coaches hope.'}`,
        playerId: p.id,
      })
    }
  }

  // decrement bans for players whose team played
  const playedTeams = new Set<string>()
  for (const fx of state.fixtures.filter(f => f.week === state.week && f.played)) {
    playedTeams.add(fx.homeId); playedTeams.add(fx.awayId)
  }
  for (const p of Object.values(state.players)) {
    if (p.bans > 0 && p.clubId && playedTeams.has(p.clubId)) p.bans--
  }

  // contract expiry warnings for the user's squad
  if (state.week === 20 || state.week === 31) {
    const expiring = state.clubs[state.userClubId].players
      .map(id => state.players[id])
      .filter(p => p && p.contractEnds <= state.season)
    if (expiring.length) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
        subject: `${expiring.length} contract${expiring.length > 1 ? 's' : ''} expiring`,
        body: `Out of contract at the end of the season: ${expiring.map(p => `${p.name} (${p.pos}, ${p.age})`).join(', ')}. Offer new deals from their profile pages or they will walk for free.`,
      })
    }
  }

  // a union comes calling: dual club-and-country roles for proven managers
  if (state.natOffer && state.week - state.natOffer.week > 3) state.natOffer = null
  if (!state.natTeam && !state.natOffer && !state.unemployed && (state.week === 6 || state.week === 18)) {
    const rep = mgrReputation(state)
    if (rep >= 64) {
      const TIERS: [string, number][] = [
        ['CAN', 64], ['USA', 65], ['TGA', 66], ['SAM', 67], ['JPN', 69], ['FIJ', 71],
        ['ITA', 72], ['WAL', 74], ['SCO', 76], ['AUS', 78], ['ARG', 78],
        ['ENG', 84], ['FRA', 86], ['RSA', 87], ['IRE', 87], ['NZL', 88],
      ]
      // offers come from the best jobs you qualify for, not the whole ladder
      const eligible = TIERS.filter(([, need]) => rep >= need).map(([n]) => n).slice(-5)
      if (eligible.length && rng() < 0.55) {
        const nat = eligible[Math.floor(rng() * eligible.length)]
        state.natOffer = { nat, week: state.week }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
          subject: `🌍 ${nat} want you as national head coach`,
          body: `The union has been watching your work and wants you to take the national side alongside your club job - Test windows, championship campaigns, maybe a World Cup. Accept or decline from your Manager Profile. The offer won't stay open long.`,
        })
      }
    }
  }

  weeklyTraining(state, rng)
  if (!state.unemployed) {
    weeklyFinance(state, rng)
    weeklyScouting(state)
    // the run-in: from week 28, gaps and rivals become the story
    if (state.week >= 31 && !state.unemployed) {
      const club = state.clubs[state.userClubId]
      const comp = state.comps[club.leagueId]
      if (comp && comp.type === 'league') {
        const order = sortTable(comp.table)
        const idx = order.findIndex(r => r.teamId === club.id)
        const roundsLeft = state.fixtures.filter(f =>
          f.compId === comp.id && !f.stage && !f.played &&
          (f.homeId === club.id || f.awayId === club.id)).length
        if (idx >= 0 && roundsLeft > 0) {
          const me = order[idx]
          const top = order[0]
          const gapTop = top.pts - me.pts
          const line = comp.playoffTeams || 0
          const lineRow = line > 0 && idx >= line ? order[line - 1] : null
          const bottom = order[order.length - 1]
          const gapDown = me.pts - bottom.pts
          const rivalResults = (ids: string[]) => state.fixtures
            .filter(f => f.compId === comp.id && f.week === state.week && f.played &&
              (ids.includes(f.homeId) || ids.includes(f.awayId)) &&
              f.homeId !== club.id && f.awayId !== club.id)
            .map(f => `${teamShort(state, f.homeId)} ${f.homeScore}–${f.awayScore} ${teamShort(state, f.awayId)}`)
          let subject = ''
          let body = ''
          if (idx === 0 && gapTop === 0) {
            const chasers = order.slice(1, 3).map(r => r.teamId)
            subject = roundsLeft === 1 ? `🏁 FINAL DAY: the title is in your hands` : `🏁 TITLE RACE: you lead with ${roundsLeft} to play`
            body = [`Top of the table, ${order[1] ? `${me.pts - order[1].pts} clear of ${teamShort(state, order[1].teamId)}` : 'clear'}. ${roundsLeft === 1 ? 'Win and it is yours. Simple as that.' : 'Every point is gold now.'}`,
              ...rivalResults(chasers).map(r => `Chasers: ${r}`)].join('\n')
          } else if (gapTop <= 6) {
            subject = roundsLeft === 1 ? `🏁 FINAL DAY: title still alive` : `🏁 TITLE RACE: ${gapTop} behind with ${roundsLeft} to play`
            body = [`${teamShort(state, top.teamId)} lead you by ${gapTop}. ${roundsLeft === 1 ? 'You need a win and a favour.' : 'Keep winning and keep watching the wires.'}`,
              ...rivalResults([top.teamId]).map(r => `The leaders: ${r}`)].join('\n')
          } else if (lineRow && lineRow.pts - me.pts <= 6) {
            subject = `🎯 PLAYOFF PUSH: ${lineRow.pts - me.pts === 0 ? 'level on points' : `${lineRow.pts - me.pts} off the line`} with ${roundsLeft} to play`
            body = [`${teamShort(state, lineRow.teamId)} hold the last playoff spot. ${roundsLeft <= 2 ? 'It comes down to these last afternoons.' : 'Time to go on a run.'}`,
              ...rivalResults([lineRow.teamId]).map(r => `Your rivals: ${r}`)].join('\n')
          } else if (idx === order.length - 1 || gapDown <= 4) {
            const above = order[order.length - 2]
            subject = roundsLeft === 1 ? `🚨 FINAL DAY: survival on the line` : `🚨 RELEGATION FIGHT: ${roundsLeft} rounds to save the season`
            body = [idx === order.length - 1
              ? `Bottom, ${above ? `${above.pts - me.pts} from safety` : 'and sinking'}. ${roundsLeft === 1 ? 'Win or go down.' : 'Every ruck is a relegation battle now.'}`
              : `Only ${gapDown} points above the drop. Look over your shoulder at your peril - but look.`,
              ...rivalResults([bottom.teamId, above?.teamId].filter(Boolean) as string[]).map(r => `Down there: ${r}`)].join('\n')
          }
          if (subject) {
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
              subject, body,
            })
          }
        }
      }
    }

    // the Six Nations window is a big deal - a round-up lands every week
    if (state.comps['sn'] && SIX_NATIONS_WEEKS.includes(state.week)) {
      const round = state.fixtures.filter(f => f.compId === 'sn' && f.week === state.week && f.played)
      if (round.length) {
        const order = sortTable(state.comps['sn'].table)
        const leader = order[0] ? nationByCode(order[0].teamId)?.name : null
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `🏆 Six Nations round ${SIX_NATIONS_WEEKS.indexOf(state.week) + 1}: the story so far`,
          body: [
            ...round.map(f => `${nationByCode(f.homeId)?.name} ${f.homeScore}–${f.awayScore} ${nationByCode(f.awayId)?.name}`),
            leader ? `\n${leader} top the table${order[0].p >= 4 ? ' with the title in sight' : ''}. The whole sport stops for this.` : '',
          ].filter(Boolean).join('\n'),
        })
      }
    }
    generatePress(state, rng)
    // press tone cools toward neutral unless you keep feeding it
    if (state.pressTone) state.pressTone = Math.abs(state.pressTone * 0.8) < 0.5 ? 0 : state.pressTone * 0.8
  }
  generateGossip(state, rng)

  // Player of the Month in the user's league - a form king gets his gong
  if (state.week % 4 === 0 && state.week <= 36 && !state.unemployed) {
    const leagueId = state.clubs[state.userClubId].leagueId
    const cands = Object.values(state.players).filter(p =>
      p.clubId && state.clubs[p.clubId]?.leagueId === leagueId && p.stats.apps >= 3)
    const best = [...cands].sort((a, b) => b.form - a.form)[0]
    if (best && best.form >= 7) {
      best.morale = clamp(best.morale + 0.6, 1, 10)
      const ours = best.clubId === state.userClubId
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `Player of the Month: ${best.name}${ours ? ' 🏅' : ''}`,
        body: `${best.name} (${teamShort(state, best.clubId!)}) takes the ${state.comps[leagueId]?.short ?? 'league'} Player of the Month award${ours ? ' - one of yours! The dressing room applauds him in, and his chest is a little bigger for it.' : '.'}`,
        playerId: best.id,
      })
    }
  }
  aiTransfers(state, rng)
  aiRenewals(state, rng)
  if (!state.unemployed) aiPreContractPoach(state, rng)
  refreshVacancies(state, rng)

  // individual development focus: extra growth for up to 3 youngsters
  if (!state.unemployed) {
    for (const id of state.devFocus.slice(0, 3)) {
      const p = state.players[id]
      if (!p || p.clubId !== state.userClubId || p.age > 26) continue
      const boost = 0.1 + state.staff.assistant * 0.04
      if (p.ca < p.pa && rng() < boost) {
        p.ca += 1
        if (rng() < 0.6) {
          const keys = Object.keys(p.a) as (keyof typeof p.a)[]
          const k = keys[Math.floor(rng() * keys.length)]
          p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
      }
    }
  }

  // trim news
  if (state.news.length > 250) state.news = state.news.slice(-250)

  // advance
  if (state.week >= SEASON_WEEKS) {
    rebuildSeason(state)
  } else {
    state.week += 1
  }

  // derby on the horizon? whip up the build-up
  const nextFx = state.fixtures.find(f =>
    f.week === state.week && !f.played &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId))
  if (nextFx && isDerby(nextFx.homeId, nextFx.awayId)) {
    const oppId = nextFx.homeId === state.userClubId ? nextFx.awayId : nextFx.homeId
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `DERBY WEEK: ${derbyName(nextFx.homeId, nextFx.awayId)}`,
      body: `It's ${teamShort(state, oppId)} this weekend and the town can talk of nothing else. Tickets are gone, tempers will fray, and the form book means precisely nothing. Win this one and the board - and the pubs - will remember it.`,
    })
  }
}
