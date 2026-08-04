import type { GameState, Player, Pos } from './model'
import { boardObjective, emptyStats, fmtMoney, isWorldCupSeason, seasonLabel, XV_SLOTS } from './model'
import { assignPersonality } from './attributes'
import { buildChampionsCup, buildInternationals, buildLeague, schedulePreseason, sortTable } from './schedule'
import { punditPredictions } from './gossip'
import { CHALLENGES, LEAGUE_DEFS } from './newgame'
import { autoSelect } from './matchEngine'
import { ensureCaptains } from './analysis'
import { objectiveById, pickObjectives } from './objectives'
import { deriveAttrs, nextPid, playerValue, playerWage } from './attributes'
import { nationByCode, regenName } from './nations'
import { clamp, mulberry32, pick, type Rng } from './rng'

const ordinal = (n: number) =>
  n <= 0 ? '-' : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

function seasonAwards(state: GameState) {
  const userLeague = state.clubs[state.userClubId].leagueId
  const leaguePlayers = Object.values(state.players).filter(p =>
    p.clubId && state.clubs[p.clubId]?.leagueId === userLeague && p.stats.apps >= 8)
  if (!leaguePlayers.length) return
  const topPoints = [...leaguePlayers].sort((a, b) => b.stats.points - a.stats.points)[0]
  const topTries = [...leaguePlayers].sort((a, b) => b.stats.tries - a.stats.tries)[0]
  const potm = [...leaguePlayers].sort((a, b) =>
    b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))[0]
  const leagueName = state.comps[userLeague]?.name ?? 'the league'

  // Team of the Season: best average rating per position slot
  const used = new Set<number>()
  const tots: string[] = []
  for (const slot of XV_SLOTS) {
    const cands = leaguePlayers
      .filter(p => !used.has(p.id) && (p.pos === slot.pos || p.alt.includes(slot.pos)))
      .sort((a, b) => b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))
    if (cands[0]) { used.add(cands[0].id); tots.push(`${slot.shirt}. ${cands[0].name} (${state.clubs[cands[0].clubId!]?.short})`) }
  }

  // record-book lines
  const leagueFx = state.fixtures.filter(f => f.compId === userLeague && f.played && !f.stage)
  const biggest = leagueFx.sort((a, b) =>
    Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0]
  const bestAtt = leagueFx.sort((a, b) => (b.att ?? 0) - (a.att ?? 0))[0]

  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `📖 The ${seasonLabel(state.season)} Annual - awards & records`,
    body: [
      `Player of the Season: ${potm.name} (${state.clubs[potm.clubId!]?.short}) - avg rating ${(potm.stats.ratingSum / Math.max(1, potm.stats.apps)).toFixed(2)}`,
      `Top Points Scorer: ${topPoints.name} - ${topPoints.stats.points} points`,
      `Top Try Scorer: ${topTries.name} - ${topTries.stats.tries} tries`,
      biggest ? `Biggest win: ${state.clubs[biggest.homeId]?.short} ${biggest.homeScore}-${biggest.awayScore} ${state.clubs[biggest.awayId]?.short}` : '',
      bestAtt?.att ? `Best attendance: ${bestAtt.att.toLocaleString()} at ${state.clubs[bestAtt.homeId]?.stadium}` : '',
      '',
      `TEAM OF THE SEASON`,
      ...tots,
    ].filter(Boolean).join('\n'),
  })
}

/** The game's biggest individual prize: judged on the whole world's season,
 *  not one league - form first, with a nudge for tries and silverware. */
function worldPlayerOfTheYear(state: GameState) {
  const cands = Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.stats.apps >= 15)
    .map(p => {
      const avg = p.stats.ratingSum / p.stats.apps
      const cups = state.history.filter(h => h.season === state.season && h.champion === p.clubId).length
      // tries already lift match ratings, so the nudge here stays small -
      // any bigger and the podium is wingers only
      return { p, avg, score: avg + p.stats.tries * 0.004 + cups * 0.15 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  if (cands.length < 3) return
  const [win, second, third] = cands
  win.p.poty = (win.p.poty ?? 0) + 1
  ;(state.potyRoll ??= []).push({
    season: state.season, playerId: win.p.id, name: win.p.name,
    clubName: state.clubs[win.p.clubId!]?.name ?? 'Unknown',
  })
  const mine = (x: typeof win) => x.p.clubId === state.userClubId
  const line = (x: typeof win) =>
    `${x.p.name} (${x.p.pos}, ${state.clubs[x.p.clubId!]?.short}) - avg ${x.avg.toFixed(2)}, ${x.p.stats.tries} tries`
  state.news.push({
    id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
    subject: `🏅 World Player of the Year: ${win.p.name}`,
    body: [
      `The world game names its best. The shortlist:`,
      `1. ${line(win)}${(win.p.poty ?? 0) > 1 ? ` (award number ${win.p.poty})` : ''}`,
      `2. ${line(second)}`,
      `3. ${line(third)}`,
      mine(win) ? `He is YOURS. The whole sport just watched your man collect its biggest prize - enjoy the market circling him, because it starts tomorrow.`
        : mine(second) || mine(third) ? `One of yours made the podium. The scouts noticed; so did his agent.`
        : `The bar for next season is set.`,
    ].join('\n'),
    playerId: win.p.id,
  })
}

function settleRecords(state: GameState) {
  state.records ??= {}
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const teamSet = new Set(comp.teamIds)
    const pool = Object.values(state.players).filter(p => p.clubId && teamSet.has(p.clubId) && p.stats.apps >= 6)
    if (!pool.length) continue
    const topP = [...pool].sort((a, b) => b.stats.points - a.stats.points)[0]
    const topT = [...pool].sort((a, b) => b.stats.tries - a.stats.tries)[0]
    const rec = state.records[comp.id] ??= {
      pts: { name: topP.name, val: topP.stats.points, season: state.season },
      tries: { name: topT.name, val: topT.stats.tries, season: state.season },
    }
    const userLeague = state.clubs[state.userClubId]?.leagueId === comp.id
    if (topP.stats.points > rec.pts.val && rec.pts.season !== state.season) {
      if (userLeague) state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `📖 RECORD BROKEN: most points in a ${comp.short} season`,
        body: `${topP.name} finishes with ${topP.stats.points} points - beating ${rec.pts.name}'s record of ${rec.pts.val} (${seasonLabel(rec.pts.season)}). The record book gets a new page.`,
        playerId: topP.id,
      })
      state.records[comp.id].pts = { name: topP.name, val: topP.stats.points, season: state.season }
    }
    if (topT.stats.tries > rec.tries.val && rec.tries.season !== state.season) {
      if (userLeague) state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `📖 RECORD BROKEN: most tries in a ${comp.short} season`,
        body: `${topT.name} crosses ${topT.stats.tries} times - past ${rec.tries.name}'s ${rec.tries.val} (${seasonLabel(rec.tries.season)}). Wingers everywhere take note.`,
        playerId: topT.id,
      })
      state.records[comp.id].tries = { name: topT.name, val: topT.stats.tries, season: state.season }
    }
  }
}

