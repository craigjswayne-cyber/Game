import type { Club, FacilityId, GameState } from './model'
import { initFacilities } from './model'
import { ensureCaptains } from './analysis'
import { buildPlayer, deriveCaps, deriveHist, deriveTrait, resetIds } from './attributes'
import { LEAGUE_DEFS, seedExClubs } from './newgame'
import { autoSelect } from './matchEngine'
import { regenName, worldNames } from './nations'
import { hashString, mulberry32 } from './rng'
import { seedNatRank } from './natrank'
import { seedStaffPeople } from './staff'
import { ensureAcademyLeague, topUpAcademy } from './academy'

const DB_NAME = 'rugby-manager'
const STORE = 'saves'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface SaveMeta {
  slot: string
  club: string
  season: number
  week: number
  savedAt: number
  managerName: string
}

export async function saveGame(slot: string, state: GameState): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const meta: SaveMeta = {
      slot,
      club: state.clubs[state.userClubId]?.name ?? '?',
      season: state.season,
      week: state.week,
      savedAt: Date.now(),
      managerName: state.managerName,
    }
    tx.objectStore(STORE).put({ meta, state: JSON.parse(JSON.stringify(state)) }, slot)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** Backfill fields added since a save was written. */
export function migrate(s: GameState): GameState {
  s.shortlist ??= []
  s.staff ??= { assistant: 0, physio: 0, scout: 0, attack: 0, defence: 0, scrumCoach: 0, kicking: 0, academyCoach: 0 }
  s.staff.attack ??= 0
  s.staff.defence ??= 0
  s.staff.scrumCoach ??= 0
  s.staff.kicking ??= 0
  s.staff.academyCoach ??= 0
  s.mgr ??= { m: 0, w: 0, d: 0, l: 0, trophies: [], finishes: [], signings: 0, spent: 0 }
  s.mgr.moms ??= 0
  s.vacancies ??= []
  s.devFocus ??= []
  s.natTeam ??= null
  s.natOffer ??= null
  s.natLineup ??= null
  s.objectives ??= ['youth', 'derby']
  s.finHist ??= []
  s.boardOwed ??= false
  // facilities moved onto the clubs (every club in the world has an estate,
  // and taking a new job means inheriting that club's buildings). Levels the
  // manager already paid for at his own club are kept, whichever is higher.
  for (const c of Object.values(s.clubs)) {
    if (!c.facilities) c.facilities = initFacilities(c, s.seed)
  }
  if (s.facilities && Object.keys(s.facilities).length) {
    const uc = s.clubs[s.userClubId]
    if (uc) {
      for (const [fid, lvl] of Object.entries(s.facilities) as [FacilityId, number][]) {
        uc.facilities = { ...(uc.facilities ?? {}), [fid]: Math.max(lvl, uc.facilities?.[fid] ?? 0) }
      }
    }
    s.facilities = {}
  }
  s.decisions ??= []
  s.analyst ??= null
  s.analystRecord ??= { right: 0, wrong: 0 }
  s.commission ??= null
  s.scoutFinds ??= null
  s.facilityBuild ??= null
  s.facilityAskCooldown ??= 0
  // the backroom staff became people: give every level already paid for a face
  seedStaffPeople(s)
  s.celebration ??= null
  s.records ??= {}
  s.mentors ??= []
  s.chem ??= {}
  s.grudges ??= []
  s.review ??= null
  s.fanMood ??= 60
  s.hof ??= []
  s.scoutFocus ??= null
  s.slAlerted ??= []
  s.pledges ??= []
  s.intakeClass ??= null
  s.preContracts ??= []
  s.takeover ??= null
  s.newOwnerUntil ??= null
  s.derbyBook ??= {}
  s.annals ??= s.review ? [s.review] : []
  s.crisisAt ??= {}
  seedNatRank(s)
  s.natConfidence ??= s.natTeam ? 60 : null
  s.tenureStart ??= s.season
  s.legendOf ??= []
  s.vsBook ??= {}
  s.gateRecord ??= null
  s.potyRoll ??= []
  s.courtedAt ??= 0
  s.courtedBy ??= null
  s.vowedAt ??= 0
  s.agency ??= { seniors: [], kids: [], best: {} }
  for (const c of Object.values(s.clubs)) { c.captain ??= null; c.vice ??= null; c.legends ??= []; c.marquee ??= []; c.tactic.roles ??= []; if (c.id !== s.userClubId) c.coach ??= 'The Head Coach' }
  const PERS = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader'] as const
  for (const p of Object.values(s.players)) {
    p.pers ??= PERS[p.id % PERS.length]
    p.sc ??= p.clubId === s.userClubId ? 100 : 30
    p.onLoan ??= false
    p.retiring ??= false
    p.debutPending ??= null
    p.ca0 ??= p.ca
    p.rust ??= 0
    p.loanFrom ??= null
    p.acad ??= false
    p.stats.mins ??= 0
    if (p.trait === undefined) p.trait = deriveTrait(p)
    p.hist ??= deriveHist(p)
    p.caps ??= deriveCaps(p)
  }
  // CRITICAL: restore the player-id counter. Only newGame resets it, so a
  // cold-started session that loads a save would otherwise mint new player
  // ids from 1, silently overwriting existing players at the next intake.
  const maxPid = Object.keys(s.players).reduce((m, k) => Math.max(m, Number(k)), 0)
  resetIds(maxPid + 1)

  // leagues added in later builds: inject their clubs & squads so existing
  // careers gain them (fixtures/tables arrive at the next season rebuild)
  const rng = mulberry32(0xadd1e ^ (s.season * 977 + s.week))
  for (const def of LEAGUE_DEFS()) {
    for (const rc of def.clubs) {
      if (s.clubs[rc.id]) continue
      const club: Club = {
        id: rc.id, name: rc.name, short: rc.short, city: rc.city,
        country: rc.country, stadium: rc.stadium, capacity: rc.capacity, capacity0: rc.capacity,
        colors: rc.colors, rep: rc.rep, leagueId: def.id,
        budget: rc.budget, balance: Math.round(rc.budget * 0.6),
        players: [],
        tactic: { style: 50, tempo: 50, kicking: 50, aggression: 50, lineup: new Array(23).fill(null) },
        wageBudget: Math.round(rc.budget * 0.9 + 2_500_000),
        boardConfidence: 70,
        captain: null,
        coach: regenName(rng, rc.country === 'EUR' ? 'ENG' : rc.country, worldNames(s)),
      }
      for (const rp of rc.players) {
        const p = buildPlayer(rp, club.id, (0xadd1e ^ hashString(rc.id)) + club.players.length * 13, s.season)
        s.players[p.id] = p
        club.players.push(p.id)
      }
      s.clubs[club.id] = club
      club.tactic.lineup = autoSelect(s, club.players.map(id => s.players[id]).filter(Boolean))
    }
  }

  // squads were raised to 38 seniors / 42 men (user feedback: too thin) -
  // existing careers get the same depth once, fringe quality, thinnest
  // positions first. Saves stamped at the short-lived 38 standard top up too
  if ((s.squadDepth ?? 0) < 42) {
    s.squadDepth = 42
    const FILL = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB'] as const
    for (const club of Object.values(s.clubs)) {
      let guard = 0
      while (club.players.length < 42 && guard++ < 14) {
        const byPos: Record<string, number> = {}
        for (const id of club.players) {
          const p = s.players[id]
          if (p) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
        }
        const pos = [...FILL].sort((a, b) => (byPos[a] ?? 0) - (byPos[b] ?? 0))[0]
        const p = buildPlayer(
          {
            name: regenName(rng, club.country, worldNames(s)), pos, age: 21 + Math.floor(rng() * 9),
            nat: club.country, q: Math.max(42, club.rep - 16 + Math.floor(rng() * 10)),
            gk: (pos === 'FH' || pos === 'FB') && rng() < 0.3,
          },
          club.id, 0xdee9 + club.players.length * 31 + guard, s.season)
        s.players[p.id] = p
        club.players.push(p.id)
      }
    }
  }

  // The academy became a 27-man team with its own A League (feedback 10G), so an
  // existing career gets the same academy in the same shape.
  //
  // PER CLUB, not per save. The first cut stamped s.acadDepth and skipped the work
  // if the save already carried it - which meant the 24 clubs the natl1/jl1
  // migration injects a few lines above, and every club a future build adds, came
  // into the world with no academy at all and no way to field an A League side.
  // topUpAcademy is a no-op on a full academy, so asking all 101 costs nothing.
  for (const club of Object.values(s.clubs)) topUpAcademy(s, club, rng, 0xACAD)
  ensureAcademyLeague(s)

  // clubs injected by a later build get an estate too
  for (const c of Object.values(s.clubs)) c.facilities ??= initFacilities(c, s.seed)
  // the catchment anchor. An existing career may already have extended its
  // ground, and shrinking the anchor retroactively would tell the manager his
  // own stand should never have been built - so today's capacity is the anchor
  for (const c of Object.values(s.clubs)) c.capacity0 ??= c.capacity

  // pre-2025 former clubs (old-boy stories): fills only players still unset
  seedExClubs(s)

  ensureCaptains(s, true)
  return s
}

export async function loadGame(slot: string): Promise<GameState | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(slot)
    req.onsuccess = () => { db.close(); resolve(req.result ? migrate(req.result.state as GameState) : null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function listSaves(): Promise<SaveMeta[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      db.close()
      resolve((req.result ?? []).map((r: { meta: SaveMeta }) => r.meta).sort((a, b) => b.savedAt - a.savedAt))
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function deleteSave(slot: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(slot)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
