import type { RawClub } from '../data/types'
import { PREM_A } from '../data/leagues/prem_a'
import { PREM_B } from '../data/leagues/prem_b'
import { TOP14_A } from '../data/leagues/top14_a'
import { TOP14_B } from '../data/leagues/top14_b'
import { URC_A } from '../data/leagues/urc_a'
import { URC_B } from '../data/leagues/urc_b'
import { SRP_A } from '../data/leagues/srp_a'
import { SRP_B } from '../data/leagues/srp_b'
import { CHAMP } from '../data/leagues/champ'
import { PROD2 } from '../data/leagues/prod2'
import { JL1 } from '../data/leagues/jl1'
import { NATL1 } from '../data/leagues/natl1'
import type { Club, GameState, Pos } from './model'
import { buildPlayer, playerValue, resetIds } from './attributes'
import { regenName } from './nations'
import { clamp } from './rng'
import { autoSelect } from './matchEngine'
import { buildChampionsCup, buildInternationals, buildLeague, schedulePreseason } from './schedule'
import { punditPredictions } from './gossip'
import { CHEM_SLOTS, chemKey, isWorldCupSeason } from './model'
import { seedKnowledge } from './scout'
import { ensureCaptains } from './analysis'
import { pickObjectives } from './objectives'
import { mulberry32 } from './rng'

export interface Challenge {
  id: string
  clubId: string
  title: string
  desc: string
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'sapiac', clubId: 'montauban', title: 'Sauvez Sapiac',
    desc: 'Tiny Montauban are back in the Top 14 with the smallest budget in the land. Keep them up. Become immortal in the Tarn-et-Garonne.',
  },
  {
    id: 'redbull', clubId: 'newcastle', title: 'The Energy Project',
    desc: 'New owners, big ambitions, bottom-four squad. Turn Newcastle from perennial strugglers into Premiership champions.',
  },
  {
    id: 'dynasty', clubId: 'munster', title: 'Break the Dynasty',
    desc: 'Leinster hoover up every trophy in Ireland. From Thomond Park, end their reign - win the URC and the Champions Cup.',
  },
  {
    id: 'pirates', clubId: 'pirates', title: "The Pirates' Dream",
    desc: 'Penzance to the Premiership: take the Cornish Pirates out of the Championship on a shoestring and put Cornwall in the top flight at last.',
  },
]

export interface LeagueDef {
  id: string
  name: string
  short: string
  double: boolean
  playoffTeams: number
  clubs: RawClub[]
}

export const LEAGUE_DEFS: () => LeagueDef[] = () => [
  { id: 'prem', name: 'Gallagher Premiership', short: 'Premiership', double: true, playoffTeams: 4, clubs: [...PREM_A, ...PREM_B] },
  { id: 'top14', name: 'Top 14', short: 'Top 14', double: true, playoffTeams: 6, clubs: [...TOP14_A, ...TOP14_B] },
  { id: 'urc', name: 'United Rugby Championship', short: 'URC', double: false, playoffTeams: 8, clubs: [...URC_A, ...URC_B] },
  { id: 'srp', name: 'Super Rugby Pacific', short: 'Super Rugby', double: true, playoffTeams: 6, clubs: [...SRP_A, ...SRP_B] },
  { id: 'champ', name: 'English Championship', short: 'Championship', double: true, playoffTeams: 4, clubs: CHAMP },
  { id: 'prod2', name: 'Pro D2', short: 'Pro D2', double: true, playoffTeams: 6, clubs: PROD2 },
  { id: 'jl1', name: 'Japan League One', short: 'League One', double: true, playoffTeams: 4, clubs: JL1 },
  { id: 'natl1', name: 'National League One', short: 'National 1', double: true, playoffTeams: 0, clubs: NATL1 },
]

