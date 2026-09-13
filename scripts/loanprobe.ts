// ---- THE LOAN SYSTEM KEEPS ITS BOOKS --------------------------------------
//
// There are two loan lifecycles in this game and they are not symmetrical,
// which is the whole reason this probe exists.
//
//   OUTBOUND (loanOut): an under-23 goes to a feeder club. His clubId does NOT
//     change - he is still yours - and loanClub is cosmetic, a name for the
//     postcards. onLoan is the flag.
//   INBOUND (loanIn): a man arrives from another club. His clubId DOES change,
//     he moves between two club.players arrays, and loanFrom remembers where
//     home is.
//
// The external audit of 13 Sep 2026 called the system sophisticated and well
// designed, and flagged the risk as the two paths interacting with transfers,
// squads and the rollover with no invariants over the top. That is the gap
// this closes.
//
// The invariant that matters most is not about loans at all: a player's club
// is written down TWICE, once as p.clubId and once as membership of
// club.players, and every loan, transfer, return and rollover has to move both.
// A man in two squads or in none is the failure that reads as "he has
// vanished" or "he played against himself", and it is checked here every week
// of every season rather than at the end, so the report names the week it
// happened rather than the wreckage afterwards.
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { loanOut, loanRecall, loanIn, loanTargets, expireLoans } from '../src/game/loans'
import { SEASON_WEEKS, absWeek } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

/** One breach is enough: a squad that has gone wrong goes wrong every week
 *  afterwards, and 45 identical lines would bury the week it started. */
let firstBreach = ''
const breach = (msg: string) => { if (!firstBreach) firstBreach = msg }

function rosterInvariants(g: GameState, when: string) {
  // ---- p.clubId and club.players are one fact written twice ----
  const homes = new Map<number, string[]>()
  for (const c of Object.values(g.clubs)) {
    for (const id of c.players) {
      if (!homes.has(id)) homes.set(id, [])
      homes.get(id)!.push(c.id)
    }
  }
  for (const p of Object.values(g.players)) {
    const inRosters = homes.get(p.id) ?? []
    if (p.clubId) {
      if (inRosters.length === 0) return breach(`${when}: ${p.name} says he plays for ${p.clubId} and is in no squad`)
      if (inRosters.length > 1) return breach(`${when}: ${p.name} is in ${inRosters.length} squads (${inRosters.join(', ')})`)
      if (inRosters[0] !== p.clubId) return breach(`${when}: ${p.name} says ${p.clubId}, squad list says ${inRosters[0]}`)
    } else if (inRosters.length) {
      return breach(`${when}: free agent ${p.name} is still in ${inRosters.join(', ')}`)
    }
  }
  // ---- a squad cannot list a player who is not in the save ----
  for (const c of Object.values(g.clubs)) {
    for (const id of c.players) if (!g.players[id]) return breach(`${when}: ${c.short} lists player ${id}, who does not exist`)
  }
}

function loanInvariants(g: GameState, when: string) {
  for (const p of Object.values(g.players)) {
    // ---- the two lifecycles are mutually exclusive ----
    if (p.onLoan && p.loanFrom) return breach(`${when}: ${p.name} is out on loan and here on loan at once`)

    // ---- outbound: still ours, and not in the side ----
    if (p.onLoan) {
      if (p.clubId !== g.userClubId) return breach(`${when}: ${p.name} is out on loan from us but registered at ${p.clubId}`)
      if (p.loanClub && !g.clubs[p.loanClub]) return breach(`${when}: ${p.name} is on loan at ${p.loanClub}, which is not a club`)
      if (p.loanClub === g.userClubId) return breach(`${when}: ${p.name} is out on loan to us`)
      const xv = g.clubs[g.userClubId].tactic.lineup.slice(0, 15)
      if (xv.includes(p.id)) return breach(`${when}: ${p.name} is out on loan and in the starting XV`)
      if (p.loanSince == null) return breach(`${when}: ${p.name} is out on loan with no start date, so a recall cannot price itself`)
    }

    // ---- inbound: here, from somewhere real, and somewhere else ----
    if (p.loanFrom) {
      if (!g.clubs[p.loanFrom]) return breach(`${when}: ${p.name} is on loan from ${p.loanFrom}, which is not a club`)
      if (p.loanFrom === p.clubId) return breach(`${when}: ${p.name} is on loan from the club he plays for`)
      if (p.clubId !== g.userClubId) return breach(`${when}: ${p.name} is on loan from ${p.loanFrom} but registered at ${p.clubId}`)
      if (p.loanUntil != null && p.loanUntil <= absWeek(g.season, g.week)) {
        return breach(`${when}: ${p.name}'s loan expired at ${p.loanUntil} and he is still here`)
      }
    }
  }
}

// ---- a career, every week, both worlds -------------------------------------
function walk(world: 'm' | 'w', seasons: number) {
  const g = newGame(LEAGUE_DEFS(world)[0].clubs[0].id, 'Loans', 8181, undefined, 'coach', world, 'm')
  const label = world === 'm' ? "men's" : "women's"
  let weeks = 0
  for (let s = 0; s < seasons; s++) {
    const target = g.season + 1
    let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), false)
      g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
      rosterInvariants(g, `${label} S${g.season}W${g.week}`)
      loanInvariants(g, `${label} S${g.season}W${g.week}`)
      weeks++
      processWeekAndAdvance(g)
    }
  }
  return weeks
}

