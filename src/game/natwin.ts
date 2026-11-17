// ---- THE WINDOW AS A CAMPAIGN (1.9.14) ----
//
// Owner, on the national job: it "needs to be improved and distinct" and "an
// honour"; after the review, "do not hold anything back". A Test window used
// to be a list of 32 names and some fixtures. Now each one has a shape:
//
//   camp opens   the union sets a target for the window (wins, read off the
//                world ranking of the sides on the fixture list)
//   the squad    named on the desk, then ANNOUNCED: debuts, recalls and the
//                big names left out, with the press's read and the dressing
//                rooms' reaction
//   the camp     one thing happens in camp, and the coach answers it
//   the Tests    each one counts towards the target
//   the review   when the window closes the union says whether it was met,
//                moves its confidence, and can warn or (below 20) end it
//
// Nothing here draws from the match or world streams: choices are seeded on
// the window (seed, season, start), so the world a coach who never opens the
// desk lives in is the world as it was.
import type { GameState, Player } from './model'
import { clamp } from './rng'
import { closeNatTenure } from './model'
import { tIn } from './i18n'
import { nationNameIn } from './nations'

export type CampEventKind = 'rest' | 'curfew' | 'scare' | 'bolter'
export type CampAnswer = 'a' | 'b' | 'c'
export type NatWin = NonNullable<GameState['natWin']>

/** The coach's nation's window, if it is this one. */
export function natWinNow(state: GameState): NatWin | null {
  const w = state.natWin
  return w && state.natTeam && w.nat === state.natTeam && w.season === state.season && state.week >= w.start && state.week <= w.end + 1 ? w : null
}

/** The fixtures of the coach's nation inside a window. */
function windowTests(state: GameState, nat: string, start: number, end: number) {
  return state.fixtures.filter(f => (f.homeId === nat || f.awayId === nat) && f.week >= start && f.week <= end &&
    !state.clubs[f.homeId] && !state.clubs[f.awayId])
}

/** The union's target: one win for each side on the list ranked below us,
 *  less one when that would ask for a clean sweep of three or more, and never
 *  less than one. */
export function windowTarget(state: GameState, nat: string, start: number, end: number): { tests: number; target: number } {
  const tests = windowTests(state, nat, start, end)
  const me = state.natRank?.[nat] ?? 70
  const favoured = tests.filter(f => (state.natRank?.[f.homeId === nat ? f.awayId : f.homeId] ?? 70) < me).length
  const n = tests.length
  const target = n === 0 ? 0 : Math.min(n, favoured >= 3 ? favoured - 1 : Math.max(1, favoured))
  return { tests: n, target }
}

/** Camp opens: the window's ledger, with the union's target. */
export function openNatWindow(state: GameState, w: { id?: string; start: number; end: number }): void {
  const nat = state.natTeam
  if (!nat) return
  if (state.natWin && state.natWin.nat === nat && state.natWin.season === state.season && state.natWin.start === w.start) return
  const { tests, target } = windowTarget(state, nat, w.start, w.end)
  state.natWin = {
    nat, season: state.season, start: w.start, end: w.end, comp: w.id ?? '',
    tests, target, w: 0, d: 0, l: 0, announced: false,
  }
  if (tests > 0) {
    const v = { nat: nationNameIn('en', nat), nat_n: nat, target, tests, comp: state.comps[w.id ?? '']?.name ?? '' }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
      subject: tIn('en', 'news.natTargetSubj', v), body: tIn('en', 'news.natTarget', v),
      k: 'news.natTarget', v,
    })
  }
}

/** A Test inside the window counts towards it. */
export function noteWindowResult(state: GameState, us: number, them: number): void {
  const w = natWinNow(state)
  if (!w || state.week > w.end) return
  if (us > them) w.w++
  else if (us < them) w.l++
  else w.d++
}

// ---- the announcement ----

const caps = (p: Player | undefined) => p?.caps ?? 0

/** Can the squad be announced now? Named to the floor, window open, not yet. */
export function canAnnounce(state: GameState, floor: number): boolean {
  const w = natWinNow(state)
  if (!w || w.announced || state.week > w.end) return false
  return (state.natSquads[w.nat] ?? []).length >= floor
}

/** Announce the squad: debuts, recalls, the big names left out, the press's
 *  read, and how the dressing rooms take it. Then the camp's one event. */