export function newGame(userClubId: string, managerName: string, seed: number, challengeId?: string): GameState {
  const rng = mulberry32(seed)
  resetIds(1)

  const state: GameState = {
    seed,
    saveName: '',
    season: 0,
    week: 1,
    userClubId,
    players: {},
    clubs: {},
    comps: {},
    fixtures: [],
    news: [],
    press: [],
    offers: [],
    nextId: 1_000_000,
    natSquads: {},
    history: [],
    unemployed: false,
    processedWeek: false,
    managerName,
    training: 'balanced',
    shortlist: [],
    staff: { assistant: 0, physio: 0, scout: 0, attack: 0, defence: 0, scrumCoach: 0, kicking: 0, academyCoach: 0 },
    mgr: { m: 0, w: 0, d: 0, l: 0, trophies: [], finishes: [], signings: 0, spent: 0 },
    challenge: challengeId,
    vacancies: [],
    devFocus: [],
    facilities: {},
  }

  const seenNames = new Set<string>()

  for (const def of LEAGUE_DEFS()) {
    for (const rc of def.clubs) {
      const club: Club = {
        id: rc.id, name: rc.name, short: rc.short, city: rc.city,
        country: rc.country, stadium: rc.stadium, capacity: rc.capacity,
        colors: rc.colors, rep: rc.rep, leagueId: def.id,
        budget: rc.budget, balance: Math.round(rc.budget * 0.6),
        players: [],
        tactic: { style: 50, tempo: 50, kicking: 50, aggression: 50, lineup: new Array(23).fill(null) },
        wageBudget: Math.round(rc.budget * 0.9 + 2_500_000),
        boardConfidence: 70,
      }
      for (const rp of rc.players) {
        // same real player supplied by two files (sabbaticals etc) - keep first
        const key = rp.name.toLowerCase()
        if (seenNames.has(key)) continue
        seenNames.add(key)
        const p = buildPlayer(rp, club.id, seed + club.players.length, 0)
        state.players[p.id] = p
        club.players.push(p.id)
      }
      state.clubs[club.id] = club
    }
  }

  // every club fields a full senior squad plus a real academy:
  // 4 named prospects (17-19, high ceilings) and squad players to 33
  const FILL_POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']
  for (const club of Object.values(state.clubs)) {
    const mkExtra = (age: number, q: number, youth: boolean, i: number) => {
      // fill the thinnest position first
      const byPos: Record<string, number> = {}
      for (const id of club.players) {
        const p = state.players[id]
        if (p) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
      }
      const pos = [...FILL_POS].sort((a, b) => (byPos[a] ?? 0) - (byPos[b] ?? 0))[0]
      let name = regenName(rng, club.country)
      let guard = 0
      while (seenNames.has(name.toLowerCase()) && guard++ < 10) name = regenName(rng, club.country)
      seenNames.add(name.toLowerCase())
      const p = buildPlayer(
        { name, pos, age, nat: club.country, q, gk: (pos === 'FH' || pos === 'FB') && rng() < 0.3 },
        club.id, seed + club.players.length * 31 + i, 0)
      if (youth) { p.youth = true; p.acad = true }
      state.players[p.id] = p
      club.players.push(p.id)
    }
    // academy prospects - the next generation is already in the building
    for (let i = 0; i < 4; i++) {
      mkExtra(17 + Math.floor(rng() * 3), 38 + Math.floor(rng() * 16) + Math.floor(club.rep / 14), true, i)
    }
    // senior depth to a full 33-man squad
    let guard = 0
    while (club.players.length < 33 && guard++ < 12) {
      mkExtra(21 + Math.floor(rng() * 9), Math.max(42, club.rep - 16 + Math.floor(rng() * 10)), false, guard + 50)
    }
  }

  // WONDERKIDS: a handful of generational academy talents scattered across
  // the world, plus unattached prodigies from the wider rugby nations
  const academyKids = Object.values(state.players).filter(p => p.youth && p.age <= 19)
  const chosen = new Set<number>()
  const watchList: string[] = []
  for (let i = 0; i < 9 && academyKids.length; i++) {
    const k = academyKids[Math.floor(rng() * academyKids.length)]
    if (chosen.has(k.id)) continue
    chosen.add(k.id)
    k.ca = clamp(k.ca + 7 + Math.floor(rng() * 6), 1, 80)
    k.pa = clamp(88 + Math.floor(rng() * 12), k.ca + 15, 99)
    k.q0 = k.ca
    k.value = playerValue(k.ca, k.age, k.pa)
    if (watchList.length < 5) {
      watchList.push(`${k.name} (${k.age}, ${k.pos} - ${state.clubs[k.clubId!]?.short})`)
    }
  }
  const GEM_NATS = ['FIJ', 'GEO', 'TGA', 'SAM', 'USA', 'URU', 'ESP', 'POR']
  const GEM_POS: Pos[] = ['WG', 'FL', 'CE', 'LK', 'FH', 'N8', 'SH', 'FB']
  for (let i = 0; i < 8; i++) {
    const nat = GEM_NATS[i % GEM_NATS.length]
    const p = buildPlayer(
      {
        name: regenName(rng, nat), pos: GEM_POS[i % GEM_POS.length],
        age: 18 + Math.floor(rng() * 3), nat,
        q: 55 + Math.floor(rng() * 12), gk: rng() < 0.15,
      },
      null, seed + 7777 + i * 13, 0)
    p.youth = true
    p.acad = true
    p.pa = clamp(84 + Math.floor(rng() * 14), p.ca + 12, 99)
    p.value = playerValue(p.ca, p.age, p.pa)
    state.players[p.id] = p
  }
  if (watchList.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: 0, type: 'youth', read: false,
      subject: `🌟 The scouts' ones to watch`,
      body: `Every pre-season, the scouting network circulates its list of academy talents with genuinely special ceilings. This year's names: ${watchList.join('; ')}. There are also whispers of unattached prodigies from the island and emerging nations drifting around the free-agent market - first club to move wins. See and tap every name: World ▸ Team of the Season ▸ Ones to Watch.`,
    })
  }

  // competitions
  for (const def of LEAGUE_DEFS()) {
    const teamIds = def.clubs.map(c => c.id)
    state.comps[def.id] = buildLeague(
      { id: def.id, name: def.name, short: def.short, teams: teamIds, double: def.double, playoffTeams: def.playoffTeams },
      rng, state,
    )
  }

  // Champions Cup: best 16 by rep from prem/top14/urc (Europe)
  const euro = Object.values(state.clubs)
    .filter(c => ['prem', 'top14', 'urc'].includes(c.leagueId))
    .sort((a, b) => b.rep - a.rep)
    .slice(0, 16)
    .map(c => c.id)
  state.comps['cc'] = buildChampionsCup(euro, rng, state)

  // Challenge Cup: the next 16 - Championship winners' pot and mid-table
  // Europe. Champions Cup clubs are excluded outright: re-sorting with the
  // champ clubs mixed in used to let a CC qualifier slip into both cups.
  const ccSet = new Set(euro)
  const chc = Object.values(state.clubs)
    .filter(c => ['prem', 'top14', 'urc', 'champ'].includes(c.leagueId) && !ccSet.has(c.id))
    .sort((a, b) => b.rep - a.rep)
    .slice(0, 16)
    .map(c => c.id)
  state.comps['chc'] = buildChampionsCup(chc, rng, state, { id: 'chc', name: 'European Challenge Cup', short: 'Challenge Cup' })

  buildInternationals(rng, state, isWorldCupSeason(0))
  schedulePreseason(state, rng)
  seedExClubs(state)
  seedKnowledge(state)
  ensureCaptains(state, true)
  state.objectives = pickObjectives(state)
  state.tenureStart = 0
  state.legendOf = []
  // every dugout has a name in it
  for (const club of Object.values(state.clubs)) {
    if (club.id !== userClubId) club.coach = regenName(rng, club.country === 'EUR' ? 'ENG' : club.country)
  }

  // initial lineups for every club
  for (const club of Object.values(state.clubs)) {
    const pool = club.players.map(id => state.players[id]).filter(Boolean)
    club.tactic.lineup = autoSelect(state, pool)
  }

  // a new manager starts with the benefit of the doubt from the terraces
  state.fanMood = 60

  // established squads don't start as strangers: seed the first-choice
  // partnerships with a history so season one has settled combinations
  state.chem = {}
  for (const club of Object.values(state.clubs)) {
    for (const [i, j] of CHEM_SLOTS) {
      const a = club.tactic.lineup[i], b = club.tactic.lineup[j]
      if (a != null && b != null) state.chem[chemKey(a, b)] = 8 + Math.floor(rng() * 20)
    }
  }

  // welcome news
  const uc = state.clubs[userClubId]
  const challenge = challengeId ? CHALLENGES.find(c => c.id === challengeId) : null
  state.news.push({
    id: state.nextId++, week: 1, season: 0, type: 'board', read: false,
    subject: challenge ? `THE CHALLENGE: ${challenge.title}` : `Welcome to ${uc.name}`,
    body: `${challenge ? challenge.desc + '\n\n' : ''}The board of ${uc.name} is delighted to confirm the appointment of ${managerName} as the club's new Director of Rugby. Expectations at ${uc.stadium} are ${uc.rep >= 85 ? 'sky-high: silverware is demanded' : uc.rep >= 75 ? 'high: a playoff push is expected' : 'modest: steady the ship and build for the future'}. Your transfer budget this season is £${(uc.budget / 1e6).toFixed(1)}m.`,
  })

  punditPredictions(state, rng)

  return state
}

/** Careers did not begin in 2025: roughly one senior player in five arrived
 *  from another club in the same league. Deterministic per player id, capped
 *  by his estimated pre-2025 volume, so saves and fresh worlds agree - and
 *  old-boy reunions exist from the very first fixture list. */
export function seedExClubs(state: GameState) {
  const byLeague = new Map<string, Club[]>()
  for (const c of Object.values(state.clubs)) {
    const arr = byLeague.get(c.leagueId) ?? []
    arr.push(c)
    byLeague.set(c.leagueId, arr)
  }
  for (const c of Object.values(state.clubs)) {
    const peers = (byLeague.get(c.leagueId) ?? []).filter(x => x.id !== c.id)
    if (!peers.length) continue
    for (const pid of c.players) {
      const p = state.players[pid]
      if (!p || p.exClub !== undefined) continue
      if (p.age < 25 || p.id % 5 !== 3) { p.exClub = null; continue }
      const spent = Math.min(30 + ((p.id * 40503) >>> 0) % 65, Math.max(0, (p.hist?.apps ?? 0) - 25))
      if (spent < 12) { p.exClub = null; continue }
      p.exClub = peers[((p.id * 2654435761) >>> 0) % peers.length].id
      p.exApps = spent
    }
  }
}
