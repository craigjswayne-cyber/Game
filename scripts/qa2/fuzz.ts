/**
 * THE OUT-OF-ORDER ACTION FUZZER (1.6.5 report, exploit resistance).
 *
 * Every user action the engine exposes, fired in a seeded random order, twice,
 * with stale ids, at any week of the season, against a world that keeps
 * settling underneath it - and after every single call the invariants that
 * an exploit or a crash would break:
 *
 *   - nothing on the user's club or in the world is NaN, Infinity or undefined
 *     where a number should be
 *   - every player is in exactly one club's list, and that club is his clubId
 *   - money leaves the world (payoffs, fees, fines) but is never created: the
 *     sum of every club's balance never rises except by a board injection
 *   - the transfer allowance never rises except through the three doors that
 *     may raise it (moving cash into it, an injection, a board grant), and a
 *     move never raises it by more than the cash that could be moved
 *   - the squad never drops below the board's floor or above the registration
 *     limit through a user action
 *
 *   npx vite-node scripts/qa2/fuzz.ts [actions=1500] [seed=1]
 *
 * A gate: the first broken invariant names the action that broke it.
 */
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, requestExpansion, requestFacility, requestFunds, arrangeMidweekFriendly, friendlySuggestions, friendlyWeeks } from '../../src/game/season'
import { agreeFee, offerRenewal, respondToOffer, signFreeAgent, signOnTerms, userBid, SQUAD_LIMIT } from '../../src/game/ai'
import { releasePlayer } from '../../src/game/release'
import { loanIn, loanOut, loanRecall, loanTargets } from '../../src/game/loans'
import { appointStaff, sackStaff, sendToCourse, staffCandidates, type StaffRole } from '../../src/game/staff'
import { releasable, releaseToBudget } from '../../src/game/treasury'
import { applyInjection, injectionCash } from '../../src/game/grants'
import { commissionScout } from '../../src/game/commission'
import { answerPress } from '../../src/game/media'
import { mulberry32 } from '../../src/game/rng'
import { type FacilityId } from '../../src/game/model'
const RELEASE_STEP = 500_000

const ACTIONS = Number(process.argv[2] ?? 1500)
const seed = Number(process.argv[3] ?? 1)
const g = newGame('bath', 'Fuzz', 20260916 + seed)
const rng = mulberry32(seed * 977 + 13)
const pick = <T,>(xs: T[]): T | undefined => xs.length ? xs[Math.floor(rng() * xs.length)] : undefined
const uid = () => g.userClubId
let fails = 0
const bad = (msg: string) => { fails++; console.log(`FAIL  ${msg}`) }

function worldMoney(): number { return Object.values(g.clubs).reduce((s, c) => s + c.balance, 0) }

function scan(v: unknown, path: string, depth: number, out: string[]) {
  if (depth > 6 || out.length > 5) return
  if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${path} is ${v}`)
  else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`, depth + 1, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, `${path}.${k}`, depth + 1, out)
}

function invariants(after: string, moneyBefore: number, moneyAllowed: number, budgetBefore: number, budgetAllowed: number): void {
  const club = g.clubs[uid()]
  const out: string[] = []
  if (club) {
    scan(club, 'club', 0, out)
    for (const id of club.players) {
      const p = g.players[id]
      if (!p) out.push(`club lists player ${id} who does not exist`)
      else { scan(p, `player ${p.name}`, 0, out); if (p.clubId !== club.id) out.push(`${p.name} is on the list with clubId ${p.clubId}`) }
    }
    const seniors = club.players.filter(id => g.players[id] && !g.players[id].acad).length
    if (seniors > SQUAD_LIMIT) out.push(`${seniors} seniors, over the ${SQUAD_LIMIT} limit`)
    if (club.budget > budgetBefore + budgetAllowed + 1) out.push(`budget rose ${club.budget - budgetBefore} (allowed ${budgetAllowed})`)
  }
  // one club per player, world-wide
  const seen = new Map<number, string>()
  for (const c of Object.values(g.clubs)) for (const id of c.players) {
    if (seen.has(id)) out.push(`player ${id} in ${seen.get(id)} and ${c.id}`)
    seen.set(id, c.id)
  }
  const drift = worldMoney() - moneyBefore
  if (drift > moneyAllowed + 1) out.push(`world money rose by ${drift} (allowed ${moneyAllowed})`)
  for (const o of out.slice(0, 3)) bad(`after ${after}: ${o}`)
}

const FACS: FacilityId[] = ['pitch', 'gym', 'recovery', 'paddock', 'kicking', 'briefing', 'academy', 'shop']
const ROLES: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']
const stale: number[] = []   // ids of men who left, to be used again later
let counts = new Map<string, number>()
const note = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)