export function announceSquad(state: GameState, eligibleTop: Player[]): NatWin['reveal'] | null {
  const w = natWinNow(state)
  if (!w || w.announced) return null
  const squad = (state.natSquads[w.nat] ?? []).slice()
  const prev = state.natPrevSquad && state.natPrevSquad.length ? state.natPrevSquad : null
  const debuts = squad.filter(id => caps(state.players[id]) === 0)
  const recalls = prev ? squad.filter(id => !prev.includes(id) && caps(state.players[id]) > 0) : []
  const omitted = (prev
    ? prev.filter(id => !squad.includes(id) && state.players[id] && !state.players[id].injury && caps(state.players[id]) >= 5)
    : eligibleTop.filter(p => caps(p) >= 10 && !squad.includes(p.id)).map(p => p.id))
    .sort((a, b) => caps(state.players[b]) - caps(state.players[a])).slice(0, 4)
  for (const id of omitted) {
    const p = state.players[id]
    if (!p) continue
    // one of his own club's men: personal, and answered by the club's mood
    if (clubManLeftOut(state, p)) continue
    p.morale = clamp(p.morale - (p.pers === 'Temperamental' || p.pers === 'Ambitious' ? 0.6 : 0.3), 1, 10)
  }
  const bigOut = omitted.some(id => caps(state.players[id]) >= 30)
  const tone: 'bold' | 'experience' | 'shock' | 'settled' =
    debuts.length >= 5 ? 'bold' : bigOut ? 'shock' : recalls.length >= 3 ? 'experience' : 'settled'
  w.announced = true
  w.reveal = { debuts, recalls, omitted, tone, seen: false }
  const v = { nat: nationNameIn('en', w.nat), nat_n: w.nat, n: squad.length, debuts: debuts.length, recalls: recalls.length, omitted: omitted.length, tone_k: `natwin.tone_${tone}` }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: true,
    subject: tIn('en', 'news.natAnnouncedSubj', v), body: tIn('en', 'news.natAnnounced', v),
    k: 'news.natAnnounced', v,
  })
  w.event = campEvent(state, w, squad)
  return w.reveal
}

// ---- the camp's one event ----

/** Deterministic on the window: the same camp always throws up the same
 *  story, and a world without a national coach never draws for one. */
function campEvent(state: GameState, w: NatWin, squad: number[]): NatWin['event'] {
  const ps = squad.map(id => state.players[id]).filter((p): p is Player => !!p && !p.injury)
  if (!ps.length) return undefined
  const h = (Math.abs(state.seed) + state.season * 31 + w.start * 7) >>> 0
  const order: CampEventKind[] = ['rest', 'curfew', 'scare', 'bolter']
  const pick = <T,>(xs: T[]) => xs[h % xs.length]
  for (let k = 0; k < order.length; k++) {
    const kind = order[(h + k) % order.length]
    let p: Player | undefined
    if (kind === 'rest') p = pick(ps.filter(q => q.clubId && q.clubId !== state.userClubId).sort((a, b) => a.cond - b.cond).slice(0, 3))
    if (kind === 'curfew') p = pick(ps.filter(q => caps(q) >= 3).sort((a, b) => a.id - b.id))
    if (kind === 'scare') p = pick([...ps].sort((a, b) => b.ca - a.ca).slice(0, 5))
    if (kind === 'bolter') p = pick(ps.filter(q => caps(q) === 0).sort((a, b) => b.ca - a.ca).slice(0, 3))
    if (p) return { kind, playerId: p.id, caps: caps(p) }
  }
  return undefined
}

/** Answer the camp's event. Returns false if there is nothing to answer. */
export function answerCampEvent(state: GameState, answer: CampAnswer, floor: number): boolean {
  const w = natWinNow(state)
  const e = w?.event
  if (!w || !e || e.answer) return false
  const p = state.players[e.playerId]
  if (!p) return false
  const squad = state.natSquads[w.nat] ?? []
  const others = squad.filter(id => id !== p.id).map(id => state.players[id]).filter((q): q is Player => !!q)
  const leave = () => {
    if (squad.length <= floor) return false
    const i = squad.indexOf(p.id)
    if (i >= 0) squad.splice(i, 1)
    p.natSquad = false
    if (state.natLineup?.team === w.nat) state.natLineup = null
    return true
  }
  switch (e.kind) {
    case 'rest':
      // release him to his club, or keep him and pay for it in his legs
      if (answer === 'a') { if (!leave()) return false; p.cond = clamp(p.cond + 8, 20, 100) }
      else p.cond = clamp(p.cond - 6, 20, 100)
      break
    case 'curfew':
      // send him home, fine him, or let it go: the camp watches what you do
      if (answer === 'a') {
        if (!leave()) return false
        p.morale = clamp(p.morale - 1.5, 1, 10)
        for (const q of others) q.morale = clamp(q.morale + 0.2, 1, 10)
      } else if (answer === 'b') p.morale = clamp(p.morale - 0.5, 1, 10)
      else for (const q of others) q.morale = clamp(q.morale - 0.2, 1, 10)
      break
    case 'scare':
      // rest him this week, or let him train through it
      if (answer === 'a') { p.cond = clamp(p.cond + 12, 20, 100); p.morale = clamp(p.morale - 0.3, 1, 10) }
      else p.cond = clamp(p.cond - 12, 20, 100)
      break
    case 'bolter':
      // a promised debut is remembered at the review
      if (answer === 'a') p.morale = clamp(p.morale + 1, 1, 10)
      else p.morale = clamp(p.morale - 0.3, 1, 10)
      break
  }
  e.answer = answer
  return true
}

