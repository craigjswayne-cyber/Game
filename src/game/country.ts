// The country desk: the national coach SHAPES his squad, he does not just
// receive it (user: "the game doesnt feel like it currently nails the
// international element. its meant to be the pinnacle but is hidden away").
// The window-open announcement hands him the federation's default list;
// these functions let him call up and drop names while the window is open,
// under the same rules the federation used to build it.
//
// Everything here is a user decision on explicit state - no rng, no dials,
// nothing to measure. Refusals return a message so the screen can say WHY,
// the same contract the treasury release uses.
import type { GameState, Player } from './model'
import { clamp } from './rng'
import { activeWindows } from './season'
import { NAT_SQUAD_FLOOR, clubQuotaLeft, conflictedClub, federationList, homeBased, nationName, nationVars } from './nations'
import { t } from './i18n'
import { CAMP_FOCI, type CampFocus } from './natcamp'
import { clubManLeftOut, natWinNow } from './natwin'
import { islesCoach } from './isles'

const HOME4 = ['ENG', 'IRE', 'SCO', 'WAL']

// the squad size, the floor and the home-based rule live in nations.ts,
// because the season engine builds the federation's own list and must obey the
// same rules the coach does - and country.ts already imports from season.ts,
// so season.ts cannot import back from here
export { NAT_SQUAD_SIZE, NAT_SQUAD_FLOOR, homeBased } from './nations'

/** THE SIDE ON THE DESK (QA, 1.9.15). On an Isles tour it is the tour party:
 *  the coach names it, drops from it and calls into it as he does his own
 *  country's, which the assistant runs for the summer. Otherwise his nation. */
export function deskNat(state: GameState): string | null {
  if (islesCoach(state) && state.natSquads['LIO']) {
    const w = activeWindows(state).find(w => w.nations.includes('LIO') && state.week >= w.start - 1 && state.week <= w.end)
    if (w) return 'LIO'
  }
  return state.natTeam ?? null
}

/** The open call-up window for the user's nation, or null between windows.
 *  Open means the squad exists AND the calendar says the window is running -
 *  after w.end the squad list lingers one week for the release housekeeping,
 *  and that week is not a week to be making calls. */
export function natWindow(state: GameState): { size: number } | null {
  const nat = deskNat(state)
  if (!nat || !state.natSquads[nat]) return null
  const w = activeWindows(state).find(w =>
    w.nations.includes(nat) && state.week >= w.start && state.week <= w.end)
  return w ? { size: w.size } : null
}

/** Is this player callable for the user's nation at all? One predicate so the
 *  screen's list and the call-up guard can never disagree.
 *
 *  Deliberately thin (user: "there should be no age limits or restrictions
 *  on who should be picked"): the passport, the treatment table and not
 *  already being in a camp are the only bars. Age, rating, loan status and
 *  even holding a club contract are the COACH's judgement, not the game's. */
function callable(state: GameState, p: Player): boolean {
  const nat = deskNat(state)
  if (!nat) return false
  const natMatch = nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat
  return natMatch && homeBased(state, p, nat) && !p.injury && !p.natSquad
}

/** The next men in: EVERY qualified player outside the current Test squads,
 *  best first, the full list - no cap, no rating floor, no velvet rope. */
export function natEligible(state: GameState): Player[] {
  if (!state.natTeam) return []
  return Object.values(state.players)
    .filter(p => callable(state, p))
    .sort((a, b) => b.ca - a.ca)
}

/** WHY A QUALIFIED MAN IS NOT ON THE LIST (owner, 1.9.16).
 *
 *  "Marcus Smith isn't available for England team?" He was injured, and the
 *  list simply left him off: a first-choice fly-half vanished with no word.
 *  The desk now shows these men too, greyed, with the reason beside them. One
 *  predicate again: a man is here exactly when `callable` refuses him for a
 *  reason the coach cannot change this week. */
export type NatBar = 'injured' | 'abroad' | 'noclub'
export function natBarOf(state: GameState, p: Player): NatBar | null {
  const nat = deskNat(state)
  if (!nat) return null
  if (!(nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat)) return null
  if (!homeBased(state, p, nat)) return p.clubId ? 'abroad' : 'noclub'
  return p.injury ? 'injured' : null
}
export function natUnavailable(state: GameState): Player[] {
  if (!state.natTeam) return []
  return Object.values(state.players)
    .filter(p => !p.natSquad && natBarOf(state, p) != null)
    .sort((a, b) => b.ca - a.ca)
}

/** A Test squad's shape: the fewest of each shirt a matchday 23 can be
 *  picked from, with cover (owner, 1.9.15: "if you dont have any lp for
 *  example in the squad, make sure more lps are in the call up"). */
export const NAT_SHAPE: Record<string, number> = { LP: 3, HK: 3, TP: 3, LK: 4, FL: 3, N8: 2, SH: 3, FH: 2, CE: 3, WG: 3, FB: 2 }

