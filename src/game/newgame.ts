import type { RawClub, RawPlayer } from '../data/types'
import { refreshCaps } from './cap'
import { verifiedClub } from '../data/verified'
import { extraPlayers } from '../data/additions'
import { prospectsFor } from '../data/prospects'
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
import type { Club, GameState, MgrOrigin, NewsItem, Pos } from './model'
import { buildPlayer, playerValue, resetIds , repriceAcademies } from './attributes'
import { regenName } from './nations'
import { inheritStaff } from './staff'
import { seedPhilosophies } from './philosophy'
import { seedDeals } from './commercial'
import { clamp } from './rng'
import { assistantJudgement, autoSelect } from './matchEngine'
import { buildChampionsCup, buildInternationals, buildLeague, schedulePreseason } from './schedule'
import { punditPredictions } from './gossip'
import { CHEM_SLOTS, RELEGATES, boardObjective, chemKey, fmtMoney, initFacilities, isWorldCupSeason } from './model'
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

/** The press verdict on a club, judged INSIDE its own league (user, scanning
 *  National League One: "they all say relegation zone"). The old label read
 *  absolute reputation on a scale calibrated for the Premiership, so a whole
 *  lower division wore the same bottom tag - in a league with no relegation
 *  and no playoffs, both words it used were impossible. A club is favourites
 *  or written off relative to the teams it actually plays, and the words only
 *  promise what its league really has. */