function agePlayers(state: GameState, rng: Rng) {
  const retirees: Player[] = []
  for (const p of Object.values(state.players)) {
    p.age += 1
    // development / decline. The last few points are the hardest: growth
    // slows sharply near the top so the world's elite stay rare - without
    // this, every nation's best 23 converges on 99 by season 12
    const growth = (base: number) =>
      p.ca >= 94 ? (rng() < 0.4 ? 1 : 0)
      : p.ca >= 88 ? Math.max(1, Math.floor(base / 2))
      : base
    if (p.age <= 23 && p.ca < p.pa) p.ca = clamp(p.ca + growth(2 + Math.floor(rng() * 3)), 1, p.pa)
    else if (p.age <= 27 && p.ca < p.pa) p.ca = clamp(p.ca + growth(1 + Math.floor(rng() * 2)), 1, p.pa)
    else if (p.age >= 33) p.ca = clamp(p.ca - (2 + Math.floor(rng() * 3)), 30, 99)
    else if (p.age >= 31) p.ca = clamp(p.ca - (1 + Math.floor(rng() * 2)), 30, 99)
    // attribute drift toward new ca
    const scale = p.ca / Math.max(30, p.q0)
    if (Math.abs(scale - 1) > 0.05) {
      for (const k of Object.keys(p.a) as (keyof Player['a'])[]) {
        p.a[k] = clamp(Math.round(p.a[k] * (0.85 + 0.15 * scale) + (scale > 1 ? 0.5 : -0.5)), 1, 20)
      }
    }
    // retirement
    const retireChance = p.farewell || p.retiring ? 1 // he said it was the last dance, and he meant it
      : p.age >= 38 ? 1 : p.age >= 36 ? 0.6 : p.age >= 34 ? (p.ca < 72 ? 0.45 : 0.2) : p.age >= 33 && p.ca < 60 ? 0.3 : 0
    if (rng() < retireChance) retirees.push(p)
    p.value = playerValue(p.ca, p.age, p.pa)
  }
  // graduation: at 22 you're too old for the academy; AI clubs also
  // promote anyone who is clearly ready
  for (const p of Object.values(state.players)) {
    if (!p.acad) continue
    if (p.age >= 22 || (p.clubId !== state.userClubId && p.ca >= 62)) {
      p.acad = false
      p.debutPending = p.stats.apps === 0 && p.career.length === 0 ? 'academy' : null
      if (p.clubId === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `${p.name} graduates to the first-team squad`,
          body: `Too old for the academy, ready or not: ${p.name} (${p.age}) moves up to full first-team training. Time to sink or swim.`,
          playerId: p.id,
        })
      }
    }
  }

  const userRetirees = retirees.filter(p => p.clubId === state.userClubId)
  for (const p of retirees) {
    // the record book: 100+ appearances for a club earns a page in it
    const byClub = new Map<string, { apps: number; tries: number; pts: number }>()
    for (const c of p.career) {
      const e = byClub.get(c.clubId) ?? { apps: 0, tries: 0, pts: 0 }
      e.apps += c.apps; e.tries += c.tries; e.pts += c.points
      byClub.set(c.clubId, e)
    }
    for (const [clubId, tot] of byClub) {
      const club = state.clubs[clubId]
      if (!club || tot.apps < 100) continue
      club.legends = [...(club.legends ?? []), { name: p.name, ...tot }]
        .sort((a, b) => b.apps - a.apps).slice(0, 25)
    }

    // the Hall of Fame: a career that will be talked about forever
    const tApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const tTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const tPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    const peakCa = Math.max(p.ca, p.q0, p.ca0 ?? 0)
    if ((peakCa >= 85 && (tApps >= 350 || tTries >= 150 || tPts >= 2200)) || tApps >= 470 || tTries >= 190 || tPts >= 3000) {
      const score = (h: { apps: number; tries: number; points: number }) => h.apps + h.tries * 2 + h.points / 10
      state.hof = [...(state.hof ?? []), {
        name: p.name, pos: p.pos, nat: p.nat,
        apps: tApps, tries: tTries, points: tPts,
        season: state.season, club: state.clubs[p.clubId ?? '']?.short ?? '-',
      }].sort((a, b) => score(b) - score(a)).slice(0, 50)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `🏛 ${p.name} enters the Hall of Fame`,
        body: `${p.name} retires with numbers that close the argument: ${tApps} appearances, ${tTries} tries, ${tPts} points. ${p.clubId === state.userClubId ? 'He finishes as one of yours - a career your club will claim for generations.' : 'The game stands to applaud one of its greats.'} His plaque goes up alongside the immortals.`,
      })
    }
  }
  for (const p of retirees) {
    const clubId = p.clubId
    if (clubId) {
      const c = state.clubs[clubId]
      c.players = c.players.filter(id => id !== p.id)
    }
    delete state.players[p.id]
    // FM-style rebirth: a notable retiree respawns as an academy newgen
    // of similar potential at the same club, under a new name
    const peak = Math.max(p.ca, p.q0)
    if (clubId && peak >= 78 && state.clubs[clubId]) {
      const club = state.clubs[clubId]
      const q = 42 + Math.floor(rng() * 14)
      const raw = {
        name: regenName(rng, p.nat in { ENG:1, FRA:1, IRE:1, SCO:1, WAL:1, ITA:1, NZL:1, AUS:1, RSA:1, ARG:1, FIJ:1, SAM:1, TGA:1, JPN:1, GEO:1 } ? p.nat : club.country),
        pos: p.pos, age: 17 + Math.floor(rng() * 2), nat: p.nat, q,
        gk: p.gk && rng() < 0.6,
      }
      const a = deriveAttrs(raw, state.seed + p.id * 7 + 3)
      const heir: Player = {
        id: nextPid(),
        name: raw.name, pos: p.pos, alt: [...p.alt], age: raw.age, nat: p.nat, clubId,
        a,
        ca: q, pa: clamp(peak + Math.floor(rng() * 9) - 4, q + 10, 99), q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 650, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: clubId === state.userClubId ? 100 : 15,
      }
      heir.value = playerValue(heir.ca, heir.age, heir.pa)
      state.players[heir.id] = heir
      club.players.push(heir.id)
      if (clubId === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `Academy buzz: the next ${p.name.split(' ').slice(-1)[0]}?`,
          body: `${heir.name}, a ${heir.age}-year-old ${heir.pos}, has joined the academy - and the coaches whisper he has everything ${p.name} had at that age. Handle with care.`,
          playerId: heir.id,
        })
      }
    }
  }
  if (userRetirees.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'general', read: false,
      subject: 'Retirements',
      body: `Hanging up the boots: ${userRetirees.map(p => `${p.name} (${p.age})`).join(', ')}. The dressing room won't be the same.`,
    })
    // the send-offs: a farewell-season man gets his shirt retired (his
    // testimonial already happened in pre-season); a surprise retiree
    // with the same service gets the one-off ceremony instead
    const legend = userRetirees
      .map(p => ({ p, apps: clubServiceApps(state, p) }))
      .filter(x => x.apps >= 150)
      .sort((a, b) => b.apps - a.apps)[0]
    if (legend) {
      const club = state.clubs[state.userClubId]
      for (const id of club.players) {
        const tm = state.players[id]
        if (tm) tm.morale = clamp(tm.morale + 0.4, 1, 10)
      }
      if (legend.p.farewell) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🎗 The shirt goes up: ${legend.p.name} retires`,
          body: `The farewell tour is over. ${legend.p.name} finishes with ${legend.apps} appearances for the club, and this morning his shirt went up over the tunnel where every young player will walk under it. The game moves on; days like his are why it matters.`,
        })
      } else {
        const gate = Math.round(club.capacity * 32)
        club.balance += gate
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🎗 Testimonial: ${legend.p.name} - ${legend.apps} games of service`,
          body: `A full ${club.stadium} rises for ${legend.p.name}. ${legend.apps} appearances, every one of them honest. He walks the pitch with his family, the gate receipts (${fmtMoney(gate)}) go to the club at his insistence, and his shirt goes up over the tunnel. Days like this are why the game matters.`,
        })
      }
    }
  }
}

