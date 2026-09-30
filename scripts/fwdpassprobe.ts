// Probe: the forward pass in a try's build-up, and the TMO that reviews it.
//
// The owner, 30 Sep 2026: "There should still be forward passes in the game,
// but IF a try happens then the TMO should get involved with 90% ruled off.
// The other 10% should be left in for debate and tight calls."
//
// Over a few thousand watched matches of the real engine, this checks:
//   forward-pass tries happen, at a small rate (FWD_PASS.rate of handled
//     tries, scaled by the side's handling error)
//   every one goes to the TMO (a review line with fx TMO, before the verdict)
//   about nine in ten are ruled out (binomial tolerance), the rest stand
//   a ruled-out one is a NO TRY (fx NOTRY, a SUB line, never a TRY), with no
//     conversion, and play restarts with a scrum to the DEFENDING side
//   one that stands is a TRY, followed by the debate line, then its conversion
//   the tries the match counts (matchStats, the score, the TRY lines) never
//     include a ruled-out one
//   every new line exists in all six languages
//   NO NEW DRAWS ON THE SHARED STREAM: the same fixtures played with the
//     forward pass switched off (FWD_PASS.rate = 0) take exactly the same
//     number of rng draws and finish with the same score wherever no
//     forward-pass try was ruled out, and every match is line-for-line the
//     same up to its first forward-pass review
//
// Run: npx vite-node scripts/fwdpassprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, matchStats, FWD_PASS, type LiveCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import { momentAt } from '../src/ui/HighlightClip'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const CLUBS = ['leicester', 'toulouse', 'leinster', 'crusaders', 'northampton', 'saracens']
const SEEDS = 60
const PER = 14
const RATE = FWD_PASS.rate

interface Played { ctx: LiveCtx; draws: number }
function play(g: GameState, fxId: number, seed: number): Played {
  const fx = g.fixtures.find(f => f.id === fxId)!
  const base = mulberry32(seed)
  let draws = 0
  const rng = () => { draws++; return base() }
  const ctx = beginMatch(g, fx, rng, true, null)
  playHalf(g, ctx); playHalf(g, ctx)
  return { ctx, draws }
}

const isReview = (k?: string) => !!k && /^comm\.tmoReviewFwd\d$/.test(k)
const isRuled = (k?: string) => !!k && /^comm\.tmoNoTryFwd\d$/.test(k)
const isScrum = (k?: string) => !!k && /^comm\.tmoFwdScrum\d$/.test(k)
const isStands = (k?: string) => !!k && /^comm\.tmoFwdStands\d$/.test(k)

let matches = 0, tries = 0, reviews = 0, ruled = 0, stood = 0
let reviewBad = 0, ruledBad = 0, ruledCon = 0, scrumBad = 0, standBad = 0, clipBad = 0
let countBad = 0, ctxBad = 0
let same = 0, sameN = 0, prefixBad = 0, standOnlySame = 0, standOnlyN = 0

for (let s = 1; s <= SEEDS; s++) {
  const club = CLUBS[s % CLUBS.length]
  // each fixture is played on two copies of one untouched world, so the
  // on and off runs start from exactly the same state
  const world = newGame(club, 'Forward Pass Probe', 8800 + s)
  const fxs = world.fixtures.filter(f => world.clubs[f.homeId] && world.clubs[f.awayId]).slice(0, PER)
  for (const [i, fx] of fxs.entries()) {
    const seed = s * 7919 + i
    const on = structuredClone(world), off = structuredClone(world)
    FWD_PASS.rate = RATE
    const a = play(on, fx.id, seed)
    FWD_PASS.rate = 0
    const b = play(off, fx.id, seed)
    FWD_PASS.rate = RATE
    matches++
    const ev = a.ctx.events
    const home = a.ctx.fx.homeId
    for (let j = 0; j < ev.length; j++) {
      const e = ev[j]
      if (e.type === 'TRY') tries++
      if (!isReview(e.k)) continue
      reviews++
      if (e.fx !== 'TMO' || e.type !== 'SUB') reviewBad++
      const v = ev[j + 1]
      if (isRuled(v?.k)) {
        ruled++
        if (v.fx !== 'NOTRY' || v.type !== 'SUB' || v.teamId !== e.teamId) ruledBad++
        // no conversion for a try that is not there
        if (ev.slice(j + 1, j + 4).some(c => c.teamId === e.teamId && (c.type === 'CON' || c.k === 'comm.conWide'))) ruledCon++
        // and the scrum is the defending side's
        const sc = ev[j + 2]
        if (!isScrum(sc?.k) || sc.teamId === e.teamId || sc.fx !== 'SCRUM') scrumBad++
        if (momentAt(ev, j + 1, home, 'key') !== 'notry') clipBad++
      } else if (v?.type === 'TRY' && v.teamId === e.teamId) {
        stood++
        const d = ev[j + 2]
        if (!isStands(d?.k) || d.teamId !== e.teamId) standBad++
        if (momentAt(ev, j + 1, home, 'key') !== 'try') clipBad++
      } else {
        standBad++
      }
    }
    // the counts: tries on the sheet are the TRY lines, and never a ruled-out one
    const st = matchStats(a.ctx)
    const hTries = ev.filter(e => e.type === 'TRY' && e.teamId === home).length
    const aTries = ev.filter(e => e.type === 'TRY' && e.teamId !== home).length
    if (st.tries[0] !== hTries || st.tries[1] !== aTries) countBad++
    if (a.ctx.fx.homeTries !== st.tries[0] || a.ctx.fx.awayTries !== st.tries[1]) countBad++
    const nRuled = (a.ctx.home.fwdRuledOut ?? 0) + (a.ctx.away.fwdRuledOut ?? 0)
    const nStood = (a.ctx.home.fwdStood ?? 0) + (a.ctx.away.fwdStood ?? 0)
    if (nRuled !== ev.filter(e => isRuled(e.k)).length || nStood !== ev.filter(e => isStands(e.k)).length) ctxBad++

    // the stream: identical until the first forward-pass review, and wholly
    // identical where nothing was ruled out
    const first = ev.findIndex(e => isReview(e.k))
    const upto = first < 0 ? ev.length : first
    const pa = ev.slice(0, upto).map(e => `${e.min}|${e.type}|${e.teamId}|${e.k}|${e.homeScore}-${e.awayScore}`)
    const pb = b.ctx.events.slice(0, upto).map(e => `${e.min}|${e.type}|${e.teamId}|${e.k}|${e.homeScore}-${e.awayScore}`)
    if (JSON.stringify(pa) !== JSON.stringify(pb)) prefixBad++
    const identical = a.draws === b.draws && a.ctx.home.score === b.ctx.home.score && a.ctx.away.score === b.ctx.away.score
    if (first < 0) { sameN++; if (identical) same++ }
    else if (nRuled === 0) { standOnlyN++; if (identical) standOnlySame++ }
  }
}