export function mediaVerdict(club: { id: string }, league: LeagueDef): string {
  const order = [...league.clubs].sort((a, b) => b.rep - a.rep)
  const i = Math.max(0, order.findIndex(c => c.id === club.id))
  const n = order.length
  const quarter = Math.max(2, Math.ceil(n / 4))
  if (i === 0) return 'Title favourites'
  if (i < quarter) return league.playoffTeams > 0 ? 'Playoff contenders' : 'Promotion chasers'
  if (i < Math.ceil(n / 2)) return 'Dark horses'
  if (i < n - quarter) return 'Mid-table battlers'
  return RELEGATES.includes(league.id) ? 'Relegation-zone rated' : 'Written off by the press'
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

export function newGame(userClubId: string, managerName: string, seed: number, challengeId?: string, origin: MgrOrigin = 'coach'): GameState {
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
    // from a manager who has delivered. Earned back through results. A former
    // international walks in with the room already half-sold (18B): they have
    // seen him play, and that buys a hearing no certificate can.
    mgrTrust: origin === 'player' ? 45 : 26,
    mgrOrigin: origin,
    // Monday of week 1. Continue walks the week a day at a time (game/days.ts).
    day: 0,
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
        const to = verifiedClub(rp.name, rc.id)
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
      const handAdded = new Set<string>()
      for (const rp of extraPlayers(rc.id)) {
        if (!squad.some(x => x.name === rp.name)) { squad.push(rp); handAdded.add(rp.name) }
      }
      for (const rp of squad) {
        // he is checked, and this is not where he plays. A HAND-ADDED man is
        // exempt: additions.ts already places him at the club that needs him,
        // by hand, and the relocation table speaks for the league FILES. When
        // the 2026-27 window moved four Northampton men to new clubs, the
        // 2025-26 guide still said Northampton and quietly deleted all four.
        const to = handAdded.has(rp.name) ? null : verifiedClub(rp.name, rc.id)
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
    //
    // A few academies carry a planted name (src/data/prospects.ts). He takes an
    // academy shirt his position asks for rather than an extra one, so every
    // squad is still ACADEMY_SIZE and the shape is unchanged.
    const planted = [...prospectsFor(club.id)]
    ACAD_SHAPE.forEach((pos, i) => {
      // Roll first, use or discard after. A planted man needs none of these
      // draws, but skipping them would shift the shared rng for every club
      // generated after this one and rebuild the whole world around five names -
      // a different fixture list, different regens, different everything. Draw
      // exactly what a generated man would have drawn, then throw it away: same
      // world, five different men in it. Verified by the fingerprint.
      const rolledAge = 17 + Math.floor(rng() * 3)
      const rolledQ = acadQuality(club, rng)
      const k = planted.findIndex(x => x.pos === pos)
      if (k >= 0) {
        const pr = planted.splice(k, 1)[0]
        regenName(rng, club.country, seenNames) // the name he replaces, burned
        // and the goal-kicker roll, which mkExtra only draws for a 10 or a 15
        if (pos === 'FH' || pos === 'FB') rng()
        seenNames.add(pr.name)
        const p = buildPlayer(
          { name: pr.name, pos: pr.pos, age: pr.age, nat: club.country, q: pr.q, gk: pr.gk },
          club.id, seed + club.players.length * 31 + i, 0)
        p.youth = true
        p.acad = true
        // a named rising star gets a floor under his ceiling. A floor rather than
        // an assignment, so a lucky hash is never taken away, and it draws nothing
        // from the shared rng so the world around him is still identical.
        if (pr.pa) {
          p.pa = Math.max(p.pa, pr.pa)
          p.value = playerValue(p.ca, p.age, p.pa, p.pos)
        }
        state.players[p.id] = p
        club.players.push(p.id)
        return
      }
      mkExtra(rolledAge, rolledQ, true, i, pos)
    })
    // senior depth to 38 SENIORS (65 with the academy): two deep in every
    // shirt with room for injuries, Tests and suspensions (user feedback:
    // squads were too thin - and the first fix forgot the academy counts)
    let guard = 0
    while (club.players.length < 38 + ACADEMY_SIZE && guard++ < 40) {
      mkExtra(21 + Math.floor(rng() * 9), Math.max(42, club.rep - 16 + Math.floor(rng() * 10)), false, guard + 50)
    }
  }

  // ---- THE WAGE BUDGET IS A WEEKLY FIGURE, SO MEASURE IT WEEKLY ----------
  //
  // It was set to `transfer budget * 0.9 + 2.5m`, which is a transfer-scale
  // number, and then displayed as "Wage budget £5,380k/wk" and compared against a
  // weekly squad bill. Measured at Harlequins: a bill of £337k/wk against a
  // "budget" of £5,380k/wk. Sixteen times the wage bill is not a budget, it is a
  // decoration, and the three screens that print wage room were printing a
  // number that could never mean anything.
  //
  // Derived from the bill the club actually pays, which is the only number in
  // pounds-per-week this game has. 18% of headroom is a real constraint that a
  // manager can spend into without it being a wall - and the salary cap, measured
  // separately from the league's median bill, is usually the tighter of the two,
  // so this changes what the screen says rather than what the game allows.
  for (const club of Object.values(state.clubs)) {
    const bill = club.players.reduce((s, id) => {
      const p = state.players[id]
      return p && !p.acad ? s + p.wage : s
    }, 0)
    club.wageBudget = Math.max(50_000, Math.round((bill * 1.18) / 1_000) * 1_000)
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
    k.value = playerValue(k.ca, k.age, k.pa, k.pos)
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
    p.value = playerValue(p.ca, p.age, p.pa, p.pos)
    state.players[p.id] = p
  }
  // Held back rather than filed here. The inbox reads oldest unread first, so
  // pushing the scouting circular during academy generation gave it the lowest id
  // in the game and it arrived ahead of the manager's own appointment (user: "it
  // has already shared a scout report so you wouldnt see it"). It is filed after
  // the four letters that introduce the job - see the opening sequence below.
  //
  // The id counter is still ADVANCED here, where it always was, and the advance is
  // then thrown away. Fixture ids come out of the same nextId counter, so taking
  // one news id later than before shifted every fixture id in the game by one -
  // and the sim hashes fixture ids for the kick-off day and the referee. The
  // fingerprint test caught it: three detailed matches identical, the fourth
  // 19-14 instead of 9-14. Burning the slot keeps the world identical while the
  // story itself gets a later id, which is what puts it behind the four letters
  // in an inbox that reads oldest first. One unused id in a counter that only
  // ever goes up costs nothing.
  state.nextId++
  const scoutCircular = watchList.length ? {
    subject: `🌟 The scouts' ones to watch`,
    body: `The pre-season list of academy talents with genuinely special ceilings: ${watchList.join('; ')}.\n\nUnattached prodigies are also drifting around the free-agent market - first club to move wins. Tap a name below, or see World ▸ Team of the Season ▸ Ones to Watch.`,
    playerIds: watchIds,
  } : null

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
  // every dugout has a name in it, and an idea in it (F23)
  for (const club of Object.values(state.clubs)) {
    if (club.id !== userClubId) club.coach = regenName(rng, club.country === 'EUR' ? 'ENG' : club.country, seenNames)
  }
  seedPhilosophies(state)
  // F30: you do not arrive at a club with the front of its shirt blank
  seedDeals(state)

  // initial lineups for every club
  for (const club of Object.values(state.clubs)) {
    const pool = club.players.map(id => state.players[id]).filter(Boolean)
    club.tactic.lineup = autoSelect(state, pool)
  }
  // ...except the user's, which the ASSISTANT names, through his own eye
  // (assistantJudgement): the manager has not picked a side yet, and the side
  // the game hands him on day one should not be the answer key. AI clubs keep
  // the honest pick above - their calibration is the league's calibration.
  {
    const mine = state.clubs[state.userClubId]
    if (mine) {
      const pool = mine.players.map(id => state.players[id]).filter(Boolean)
      mine.tactic.lineup = autoSelect(state, pool, undefined, assistantJudgement(state))
    }
  }

  // a new manager starts with the benefit of the doubt from the terraces -
  // and the local hero (18B) starts with more than that at HIS club: the
  // board gave the job to one of their own and the town approves. The warmth
  // is front-loaded only; it does not survive a bad season, and it does not
  // travel to the next job.
  state.fanMood = origin === 'local' ? 72 : 60
  if (origin === 'local') {
    const home = state.clubs[state.userClubId]
    if (home) home.boardConfidence = Math.min(100, home.boardConfidence + 12)
  }

  // established squads don't start as strangers: seed the first-choice
  // partnerships with a history so season one has settled combinations
  state.chem = {}
  for (const club of Object.values(state.clubs)) {
    for (const [i, j] of CHEM_SLOTS) {
      const a = club.tactic.lineup[i], b = club.tactic.lineup[j]
      if (a != null && b != null) state.chem[chemKey(a, b)] = 8 + Math.floor(rng() * 20)
    }
  }

  // ---- THE OPENING SEQUENCE ----
  //
  // Four letters, in this order, because this is the order a new man actually
  // finds things out (user: "can we do a welcome, a fan response, squad
  // assessment, coaching team so you get a decent amount of information"). The
  // inbox reads oldest unread first, so the order here IS the order they open in,
  // and nothing else may be filed before them.
  const uc = state.clubs[userClubId]
  const challenge = challengeId ? CHALLENGES.find(c => c.id === challengeId) : null

  // 1. the appointment
  state.news.push({
    id: state.nextId++, week: 1, season: 0, type: 'board', read: false,
    subject: challenge ? `THE CHALLENGE: ${challenge.title}` : `Welcome to ${uc.name}`,
    body: `${challenge ? challenge.desc + '\n\n' : ''}The board of ${uc.name} is delighted to confirm the appointment of ${managerName} as the club's new Director of Rugby. Expectations at ${uc.stadium} are ${uc.rep >= 85 ? 'sky-high: silverware is demanded' : uc.rep >= 75 ? 'high: a playoff push is expected' : 'modest: steady the ship and build for the future'}. Your transfer budget this season is £${(uc.budget / 1e6).toFixed(1)}m.`,
  })

  // 2. what the terraces made of it
  // its own stream, NOT the shared world rng: three draws for three terrace
  // voices would otherwise shift every draw taken after this point and quietly
  // change the generated world. The fingerprint test caught exactly that.
  state.news.push(fanReaction(state, managerName, mulberry32(seed ^ 0x5FA17A11)))

  // 3. the assistant's honest read on what you have inherited
  state.news.push(squadAssessment(state))

  // 4. the coaching department you walk into, sized to the club's standing
  inheritStaff(state)

  // and only then the circulars
  if (scoutCircular) {
    state.news.push({ id: state.nextId++, week: 1, season: 0, type: 'youth', read: false, ...scoutCircular })
  }

  punditPredictions(state, rng)

  // the A League: the academy sides of the manager's own league, fixtures and
  // table, played under the academy coach every league week (feedback 10G)
  ensureAcademyLeague(state)

  // every academy man on a development deal, BEFORE the cap is measured so the
  // cap is taken from a bill that is actually true (see repriceAcademies)
  repriceAcademies(Object.values(state.players))

  // the salary cap for every division, measured from the division itself (F6)
  refreshCaps(state, true)

  return state
}

/** Careers did not begin in 2025: roughly one senior player in five arrived
 *  from another club in the same league. Deterministic per player id, capped
 *  by his estimated pre-2025 volume, so saves and fresh worlds agree - and
 *  old-boy reunions exist from the very first fixture list.
 *
 *  GENERATED PLAYERS ONLY. A hand-written name carries a real man's real
 *  history, and hashing him an ex-club invents one: the briefing told a
 *  Northampton manager that Harlequins' Nick David once made 39 appearances
 *  in his colours, which never happened. A real player's pre-2025 past stays
 *  blank; the old-boy beat still finds him the honest way, through transfers
 *  made inside the career (p.career). */
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
      if (p.real || p.age < 25 || p.id % 5 !== 3) { p.exClub = null; continue }
      const spent = Math.min(30 + ((p.id * 40503) >>> 0) % 65, Math.max(0, (p.hist?.apps ?? 0) - 25))
      if (spent < 12) { p.exClub = null; continue }
      p.exClub = peers[((p.id * 2654435761) >>> 0) % peers.length].id
      p.exApps = spent
    }
  }
}