/** Appearances in this club's shirt: seasons played here plus current-season
 *  apps, plus pre-2025 service for men who have never played anywhere else. */
function clubServiceApps(state: GameState, p: Player): number {
  const clubId = state.userClubId
  const here = p.career.filter(c => c.clubId === clubId).reduce((s, c) => s + c.apps, 0) + p.stats.apps
  const oneClub = p.career.every(c => c.clubId === clubId)
  const pre = oneClub ? Math.max(0, (p.hist?.apps ?? 0) - (p.exApps ?? 0)) : 0
  return here + pre
}

function handleContracts(state: GameState, rng: Rng) {
  // pre-contracts go through first: the moves were agreed in the spring
  for (const pc of state.preContracts ?? []) {
    const p = state.players[pc.playerId]
    const to = state.clubs[pc.toClubId]
    if (!p || !to || p.clubId === pc.toClubId) continue
    const from = p.clubId ? state.clubs[p.clubId] : null
    if (from) {
      from.players = from.players.filter(id => id !== p.id)
      from.tactic.lineup = from.tactic.lineup.map(id => (id === p.id ? null : id))
      if (from.captain === p.id) from.captain = null
      if (from.vice === p.id) from.vice = null
    }
    to.players.push(p.id)
    p.clubId = to.id
    p.wage = Math.round((playerWage(p.ca, p.age) * 1.1) / 50) * 50
    p.contractEnds = state.season + 1 + (p.age < 30 ? 2 : 1)
    p.morale = clamp(p.morale + 1, 1, 10)
    p.transferListed = false
    p.debutPending = 'signing'
    if (to.id === state.userClubId) { p.sc = 100; state.mgr.signings += 1 }
    if (to.id === state.userClubId || from?.id === state.userClubId) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'transfer', read: false,
        subject: `${p.name} joins ${to.name} on a free`,
        body: `The pre-contract agreed in the spring goes through: ${p.name} arrives at ${to.name} for nothing, on ${fmtMoney(p.wage)}/week until ${2026 + p.contractEnds}. ${from ? `${from.short} watch a ${fmtMoney(p.value)} asset walk out the door.` : ''}`,
        playerId: p.id,
      })
    }
  }
  state.preContracts = []

  const freed: Player[] = []
  for (const p of Object.values(state.players)) {
    if (p.clubId && p.contractEnds < state.season + 1) {
      const club = state.clubs[p.clubId]
      if (p.clubId !== state.userClubId && rng() < 0.5) {
        // quiet AI renewal
        p.contractEnds = state.season + 2
        p.wage = playerWage(p.ca, p.age)
        continue
      }
      // the DoR's safety net: settled squad men take the standard one-year
      // extension rather than walking - the unhappy and the listed still go
      if (p.clubId === state.userClubId && !p.transferListed && p.morale >= 4.5 && rng() < 0.7) {
        p.contractEnds = state.season + 1
        p.wage = playerWage(p.ca, p.age)
        continue
      }
      club.players = club.players.filter(id => id !== p.id)
      if (p.clubId === state.userClubId) freed.push(p)
      p.clubId = null
      p.transferListed = false
    }
  }
  if (freed.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'contract', read: false,
      subject: 'Contracts expired',
      body: `Departed on free transfers after their deals expired: ${freed.map(p => p.name).join(', ')}.`,
    })
  }
}

const YOUTH_POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']

/** Deep rugby nations produce slightly better kids: without this, national
 *  pecking order converges to who has the most domestic clubs. */
function natTalentBonus(country: string): number {
  const rep = nationByCode(country)?.rep ?? 70
  return Math.floor((rep - 70) / 6)
}

/** Roll the user's next academy class. Fixed at the week-30 preview so the
 *  coach's forecast and intake day always tell the same story. */
export function rollIntakeClass(state: GameState, rng: Rng): NonNullable<GameState['intakeClass']> {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  const coe = state.facilities?.academy ?? 0
  const n = 2 + Math.floor(rng() * 3)
  const out: NonNullable<GameState['intakeClass']> = []
  for (let i = 0; i < n; i++) {
    const pos = pick(rng, YOUTH_POS)
    const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12) + coe * 2 + natTalentBonus(club.country)
    // roughly one club a season unearths a genuine wonderkid - a Centre
    // of Excellence tilts the odds your way
    const wonder = rng() < 0.085 + coe * 0.02
    out.push({
      name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country),
      pos, age: 17 + Math.floor(rng() * 2), q,
      pa: wonder ? clamp(87 + Math.floor(rng() * 13), q + 20, 99) : clamp(q + 12 + Math.floor(rng() * rng() * 30), q, 99),
      gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      wonder,
    })
  }
  return out
}

const paStars = (pa: number) => pa >= 88 ? 5 : pa >= 80 ? 4 : pa >= 71 ? 3 : pa >= 62 ? 2 : 1