const tryRate = reviews / Math.max(1, tries + ruled)
console.log(`${matches} watched matches: ${(tries / matches).toFixed(2)} tries a match, ${reviews} forward-pass reviews (${(reviews / matches).toFixed(3)} a match, ${(tryRate * 100).toFixed(1)}% of tries scored or ruled out)`)
console.log(`ruled out ${ruled}, stood ${stood} (${(ruled / Math.max(1, reviews) * 100).toFixed(1)}% ruled out)\n`)

ok(reviews >= 100, `forward-pass tries happen (${reviews})`)
ok(tryRate > RATE * 0.4 && tryRate < RATE * 1.6, `at a small rate (${(tryRate * 100).toFixed(1)}% of tries, base ${(RATE * 100).toFixed(1)}% of handled tries)`)
ok(reviewBad === 0, `every one goes to the TMO: a review line held as fx TMO (${reviewBad} not)`)
const want = FWD_PASS.ruledOut, se = Math.sqrt(want * (1 - want) / Math.max(1, reviews))
ok(Math.abs(ruled / reviews - want) < 4 * se, `about nine in ten are ruled out (${(ruled / reviews * 100).toFixed(1)}%, 90% +/- ${(4 * se * 100).toFixed(1)})`)
ok(stood > 0, `and some stand, for debate (${stood})`)
ok(ruled + stood === reviews && standBad === 0, `a stood one is the TRY, then the debate line (${standBad} not)`)
ok(ruledBad === 0, `a ruled-out one is a NO TRY line, never a TRY (${ruledBad} not)`)
ok(ruledCon === 0, `with no conversion (${ruledCon} had one)`)
ok(scrumBad === 0, `and play restarts with a scrum to the defending side (${scrumBad} not)`)
ok(clipBad === 0, `the match view plays them as the TMO's NO TRY or the TRY (${clipBad} not)`)
ok(countBad === 0, `the tries counted (matchStats, the fixture) never include a ruled-out one (${countBad} mismatched)`)
ok(ctxBad === 0, `the side's own ruled-out and stood counts agree with the lines (${ctxBad} not)`)

console.log('\n--- no new draws on the shared stream\n')
ok(prefixBad === 0, `every match is line for line the same as with the forward pass off, up to its first review (${prefixBad} differ)`)
ok(sameN > 0 && same === sameN, `a match with no forward-pass try takes the same draws to the same score (${same}/${sameN})`)
ok(standOnlyN === 0 || standOnlySame / standOnlyN >= 0.8, `and one where it only stood almost always does too (${standOnlySame}/${standOnlyN}; the ordinary review's verdict can differ)`)

console.log('\n--- the words, in six languages\n')
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
const KEYS = [1, 2].flatMap(n => ['tmoReviewFwd', 'tmoNoTryFwd', 'tmoFwdScrum', 'tmoFwdStands'].map(k => `comm.${k}${n}`))
let missing = 0
for (const l of LANGS) await ensureLang(l)
for (const l of LANGS) for (const k of KEYS) {
  const s = tIn(l, k, { team: 'Bath' })
  if (!s || s === k || s.includes('{') || (l !== 'en' && s === tIn('en', k, { team: 'Bath' }))) { missing++; console.log(`    missing ${l} ${k}`) }
}
ok(missing === 0, `all ${KEYS.length} lines exist in all six languages (${missing} missing)`)

console.log(fails ? `\n${fails} FAILURES` : '\nFORWARD PASS PROBE PASSED')
process.exit(fails ? 1 : 0)