/** The shirts the named squad is short of, in the order of the team sheet. */
export function natShort(state: GameState): string[] {
  const nat = deskNat(state)
  if (!nat) return []
  const named = (state.natSquads[nat] ?? []).map(id => state.players[id]).filter((p): p is Player => !!p)
  return Object.keys(NAT_SHAPE).filter(pos => named.filter(p => p.pos === pos).length < NAT_SHAPE[pos])
}

/** The coaches' squad: every shirt covered first (best first within it),
 *  then the best of the rest, in the order given, up to the window's size.
 *  Calls up through natCallUp, so every rule the coach obeys still holds. */
export function suggestNatSquad(state: GameState, order: Player[], size: number): void {
  const nat = deskNat(state)
  if (!nat) return
  const count = (pos: string) => (state.natSquads[nat] ?? []).filter(id => state.players[id]?.pos === pos).length
  for (const pos of Object.keys(NAT_SHAPE)) {
    for (const p of order) {
      if ((state.natSquads[nat] ?? []).length >= size || count(pos) >= NAT_SHAPE[pos]) break
      if (p.pos === pos) natCallUp(state, p.id)
    }
  }
  for (const p of order) {
    if ((state.natSquads[nat] ?? []).length >= size) break
    natCallUp(state, p.id)
  }
}

/** Call a player into the window squad. Returns null on success, or the
 *  refusal the screen prints. */
export function natCallUp(state: GameState, playerId: number): string | null {
  const nat = deskNat(state)
  if (!nat) return t('reply.noNationalJob')
  const w = natWindow(state)
  const squad = state.natSquads[nat]
  if (!w || !squad) return t('reply.noCampWindow')
  const p = state.players[playerId]
  if (!p) return t('reply.noSuchPlayer')
  if (squad.includes(playerId) || p.natSquad) return t('reply.alreadyInTestSquad', { player: p.name })
  if (!(nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat)) return t('reply.notQualified', { player: p.name })
  // the country's name, not its code; a player with no club is not abroad
  if (!homeBased(state, p, nat)) return t(p.clubId ? 'reply.notHomeBased' : 'reply.notHomeBasedFree', { player: p.name, nat: nationName(nat), ...nationVars(nat) })
  if (p.injury) return t('reply.injuredNotPassed', { player: p.name })
  if (squad.length >= w.size) return t('reply.squadCapped', { n: w.size })
  // ONE MAN, TWO JOBS (9.10, nations.ts): while he also runs a club, no more
  // men from a club his side meets than the federation itself would take
  if (p.clubId && clubQuotaLeft(state, nat, w.size, squad, p.clubId) <= 0) {
    const club = state.clubs[p.clubId]?.short ?? ''
    const n = federationList(state, nat, w.size).filter(q => q.clubId === p.clubId).length
    return p.clubId === conflictedClub(state)
      ? t('reply.ownClubQuota', { player: p.name, club, n })
      : t('reply.rivalQuota', { player: p.name, club, n })
  }
  squad.push(playerId)
  p.natSquad = true
  // a man recalled after being sent home this window gets the sting back, not
  // a second dose of pride: call-and-drop is not a lever on anyone's morale
  const sent = state.natSent ?? []
  const back = sent.indexOf(playerId)
  if (back >= 0) {
    sent.splice(back, 1)
    // back what the drop took and no more: at the morale floor the drop took
    // nothing, and a flat +0.7 made drop-and-recall a gain (QA, 1.9.15)
    const lost = state.natSentLoss?.[playerId] ?? 0.7
    if (state.natSentLoss) delete state.natSentLoss[playerId]
    p.morale = clamp(p.morale + lost, 1, 10)
  } else {
    const before = p.morale
    p.morale = clamp(p.morale + 0.5, 1, 10) // the proudest phone call in rugby
    ;(state.natCallGain ??= {})[playerId] = p.morale - before
  }
  // the 23 is picked from the squad - a changed squad voids the old teamsheet
  if (state.natLineup?.team === nat) state.natLineup = null
  return null
}

/** Drop a player from the window squad. Returns null on success, or the
 *  refusal the screen prints. */
