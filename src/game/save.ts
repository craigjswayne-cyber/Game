import type { Club, GameState } from './model'
import { ensureCaptains } from './analysis'
import { buildPlayer, deriveCaps, deriveHist, deriveTrait, resetIds } from './attributes'
import { LEAGUE_DEFS, seedExClubs } from './newgame'
import { autoSelect } from './matchEngine'
import { regenName } from './nations'
import { hashString, mulberry32 } from './rng'
import { seedNatRank } from './natrank'

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
  s.facilities ??= {}
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
  s.agency ??= { seniors: [], kids: [], best: {} }
  for (const c of Object.values(s.clubs)) { c.captain ??= null; c.vice ??= null; c.legends ??= []; c.marquee ??= []; c.tactic.roles ??= []; if (c.id !== s.userClubId) c.coach ??= 'The Head Coach' }
  const PERS = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader'] as const
  for (const p of Object.values(s.players)) {
    p.pers ??= PERS[p.id % PERS.length]
    p.sc ??= p.clubId === s.userClubId ? 100 : 30
    p.onLoan ??= false
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
        country: rc.country, stadium: rc.stadium, capacity: rc.capacity,
        colors: rc.colors, rep: rc.rep, leagueId: def.id,
        budget: rc.budget, balance: Math.round(rc.budget * 0.6),
        players: [],
        tactic: { style: 50, tempo: 50, kicking: 50, aggression: 50, lineup: new Array(23).fill(null) },
        wageBudget: Math.round(rc.budget * 0.9 + 2_500_000),
        boardConfidence: 70,
        captain: null,
        coach: regenName(rng, rc.country === 'EUR' ? 'ENG' : rc.country),
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

  // pre-2025 former clubs (old-boy stories): fills only players still unset
  seedExClubs(s)

  ensureCaptains(s)
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
