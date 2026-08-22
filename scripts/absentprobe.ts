/**
 * ---- THE ABSENT MANAGER PAYS FOR IT ----
 *
 * Reported from a hands-off save at week 11, 3W-1D-1L: "ive not made one
 * single change yet in the game since I signed up and started everything is
 * done with the auto buttons". difficultyprobe had already measured the gap in
 * a lab; this was the same finding walking around in the wild. Autopilot was
 * the honest optimiser - lineupFor handed a never-touched sheet to the same
 * auto-picker the OPTIMISER manager uses, and ignoring the press desk cost
 * exactly nothing. Doing nothing was near-optimal, and a management game where
 * doing nothing is near-optimal is a slideshow.
 *
 * The wave under test:
 *   1. assistantJudgement - a deterministic per-man misread multiplied into
 *      autoSelect's score when the ASSISTANT names the side (any user sheet
 *      the manager has not claimed, and the Best XV button). Amplitude runs
 *      12% with no assistant hired down to 2% at level 3.
 *   2. The sheet stays STICKY, exactly as before - the first cut re-named it
 *      weekly and difficultyprobe caught that making autopilot BETTER (a
 *      weekly form refresh outweighs a 12% misread). Only the naming moments
 *      carry the eye: day one, the stale tidy-up, the one-tap buttons. A
 *      claimed sheet (userPicked) is untouched, as ever.
 *   3. Expired press questions now dock board confidence and fan mood.
 *
 * Run: npx vite-node scripts/absentprobe.ts
 */
import * as ME from '../src/game/matchEngine'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { effAt } from '../src/game/attributes'
import { XV_SLOTS } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- the module surface exists (red on any tree without the wave) ----
const judgeFn = (ME as Record<string, unknown>).assistantJudgement as
  ((s: GameState) => (p: Player) => number) | undefined
ok(typeof judgeFn === 'function', 'matchEngine exports assistantJudgement')

const g = newGame('northampton', 'Absent', 4242)
const club = g.clubs[g.userClubId]