function youthIntake(state: GameState, rng: Rng) {
  // the user's class was fixed at the week-30 preview - deliver it verbatim,
  // with the report card the plain arrival note never was
  const userClub = state.clubs[state.userClubId]
  if (userClub) {
    const spec = state.intakeClass?.length ? state.intakeClass : rollIntakeClass(state, rng)
    const report: string[] = []
    spec.forEach((s, i) => {
      const raw = { name: s.name, pos: s.pos, age: s.age, nat: userClub.country, q: s.q, gk: s.gk }
      const a = deriveAttrs(raw, state.seed + state.season * 977 + i)
      const p: Player = {
        id: nextPid(),
        name: s.name, pos: s.pos, alt: [], age: s.age, nat: userClub.country, clubId: userClub.id,
        a,
        ca: s.wonder ? clamp(s.q + 8, 1, 78) : s.q,
        pa: s.pa,
        q0: s.q,
        intl: false, gk: s.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: 100,
      }
      p.value = playerValue(p.ca, p.age, p.pa)
      state.players[p.id] = p
      userClub.players.push(p.id)
      report.push(`${'★'.repeat(paStars(s.pa))}${'☆'.repeat(5 - paStars(s.pa))} ${p.name} - ${p.pos}, ${p.age}`)
      if (s.wonder) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `🌟 WONDERKID: the academy has struck gold`,
          body: `The coaches are calling ${p.name} (${p.age}, ${p.pos}) the best prospect the academy has produced in a generation. Handle him right - game time, a development focus, patience - and he could be anything.`,
          playerId: p.id,
        })
      }
    })
    const best = Math.max(0, ...spec.map(s => s.pa))
    const grade = best >= 96 ? 'A' : best >= 90 ? 'B' : best >= 82 ? 'C' : best >= 74 ? 'D' : 'E'
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: `🎓 Intake day: the class arrives - grade ${grade}`,
      body: [
        `The academy has promoted this year's crop. The coaches' potential ratings:`,
        ...report,
        grade === 'A' ? `A vintage year. Protect them from the vultures and this class will define the club.`
          : grade === 'B' ? `A strong group - at least one of these boys should make the first team his own.`
          : grade === 'C' ? `A decent, honest class. Squad players, with a chance one over-delivers.`
          : grade === 'D' ? `A thin year. The coaches are already talking about next season's group.`
          : `A year to forget. The academy coach has asked that nobody frame this list.`,
      ].join('\n'),
    })
    state.intakeClass = null
  }

  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    const n = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      const pos = pick(rng, YOUTH_POS)
      const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12) + natTalentBonus(club.country)
      const raw = {
        name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country),
        pos, age: 17 + Math.floor(rng() * 2), nat: club.country, q,
        gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      }
      const a = deriveAttrs(raw, state.seed + state.season * 977 + i)
      const wonder = rng() < 0.085
      const p: Player = {
        id: nextPid(),
        name: raw.name, pos, alt: [], age: raw.age, nat: raw.nat, clubId: club.id,
        a,
        ca: wonder ? clamp(q + 8, 1, 78) : q,
        pa: wonder ? clamp(87 + Math.floor(rng() * 13), q + 20, 99) : clamp(q + 12 + Math.floor(rng() * rng() * 30), q, 99),
        q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: 15,
      }
      p.value = playerValue(p.ca, p.age, p.pa)
      state.players[p.id] = p
      club.players.push(p.id)
    }
  }
  // a few unattached young gems drift into the free-agent pool each season
  for (let i = 0; i < 3; i++) {
    const nats = ['FIJ', 'GEO', 'TGA', 'SAM', 'USA', 'URU']
    const nat = pick(rng, nats)
    const pos = pick(rng, YOUTH_POS)
    const q = 54 + Math.floor(rng() * 12)
    const raw = { name: regenName(rng, nat), pos, age: 18 + Math.floor(rng() * 3), nat, q, gk: rng() < 0.15 }
    const a = deriveAttrs(raw, state.seed + state.season * 3011 + i)
    const p: Player = {
      id: nextPid(),
      name: raw.name, pos, alt: [], age: raw.age, nat, clubId: null,
      a, ca: q, pa: clamp(84 + Math.floor(rng() * 14), q + 12, 99), q0: q,
      intl: false, gk: !!raw.gk,
      form: 6, morale: 7, cond: 100, sharp: 50,
      injury: null, bans: 0, natSquad: false,
      wage: 900, contractEnds: state.season, value: 0,
      stats: emptyStats(), career: [], transferListed: false, youth: true,
      pers: assignPersonality(rng, a), sc: 10,
    }
    p.value = playerValue(p.ca, p.age, p.pa)
    state.players[p.id] = p
  }
}

/** Any club left short of bodies signs free agents (board-driven squad fillers). */
function replenishSquads(state: GameState, rng: Rng) {
  const freeAgents = () => Object.values(state.players)
    .filter(p => !p.clubId && p.age <= 34)
    .sort((a, b) => b.ca - a.ca)
  for (const club of Object.values(state.clubs)) {
    let guard = 0
    while (club.players.length < 26 && guard++ < 25) {
      // biggest positional hole
      const byPos: Record<string, number> = {}
      for (const id of club.players) {
        const p = state.players[id]
        if (p) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
      }
      const need = YOUTH_POS.find(pos => (byPos[pos] ?? 0) < 2) ?? pick(rng, YOUTH_POS)
      const fa = freeAgents().find(p => p.pos === need || p.alt.includes(need)) ?? freeAgents()[0]
      if (!fa) {
        // the market is bare - register an academy scholar instead
        const raw = {
          name: regenName(rng, club.country), pos: need,
          age: 18 + Math.floor(rng() * 2), nat: club.country,
          q: clamp(40 + Math.floor(rng() * 12) + Math.floor(club.rep / 14), 38, 62),
          gk: (need === 'FH' || need === 'FB') && rng() < 0.3,
        }
        const a2 = deriveAttrs(raw, state.seed + state.season * 131 + club.players.length * 7)
        const kid: Player = {
          id: nextPid(), name: raw.name, pos: raw.pos, alt: [], age: raw.age, nat: raw.nat,
          clubId: club.id, a: a2, ca: raw.q, pa: clamp(raw.q + 15 + Math.floor(rng() * 20), raw.q, 99),
          q0: raw.q, intl: false, gk: !!raw.gk, form: 6, morale: 7, cond: 100, sharp: 55,
          injury: null, bans: 0, natSquad: false, wage: 600, contractEnds: state.season + 3,
          value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
          pers: assignPersonality(rng, a2), sc: club.id === state.userClubId ? 100 : 15,
        }
        kid.value = playerValue(kid.ca, kid.age, kid.pa)
        state.players[kid.id] = kid
        club.players.push(kid.id)
        continue
      }
      fa.clubId = club.id
      fa.wage = playerWage(fa.ca, fa.age)
      fa.contractEnds = state.season + 1
      fa.morale = 7
      club.players.push(fa.id)
      if (club.id === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
          subject: `Board signing: ${fa.name}`,
          body: `With the squad short of numbers, the board moved to sign free agent ${fa.name} (${fa.pos}, ${fa.age}) on a one-year deal.`,
          playerId: fa.id,
        })
      }
    }
  }
}

/** The year's best moment, replayed: the try judged most dramatic at the
 *  whistle all season gets its own award night, commentary line and all. */
function tryOfTheSeason(state: GameState) {
  // note: the ledger is not cleared here - the season review captures it
  // further down rebuildSeason, and the clear happens at the very end
  const t = state.tryOfSeason
  if (!t || t.season !== state.season) return
  const scorer = state.players[t.playerId]
  const club = state.clubs[state.userClubId]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `🏉 Try of the Season: ${t.name}`,
    body: [
      `The supporters' vote was not close. ${t.name}'s ${ordinal(t.min)}-minute score against ${t.opp} is the ${club.name} Try of the Season.`,
      `As it sounded at the time: "${t.text}"`,
      scorer && scorer.clubId === state.userClubId
        ? `He collects the award at the end-of-season dinner to the loudest cheer of the night.`
        : `He is not at the club to collect it, which makes the ovation longer, not shorter.`,
    ].join('\n'),
    playerId: t.playerId,
  })
}