export function natDrop(state: GameState, playerId: number): string | null {
  const nat = deskNat(state)
  if (!nat) return t('reply.noNationalJob')
  const w = natWindow(state)
  const squad = state.natSquads[nat]
  if (!w || !squad) return t('reply.noWindow')
  const idx = squad.indexOf(playerId)
  if (idx < 0) return t('reply.notInSquad')
  const p = state.players[playerId]
  // his own club's men on the federation's list stay in camp while he also
  // runs that club, or leaving them home would be the favour 9.10 rules out
  const mine = conflictedClub(state)
  if (p && mine && p.clubId === mine && !p.injury &&
      federationList(state, nat, w.size).some(q => q.id === playerId)) {
    return t('reply.ownClubKept', { player: p.name, club: state.clubs[mine]?.short ?? '' })
  }
  // THE FLOOR IS FOR A NAMED SQUAD (owner, 1.9.16: "I accidentally picked a
  // wrong player when selecting my 32, you should be able to remove anyone
  // until you submit"). Until the announcement the sheet is a draft: a man
  // named by mistake comes off it whatever the count (Continue is held until
  // the sheet is legal, so a short draft cannot reach a Test). Once the squad
  // is announced, 23 dress on the day and it cannot be trimmed below that.
  const named = natWinNow(state)?.announced ?? true
  if (named && squad.length <= NAT_SQUAD_FLOOR) return t('reply.squadFloor', { n: NAT_SQUAD_FLOOR })
  squad.splice(idx, 1)
  // A DRAFT CORRECTION IS NOT A SNUB (1.9.16). Before the announcement nobody
  // outside the room has seen the sheet: the man comes off it, the lift the
  // call gave him goes back, and that is all. No sting, no "sent home", no
  // club grievance - those belong to a squad that was named.
  if (p && !named) {
    p.natSquad = false
    const gain = state.natCallGain?.[playerId]
    if (gain != null) { p.morale = clamp(p.morale - gain, 1, 10); delete state.natCallGain![playerId] }
    if (state.natLineup?.team === nat) state.natLineup = null
    return null
  }
  if (p) {
    p.natSquad = false
    const before = p.morale
    p.morale = clamp(p.morale - 0.7, 1, 10) // being sent home from camp stings
    ;(state.natSentLoss ??= {})[playerId] = before - p.morale
    // and sent home by your own club's coach is personal, on top (1.9.14,
    // natwin.ts clubManLeftOut). On top, so a recall (which gives back the
    // sting) can never make a drop-and-recall a morale gain. Not for an
    // injured man: sending him home is the physio's call, not a snub (1.9.15)
    if (!p.injury) clubManLeftOut(state, p)
    ;(state.natSent ??= []).push(playerId)
  }
  if (state.natLineup?.team === nat) state.natLineup = null
  return null
}

/**
 * THE NEXT TIME THE COACH NAMES A SQUAD - in weeks, from right now.
 *
 * Owner: "could we have days til squad work." The window calendar has always
 * known this and nothing ever said it, so a Test job spent most of the season
 * looking like nothing was happening. Returns null when a window is already
 * open (there is nothing to count down to) or when the season holds no more
 * for this nation.
 */
export function weeksToSquad(state: GameState): number | null {
  const nat = state.natTeam
  if (!nat || natWindow(state)) return null
  const teams = nat === 'LIO' ? [nat] : [nat, ...(HOME4.includes(nat) ? ['LIO'] : [])]
  const starts = activeWindows(state)
    // a window already running but not yet opened for him (QA, 1.9.15: the
    // World Championship's first week skipped to the next window, "Squad
    // named in 161 days") counts as this week
    .filter(w => w.nations.some(n => teams.includes(n)) && w.end >= state.week)
    .map(w => Math.max(state.week, w.start))
    .sort((a, b) => a - b)
  return starts.length ? starts[0] - state.week : null
}

/**
 * THE HOLD: does the coach still owe his country a squad?
 *
 * One predicate, read by continueWeek (which acts on it) and by the Continue
 * button (which labels itself from it) - the same contract the press hold uses,
 * because a button that says Continue and then refuses is the illegible gate
 * this codebase has now fixed twice.
 */
export function natSquadHold(state: GameState): { n: number } | null {
  // No unemployed test. A manager out of a club job can still hold a Test job
  // (the Profile offers "clear the desk and go all-in on country", and a sacking
  // does not end a national tenure), and the camp still opens empty for him in
  // manageInternationals. With the hold switched off for him, nothing named his
  // squad and his country played its Tests with nobody in the camp at all.
  const nat = deskNat(state)
  if (!nat) return null
  if (!natWindow(state)) return null
  const named = (state.natSquads[nat] ?? []).length
  const short = NAT_SQUAD_FLOOR - named
  if (short <= 0) return null
  // only a hold that can be cleared is a hold - see days.ts squadBlock
  if (named + natEligible(state).length < NAT_SQUAD_FLOOR) return null
  return { n: short }
}

/** The open window for the user's nation, with its weeks, or null: the same
 *  test natWindow makes (natcamp.ts, 1.9.14). */
export function campWindow(state: GameState): { start: number; end: number } | null {
  // the side on the desk: the tour party on an Isles tour (1.9.16), or the
  // focus he chose there was worn by his country under the assistant
  const nat = deskNat(state)
  if (!nat || !state.natSquads[nat]) return null
  const w = activeWindows(state).find(w => w.nations.includes(nat) && state.week >= w.start && state.week <= w.end)
  return w ? { start: w.start, end: w.end } : null
}

/** Choose the camp's focus for this window. False outside one: no camp. */
export function setCampFocus(state: GameState, focus: CampFocus): boolean {
  const w = campWindow(state)
  if (!w || !CAMP_FOCI.includes(focus)) return false
  state.natCamp = { nat: deskNat(state)!, season: state.season, start: w.start, end: w.end, focus }
  return true
}