if (typeof judgeFn === 'function') {
  // ---- the eye itself ----
  const pool = ME.availablePlayers(g, club.players, false)
  const spreadAt = (lvl: number) => {
    g.staff.assistant = lvl
    const j = judgeFn(g)
    let lo = Infinity, hi = -Infinity
    for (const p of pool) { const v = j(p); lo = Math.min(lo, v); hi = Math.max(hi, v) }
    return { lo, hi }
  }
  const s0 = spreadAt(0), s3 = spreadAt(3)
  ok(s0.lo >= 0.88 - 1e-9 && s0.hi <= 1.12 + 1e-9 && s0.hi - s0.lo > 0.10,
    `level-0 misreads span the squad inside +-12% (saw ${s0.lo.toFixed(3)}..${s0.hi.toFixed(3)})`)
  ok(s3.lo >= 0.98 - 1e-9 && s3.hi <= 1.02 + 1e-9,
    `level-3 misreads stay inside +-2% (saw ${s3.lo.toFixed(3)}..${s3.hi.toFixed(3)})`)
  g.staff.assistant = 0
  const j1 = judgeFn(g)
  const p0 = pool[0]
  ok(j1(p0) === judgeFn(g)(p0), 'same week, same man, same misread (deterministic)')
  const wasWeek = g.week
  g.week += 1
  const moved = pool.filter(p => Math.abs(judgeFn(g)(p) - j1(p)) > 1e-6).length
  g.week = wasWeek
  ok(moved > pool.length / 2, `a new week is a new set of misreads (${moved}/${pool.length} moved)`)

  // ---- the day-one sheet is the assistant's, and it costs something ----
  // value a XV by the same score autoSelect ranks with, so "weaker" means
  // weaker in the auto-picker's own currency, not a different ruler's
  const xvValue = (st: GameState, lu: (number | null)[]) => {
    let v = 0
    for (let i = 0; i < 15; i++) {
      const p = st.players[lu[i] ?? -1]
      if (p) v += effAt(p, XV_SLOTS[i].pos) * (0.7 + 0.3 * (p.cond / 100)) * (0.85 + 0.03 * p.form)
    }
    return v
  }
  let weaker = 0, tried = 0, deficit = 0
  for (const seed of [4242, 9, 777, 12345, 31337]) {
    const w = newGame('northampton', 'Absent', seed)
    const c = w.clubs[w.userClubId]
    const honestW = ME.autoSelect(w, c.players.map(id => w.players[id]).filter((x): x is Player => !!x))
    const v = xvValue(w, c.tactic.lineup), hv = xvValue(w, honestW)
    tried++
    if (v < hv - 1e-9) weaker++
    deficit += hv - v
    // no per-seed "never beats" assert: the honest pick is greedy, not a
    // global optimum, so a misread ordering CAN luck into a better fill -
    // the claim that matters is the average cost, below
  }
  ok(weaker >= 3, `the level-0 assistant names a weaker day-one XV most saves (${weaker}/${tried})`)
  ok(deficit / tried > 0, `and the misreads cost XV quality on average (${(deficit / tried).toFixed(2)} score)`)

  // ---- the stale tidy-up carries his eye too ----
  // Stage a stale shirt: an unclaimed sheet with a non-natural in a shirt a
  // better natural could wear. The rewrite must be the judge-pick, written back.
  {
    club.tactic.userPicked = false
    const pool = ME.availablePlayers(g, club.players, false)
    const expected = ME.autoSelect(g, pool, undefined, judgeFn(g))
    // find a natural starter and a man from another position to squat his shirt
    const lu = expected.slice()
    const shirtPos = XV_SLOTS[0].pos
    const squatter = pool.find(p => p.pos !== shirtPos && !p.alt.includes(shirtPos) && !lu.includes(p.id))
    if (squatter) {
      lu[0] = squatter.id
      club.tactic.lineup = lu
      const named = ME.lineupFor(g, g.userClubId)
      ok(named === club.tactic.lineup, 'the stale tidy-up writes the new sheet back')
      ok(JSON.stringify(named) === JSON.stringify(expected),
        "and the tidy-up is the ASSISTANT'S pick, misread and all")
    } else {
      ok(false, 'could not stage a stale shirt (no squatter found)')
    }
  }

  // ---- a claimed sheet is sacred ----
  const mine = ME.autoSelect(g, ME.availablePlayers(g, club.players, false)).slice()
  ;[mine[0], mine[1]] = [mine[1], mine[0]] // deliberately not the auto pick
  club.tactic.lineup = mine
  club.tactic.userPicked = true
  const back = ME.lineupFor(g, g.userClubId)
  ok(back === mine, 'a manager-picked sheet comes back by reference, untouched')
  club.tactic.userPicked = false

  // ---- AI clubs never see the assistant's eye ----
  const aiId = Object.keys(g.clubs).find(id => id !== g.userClubId && g.clubs[id].leagueId === 'prem')!
  const aiPool = ME.availablePlayers(g, g.clubs[aiId].players, false)
  const aiNamed = ME.lineupFor(g, aiId)
  const aiHonest = ME.autoSelect(g, aiPool, undefined)
  ok(JSON.stringify(aiNamed.slice(0, 15)) === JSON.stringify(aiHonest.slice(0, 15)),
    'an AI club still fields the honest auto-pick, misread-free')
}

// ---- silence at the press desk has a price ----
{
  const s = newGame('northampton', 'Silent', 777)
  // walk far enough that questions have been asked and expired: three weeks
  // hands-off, then compare the trajectory against a world where the same
  // questions were all swallowed for free (the old behaviour has no lever to
  // pull, so stage it directly: plant an old unanswered question and settle).
  const before = { board: s.clubs[s.userClubId].boardConfidence, mood: s.fanMood ?? 60 }
  s.press.push({
    id: 9999, season: s.season, week: s.week - 1, outlet: 'The Probe',
    question: 'Care to comment?', options: [], answered: false,
  } as never)
  const q = s.press[s.press.length - 1]
  processWeekAndAdvance(s)
  ok(q.answered === true && q.answerLabel === 'No comment', 'an ignored question expires as before')
  const dBoard = before.board - s.clubs[s.userClubId].boardConfidence
  const dMood = before.mood - (s.fanMood ?? 60)
  // the week's own results also move both numbers, so the claim is directional
  // with the planted question's exact cost measured against a control world
  const c = newGame('northampton', 'Silent', 777)
  processWeekAndAdvance(c)
  const cBoard = before.board - c.clubs[c.userClubId].boardConfidence
  const cMood = before.mood - (c.fanMood ?? 60)
  ok(Math.abs((dBoard - cBoard) - 0.8) < 1e-6,
    `the expired question itself cost 0.8 board confidence (saw ${(dBoard - cBoard).toFixed(2)})`)
  ok(Math.abs((dMood - cMood) - 0.4) < 1e-6,
    `and 0.4 fan mood (saw ${(dMood - cMood).toFixed(2)})`)
}

console.log(fails ? `ABSENT PROBE FAILED (${fails})` : 'ABSENT PROBE PASSED')
if (fails) process.exit(1)