/**
 * Letter 2 of the opening sequence: what the terraces made of the appointment.
 *
 * A brand new manager is nobody, and the fans say so. This is where the low
 * starting reputation is first felt as words rather than as a number on a bar:
 * an unproven name at a big club gets scepticism, the same name at a struggling
 * one gets relief that somebody has taken the job. Nothing here is invented
 * about a real person - the manager is the player's own.
 */
function fanReaction(state: GameState, managerName: string, rng: () => number): NewsItem {
  const uc = state.clubs[state.userClubId]
  const mood = state.fanMood ?? 60
  const big = uc.rep >= 80
  const mid = uc.rep >= 68
  // three voices, so the card reads like a message board rather than a verdict
  const sceptics = [
    'Never heard of him. Hope the board know something we do not.',
    'An unproven appointment at a club this size. That is a gamble with our season.',
    'I will judge him in May, not August. Prove it on the pitch.',
  ]
  const hopefuls = [
    'Fresh ideas, finally. Anything is better than what we had.',
    'Give him two seasons and a bit of money and see what happens.',
    'He has said the right things. Now let him pick a team.',
  ]
  const patient = [
    'Steady on. New man, new voice, same old fixture list.',
    'The squad is the squad. He can only work with what is in the building.',
    'First home game will tell us plenty about how he wants to play.',
  ]
  const pick = (xs: string[]) => xs[Math.floor(rng() * xs.length)]
  const voices = big
    ? [pick(sceptics), pick(patient), pick(hopefuls)]
    : mood >= 62
      ? [pick(hopefuls), pick(patient), pick(sceptics)]
      : [pick(hopefuls), pick(hopefuls), pick(patient)]
  const headline = big
    ? `The terraces are not convinced yet`
    : mid ? `Cautious welcome from the ${uc.short} faithful`
    : `The ${uc.short} support are ready to get behind you`
  const opener = big
    ? `A crowd used to winning has been handed a manager nobody has heard of, and the supporters' forums have noticed.`
    : mid
      ? `The reaction around ${uc.city} is wait-and-see. Nobody is thrilled, nobody is furious.`
      : `There is genuine relief around ${uc.city} that somebody has taken the job, and a fair amount of goodwill going with it.`
  // Three voices are still DRAWN (the pick count feeds the shared rng stream,
  // and one draw fewer shifts every fixture id in the world), but only two are
  // printed: the user's brevity pass (19A) cut every letter to what a phone
  // screen wants to hold.
  void voices[2]
  void managerName
  return {
    id: state.nextId++, week: 1, season: 0, type: 'general', read: false,
    subject: `🗣 ${headline}`,
    body: `${opener}\n\n"${voices[0]}"\n\n"${voices[1]}"\n\n`
      + `Terrace mood is ${mood >= 80 ? 'bouncing' : mood >= 62 ? 'behind you' : mood >= 45 ? 'watching' : mood >= 30 ? 'restless' : 'mutinous'}. Results will move it.`,
  }
}

