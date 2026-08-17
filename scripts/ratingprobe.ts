// Does a player's mark know what happened in the match?
//
// User, after winning 75-7: "this was the player rating - feels off?" Nine of
// his fifteen sat on 6.0 while the wing who scored took 9.6.
//
// The measurement was worse than the impression. Before this probe existed:
//
//   won by 15-39   mean 6.73   26% rated 7+
//   won by 1-14    mean 6.68   23% rated 7+
//   lost by 1-14   mean 5.82    3% rated 7+
//   lost by 15+    mean 5.81    3% rated 7+
//
// A thirty-point win and a one-point win were 0.05 apart, and losing by three
// was the same as losing by forty. The scoreboard was a win/loss switch.
//
// Three things are checked, and the first two are EXACT - which matters,
// because a band wide enough to survive noise is a band wide enough to miss
// the bug (the dialweight lesson: three calibrations were made against numbers
// with more slop than the effect being measured).
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, playHalf, teamRatingTerm } from '../src/game/matchEngine'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// ---- 1. the team term is exactly symmetric -------------------------------
//
// One side's gain is the other's loss, for every scoreline. That is what keeps
// the world's mean rating where it is BY CONSTRUCTION rather than by hoping,
// and it is the property the old +0.5 win against -0.3 defeat did not have (it
// paid out +0.2 a fixture, and punished both sides of a draw as non-winners).
{
  const side = (score: number) => ({ score }) as never
  let worst = 0
  const scores = [0, 3, 7, 10, 17, 22, 28, 35, 41, 50, 62, 75, 104]
  for (const a of scores) {
    for (const b of scores) {
      const sum = teamRatingTerm(side(a), side(b)) + teamRatingTerm(side(b), side(a))
      worst = Math.max(worst, Math.abs(sum))
    }
  }
  ok(worst < 1e-12, `the two sides of a fixture cancel exactly (worst residual ${worst.toExponential(1)})`)
  const drew = teamRatingTerm(side(21), side(21))
  ok(drew === 0, `a draw is neutral rather than punished as a non-win (${drew})`)
  // and it is bounded, so a cricket score cannot hand out nines on its own
  const huge = teamRatingTerm(side(140), side(0))
  ok(huge <= 1.70001, `the margin is capped (140-0 is worth ${huge.toFixed(2)})`)
  // ...but past the old cap it is not DEAD flat (user, after the 106-3:
  // "still a little way off for a 106-3 game"). 31-6 and 106-3 used to pay
  // every man on the pitch identically; a hammering now keeps climbing, at a
  // gentler slope, to its own ceiling.
  const handsome = teamRatingTerm(side(31), side(6))
  const cricket = teamRatingTerm(side(106), side(3))
  ok(cricket >= handsome + 0.25,
    `a 106-3 outranks a 31-6 for every shirt (${cricket.toFixed(2)} v ${handsome.toFixed(2)})`)
}

// ---- 2. the screen and the record are the same number --------------------
//
// finalizeMatch settles a mark, files it against the season and the player's
// form, and MatchDay's panel renders the live ctx. Those had drifted: the panel
// read the raw in-match accumulator, so on a 75-7 win a manager saw 6.0 while a
// different figure went into the record. This plays a real match and compares
// what the panel would draw against what the season kept, man by man.
{
  const g = newGame('northampton', 'Rating Probe', 771)
  // A COMPETITIVE ONE. Pre-season friendlies bank rhythm, not records - no
  // apps, no minutes, no ratings (finalizeMatch says so) - so the first
  // fixture a new career meets would give this comparison nothing to compare.
  let fx = userFixtureThisWeek(g)
  for (let i = 0; i < 30 && fx?.compId !== 'prem'; i++) {
    processWeekAndAdvance(g)
    fx = userFixtureThisWeek(g)
  }
  if (!fx || fx.compId === 'fr') throw new Error('no competitive fixture to play')
  const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
  playHalf(g, ctx)
  playHalf(g, ctx)

  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const panel = mine.finalR
  ok(!!panel && panel.size > 0, `the panel has settled marks to draw (${panel?.size ?? 0})`)
  let worst = 0
  let compared = 0
  for (const [id, shown] of panel ?? []) {
    const p = g.players[id]
    if (!p || p.lastR == null) continue
    compared++
    worst = Math.max(worst, Math.abs(shown - p.lastR))
  }
  ok(compared >= 15, `enough men to compare (${compared})`)
  ok(worst < 1e-9, `every mark on screen is the mark on the record (worst gap ${worst.toExponential(1)})`)
  // and the raw accumulator is untouched, so a second settle cannot compound
  const raw = mine.ratings
  const same = [...(panel ?? [])].filter(([id, v]) => raw.get(id) === v).length
  ok(same < compared, `the raw accumulator was not overwritten (${compared - same} of ${compared} differ)`)
}

