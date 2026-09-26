/**
 * ---- THE MEDICAL JOKER (joker.ts) ----
 *
 * Owner, 25 Sep 2026: "Medical joker signings" - a short-term signing to cover
 * a long-term injury without breaking the salary cap. This holds the rule:
 *
 *   1. only a long lay-off opens the door, and only once per injured man
 *   2. the joker's wage is outside the cap while he covers, and still paid
 *   3. he goes the week his man is fit, and the flag goes with him
 *   4. no joker survives the end of the season
 *
 * Run: npx vite-node scripts/jokerprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { capBill } from '../src/game/ai'
import { JOKER_MIN_WEEKS, jokerCandidates, jokerFor, jokerOpen, signMedicalJoker } from '../src/game/joker'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const fresh = (): GameState => {
  const g = newGame('leicester', 'Joker Probe', 71)
  while (g.week < 6) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    processWeekAndAdvance(g)
  }
  return g
}
const squad = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p)
const hurt = (g: GameState, p: Player, weeks: number) => {
  p.injury = { desc: 'Knee ligaments', dk: 'injury.kneeLigament', until: g.week + weeks, weeks, seen: true }
}

console.log('--- 1. who can have one')
{
  const g = fresh()
  const [a, b] = squad(g).filter(p => !p.injury && !p.acad)
  hurt(g, a, JOKER_MIN_WEEKS + 4)
  hurt(g, b, JOKER_MIN_WEEKS - 3)
  ok(jokerOpen(g, a), `a ${JOKER_MIN_WEEKS + 4}-week lay-off opens the door`)
  ok(!jokerOpen(g, b), `a ${JOKER_MIN_WEEKS - 3}-week one does not`)
  const pool = jokerCandidates(g, a)
  ok(pool.length > 0, `there are free agents who can cover a ${a.pos} (${pool.length})`)
  ok(pool.every(c => !c.clubId && (c.pos === a.pos || c.alt.includes(a.pos))), 'and every one is free and plays the position')
  const r = signMedicalJoker(g, a.id, pool[0].id)
  ok(r.ok, `he signs: "${r.msg}"`)
  ok(jokerFor(g, a.id)?.id === pool[0].id, 'and is recorded as covering the injured man')
  ok(!jokerOpen(g, a), 'one joker per injured man: the door closes behind him')
  const again = pool[1] ? signMedicalJoker(g, a.id, pool[1].id) : { ok: false }
  ok(!again.ok, 'a second joker for the same man is refused')
}

console.log('--- 2. the cap waives him, the wage bill does not')
{
  const g = fresh()
  const club = g.clubs[g.userClubId]
  const [a] = squad(g).filter(p => !p.injury && !p.acad)
  hurt(g, a, 12)
  const before = capBill(g, club)
  const j = jokerCandidates(g, a)[0]
  signMedicalJoker(g, a.id, j.id)
  ok(j.clubId === g.userClubId && j.wage > 0, `he is on the books at ${j.wage} a week`)
  ok(capBill(g, club) === before, `and the cap bill does not move (${before} -> ${capBill(g, club)})`)
  const bal = club.balance
  processWeekAndAdvance(g)
  ok(club.balance !== bal, 'the club still pays its wages that week')
}

console.log('--- 3. he goes when his man is fit')
{
  const g = fresh()
  const [a] = squad(g).filter(p => !p.injury && !p.acad)
  hurt(g, a, 10)
  const j = jokerCandidates(g, a)[0]
  signMedicalJoker(g, a.id, j.id)
  a.injury = null
  const mark = g.news.length
  processWeekAndAdvance(g)
  ok(j.clubId == null, 'the injured man is fit: the joker is a free agent again')
  ok(j.joker == null, 'and the joker flag is gone with him')
  ok(!g.clubs[g.userClubId].tactic.lineup.includes(j.id), 'and he is off the team sheet')
  ok(g.news.slice(mark).some(n => n.k === 'news.jokerEndsFit'), 'and the inbox says why')
}

console.log('--- 4. nobody rolls into next season on a joker deal')
{
  const g = fresh()
  const [a] = squad(g).filter(p => !p.injury && !p.acad)
  hurt(g, a, 200)
  const j = jokerCandidates(g, a)[0]
  signMedicalJoker(g, a.id, j.id)
  const season = g.season
  for (let i = 0; i < 80 && g.season === season; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    processWeekAndAdvance(g)
    if (a.injury) a.injury.until = g.week + 200
  }
  ok(g.season === season + 1, 'the season turned over')
  ok(j.clubId !== g.userClubId && j.joker == null, `and the joker left with it (${j.clubId ?? 'free agent'})`)
}

console.log(fails ? `\nJOKER PROBE FAILED (${fails})` : '\nJOKER PROBE PASSED: one long lay-off, one joker, off the cap, gone when the man is back')
process.exit(fails ? 1 : 0)
