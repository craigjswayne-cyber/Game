// Probe: the season-launch decision has consequences you can bank.
//
// User: "think they'll win the league? they get a bit more money but they
// best win or the board will be nervous about their budget. same goes if a
// manager picks a top team and selects fight bravely against relegation then
// it should be showing his lack of expectation and the squad should be more
// doubtful of their manager."
//
// Four claims, each asserted as a DIFFERENCE between paired states that agree
// on everything else, so world noise cannot vote:
//
//   1. Aiming high banks the war chest printed on the button, immediately.
//   2. The squad's reaction scales with stature: talking a title favourite
//      down costs real morale, talking a wooden-spoon pick up buys more than
//      it would at a favourite.
//   3. At rollover, a missed promise claws the advance back with interest;
//      a kept one is kept. (Paired clones at the rollover boundary.)
//   4. The objective bonus the verdict prints ("+£250k budget") actually
//      lands in the budget. It never did: it was added 400 lines before the
//      refresh that assigns every budget from scratch.
//
// All four fail on the old engine, which is the point of a probe.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import type { GameState, PressItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const stanceQ = (g: GameState): PressItem | undefined =>
  g.press.find(p => !p.answered && p.options.some(o => o.stance))

/** Advance until the launch question is on the desk (fires week 2). */
const toQuestion = (g: GameState) => {
  for (let i = 0; i < 4 && !stanceQ(g); i++) processWeekAndAdvance(g)
  return stanceQ(g)
}

const meanMorale = (g: GameState) => {
  const ps = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean)
  return ps.reduce((s, p) => s + p.morale, 0) / ps.length
}

// ---- 1. the war chest is banked the moment the words are out ---------------
{
  const g = newGame('northampton', 'Stance', 21)
  const q = toQuestion(g)
  const high = q?.options.find(o => o.stance === 'high')
  ok(!!high?.fund && high.fund >= 100_000, `the aim-high option carries money (${high?.fund ?? 0})`)
  ok(!!high && high.label.includes('war chest'), 'the label says what the money is')
  const before = g.clubs[g.userClubId].budget
  const moraleBefore = meanMorale(g)
  if (q && high) {
    answerPress(g, q.id, q.options.indexOf(high))
    ok(g.clubs[g.userClubId].budget === before + (high.fund ?? 0),
      `the budget moved by exactly the fund (${before} -> ${g.clubs[g.userClubId].budget})`)
    ok(g.stanceFund === high.fund, 'the advance is on the books for the rollover to settle')
    const moved = meanMorale(g) - moraleBefore
    ok(Math.abs(moved - high.morale) < 0.05,
      `the whole room heard it: squad morale moved ${moved.toFixed(2)} against a printed ${high.morale}`)
  }
}

// ---- 2. the reaction reads the club's stature ------------------------------
{
  const at = (pred: number, seed: number) => {
    const g = newGame('northampton', 'Stance', seed)
    g.preds![g.userClubId] = pred
    const q = toQuestion(g)
    return {
      safe: q?.options.find(o => o.stance === 'safe')?.morale ?? 99,
      high: q?.options.find(o => o.stance === 'high')?.morale ?? -99,
    }
  }
  const fav = at(1, 23)
  const dog = at(10, 23)
  console.log(`  favourite: safe ${fav.safe}, high ${fav.high} | bottom pick: safe ${dog.safe}, high ${dog.high}`)
  ok(fav.safe <= -0.5, `talking a title favourite down costs the room dearly (${fav.safe})`)
  ok(dog.safe >= -0.1, `the same words at a wooden-spoon pick cost nearly nothing (${dog.safe})`)
  ok(dog.high > fav.high + 0.2, `aiming high lifts an unfancied squad more than a favourite (${dog.high} v ${fav.high})`)
}

