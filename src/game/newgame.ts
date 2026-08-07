import type { RawClub, RawPlayer } from '../data/types'
import { verifiedClub } from '../data/verified'
import { extraPlayers } from '../data/additions'
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
import { inheritStaff } from './staff'
import { clamp } from './rng'
import { autoSelect } from './matchEngine'
import { buildChampionsCup, buildInternationals, buildLeague, schedulePreseason } from './schedule'
import { punditPredictions } from './gossip'
import { CHEM_SLOTS, chemKey, initFacilities, isWorldCupSeason } from './model'
import { seedKnowledge } from './scout'
import { ensureCaptains } from './analysis'
import { CLUB_CAPTAINS, sameName } from '../data/captains'
import { pickObjectives } from './objectives'
import { mulberry32 } from './rng'
import { ACAD_SHAPE, ACADEMY_SIZE, acadQuality, ensureAcademyLeague } from './academy'

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
    // The room has never met you. 26 is "still making their minds up" territory:
    // they will listen, but a speech from a stranger is only worth half of one
    // from a manager who has delivered. Earned back through results.
    mgrTrust: 26,
    challenge: challengeId,
    vacancies: [],
    devFocus: [],
  }

  const seenNames = new Set<string>()

  // the Sapiac challenge's premise is that Montauban ARE in the Top 14 -
  // make it true at boot: they come up, the weakest Top 14 side goes down
  const defs = LEAGUE_DEFS()
  if (challengeId === 'sapiac') {
    const top14 = defs.find(d => d.id === 'top14')
    const prod2 = defs.find(d => d.id === 'prod2')
    const mont = prod2?.clubs.find(c => c.id === 'montauban')
    if (top14 && prod2 && mont) {
      // copy, never splice: the defs' inner arrays may be shared module state
      const weakest = [...top14.clubs].sort((a, b) => a.rep - b.rep)[0]
      top14.clubs = [...top14.clubs.filter(c => c.id !== weakest.id), mont]
      prod2.clubs = [...prod2.clubs.filter(c => c.id !== 'montauban'), weakest]
    }
  }

  // A player the squad files place at the wrong club is moved to the right one,
  // carrying the entry that was authored for him. Collected in a pre-pass so
  // the result does not depend on league order, which is the whole bug.
  const relocate = new Map<string, RawPlayer[]>()
  const clubIds = new Set(defs.flatMap(d => d.clubs.map(c => c.id)))
  for (const def of defs) {
    for (const rc of def.clubs) {
      for (const rp of rc.players) {
        const to = verifiedClub(rp.name)
        if (!to || to === rc.id || !clubIds.has(to)) continue
        const list = relocate.get(to) ?? []
        // his old club may list him twice over; he only signs for one of them
        if (!list.some(x => x.name === rp.name)) list.push(rp)
        relocate.set(to, list)
      }
    }
  }

  for (const def of defs) {
    for (const rc of def.clubs) {
      const club: Club = {
        id: rc.id, name: rc.name, short: rc.short, city: rc.city,
        country: rc.country, stadium: rc.stadium, capacity: rc.capacity, capacity0: rc.capacity,
        colors: rc.colors, rep: rc.rep, leagueId: def.id,
        budget: rc.budget, balance: Math.round(rc.budget * 0.6),
        players: [],
        tactic: { style: 50, tempo: 50, kicking: 50, aggression: 50, lineup: new Array(23).fill(null) },
        wageBudget: Math.round(rc.budget * 0.9 + 2_500_000),
        boardConfidence: 70,
      }
      // bricks and mortar sized to the club's standing, before you arrive
      club.facilities = initFacilities(club, seed)
      const squad = [...rc.players]
      // men who really play here but are listed elsewhere in the files
      for (const rp of relocate.get(rc.id) ?? []) {
        if (!squad.some(x => x.name === rp.name)) squad.push(rp)
      }
      // men who really play here and are in no file at all
      for (const rp of extraPlayers(rc.id)) {
        if (!squad.some(x => x.name === rp.name)) squad.push(rp)
      }
      for (const rp of squad) {
        // he is checked, and this is not where he plays
        const to = verifiedClub(rp.name)
        if (to && clubIds.has(to) && to !== rc.id) continue
        // same real player supplied by two files (sabbaticals etc) - keep first
        const key = rp.name.toLowerCase()
        if (seenNames.has(key)) continue
        seenNames.add(key)
        const p = buildPlayer(rp, club.id, seed + club.players.length, 0)
        p.real = true // written by hand in the data, not by the name generator
        state.players[p.id] = p
        club.players.push(p.id)
      }
      state.clubs[club.id] = club
    }
  }

  // every club fields a full senior squad plus a real academy of 27
  const FILL_POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']
  for (const club of Object.values(state.clubs)) {
    const mkExtra = (age: number, q: number, youth: boolean, i: number, want?: Pos) => {
      // Fill the thinnest SENIOR position first, unless the caller named the shirt.
      //
      // Seniors only, and this is load-bearing. Counting the whole registered squad
      // meant the 27 academy men (feedback 10G) made every position look two or
      // three deep before a single senior filler was signed, so the fill spread
      // itself at random instead of covering real senior gaps - and the soak caught
      // it as a jump in out-of-position starters, because autoSelect was being
      // handed squads with no natural hooker behind the two it had.
      const byPos: Record<string, number> = {}
      for (const id of club.players) {
        const p = state.players[id]
        if (p && !p.acad) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
      }
      const pos = want ?? [...FILL_POS].sort((a, b) => (byPos[a] ?? 0) - (byPos[b] ?? 0))[0]
      // seenNames already holds every real player in the world, so the guard has
      // the whole database to avoid and not just the generated men before him.
      // regenName does the retrying and the registering now.
      const name = regenName(rng, club.country, seenNames)
      const p = buildPlayer(
        { name, pos, age, nat: club.country, q, gk: (pos === 'FH' || pos === 'FB') && rng() < 0.3 },
        club.id, seed + club.players.length * 31 + i, 0)
      if (youth) { p.youth = true; p.acad = true }
      state.players[p.id] = p
      club.players.push(p.id)
    }
    // The academy is a real team, not a shelf of four prospects (feedback 10G):
    // ACADEMY_SIZE men in the shape of a squad that can field a side every week,
    // which is why the shirts are named rather than filled thinnest-first - a
    // thinnest-first academy borrows the seniors' gaps and ends up with six locks
    // and no scrum-half. They sit outside the senior salary cap, as they do in
    // the real game: a club is not punished for growing its own.
    ACAD_SHAPE.forEach((pos, i) => {
      mkExtra(17 + Math.floor(rng() * 3), acadQuality(club, rng), true, i, pos)
    })
    // senior depth to 38 SENIORS (65 with the academy): two deep in every
    // shirt with room for injuries, Tests and suspensions (user feedback:
    // squads were too thin - and the first fix forgot the academy counts)
    let guard = 0
    while (club.players.length < 38 + ACADEMY_SIZE && guard++ < 40) {
      mkExtra(21 + Math.floor(rng() * 9), Math.max(42, club.rep - 16 + Math.floor(rng() * 10)), false, guard + 50)
    }
  }

  // WONDERKIDS: a handful of generational academy talents scattered across
  // the world, plus unattached prodigies from the wider rugby nations
  const academyKids = Object.values(state.players).filter(p => p.youth && p.age <= 19)
  const chosen = new Set<number>()
  const watchList: string[] = []
  const watchIds: number[] = []
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
      watchIds.push(k.id)
    }
  }
  const GEM_NATS = ['FIJ', 'GEO', 'TGA', 'SAM', 'USA', 'URU', 'ESP', 'POR']
  const GEM_POS: Pos[] = ['WG', 'FL', 'CE', 'LK', 'FH', 'N8', 'SH', 'FB']
  for (let i = 0; i < 8; i++) {
    const nat = GEM_NATS[i % GEM_NATS.length]
    const p = buildPlayer(
      {
        name: regenName(rng, nat, seenNames), pos: GEM_POS[i % GEM_POS.length],
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
      body: `Every pre-season, the scouting network circulates its list of academy talents with genuinely special ceilings. This year's names: ${watchList.join('; ')}. There are also whispers of unattached prodigies from the island and emerging nations drifting around the free-agent market - first club to move wins. Tap a name below to open his profile, or browse the full list: World ▸ Team of the Season ▸ Ones to Watch.`,
      playerIds: watchIds,
    })
  }

  // competitions (same defs as above so a challenge swap carries through)
  for (const def of defs) {
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
  // the real 2025-26 skippers wear the armband, and a captain of men is given
  // the leadership to match. Names that are not in the squad simply pass over,
  // and ensureCaptains fills every club the list does not cover.
  for (const [cid, capName] of Object.entries(CLUB_CAPTAINS)) {
    const club = state.clubs[cid]
    if (!club) continue
    const man = club.players.map(id => state.players[id]).find(p => p && sameName(p.name, capName))
    if (!man) continue
    club.captain = man.id
    man.a.lea = Math.max(man.a.lea, 15)
  }
  ensureCaptains(state, true)
  state.objectives = pickObjectives(state)
  state.tenureStart = 0
  state.legendOf = []
  // every dugout has a name in it
  for (const club of Object.values(state.clubs)) {
    if (club.id !== userClubId) club.coach = regenName(rng, club.country === 'EUR' ? 'ENG' : club.country, seenNames)
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

  // the coaching department you walk into, sized to the club's standing
  inheritStaff(state)

  punditPredictions(state, rng)

  // the A League: the academy sides of the manager's own league, fixtures and
  // table, played under the academy coach every league week (feedback 10G)
  ensureAcademyLeague(state)

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