/** Full end-of-season rollover into a fresh campaign. */
export function rebuildSeason(state: GameState) {
  const rng = mulberry32(state.seed ^ ((state.season + 1) * 60013))

  seasonAwards(state)
  tryOfTheSeason(state)
  worldPlayerOfTheYear(state)
  settleRecords(state)

  // the union's annual review: the Test job answers to somebody too
  if (state.natTeam && state.natConfidence != null) {
    const nat = state.natTeam
    const natFx = state.fixtures.filter(f => f.played && (f.homeId === nat || f.awayId === nat) &&
      !state.clubs[f.homeId] && !state.clubs[f.awayId])
    let w = 0, l = 0
    for (const f of natFx) {
      const us = f.homeId === nat ? f.homeScore : f.awayScore
      const them = f.homeId === nat ? f.awayScore : f.homeScore
      if (us > them) w++
      else if (us < them) l++
    }
    const conf = Math.round(state.natConfidence)
    if (conf < 28) {
      state.natTeam = null
      state.natConfidence = null
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `🌍 SACKED: ${nat} relieve you of the national job`,
        body: `The union's annual review was short. ${w} Test wins against ${l} defeats was not the trajectory they hired you for, and the ${nat} job is no longer yours. The club work continues - and unions have short memories when results turn.`,
      })
    } else {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `🌍 Union annual review: ${conf >= 70 ? 'glowing' : conf >= 45 ? 'satisfactory' : 'concerned'}`,
        body: [
          `The ${nat} union has completed its annual review of the national programme: ${w} Test wins, ${l} defeats this season. Confidence in the head coach stands at ${conf}%.`,
          conf >= 70 ? `They are already talking about extending your tenure.`
            : conf >= 45 ? `Steady as she goes - but unions measure everything in World Cups.`
            : `The knives are not out yet, but the drawer is open. The next window matters.`,
        ].join(' '),
      })
      // summers soften opinions a little, in both directions - but they do
      // not launder a losing record
      state.natConfidence = clamp(state.natConfidence * 0.9 + 55 * 0.1, 0, 100)
    }
  }

  // the manager's season in review - a proper full-time moment
  if (!state.unemployed) {
    const uid = state.userClubId
    const uf = state.fixtures.filter(f => f.played && (f.homeId === uid || f.awayId === uid))
    let w = 0, d = 0, l = 0
    let best: { diff: number; line: string } | null = null
    for (const f of uf) {
      const us = f.homeId === uid ? f.homeScore : f.awayScore
      const them = f.homeId === uid ? f.awayScore : f.homeScore
      if (us > them) w++; else if (us < them) l++; else d++
      const diff = us - them
      if (us > them && (!best || diff > best.diff)) {
        best = { diff, line: `${state.clubs[f.homeId]?.short ?? f.homeId} ${f.homeScore}-${f.awayScore} ${state.clubs[f.awayId]?.short ?? f.awayId}` }
      }
    }
    const squad = state.clubs[uid].players.map(id => state.players[id]).filter(Boolean)
    const topPts = [...squad].sort((a, b) => b.stats.points - a.stats.points)[0]
    const topTry = [...squad].sort((a, b) => b.stats.tries - a.stats.tries)[0]
    let predLine = ''
    const predicted = state.preds?.[uid]
    const myComp = state.comps[state.clubs[uid].leagueId]
    const actualPos = myComp ? sortTable(myComp.table).findIndex(r => r.teamId === uid) + 1 : 0
    if (predicted && myComp && actualPos > 0) {
      predLine = `Pundits predicted ${actualPos < predicted ? `${ordinal(predicted)} - you finished ${ordinal(actualPos)}. They owe you an apology.`
        : actualPos === predicted ? `${ordinal(predicted)} - and ${ordinal(actualPos)} it was. Read like a book.`
        : `${ordinal(predicted)} - you finished ${ordinal(actualPos)}. The phone-ins will be brutal.`}`
    }

    // structured snapshot for the one-page Season Review screen
    const leagueFx = uf.filter(f => f.compId === state.clubs[uid].leagueId && !f.stage)
    let lw = 0, ld = 0, ll = 0
    for (const f of leagueFx) {
      const us = f.homeId === uid ? f.homeScore : f.awayScore
      const them = f.homeId === uid ? f.awayScore : f.homeScore
      if (us > them) lw++; else if (us < them) ll++; else ld++
    }
    const stageRank: Record<string, number> = { BAR: 0, R16: 1, QF: 2, SF: 3, F: 4 }
    const stageWord: Record<string, string> = { BAR: 'playoff barrage', R16: 'last-16 exit', QF: 'quarter-final exit', SF: 'semi-final exit', F: 'Runners-up' }
    const cupRuns: { comp: string; result: string }[] = []
    for (const comp of Object.values(state.comps)) {
      if (comp.type === 'league') continue
      const mine = state.fixtures.filter(f => f.compId === comp.id && f.played && (f.homeId === uid || f.awayId === uid))
      if (!mine.length || !state.clubs[mine[0].homeId]) continue
      const ko = mine.filter(f => f.stage).sort((a, b) => (stageRank[a.stage!] ?? 0) - (stageRank[b.stage!] ?? 0))
      const last = ko[ko.length - 1]
      let result = 'Pool stages'
      if (last) {
        const won = last.homeId === uid ? last.homeScore > last.awayScore : last.awayScore > last.homeScore
        result = last.stage === 'F' && won ? '🏆 CHAMPIONS' : stageWord[last.stage!] ?? `${last.stage} exit`
      }
      cupRuns.push({ comp: comp.short, result })
    }
    const rated0 = squad.filter(p => p.stats.apps >= 8)
      .map(p => ({ p, avg: p.stats.ratingSum / Math.max(1, p.stats.apps) }))
      .sort((a, b) => b.avg - a.avg)[0]
    // the summer verdict from the terraces: silverware and overachievement
    // carry into next season's mood; a flop resets the goodwill
    const trophyCount = state.history.filter(h => h.season === state.season && h.champion === uid).length
    let moodShift = trophyCount * 18
    if (predicted && actualPos > 0) moodShift += (predicted - actualPos) * 3
    state.fanMood = clamp((state.fanMood ?? 60) * 0.6 + 55 * 0.4 + moodShift, 10, 95)

    const club0 = state.clubs[uid]
    state.review = {
      season: state.season,
      clubName: club0.name,
      league: { name: myComp?.name ?? '', pos: actualPos, predicted, w: lw, d: ld, l: ll },
      overall: { w, d, l, m: uf.length, bestWin: best?.line },
      cups: cupRuns,
      topPoints: topPts?.stats.points ? { name: topPts.name, val: topPts.stats.points } : undefined,
      topTries: topTry?.stats.tries ? { name: topTry.name, val: topTry.stats.tries } : undefined,
      bestAvg: rated0 ? { name: rated0.p.name, val: Math.round(rated0.avg * 100) / 100 } : undefined,
      tryOfSeason: state.tryOfSeason && state.tryOfSeason.season === state.season
        ? { name: state.tryOfSeason.name, min: state.tryOfSeason.min, opp: state.tryOfSeason.opp }
        : undefined,
      balanceDelta: club0.balance - (state.finHist?.[0]?.b ?? club0.balance),
      confidence: club0.boardConfidence,
      trophies: state.history.filter(h => h.season === state.season && h.champion === uid).map(h => state.comps[h.compId]?.name ?? h.compId),
    }
    // the annals: the career chronicle, one entry per season, oldest first
    ;(state.annals ??= []).push(state.review)
    if (state.annals.length > 30) state.annals = state.annals.slice(-30)

    // the era: anniversaries are marked, and long loyal service with
    // silverware makes you part of the club's furniture forever
    {
      const tenure = state.season - (state.tenureStart ?? state.season) + 1
      const era = (state.annals ?? []).filter(a => a.clubName === club0.name).slice(-tenure)
      const eraW = era.reduce((s, a) => s + a.overall.w, 0)
      const eraL = era.reduce((s, a) => s + a.overall.l, 0)
      const eraCups = era.reduce((s, a) => s + a.trophies.length, 0)
      if ([5, 10, 15, 20, 25].includes(tenure)) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🎉 ${tenure} years at ${club0.name}`,
          body: `The club marks your ${tenure}th season in charge: ${eraW} wins, ${eraL} defeats and ${eraCups} ${eraCups === 1 ? 'trophy' : 'trophies'} in the era. The programme runs a retrospective; the chairman makes a speech; the fixture list, as ever, does not care. On we go.`,
        })
      }
      state.legendOf ??= []
      if (tenure >= 8 && eraCups >= 3 && !state.legendOf.includes(club0.id)) {
        state.legendOf.push(club0.id)
        state.fanMood = clamp((state.fanMood ?? 60) + 10, 5, 98)
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🗽 CLUB LEGEND: the city claims you as its own`,
          body: `${tenure} seasons. ${eraCups} trophies. The supporters' trust has voted unanimously: you are a legend of ${club0.name}, whatever happens from here. There is talk of a statue outside ${club0.stadium}, and the artist has already asked how you would like to be posed. Results can dip; this cannot be taken away.`,
        })
      }
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `📋 Your ${seasonLabel(state.season)} season in review`,
      body: [
        `Record: ${w}W ${d}D ${l}L from ${uf.length} matches.`,
        best ? `Best win: ${best.line}` : '',
        topPts?.stats.points ? `Top points: ${topPts.name} (${topPts.stats.points})` : '',
        topTry?.stats.tries ? `Top tries: ${topTry.name} (${topTry.stats.tries})` : '',
        predLine,
      ].filter(Boolean).join('\n'),
    })

    // the end-of-season awards dinner - black tie, white wine, in-jokes
    const rated = squad.filter(p => p.stats.apps >= 8)
    if (rated.length >= 3) {
      const avgR = (p: Player) => p.stats.ratingSum / Math.max(1, p.stats.apps)
      const poty = [...rated].sort((a, b) => avgR(b) - avgR(a))[0]
      const young = [...rated].filter(p => p.age <= 22).sort((a, b) => avgR(b) - avgR(a))[0]
      const tryKing = [...rated].sort((a, b) => b.stats.tries - a.stats.tries)[0]
      for (const w of [poty, young, tryKing]) {
        if (w) w.morale = clamp(w.morale + 0.8, 1, 10)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `🥂 Club awards night: ${poty.name} sweeps the room`,
        body: [
          `The season ends the way it should - the whole squad in one room, telling lies about each other.`,
          ``,
          `Player of the Season: ${poty.name} (avg ${avgR(poty).toFixed(2)})`,
          young ? `Young Player of the Season: ${young.name} (${young.age})` : '',
          tryKing.stats.tries > 0 ? `Top Try Scorer: ${tryKing.name} (${tryKing.stats.tries})` : '',
        ].filter(Boolean).join('\n'),
        playerId: poty.id,
      })
    }
  }

  // board verdict on the season vs their stated objective
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    const comp = state.comps[club.leagueId]
    if (comp) {
      const pos = sortTable(comp.table).findIndex(r => r.teamId === club.id) + 1
      state.mgr.finishes.push({ season: state.season, leagueId: club.leagueId, pos })
      const obj = boardObjective(club.rep)
      const wonLeague = comp.champion === club.id
      const met = wonLeague || (pos > 0 && pos <= obj.pos)
      club.boardConfidence = clamp(club.boardConfidence + (wonLeague ? 25 : met ? 12 : -14), 5, 100)
      // secondary objectives: side quests with real consequences
      const sideLines: string[] = []
      for (const id of state.objectives ?? []) {
        const def = objectiveById(id)
        if (!def || !def.applies(state)) continue
        const ok = def.met(state)
        club.boardConfidence = clamp(club.boardConfidence + (ok ? 5 : -4), 5, 100)
        if (ok) { club.budget += 250_000; state.boardOwed = true }
        sideLines.push(`${ok ? '✅' : '❌'} ${def.text(state)}${ok ? ' - met (+£250k budget)' : ' - missed'}`)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: met ? 'Board delighted with the season' : 'Board verdict: not good enough',
        body: `The objective was to ${obj.text}. You finished ${ordinal(pos)}${wonLeague ? ' and won the title' : ''}. ${met
          ? 'The chairman shakes your hand warmly - keep building.'
          : 'The chairman expects markedly better next season.'}${sideLines.length ? '\n\n' + sideLines.join('\n') : ''}`,
      })
    }
  }

  // prize money & budget refresh (uses final tables before wipe)
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const order = sortTable(comp.table).map(r => r.teamId)
    order.forEach((teamId, idx) => {
      const club = state.clubs[teamId]
      if (!club) return
      const prize = Math.max(0, (order.length - idx)) * 120_000 + (comp.champion === teamId ? 1_500_000 : 0)
      club.balance += prize
    })
  }

  // bums on seats: clubs that keep selling out build bigger stands
  for (const club of Object.values(state.clubs)) {
    const home = state.fixtures.filter(f => f.played && f.homeId === club.id && f.att)
    if (home.length < 5 || club.capacity >= 82_000) continue
    const avg = home.reduce((sum, f) => sum + (f.att ?? 0), 0) / home.length
    if (avg / club.capacity < 0.93 || rng() > 0.4) continue // boards dither
    const add = Math.round((club.capacity * (0.04 + rng() * 0.06)) / 100) * 100
    const cost = add * 1_400
    if (add < 100 || club.balance < cost * 2) continue
    club.balance -= cost
    club.capacity += add
    if (club.id === state.userClubId) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `🏗 ${club.stadium} to grow - ${add.toLocaleString()} new seats`,
        body: `Full houses all season have convinced the board. Diggers arrive this summer: capacity rises to ${club.capacity.toLocaleString()} at a cost of ${fmtMoney(cost)}. Keep winning and we'll fill that too.`,
      })
    }
  }

  // archive player season -> career
  for (const p of Object.values(state.players)) {
    if (p.stats.apps > 0 && p.clubId) {
      p.career.push({ season: state.season, clubId: p.clubId, apps: p.stats.apps, tries: p.stats.tries, points: p.stats.points })
      if (p.career.length > 20) p.career = p.career.slice(-20)
    }
    p.stats = emptyStats()
    p.form = 6
    p.morale = clamp(p.morale, 5, 10)
    p.cond = 100
    p.sharp = 60
    p.injury = null
    p.specialist = false
    p.bans = 0
    p.rust = 0
    p.natSquad = false
    if (p.onLoan) {
      // back from a season of first-team rugby elsewhere
      p.onLoan = false
      if (p.ca < p.pa) p.ca = clamp(p.ca + 2 + Math.floor(mulberry32(state.seed + p.id)() * 3), 1, p.pa)
      if (p.clubId === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `${p.name} returns from loan`,
          body: `A season of regular rugby has done ${p.name} the world of good. He reports back noticeably sharper.`,
          playerId: p.id,
        })
      }
    }
    p.ca0 = p.ca
  }
  state.natSquads = {}
  state.natLineup = null

  agePlayers(state, rng)
  handleContracts(state, rng)
  youthIntake(state, rng)
  replenishSquads(state, rng)

  // AI squads shed their surplus every summer: intake adds more bodies
  // than retirement removes, and without a clear-out the median squad
  // drifts from 33 to 43+ over a decade. Weakest seniors are released
  // into the free-agent pool (which is pruned just below).
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId || club.players.length <= 46) continue
    const releasable = club.players
      .map(id => state.players[id])
      .filter((p): p is Player => !!p && !p.acad && p.age >= 21 && !p.onLoan && !p.loanFrom)
      .sort((a, b) => a.ca - b.ca)
    for (const p of releasable) {
      if (club.players.length <= 44) break
      club.players = club.players.filter(id => id !== p.id)
      club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
      if (club.captain === p.id) club.captain = null
      if (club.vice === p.id) club.vice = null
      p.clubId = null
      p.transferListed = false
    }
  }

  // keep the free-agent pool from growing without bound over long careers
  const fas = Object.values(state.players)
    .filter(p => !p.clubId)
    .sort((a, b) => b.ca - a.ca)
  for (const p of fas.slice(120)) delete state.players[p.id]
  for (const p of fas.slice(0, 120)) if (p.age >= 35) delete state.players[p.id]

  // Promotion & relegation between each top flight and its second tier
  const PYRAMID: [string, string, string][] = [
    ['prem', 'champ', 'the Premiership'],
    ['champ', 'natl1', 'the Championship'],
    ['top14', 'prod2', 'the Top 14'],
  ]
  for (const [topId, lowId, topName] of PYRAMID) {
    const topComp = state.comps[topId]
    const lowComp = state.comps[lowId]
    if (!topComp || !lowComp) continue
    const topOrder = sortTable(topComp.table).map(r => r.teamId)
    const down = topOrder[topOrder.length - 1]
    const up = lowComp.champion ?? sortTable(lowComp.table)[0]?.teamId
    if (!down || !up || down === up || !state.clubs[down] || !state.clubs[up]) continue
    state.clubs[down].leagueId = lowId
    state.clubs[down].rep = Math.max(44, state.clubs[down].rep - 4)
    state.clubs[up].leagueId = topId
    state.clubs[up].rep = Math.min(88, state.clubs[up].rep + 5)
    if (up === state.userClubId) {
      state.celebration = {
        headline: `PROMOTED - ${state.clubs[up].short.toUpperCase()} ARE GOING UP`,
        sub: `Welcome to ${topName} · ${state.managerName}`,
        icon: '🎉',
      }
    }
    const userInvolved = down === state.userClubId || up === state.userClubId
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: userInvolved ? 'board' : 'general', read: false,
      subject: down === state.userClubId
        ? `💔 RELEGATED: ${state.clubs[down].name} go down`
        : up === state.userClubId
          ? `🎉 PROMOTED: ${state.clubs[up].name} are going up!`
          : `Promotion & relegation: ${state.clubs[up].short} up, ${state.clubs[down].short} down`,
      body: `${state.clubs[up].name} have won promotion to ${topName}. ${state.clubs[down].name} finished bottom and drop into the second tier.${down === state.userClubId ? ' The board is wounded and the budget will feel it - win the league and bounce straight back.' : ''}${up === state.userClubId ? ' The big time. The board urges cool heads: survival is the first objective.' : ''}`,
    })
  }

  // Champions Cup qualification for next season from final league standings
  const euroSlots: string[] = []
  const slotMap: Record<string, number> = { prem: 5, top14: 6, urc: 5 }
  for (const [leagueId, slots] of Object.entries(slotMap)) {
    const comp = state.comps[leagueId]
    if (comp) euroSlots.push(...sortTable(comp.table).map(r => r.teamId).slice(0, slots))
  }
  // Challenge Cup slots come from the same final standings - this must run
  // BEFORE the season wipe (it once read the rebuilt, zeroed tables, handing
  // out places at random and double-booking Champions Cup clubs)
  const chcSlots: string[] = []
  const euroSet = new Set(euroSlots.slice(0, 16))
  const chcMap: Record<string, [number, number]> = { champ: [0, 2], prem: [5, 9], top14: [6, 11], urc: [5, 10] }
  for (const [leagueId, [from, to]] of Object.entries(chcMap)) {
    const comp = state.comps[leagueId]
    if (comp) chcSlots.push(...sortTable(comp.table).map(t => t.teamId).slice(from, to).filter(id => !euroSet.has(id)))
  }
  // a filtered slot leaves the draw short: top up with the best of the rest
  if (chcSlots.length < 16) {
    const taken = new Set([...euroSet, ...chcSlots])
    const rest = Object.values(state.clubs)
      .filter(c => ['prem', 'top14', 'urc', 'champ'].includes(c.leagueId) && !taken.has(c.id))
      .sort((a, b) => b.rep - a.rep)
    while (chcSlots.length < 16 && rest.length) chcSlots.push(rest.shift()!.id)
  }

  // wipe season structures & rebuild
  state.season += 1
  state.week = 1
  state.finHist = []
  state.fixtures = []
  state.offers = []
  state.vacancies = []
  state.devFocus = state.devFocus.filter(id => state.players[id]?.clubId === state.userClubId)
  state.press = state.press.filter(p => !p.answered).slice(-5)
  state.comps = {}

  for (const def of LEAGUE_DEFS()) {
    const teamIds = Object.values(state.clubs).filter(c => c.leagueId === def.id).map(c => c.id)
    state.comps[def.id] = buildLeague(
      { id: def.id, name: def.name, short: def.short, teams: teamIds, double: def.double, playoffTeams: def.playoffTeams },
      rng, state,
    )
  }
  state.comps['cc'] = buildChampionsCup(euroSlots.slice(0, 16), rng, state)
  state.comps['chc'] = buildChampionsCup(chcSlots.slice(0, 16), rng, state, { id: 'chc', name: 'European Challenge Cup', short: 'Challenge Cup' })
  const wcYear = isWorldCupSeason(state.season)
  buildInternationals(rng, state, wcYear)
  schedulePreseason(state, rng)

  // the farewell season: a one-club servant announces his last dance, and
  // his home pre-season friendly becomes the testimonial he plays in
  {
    const club = state.clubs[state.userClubId]
    if (club && !state.unemployed) {
      const cand = club.players
        .map(id => state.players[id])
        .filter(Boolean)
        .filter(p => p.age >= 34 && !p.farewell && !p.loanFrom)
        .map(p => ({ p, apps: clubServiceApps(state, p) }))
        .filter(x => x.apps >= 150)
        .sort((a, b) => b.apps - a.apps)[0]
      const home = cand ? state.fixtures.find(f =>
        f.compId === 'fr' && !f.played && f.week <= 3 && f.homeId === club.id) : null
      if (cand && home) {
        cand.p.farewell = true
        cand.p.morale = clamp(cand.p.morale + 1, 1, 10)
        home.testimonial = cand.p.id
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'award', read: false,
          subject: `🎗 The last dance: ${cand.p.name} announces his farewell season`,
          body: `${cand.p.name} (${cand.p.age}, ${cand.p.pos}) has told the squad this season will be his last. ${cand.apps} appearances in the shirt, and one year left to add to them. His testimonial is set for the pre-season fixture at ${club.stadium} in week ${home.week} - pick him, and give the ground its goodbye.`,
          playerId: cand.p.id,
        })
      }
    }
  }
  if (wcYear) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season, type: 'intl', read: false,
      subject: `🏆 A RUGBY WORLD CUP season`,
      body: `The ${2025 + state.season} Rugby World Cup kicks off in the opening weeks of the season. Twenty nations, four pools, one trophy - and your internationals will be away with their countries until it's decided. Plan your early rounds carefully.`,
    })
  }

  // old wounds heal: expired grudges drop off the fixture list, and
  // contract stand-offs reset with the new season
  state.grudges = (state.grudges ?? []).filter(g => g.until >= state.season)
  for (const p of Object.values(state.players)) { if ((p.wantsDeal ?? 0) > 0) p.wantsDeal = 0 }
  state.slAlerted = []
  state.pledges = [] // a new season wipes the promise ledger clean
  state.takeover = null // deals not done by summer quietly collapse
  state.newOwnerUntil = null // the honeymoon does not survive the summer
  state.crisisAt = {} // week numbers reset with the calendar

  // partnership chemistry only lives while the pair share a dressing room -
  // prune split/retired pairs so the ledger stays small
  if (state.chem) {
    for (const k of Object.keys(state.chem)) {
      const [a, b] = k.split('_').map(Number)
      const pa = state.players[a], pb = state.players[b]
      if (!pa || !pb || pa.clubId !== pb.clubId) delete state.chem[k]
    }
  }

  // the Scouting Agency's boards refresh monthly, but retirees must drop off
  // now - a chart pointing at a deleted player is a broken chart
  if (state.agency) {
    state.agency.seniors = state.agency.seniors.filter(pid => state.players[pid])
    state.agency.kids = state.agency.kids.filter(pid => state.players[pid])
    for (const k of Object.keys(state.agency.best)) {
      if (!state.players[Number(k)]) delete state.agency.best[Number(k)]
    }
  }

  // budgets: base by rep + carryover health
  for (const club of Object.values(state.clubs)) {
    club.budget = Math.max(200_000, Math.round((club.rep * 45_000 + Math.max(0, club.balance) * 0.15) / 50_000) * 50_000)
    club.boardConfidence = clamp(club.boardConfidence * 0.6 + 30, 0, 100)
    const pool = club.players.map(id => state.players[id]).filter(Boolean)
    club.tactic.lineup = autoSelect(state, pool)
  }
  ensureCaptains(state)

  // loan-ins go home to their parent clubs
  for (const p of Object.values(state.players)) {
    if (p.loanFrom && state.clubs[p.loanFrom]) {
      const user = state.clubs[state.userClubId]
      user.players = user.players.filter(id => id !== p.id)
      user.tactic.lineup = user.tactic.lineup.map(id => (id === p.id ? null : id))
      state.clubs[p.loanFrom].players.push(p.id)
      p.clubId = p.loanFrom
      p.loanFrom = null
      if (p.ca < p.pa) p.ca = clamp(p.ca + 1 + Math.floor(rng() * 3), 1, p.pa)
      state.news.push({
        id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
        subject: `${p.name} returns to ${state.clubs[p.clubId]?.short} after his loan`,
        body: `The loan is over. ${p.name} heads back to his parent club having grown from the rugby you gave him.`,
        playerId: p.id,
      })
    }
  }
  state.objectives = pickObjectives(state)

  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
    subject: `The ${seasonLabel(state.season)} season begins`,
    body: `Pre-season is over. Your transfer budget has been set at ${fmtMoney(state.clubs[state.userClubId].budget)}. Bring us silverware.`,
  })

  punditPredictions(state, rng)
  state.tryOfSeason = null // the new season starts its own reel
  challengeCheck(state)
}

