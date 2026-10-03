/**
 * ---- A LOANED MAN IS OFF THE LOAN LIST ----
 *
 * Owner, round 183: "when a player is loaned out, he still appears in the
 * available loan list. A loaned player must be removed from that list
 * immediately and must not reappear until he returns or is eligible again.
 * Check save/load and week processing don't re-add him."
 *
 * The list the Transfers screen shows under Deal: Loan is loans.loanMarket -
 * the shop window (loanTargets) plus, once a name is typed, anyone a manager
 * may ring about (loanApproachable). Before round 183 the screen built and
 * cached that list itself, keyed on the week, so a loan struck mid-week left
 * the man on it; there was no engine function to hold to account at all, and
 * this probe fails on that code at the import. scripts/loanlistui.mjs is the
 * same complaint read off the rendered page.
 *
 * Every loaned man is checked against the market under every query that could
 * surface him (blank, and his own name, which opens the approach door):
 *   1. a loan-in, the moment he signs
 *   2. after a save and a load, through the game's own migrate()
 *   3. every week of the loan as the weekly settle runs
 *   4. after the loan ends: back on his parent's books, free again, and on the
 *      list only if the ordinary rules put him there
 *   5. a man the manager loans OUT, and the same man left on an AI club's books
 *      still away (what a change of job leaves behind)
 *   6. an AI-held man carrying a loan from another club
 *
 * Run: npx vite-node scripts/loanlistprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { migrate } from '../src/game/save'
import { loanFree, loanIn, loanMarket, loanOut, loanTargets, loanTerms } from '../src/game/loans'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** is he anywhere on the market the screen would show, under any query? */
const onMarket = (g: GameState, id: number) => {
  const p = g.players[id]
  return [loanMarket(g), loanMarket(g, p.name), loanMarket(g, p.name.split(' ').pop()!)]
    .some(list => list.some(q => q.id === id)) || loanTargets(g).some(q => q.id === id)
}
const reload = (g: GameState) => migrate(JSON.parse(JSON.stringify(g)) as GameState)

// ---- 1-4. a loan-in, through its whole life -------------------------------
for (const [club, seed, length] of [['newcastle', 1357, 'short'], ['newcastle', 4242, 'half']] as const) {
  console.log(`\n--- ${club} seed ${seed}: a ${length} loan-in`)
  let g = newGame(club, 'Loan List', seed)
  const listed = loanTargets(g)
  const target = listed.find(p => loanTerms(g, p.id, length, 1).ok)
  ok(!!target, `a listed man says yes at full wages${target ? `: ${target.name}` : ''}`)
  if (!target) continue
  const id = target.id, parent = target.clubId!
  ok(onMarket(g, id), 'he is on the market before the loan')
  loanIn(g, id, length, 1)
  ok(g.players[id].clubId === g.userClubId && g.players[id].loanFrom === parent, 'the loan is struck')
  ok(!onMarket(g, id), '1. off the list the moment he signs')
  ok(!loanTerms(g, id, length, 1).ok && !loanFree(g, g.players[id]), '   and there is nothing to negotiate for him')
  g = reload(g)
  ok(!onMarket(g, id), '2. still off it after a save and a load')
  let back = -1, leaked = 0, weeks = 0
  for (let w = 0; w < 40 && g.season === 0; w++) {
    processWeekAndAdvance(g)
    if (w === 5) g = reload(g)
    weeks++
    const p = g.players[id]
    if (p.loanFrom) { if (onMarket(g, id)) leaked++ }
    else if (back < 0) { back = g.week; break }
  }
  ok(leaked === 0, `3. off it every week of the loan (${weeks} weeks settled, a reload in the middle)`)
  ok(back > 0, `4. the loan ends (home in week ${back})`)
  const p: Player = g.players[id]
  ok(p.clubId === parent && !p.loanFrom && p.loanUntil == null && p.loanShare == null, '   back on his parent\'s books with no loan paperwork left on him')
  ok(loanFree(g, p), '   and free to be lent again')
  // he is back on the list only if the ordinary rules say so: a man in his
  // parent's XV, or over the line, is not, and that is the rule, not a leak
  const xv = g.clubs[parent].tactic.lineup.slice(0, 15).includes(id)
  const listedNow = loanTargets(g).some(q => q.id === id)
  ok(!(xv && listedNow), `   listed again: ${listedNow} (in his parent's XV: ${xv}) - by the ordinary rules`)
  const g2 = reload(g)
  ok(loanTargets(g2).some(q => q.id === id) === listedNow, '   and a reload agrees with the list he left on')
}

// ---- 5. the manager's own man, loaned out ---------------------------------
console.log('\n--- a man the manager sends out on loan')
{
  let g = newGame('leicester', 'Loan Out', 4242)
  const club = g.clubs[g.userClubId]
  const xv = new Set(club.tactic.lineup.slice(0, 15))
  const kid = club.players.map(i => g.players[i]).find(p => p.age <= 23 && !xv.has(p.id) && !p.acad)
  ok(!!kid, `a young squad man outside the XV${kid ? `: ${kid.name}` : ''}`)
  if (kid) {
    const r = loanOut(g, kid.id)
    ok(r.ok && !!g.players[kid.id].onLoan, 'he goes out on loan')
    ok(!onMarket(g, kid.id), 'he is not on the loan market')
    g = reload(g)
    for (let w = 0; w < 6; w++) processWeekAndAdvance(g)
    ok(!onMarket(g, kid.id), 'nor after a reload and six weeks')
    // A CHANGE OF JOB leaves him on the old club's books, still away. That is
    // an AI club's man now, and still somebody's loan.
    const p = g.players[kid.id]
    const ai = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.rep >= g.clubs[g.userClubId].rep + 6)!
    g.clubs[g.userClubId].players = g.clubs[g.userClubId].players.filter(i => i !== p.id)
    ai.players.push(p.id)
    p.clubId = ai.id
    ok(!onMarket(g, p.id), `left on ${ai.short}'s books while away, he is still off the market`)
    ok(!loanTerms(g, p.id, 'season', 1).ok, 'and no offer for him can be struck')
    g = reload(g)
    ok(!onMarket(g, p.id), 'and a reload does not put him back')
  }
}

// ---- 6. an AI club's man who is himself on loan --------------------------
console.log('\n--- an AI-held man carrying a loan from another club')
{
  let g = newGame('newcastle', 'AI Loan', 1357)
  const t = loanTargets(g)[0]
  ok(!!t, 'a listed man to stand in for him')
  if (t) {
    const lender = Object.values(g.clubs).find(c => c.id !== t.clubId && c.id !== g.userClubId)!
    t.loanFrom = lender.id
    ok(!onMarket(g, t.id), `on loan at ${g.clubs[t.clubId!].short} from ${lender.short}: off the market`)
    g = reload(g)
    processWeekAndAdvance(g)
    ok(!onMarket(g, t.id), 'and after a reload and a week')
  }
}

console.log(fails ? `\nLOAN LIST PROBE FAILED (${fails})` : '\nLOAN LIST PROBE PASSED: a loaned man stays off the loan list until the loan is over')
process.exit(fails ? 1 : 0)