/**
 * Letter 3 of the opening sequence: the assistant's honest read on the squad.
 *
 * Everything in it is measured from the squad itself rather than asserted, so it
 * is true for any club the player picks - including the four challenge starts,
 * where the whole point is that the squad is not good enough yet.
 */
function squadAssessment(state: GameState): NewsItem {
  const uc = state.clubs[state.userClubId]
  const squad = uc.players.map(id => state.players[id]).filter(p => p && !p.acad)
  const senior = squad.length
  const avgAge = senior ? squad.reduce((s, p) => s + p.age, 0) / senior : 0
  const avgCa = senior ? squad.reduce((s, p) => s + p.ca, 0) / senior : 0
  const best = [...squad].sort((a, b) => b.ca - a.ca).slice(0, 3)
  const under23 = squad.filter(p => p.age <= 22).length
  const over32 = squad.filter(p => p.age >= 32).length
  // the thin shirts: any position with fewer than two men who can play it
  const FORWARDS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8']
  const BACKS: Pos[] = ['SH', 'FH', 'CE', 'WG', 'FB']
  const depth = (pos: Pos) => squad.filter(p => p.pos === pos || p.alt.includes(pos)).length
  const thin = [...FORWARDS, ...BACKS].filter(pos => depth(pos) < 2)
  const packCa = (() => {
    const f = squad.filter(p => FORWARDS.includes(p.pos))
    return f.length ? f.reduce((s, p) => s + p.ca, 0) / f.length : 0
  })()
  const backsCa = (() => {
    const b = squad.filter(p => BACKS.includes(p.pos))
    return b.length ? b.reduce((s, p) => s + p.ca, 0) / b.length : 0
  })()
  const lean = packCa - backsCa >= 3 ? 'the pack is the stronger half of this side'
    : backsCa - packCa >= 3 ? 'the strength is out wide, not up front'
    : 'the two halves of the side are about level'
  const ageWord = avgAge >= 28.5 ? 'an experienced group nearing the end of a cycle'
    : avgAge >= 26.5 ? 'a settled group in its prime years'
    : avgAge >= 24.5 ? 'a young squad with room to grow'
    : 'a very young squad that will need patience'
  return {
    id: state.nextId++, week: 1, season: 0, type: 'general', read: false,
    subject: `📋 Your assistant's read on the squad`,
    // One fact per line, no throat-clearing: the user's brevity pass (19A)
    // found the original at 669 characters of paragraphs on a phone screen.
    body: `"The numbers, before anything else.\n\n`
      + `${senior} senior men, average age ${avgAge.toFixed(1)} - ${ageWord}.\n`
      + `Average ability ${Math.round(avgCa)}/100, and ${lean}.\n`
      + `Best on paper: ${best.map(p => `${p.name} (${p.pos}, ${Math.round(p.ca)})`).join(', ')}.\n`
      + (thin.length
        ? `Short at ${thin.join(', ')} - one injury there and someone plays out of position.\n`
        : `Every position has cover.\n`)
      + `Board expects you to ${boardObjective(uc.rep).text}. Budget ${fmtMoney(uc.budget)}, wages ${fmtMoney(squad.reduce((s, p) => s + p.wage, 0))} a week.\n\n`
      + `I will have a read on the first opponent by Friday."`,
  }
}