/** Scripted challenges are won at a season's end, and the game says so. */
function challengeCheck(state: GameState) {
  const ch = state.challenge
  if (!ch) return
  const uid = state.userClubId
  const prev = state.season - 1 // the season just completed
  const wonEver = (compId: string) => state.history.some(h => h.champion === uid && h.compId === compId)
  const done =
    ch === 'sapiac' ? uid === 'montauban' && state.clubs[uid]?.leagueId === 'top14'
    : ch === 'redbull' ? uid === 'newcastle' && state.history.some(h => h.season === prev && h.compId === 'prem' && h.champion === uid)
    : ch === 'dynasty' ? uid === 'munster' && wonEver('urc') && wonEver('cc')
    : ch === 'pirates' ? uid === 'pirates' && state.clubs[uid]?.leagueId === 'prem'
    : false
  if (!done) return
  state.challenge = undefined
  ;(state.challengesDone ??= []).push(ch)
  const title = CHALLENGES.find(c => c.id === ch)?.title ?? ch
  const line =
    ch === 'sapiac' ? 'Montauban stay in the Top 14. Sapiac is safe, and the Tarn-et-Garonne will sing your name for a generation.'
    : ch === 'redbull' ? 'Newcastle are champions of England. From bottom-four squad to the summit - the project is complete.'
    : ch === 'dynasty' ? 'The URC and the Champions Cup both live at Thomond Park now. The dynasty is broken, and it broke on your watch.'
    : 'Penzance to the Premiership. Cornwall has a top-flight club at last, and it is yours.'
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'award', read: false,
    subject: `🏅 CHALLENGE COMPLETE: ${title}`,
    body: `${line}\n\nThe badge goes on your profile, forever. Whatever happens next, nobody can take this one away.`,
  })
}