// ---- 3. the scoreboard is heard, pooled over four worlds ------------------
//
// Direction, not a fixed band: what has to be true is that a hammering rates
// better than a scrape and a hiding rates worse than a narrow defeat. The
// margins are ORDERED, so the assertion is the ordering rather than any number
// I would otherwise be tempted to tune.
{
  const FWD = new Set(['LP', 'HK', 'TP', 'LK', 'FL', 'N8'])
  const bucket: Record<string, number[]> = {}
  const unit: Record<string, number[]> = {}
  const of = (m: number) => m >= 25 ? 'big win' : m > 0 ? 'narrow win'
    : m === 0 ? 'draw' : m > -25 ? 'narrow loss' : 'heavy loss'

  for (const seed of [991, 4242, 777, 31337]) {
    const g = newGame('northampton', 'Rating Probe', seed)
    const club = g.clubs[g.userClubId]
    for (let wk = 0; wk < 34; wk++) {
      const fx = userFixtureThisWeek(g)
      const before = new Map(club.players.map(id => [id, g.players[id]?.stats.apps ?? 0]))
      processWeekAndAdvance(g)
      if (!fx?.played) continue
      const mine = fx.homeId === club.id ? fx.homeScore : fx.awayScore
      const theirs = fx.homeId === club.id ? fx.awayScore : fx.homeScore
      const b = of(mine - theirs)
      for (const id of club.players) {
        const p = g.players[id]
        if (!p || p.lastR == null || (p.stats.apps ?? 0) === before.get(id)) continue
        ;(bucket[b] ??= []).push(p.lastR)
        ;(unit[FWD.has(p.pos) ? 'forwards' : 'backs'] ??= []).push(p.lastR)
      }
    }
  }

  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const pct7 = (a: number[]) => (a.filter(v => v >= 7).length / a.length) * 100
  console.log('')
  for (const k of ['big win', 'narrow win', 'draw', 'narrow loss', 'heavy loss']) {
    const a = bucket[k]
    if (a?.length) console.log(`  ${k.padEnd(12)} n=${String(a.length).padStart(4)}  mean ${mean(a).toFixed(2)}  ${pct7(a).toFixed(0)}% rated 7+`)
  }
  console.log('')
  for (const k of Object.keys(unit)) {
    console.log(`  ${k.padEnd(12)} n=${String(unit[k].length).padStart(4)}  mean ${mean(unit[k]).toFixed(2)}  ${pct7(unit[k]).toFixed(0)}% rated 7+`)
  }
  console.log('')

  const have = (k: string) => (bucket[k]?.length ?? 0) >= 40
  if (have('big win') && have('narrow win')) {
    const d = mean(bucket['big win']) - mean(bucket['narrow win'])
    ok(d >= 0.25, `a big win rates better than a narrow one (+${d.toFixed(2)}, was +0.05)`)
  }
  if (have('heavy loss') && have('narrow loss')) {
    const d = mean(bucket['narrow loss']) - mean(bucket['heavy loss'])
    ok(d >= 0.25, `a hiding rates worse than a narrow defeat (${d.toFixed(2)} apart, was 0.01)`)
  }
  // and the whole thing has to stay a rugby mark, not drift to 8s or 4s
  const all = Object.values(bucket).flat()
  const m = mean(all)
  ok(m > 5.7 && m < 6.5, `the world's mean mark is still about six (${m.toFixed(2)})`)
}

console.log(fails ? `\nRATING PROBE FAILED (${fails})` : '\nRATING PROBE PASSED: the scoreboard is in the mark')
process.exit(fails ? 1 : 0)
