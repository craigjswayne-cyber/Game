// The world's register of people over the summer: who leaves it, whose name
// stays taken, and the lists that must stop pointing at men who have gone.
import type { GameState, Player } from '../model'
import { dropNameRegistry, keptRetiredNames } from '../nations'

/** A player leaves the world, and his name stays taken for a couple of summers
 *  (GameState.retiredNames, trimmed by pruneNames). */
export function forget(state: GameState, p: Player) {
  ;(state.retiredNames ??= []).push(p.name.toLowerCase())
  delete state.players[p.id]
}

/** The name registry's two lists, trimmed once a summer (nations.ts).
 *
 *  takenNames exists for the names handed out BEFORE their players exist
 *  (the intake class, a scout's finds); once a man is in the world or has
 *  left it his name is covered by players or retiredNames, so the list is
 *  trimmed to what only it knows. Unpruned it was 5% of a fifteen-season
 *  save (scripts/qa2/savesize.ts).
 *
 *  retiredNames keeps the newest RETIRED_NAMES_KEPT departures. Its one reader
 *  is the registry, and what the registry needs from it is that a name does
 *  not come back the summer after its man left; kept whole it was the
 *  biggest list in a long save (1.8.3). Every forget() happens earlier in
 *  the rollover than this, so between summers the list never runs past the
 *  cap and migrate's trim of an old save is a no-op on a new one.
 *
 *  Both lists are what a reload rebuilds the registry from, so the running
 *  game drops its cached registry here and rebuilds from the same lists:
 *  otherwise it would still hold the trimmed names and a reload would not
 *  (scripts/qa/determinism.ts). Runs whether or not the manager is in a job,
 *  unlike boardReinvests, where the takenNames trim used to live. */
export function pruneNames(state: GameState) {
  if (state.takenNames?.length) {
    const held = new Set<string>()
    for (const p of Object.values(state.players)) held.add(p.name.toLowerCase())
    for (const n of state.retiredNames ?? []) held.add(n.toLowerCase())
    state.takenNames = [...new Set(state.takenNames)].filter(n => !held.has(n))
  }
  if (state.retiredNames?.length) state.retiredNames = keptRetiredNames(state.retiredNames)
  dropNameRegistry(state)
}

/** The ledgers that hold player ids, cleared of the men the summer took:
 *  chemistry pairs, the agency's boards, the scout's report, the shortlist. */
export function pruneDeparted(state: GameState) {
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
  // The scout's filed report holds player ids too, and it was never pruned -
  // commissioned scouting arrived after this block was written. Found by the
  // release audit: "s4w1 scout report names a missing player 1385", a ghost
  // left behind when the free-agent pool was trimmed. Same treatment as the
  // agency boards: a report pointing at a deleted player is a broken report.
  if (state.scoutFinds?.length) {
    state.scoutFinds = state.scoutFinds.filter(f => state.players[f.playerId])
    if (!state.scoutFinds.length) state.scoutFinds = null
  }
  // and the verdicts behind the Scouting page
  if (state.scoutRecs?.length) state.scoutRecs = state.scoutRecs.filter(r => state.players[r.playerId])
  // the shortlist has the same shape of problem
  if (state.shortlist?.length) {
    state.shortlist = state.shortlist.filter(pid => state.players[pid])
  }
}