const mWeeks = walk('m', 4)
const wWeeks = walk('w', 3)
ok(firstBreach === '', `${mWeeks + wWeeks} weeks of two careers keep their squads straight${firstBreach ? ` - ${firstBreach}` : ''}`)

// ---- the outbound lifecycle, driven by hand ---------------------------------
{
  const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Loans', 9090)
  const club = g.clubs[g.userClubId]
  const kid = club.players.map(id => g.players[id])
    .find(p => p && p.age <= 23 && !p.acad && !club.tactic.lineup.slice(0, 15).includes(p.id))
  ok(!!kid, `there is an under-23 outside the XV to send out (${kid?.name ?? 'none'})`)
  if (kid) {
    const out = loanOut(g, kid.id)
    ok(out.ok, `he goes out on loan: ${out.msg.slice(0, 60)}`)
    ok(kid.onLoan === true && kid.clubId === g.userClubId, 'he is away but still registered to us')
    ok(kid.loanSince === absWeek(g.season, g.week), 'and the week he left is written down')

    const again = loanOut(g, kid.id)
    ok(!again.ok, `he cannot be sent out twice: ${again.msg.slice(0, 50)}`)

    // ---- a recall is weeks of rugby, not a button (the 16B cycling exploit) --
    const early = loanRecall(g, kid.id)
    ok(!early.ok, 'and cannot be recalled the same week')
    ok(kid.onLoan === true, 'a refused recall leaves him where he is')

    for (let w = 0; w < 3; w++) { g.week++ }
    ok(!loanRecall(g, kid.id).ok, 'nor after three weeks')
    g.week++
    const late = loanRecall(g, kid.id)
    ok(late.ok, 'four weeks served and he can come home')
    ok(kid.onLoan === false && kid.loanClub === undefined && kid.loanSince === undefined,
       'and the loan is cleared off him entirely')
    rosterInvariants(g, 'after a recall')
  }
}

// ---- the inbound lifecycle, and expiry exactly once -------------------------
{
  const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Loans', 5150)
  // loanTerms rolls, so walk the board until a parent club says yes
  let signed: Player | undefined
  for (const cand of loanTargets(g).slice(0, 60)) {
    const parentId = cand.clubId
    loanIn(g, cand.id, 'short', 1)
    if (cand.loanFrom) { signed = cand; ok(parentId === cand.loanFrom, `${cand.name} arrives on loan from ${g.clubs[parentId!]?.short}`); break }
  }
  ok(!!signed, `a short loan was agreed somewhere on the board${signed ? '' : ' (none of 60 targets said yes)'}`)

  if (signed) {
    const parent = g.clubs[signed.loanFrom!]
    ok(signed.clubId === g.userClubId, 'he is ours to pick')
    ok(g.clubs[g.userClubId].players.includes(signed.id), 'and in our squad list')
    ok(!parent.players.includes(signed.id), 'and out of theirs')
    ok(!parent.tactic.lineup.includes(signed.id), 'and out of their XV')
    ok(signed.loanUntil === absWeek(g.season, g.week) + 13, `a short loan runs thirteen weeks (until ${signed.loanUntil})`)
    rosterInvariants(g, 'after a loan signing')
    ok(firstBreach === '', `the signing keeps the squads straight${firstBreach ? ` - ${firstBreach}` : ''}`)

    // not yet
    expireLoans(g, () => 0.5)
    ok(signed.loanFrom === parent.id, 'the loan does not expire before its date')

    // the week it falls due
    const before = g.news.length
    g.week = signed.loanUntil! - absWeek(g.season, 0)
    expireLoans(g, () => 0.5)
    ok(signed.loanFrom == null, 'on the date it ends')
    ok(signed.clubId === parent.id, 'and he goes home')
    ok(parent.players.includes(signed.id), 'onto their squad list')
    ok(!g.clubs[g.userClubId].players.includes(signed.id), 'and off ours')
    ok(!g.clubs[g.userClubId].tactic.lineup.includes(signed.id), 'and out of our XV')
    ok(signed.loanUntil === undefined && signed.loanShare === undefined, 'with the loan cleared off him')
    const added = g.news.length - before
    ok(added === 1, `one notice that he has gone (${added})`)

    // and not a second time
    expireLoans(g, () => 0.5)
    ok(g.news.length - before === 1, 'a second sweep does not send him home twice')
    rosterInvariants(g, 'after a loan return')
    ok(firstBreach === '', `the return keeps the squads straight${firstBreach ? ` - ${firstBreach}` : ''}`)
  }
}

console.log(fails
  ? `\nLOAN PROBE FAILED (${fails})`
  : '\nLOAN PROBE PASSED: one squad per man, both lifecycles, and a loan that ends exactly once')
process.exit(fails ? 1 : 0)