// ---- 3 & 4. the rollover settles every promise, paired at the boundary -----
{
  // Walk a career to the rollover, keeping a clone of the state just before
  // the advance that flips the season. The seed is FOUND, not pinned: the
  // miss case needs a season that does not end in the title, and a pinned
  // seed's outcome changes every time the engine legitimately moves (this
  // block's first seed started winning the league the week garbage-time
  // compression shipped). Candidates are tried in order and the first
  // non-champion season carries the asserts - deterministic for any given
  // engine, robust across engines.
  // AND THE MANAGER HAS TO STILL BE THERE IN MAY.
  //
  // The settlement block is inside `if (!state.unemployed)`, and rightly so: a
  // board cannot recall a war chest from a man who no longer has the desk. But
  // that means a candidate season ending in the sack settles as NEITHER kept
  // nor clawed, and every assertion below reads as a failure on an engine that
  // is behaving correctly. It happened for real in v1.1.12: an unrelated change
  // shifted the world, seed 26 started winning silverware, the search fell
  // through to seed 28 - where the hands-off manager is sacked - and CI
  // reported three failures in settlement bookkeeping that was working. Seeds
  // 28 and 33 both do it, which is two of the original five candidates.
  //
  // So the acceptance test is what the claims actually need: a season with no
  // title AND a manager still in a job, from a list wide enough that a
  // reshuffle has somewhere to land.
  let pre: GameState | null = null
  let s0 = 0
  let seedUsed = 0
  for (const seed of [26, 28, 33, 41, 47, 52, 59, 63, 71, 88, 94, 103]) {
    const g = newGame('northampton', 'Stance', seed)
    const start = g.season
    let snap: GameState | null = null
    for (let i = 0; i < 60 && g.season === start; i++) {
      const s = structuredClone(g)
      processWeekAndAdvance(g)
      if (g.season !== start) snap = s
    }
    const champ = g.history.some(h => h.season === start && h.champion === g.userClubId)
    if (snap && !champ && !g.unemployed) { pre = snap; s0 = start; seedUsed = seed; break }
    console.log(`  (seed ${seed} ${champ ? 'ends in silverware' : g.unemployed ? 'ends in the sack' : 'never turned over'} - trying the next)`)
  }
  ok(!!pre, `captured a title-free season on the eve of its rollover (seed ${seedUsed})`)
  if (pre) {
    const run = (mutate: (s: GameState) => void): GameState => {
      const s = structuredClone(pre!)
      mutate(s)
      for (let i = 0; i < 4 && s.season === s0; i++) processWeekAndAdvance(s)
      return s
    }
    const control = run(() => {})
    const budget = (s: GameState) => s.clubs[s.userClubId].budget

    // a promise measured against pred 1 is missed by anyone but the champion
    const missed = run(s => {
      s.stance = 'high'
      s.stanceFund = 250_000
      s.preds![s.userClubId] = 1
    })
    const wonIt = missed.news.some(n => n.subject.includes('war chest is yours to keep'))
    if (wonIt) {
      ok(false, 'a season with no trophy must not settle the promise as kept')
    } else {
      ok(missed.news.some(n => n.subject.includes('recalls the war chest')),
        'the board says out loud that it is taking the money back')
      ok(budget(missed) === Math.max(200_000, budget(control) - 450_000),
        `the advance came back with interest: ${budget(control)} -> ${budget(missed)} (claw 1.75x 250k)`)
    }

    // a promise measured against a rung BELOW the table is kept by any finish
    // at all. This used to stage pred = dead last ("kept by anyone not dead
    // last") and the assistant-eye wave promptly found the hole: seed 26's
    // hands-off Saints finished bottom and survived the relegation playoff -
    // the autopilot cost working as designed - and the staging silently turned
    // into a missed promise. This probe tests the settlement bookkeeping, not
    // the club's season, so the staged number must not depend on the finish.
    const kept = run(s => {
      s.stance = 'high'
      s.stanceFund = 250_000
      const n = Object.keys(s.preds ?? {}).length || 10
      s.preds![s.userClubId] = n + 1
    })
    ok(kept.news.some(n => n.subject.includes('war chest is yours to keep')),
      'a kept promise is acknowledged, not clawed')
    ok(budget(kept) === budget(control), 'and the advance stays spent, no claw')

    // the objective bonus is real money now: same rollover, objectives removed
    const bare = run(s => { s.objectives = [] })
    const verdict = control.news.find(n => n.subject.includes('Board delighted') || n.subject.includes('Board verdict'))
    const met = (verdict?.body.match(/met \(\+£250k budget\)/g) ?? []).length
    console.log(`  objectives met on this seed: ${met}`)
    if (met > 0) {
      ok(budget(control) === budget(bare) + met * 250_000,
        `the printed +£250k per met objective actually lands (${budget(bare)} -> ${budget(control)})`)
    } else {
      ok(budget(control) === budget(bare), 'no objectives met, no bonus - budgets agree')
      console.log('  (no objective met on this seed - the landing assert was not exercised)')
    }
  }
}

console.log(fails ? `\nSTANCEPROBE FAILED (${fails})` : '\nSTANCEPROBE PASSED')
process.exit(fails ? 1 : 0)
