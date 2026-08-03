import type { GameState } from './model'
import { ensureCaptains } from './analysis'

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
function migrate(s: GameState): GameState {
  s.shortlist ??= []
  s.staff ??= { assistant: 0, physio: 0, scout: 0, attack: 0, defence: 0, scrumCoach: 0, kicking: 0 }
  s.staff.attack ??= 0
  s.staff.defence ??= 0
  s.staff.scrumCoach ??= 0
  s.staff.kicking ??= 0
  s.mgr ??= { m: 0, w: 0, d: 0, l: 0, trophies: [], finishes: [], signings: 0, spent: 0 }
  s.vacancies ??= []
  s.devFocus ??= []
  s.natTeam ??= null
  s.natOffer ??= null
  s.natLineup ??= null
  s.objectives ??= ['youth', 'derby']
  for (const c of Object.values(s.clubs)) { c.captain ??= null; if (c.id !== s.userClubId) c.coach ??= 'The Head Coach' }
  const PERS = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader'] as const
  for (const p of Object.values(s.players)) {
    p.pers ??= PERS[p.id % PERS.length]
    p.sc ??= p.clubId === s.userClubId ? 100 : 30
    p.onLoan ??= false
    p.ca0 ??= p.ca
    p.rust ??= 0
    p.loanFrom ??= null
  }
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
