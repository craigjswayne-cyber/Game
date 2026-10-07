/**
 * AN INJURED MAN DOES NOT MOAN ABOUT MINUTES (owner, 1.8.12: "If someone is
 * injured, they should not be moaning about lack of game time").
 *
 * A key man left out of every match is set up twice, once fit and once on the
 * treatment table, and the week's game-time settle is run on both:
 *   1. fit, he sulks and hands in a transfer request (the mechanic still works);
 *   2. injured, his morale does not move and no letter lands;
 *   3. the squad screen's reading of him is "content", not "unhappy";
 *   4. the assistant's game-time report leaves him off.
 *
 * Run: npx vite-node scripts/injuredquietprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { settleGameTime, ledgerRow, clubMatchesPlayed, gameTimeReview } from '../src/game/gametime'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const base = newGame('northampton', 'Quiet', 61)
for (let w = 0; w < 13; w++) {
  base.clubs[base.userClubId].boardConfidence = Math.max(base.clubs[base.userClubId].boardConfidence, 55)
  processWeekAndAdvance(base)
}
const clone = (g: GameState): GameState => JSON.parse(JSON.stringify(g))
const club = base.clubs[base.userClubId]
const played = clubMatchesPlayed(base, club.id)
ok(played >= 6, `a sample worth arguing about (${played} matches)`)
const named = new Set(club.tactic.lineup.filter((x): x is number => x != null))
const pid = club.players.find(id => !named.has(id) && !base.players[id].onLoan && !base.players[id].acad && base.players[id].age <= 33)!

const setUp = (injured: boolean) => {
  const g = clone(base)
  const p = g.players[pid]
  p.status = 'key'
  p.stats.apps = 0; p.avail = played; p.morale = 4; p.wantsOut = 0; p.transferListed = false
  p.injury = injured ? { desc: 'Hamstring', until: g.week + 4, weeks: 4 } : null
  return { g, p }
}

const fit = setUp(false)
const fitRow = ledgerRow(fit.g, fit.g.clubs[fit.g.userClubId], fit.p, played)
const fitBefore = fit.p.morale
settleGameTime(fit.g)
ok(fitRow.gap < -3, `fit and left out, he is short-changed (gap ${fitRow.gap}, status ${fitRow.status})`)
ok(fit.p.morale !== fitBefore || (fit.p.wantsOut ?? 0) > 0, `and fit, the ledger reaches him (morale ${fitBefore} -> ${fit.p.morale.toFixed(2)}, request ${fit.p.wantsOut ? 'in' : 'none'})`)

const hurt = setUp(true)
const before = hurt.p.morale
const news0 = hurt.g.news.length
settleGameTime(hurt.g)
ok(hurt.p.morale === before, `injured, his morale does not move (${before} -> ${hurt.p.morale})`)
ok(!(hurt.p.wantsOut ?? 0), 'injured, no transfer request')
ok(!hurt.g.news.slice(news0).some(n => n.playerId === pid), 'and nothing about him in the inbox')
ok(ledgerRow(hurt.g, hurt.g.clubs[hurt.g.userClubId], hurt.p, played).mood === 'content', 'the squad screen reads him as content')
hurt.g.week = 14
const n1 = hurt.g.news.length
gameTimeReview(hurt.g)
ok(!hurt.g.news.slice(n1).some(n => (n.body ?? '').includes(hurt.p.name)), "the assistant's game-time report leaves him off")

console.log(fails ? `\nINJURED QUIET PROBE FAILED (${fails})` : '\nINJURED QUIET PROBE PASSED: a man on the treatment table does not ask for minutes')
