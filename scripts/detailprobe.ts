// Probe: watching a match does not change it (1.8.0).
//
// From how Football Manager's engine is described (one engine, and the
// "detail" level decides only what is kept for watching, never the result):
// a fixture played with commentary (detail) and the same fixture played
// silently, from the same state and the same seed, must be the SAME match.
// Every AI fixture in the league is played silently and the user's own is
// watched, so any difference here is the game treating the two differently.
//
// The engine used to draw from the match's one random stream for things only
// the commentary needed (a missed penalty's line, the atmosphere lines), so
// the silent match and the watched one parted company at the first of them,
// and a sin bin was timed from the commentary clock in one and the tick in
// the other.
//
// Run: npx vite-node scripts/detailprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, matchStats } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const play = (seed: number, fxIndex: number, detail: boolean) => {
  const g = newGame('leicester', 'Detail Probe', seed)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId] && f.homeId !== g.userClubId && f.awayId !== g.userClubId)
  const fx = fxs[fxIndex % fxs.length]
  const ctx = beginMatch(g, fx, mulberry32(seed * 31 + fxIndex), detail, null)
  playHalf(g, ctx); playHalf(g, ctx)
  const st = matchStats(ctx)
  const players = [...ctx.home.onPitch, ...ctx.away.onPitch].sort((a, b) => a - b)
  return {
    score: `${ctx.home.score}-${ctx.away.score}`, tries: `${ctx.home.tries}-${ctx.away.tries}`,
    stats: JSON.stringify(st), onPitch: players.join(','),
    ticks: ctx.tick,
  }
}

const N = 120
let same = 0, sameStats = 0
const diffs: string[] = []
for (let i = 0; i < N; i++) {
  const seed = 3000 + (i % 12), k = i
  const a = play(seed, k, true), b = play(seed, k, false)
  if (a.score === b.score && a.tries === b.tries) same++
  else if (diffs.length < 5) diffs.push(`seed ${seed} fixture ${k}: watched ${a.score} (${a.tries} tries), silent ${b.score} (${b.tries} tries)`)
  if (a.stats === b.stats && a.onPitch === b.onPitch) sameStats++
}
console.log(`${N} fixtures, each played watched and silent from the same state and seed\n`)
for (const d of diffs) console.log(`  ${d}`)
ok(same === N, `the same score and tries every time (${same}/${N})`)
ok(sameStats === N, `and the same match sheet and the same thirty men on at the end (${sameStats}/${N})`)

// ---- AND THE MANAGER'S OWN SIDE (1.8.1) -----------------------------------
// The block above names no user side, so it never met the paths that only a
// user side takes. Two of them differed: a standing call of 'ask' held the
// kick to the end of the tick when watched and took it at once when silent,
// and the testimonial and old-boy tries were worth a better mark only inside
// the watched-only commentary. Played here with the manager's club as the
// user's side and a testimonial named for his best-rated starter, the marks
// and the man of the match have to agree as well as the score.
{
  const playUser = (seed: number, k: number, detail: boolean) => {
    const g = newGame('leicester', 'Detail Probe', seed)
    const fxs = g.fixtures.filter(f => f.homeId === g.userClubId || f.awayId === g.userClubId)
    const fx = fxs[k % fxs.length]
    g.clubs[g.userClubId].tactic.penaltyCall = 'ask'
    // every starter is the testimonial man in turn across the run, so some
    // of them score; and one of them is an old boy of the opposition when
    // the fixture list allows it (exIds is built from the career rows)
    const mine = g.clubs[g.userClubId]
    const xv = mine.tactic.lineup.slice(0, 15).filter((id): id is number => id != null)
    if (fx.homeId === g.userClubId && xv.length) fx.testimonial = xv[k % xv.length]
    const ctx = beginMatch(g, fx, mulberry32(seed * 17 + k), detail)
    playHalf(g, ctx); playHalf(g, ctx)
    const marks = (side: typeof ctx.home) => [...side.ratings.entries()].sort((a, b) => a[0] - b[0]).map(([id, r]) => `${id}:${r.toFixed(3)}`).join(',')
    return { score: `${ctx.home.score}-${ctx.away.score}`, marks: marks(ctx.home) + '|' + marks(ctx.away), motm: ctx.motmId }
  }
  const M = 48
  let sameScore = 0, sameMarks = 0
  const why: string[] = []
  for (let i = 0; i < M; i++) {
    const seed = 5100 + (i % 8)
    const a = playUser(seed, i, true), b = playUser(seed, i, false)
    if (a.score === b.score) sameScore++
    else if (why.length < 4) why.push(`seed ${seed} fixture ${i}: watched ${a.score}, silent ${b.score}`)
    if (a.marks === b.marks && a.motm === b.motm) sameMarks++
  }
  console.log(`\n${M} of the manager's own fixtures, watched and silent\n`)
  for (const d of why) console.log(`  ${d}`)
  ok(sameScore === M, `the manager's side plays the same match either way (${sameScore}/${M})`)
  ok(sameMarks === M, `with the same marks and the same man of the match (${sameMarks}/${M})`)
}

console.log(fails ? `\nDETAIL PROBE FAILED (${fails})` : '\nDETAIL PROBE PASSED: watching a match does not change it')
process.exit(fails ? 1 : 0)