// ---- the review ----

/** The window closes: target met or not, the union's confidence moves, and a
 *  coach below 20 is relieved of the job there and then. */
export function reviewNatWindow(state: GameState, start: number): void {
  const w = state.natWin
  const nat = state.natTeam
  if (!w || !nat || w.nat !== nat || w.season !== state.season || w.start !== start || w.review || w.tests === 0) return
  const met = w.w >= w.target
  const delta = met ? (w.w > w.target ? 6 : 4) : (w.target - w.w === 1 ? -3 : -7)
  // a debut promised in camp and never given
  let broken = false
  const e = w.event
  if (e?.kind === 'bolter' && e.answer === 'a') {
    const p = state.players[e.playerId]
    if (p && caps(p) === e.caps) { p.morale = clamp(p.morale - 1.5, 1, 10); broken = true }
  }
  const conf = clamp((state.natConfidence ?? 60) + delta, 0, 100)
  state.natConfidence = conf
  const sacked = conf < 20
  const warned = !sacked && conf < 35
  w.review = { met, delta, conf: Math.round(conf), warned, sacked, broken, seen: false }
  state.natPrevSquad = (state.natSquads[nat] ?? []).slice()
  const v = {
    nat: nationNameIn('en', nat), nat_n: nat, w: w.w, d: w.d, l: w.l, target: w.target, tests: w.tests,
    conf: Math.round(conf), delta: (delta > 0 ? '+' : '') + delta,
    verdict_k: met ? 'natwin.verdictMet' : 'natwin.verdictMissed',
    tail_k: sacked ? 'natwin.tailSacked' : warned ? 'natwin.tailWarned' : met ? 'natwin.tailGood' : 'natwin.tailOk',
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.natWindowReviewSubj', v), body: tIn('en', 'news.natWindowReview', v),
    k: 'news.natWindowReview', v,
  })
  if (sacked) {
    state.natLastReview = { ...w }
    closeNatTenure(state)
  }
}

// ---- THE CLUB MAN THE COUNTRY'S COACH LEFT OUT (1.9.14) ----
//
// Owner: "If you coach international and you drop a player from your club
// team it should impact the relationship. Different reactions to different
// players moods." Being left out by any national coach stings; being left
// out by the coach you see every Monday at the club is personal. How it lands
// depends on where his head is (morale) and on the man: a Professional takes
// it on the chin, a Loyal man is hurt, an Ambitious or Temperamental one can
// be angry enough to ask to leave.
export type ClubDropReaction = 'fine' | 'hurt' | 'angry' | 'request'
const PERS_F: Record<string, number> = { Professional: 0.6, Mercenary: 0.5, Leader: 0.8, Loyal: 1.2, Ambitious: 1.4, Temperamental: 1.6 }

export function clubManLeftOut(state: GameState, p: Player): ClubDropReaction | null {
  if (!state.natTeam || state.unemployed || p.clubId !== state.userClubId) return null
  const band = p.morale >= 7 ? 0.3 : p.morale >= 5 ? 0.7 : 1.2
  const hit = band * (PERS_F[p.pers] ?? 1)
  p.morale = clamp(p.morale - hit, 1, 10)
  let r: ClubDropReaction = hit < 0.5 ? 'fine' : hit < 1.1 ? 'hurt' : 'angry'
  if (r === 'angry' && (p.pers === 'Ambitious' || p.pers === 'Temperamental') && p.morale < 3.5 && !(p.wantsOut ?? 0)) {
    p.wantsOut = Math.max(1, state.week)
    r = 'request'
  }
  const v = { player: p.name, nat: nationNameIn('en', state.natTeam), nat_n: state.natTeam, react_k: `natwin.react_${r}` }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', 'news.natClubDropSubj', v), body: tIn('en', 'news.natClubDrop', v),
    k: 'news.natClubDrop', v, playerId: p.id,
  })
  return r
}
