// Squad sizes over the summer: short squads sign free agents, swollen AI
// squads release their weakest seniors, and the free-agent pool is kept small.
import { aiPayRate } from '../aiecon'
import { assignPersonality, deriveAttrs, nextPid, playerValue, playerWage } from '../attributes'
import { genderOf } from '../gender'
import { absWeek, emptyStats, type Club, type GameState, type Player } from '../model'
import { regenName, worldNames } from '../nations'
import { clamp, pick, type Rng } from '../rng'
import { YOUTH_POS } from './intake'
import { forget } from './registry'

/** Any club left short of bodies signs free agents (board-driven squad fillers).
 *
 *  Counts SENIORS, not the squad list. Once the academy became 27 strong
 *  (feedback 10G) no club on earth was ever under 26 registered players again,
 *  so a whole-squad count would have quietly switched this off and let senior
 *  squads shrivel season by season while the academy stayed full. */
export function replenishSquads(state: GameState, rng: Rng, rooms: Map<string, number>) {
  const freeAgents = () => Object.values(state.players)
    .filter(p => !p.clubId && p.age <= 34)
    .sort((a, b) => b.ca - a.ca)
  const seniors = (club: Club) =>
    club.players.reduce((n, id) => n + (state.players[id] && !state.players[id].acad ? 1 : 0), 0)
  for (const club of Object.values(state.clubs)) {
    let guard = 0
    while (seniors(club) < 26 && guard++ < 25) {
      // biggest positional hole
      // seniors only, for the same reason the count above is: with 27 academy men
      // registered, no position is ever under two and this would fall through to a
      // random shirt every time, filling gaps the club does not have
      const byPos: Record<string, number> = {}
      for (const id of club.players) {
        const p = state.players[id]
        if (p && !p.acad) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
      }
      const need = YOUTH_POS.find(pos => (byPos[pos] ?? 0) < 2) ?? pick(rng, YOUTH_POS)
      // a club short of seniors takes a free agent of ITS OWN standing (1.6.3):
      // the pool is kept as the best 120 by rating, and the best of them went
      // to whichever club happened to be short - which is how a National One
      // side came to sign an 88-rated Test back for nothing every summer
      const pool = freeAgents()
      const fits = (p: { ca: number }) => p.ca <= club.rep + 15
      const fa = pool.find(p => fits(p) && (p.pos === need || p.alt.includes(need)))
        ?? pool.find(fits)
        ?? pool.find(p => p.pos === need || p.alt.includes(need))
        ?? pool[0]
      if (!fa) {
        // The market is bare - hand a young pro a senior contract instead. He
        // used to be registered as an academy scholar, which stopped being safe
        // the moment this loop started counting seniors: an academy signing does
        // not raise the senior count, so the loop would spin to its guard and
        // hand the club twenty-five schoolboys it did not need.
        const raw = {
          name: regenName(rng, club.country, worldNames(state), genderOf(state)), pos: need,
          age: 19 + Math.floor(rng() * 2), nat: club.country,
          q: clamp(40 + Math.floor(rng() * 12) + Math.floor(club.rep / 14), 38, 62),
          gk: (need === 'FH' || need === 'FB') && rng() < 0.3,
        }
        const a2 = deriveAttrs(raw, state.seed + state.season * 131 + club.players.length * 7)
        const kid: Player = {
          id: nextPid(), name: raw.name, pos: raw.pos, alt: [], age: raw.age, nat: raw.nat,
          clubId: club.id, a: a2, ca: raw.q, pa: clamp(raw.q + 15 + Math.floor(rng() * 20), raw.q, 99),
          q0: raw.q, intl: false, gk: !!raw.gk, form: 6, morale: 7, cond: 100, sharp: 55,
          injury: null, bans: 0, natSquad: false, wage: 600, contractEnds: state.season + 3,
          value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true,
          pers: assignPersonality(rng, a2), sc: club.id === state.userClubId ? 100 : 15,
        }
        kid.value = playerValue(kid.ca, kid.age, kid.pa, kid.pos, undefined, undefined, kid.caps)
        state.players[kid.id] = kid
        club.players.push(kid.id)
        continue
      }
      fa.clubId = club.id
      // stamped like every other arrival, so his career before this one is
      // never read as service to the club that just signed him (legends.ts)
      fa.joinedAt = absWeek(state.season, state.week)
      // a board filling its squad pays what it can (aiecon.ts aiPayRate,
      // 1.8.3); the manager's board signs on the scale, as it always has
      fa.wage = Math.round(playerWage(fa.ca, fa.age) * aiPayRate(state, club, rooms.get(club.id)) / 50) * 50
      fa.contractEnds = state.season + 1
      fa.morale = 7
      club.players.push(fa.id)
      if (club.id === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
          subject: `Board signing: ${fa.name}`,
          body: `With the squad short of numbers, the board moved to sign free agent ${fa.name} (${fa.pos}, ${fa.age}) on a one-year deal.`,
          k: 'news.boardSigning', v: { player: fa.name, pos: fa.pos, age: fa.age },
          playerId: fa.id,
        })
      }
    }
  }
}

// AI squads shed their surplus every summer: intake adds more bodies
// than retirement removes, and without a clear-out the median squad
// drifts from 33 to 43+ over a decade. Weakest seniors are released
// into the free-agent pool (which is pruned just below).
//
// Counts SENIORS on both ends. It used to count the whole registered squad,
// which the 27-man academy (feedback 10G) turned into a wrecking ball: every
// club in the world sat over 46 registered on day one, and since only seniors
// are releasable it would have stripped all 101 of them down to seventeen
// senior players while the academy sat there untouched.
export function trimAiSquads(state: GameState) {
  const seniorCount = (club: Club) =>
    club.players.reduce((n, id) => n + (state.players[id] && !state.players[id].acad ? 1 : 0), 0)
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId || seniorCount(club) <= 46) continue
    const releasable = club.players
      .map(id => state.players[id])
      .filter((p): p is Player => !!p && !p.acad && p.age >= 21 && !p.onLoan && !p.loanFrom)
      .sort((a, b) => a.ca - b.ca)
    for (const p of releasable) {
      if (seniorCount(club) <= 44) break
      club.players = club.players.filter(id => id !== p.id)
      club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
      if (club.captain === p.id) club.captain = null
      if (club.vice === p.id) club.vice = null
      p.clubId = null
      p.transferListed = false
    }
  }
}

/** Keep the free-agent pool from growing without bound over long careers. */
export function pruneFreeAgents(state: GameState) {
  const fas = Object.values(state.players)
    .filter(p => !p.clubId)
    .sort((a, b) => b.ca - a.ca)
  for (const p of fas.slice(120)) forget(state, p)
  for (const p of fas.slice(0, 120)) if (p.age >= 35) forget(state, p)
}