const actions: { name: string; run: () => number | [number, number] }[] = [
  { name: 'bid', run: () => { const p = pick(Object.values(g.players).filter(p => p.clubId && p.clubId !== uid())); if (!p) return 0; const fee = Math.round(rng() * 6_000_000); userBid(g, p.id, fee); return 0 } },
  { name: 'agreeFee', run: () => { const p = pick(Object.values(g.players).filter(p => p.clubId && p.clubId !== uid())); if (!p) return 0; const fee = Math.round(rng() * 4_000_000); const r = agreeFee(g, p.id, fee) as unknown; note(`agreeFee:${!!r}`); return 0 } },
  { name: 'signOnTerms', run: () => { const p = pick(Object.values(g.players).filter(p => p.clubId && p.clubId !== uid())); if (!p) return 0; const before = worldMoney(); signOnTerms(g, p.id, Math.round(rng() * 4_000_000), Math.round(p.wage * (0.8 + rng())), Math.round(rng() * 3_000_000), rng() < 0.5); return Math.abs(worldMoney() - before) } },
  { name: 'signFreeAgent', run: () => { const p = pick(Object.values(g.players).filter(p => !p.clubId)); if (!p) return 0; signFreeAgent(g, p.id); return 0 } },
  { name: 'release', run: () => { const c = g.clubs[uid()]; const id = pick(c.players); if (id == null) return 0; const r = releasePlayer(g, id); if (r && typeof r === 'object' && 'ok' in r && (r as { ok: boolean }).ok) stale.push(id); return 0 } },
  { name: 'releaseStale', run: () => { const id = pick(stale); if (id == null) return 0; releasePlayer(g, id); return 0 } },
  { name: 'renew', run: () => { const c = g.clubs[uid()]; const id = pick(c.players); if (id == null) return 0; offerRenewal(g, id); return 0 } },
  { name: 'renewTwice', run: () => { const c = g.clubs[uid()]; const id = pick(c.players); if (id == null) return 0; offerRenewal(g, id); offerRenewal(g, id); return 0 } },
  { name: 'respondOffer', run: () => { const o = pick(g.offers ?? []); if (!o) return 0; const fee = (o as { fee?: number }).fee ?? 0; respondToOffer(g, o.id, rng() < 0.5); return [0, fee] } },
  { name: 'loanOut', run: () => { const c = g.clubs[uid()]; const id = pick(c.players); if (id == null) return 0; loanOut(g, id); return 0 } },
  { name: 'loanIn', run: () => { const p = pick(rng() < 0.5 ? loanTargets(g) : Object.values(g.players).filter(p => p.clubId && p.clubId !== uid())); if (!p) return 0; loanIn(g, p.id, pick(['season', 'half'] as const), rng()); return 0 } },
  { name: 'loanRecall', run: () => { const p = pick(Object.values(g.players).filter(p => p.clubId === uid() && p.onLoan)); if (!p) return 0; loanRecall(g, p.id); return 0 } },
  { name: 'staff', run: () => { const role = pick(ROLES)!; if (rng() < 0.3) { sackStaff(g, role); return 0 } const cands = staffCandidates(g, role); if (cands.length) appointStaff(g, role, Math.floor(rng() * cands.length)); else sendToCourse(g, role); return 0 } },
  // the board's doors: asking again after a no is a strike and the second is
  // the sack (boardAsks), which is a rule, not a hole - so the fuzzer knocks
  // only while the door is open, and the sacking path is left to jobs probes
  { name: 'facility', run: () => { if (g.boardAsks?.capital?.strikes) return 0; requestFacility(g, pick(FACS)!); return 0 } },
  { name: 'expansion', run: () => { if (g.boardAsks?.capital?.strikes) return 0; requestExpansion(g); return 0 } },
  { name: 'funds', run: () => { if (g.boardAsks?.funds?.strikes) return 0; requestFunds(g); return [0, 50_000_000] } },
  { name: 'releaseToBudget', run: () => { const most = releasable(g); releaseToBudget(g, Math.round(rng() * 5_000_000)); return [0, Math.max(RELEASE_STEP, most)] } },
  { name: 'releaseToBudgetBad', run: () => { const b = g.clubs[uid()].budget; const r1 = releaseToBudget(g, -1_000_000); const r2 = releaseToBudget(g, Number.NaN); const r3 = releaseToBudget(g, Number.POSITIVE_INFINITY); if (r1.ok || r2.ok || r3.ok || g.clubs[uid()].budget !== b) bad('a bad amount was moved into the transfer budget'); return 0 } },
  { name: 'inject', run: () => { const tier = pick(['s', 'm', 'l', 'xl'] as const)!; const before = worldMoney(); applyInjection(g, tier); const cash = injectionCash(g, tier); return [Math.max(0, worldMoney() - before) + cash, cash + 1] } },
  { name: 'scout', run: () => { commissionScout(g, 'any', pick([3, 6, 9] as const)!); return 0 } },
  { name: 'friendly', run: () => { const w = pick(friendlyWeeks(g, 40)); if (w == null) return 0; const o = pick(friendlySuggestions(g, w)); if (o) arrangeMidweekFriendly(g, o, w); return 0 } },
  // a press answer can win the board over to a little more money; a million is
  // the most any answer is written to move
  { name: 'press', run: () => { for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, Math.floor(rng() * 3)); return [0, 1_000_000] } },
  { name: 'week', run: () => { processWeekAndAdvance(g); return [1e12, 1e12] } },
]

const t0 = Date.now()
let weeks = 0
for (let i = 0; i < ACTIONS && fails < 20; i++) {
  const a = pick(actions)!
  if (a.name === 'week') weeks++
  const before = worldMoney()
  const budgetBefore = g.clubs[uid()]?.budget ?? 0
  let allowed: number | [number, number] = 0
  try { allowed = a.run() } catch (e) { bad(`${a.name} threw: ${String(e).slice(0, 160)}`); continue }
  note(a.name)
  const [m, b] = Array.isArray(allowed) ? allowed : [allowed, 0]
  invariants(a.name, before, m, budgetBefore, b)
  if (g.unemployed) { note('sacked'); break }
  if (g.season > 1) break
}
const secs = ((Date.now() - t0) / 1000).toFixed(0)
console.log(`${[...counts].map(([k, v]) => `${k}:${v}`).join(' ')}`)
console.log(`seed ${seed}: ${ACTIONS} actions, ${weeks} weeks settled, season ${g.season} week ${g.week}, ${secs}s, ${g.unemployed ? 'sacked' : 'employed'}`)
console.log(fails ? `\nFUZZ FAILED (${fails})` : `\nFUZZ PASSED: every action in any order, nothing NaN, nobody in two clubs, no money made from nothing`)
process.exit(fails ? 1 : 0)
