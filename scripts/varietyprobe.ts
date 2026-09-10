/**
 * ---- NOTHING THE GAME WRITES SAYS THE SAME THING TWICE ----
 *
 * The opening news item at a low-reputation club printed this, twice, one
 * paragraph after the other:
 *
 *     "Fresh ideas, finally. Anything is better than what we had."
 *     "Fresh ideas, finally. Anything is better than what we had."
 *
 * Not bad luck. The branch drew its two printed fan quotes with pick(hopefuls)
 * TWICE over the same three-item array, so two independent draws collided one
 * time in three. One career in three opened that way, for as long as the
 * feature had existed, and the owner found it by reading his own inbox.
 *
 * TWO HUNDRED AND THIRTEEN PROBES DID NOT. Every text probe in this repository
 * asks correctness questions - does the key exist, does it render, is it
 * translated into six languages, does it fit the phone. Not one of them ever
 * asked the only question that would have caught this:
 *
 *     SAY IT A HUNDRED TIMES AND SHOW ME THE DISTINCT RESULTS.
 *
 * That is the gap this file fills, and it generalises past the one bug. Two
 * separate faults hide in the same blind spot:
 *
 *   REPETITION INSIDE ONE PIECE. A single item repeating itself is the
 *     obvious one and reads as broken.
 *   COLLAPSE ACROSS MANY. A bank of ten lines where one is drawn 60% of the
 *     time reads as a game with one line, and no single career reveals it -
 *     it needs the population.
 *
 * Both are measured here, over real careers rather than by calling the
 * generators directly, because the bug lived in HOW a generator was called and
 * a probe that calls it correctly proves nothing.
 *
 * Run: npx vite-node scripts/varietyprobe.ts
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { generatePress } from '../src/game/media'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const say = (s: string) => console.log(s)

/** Sentences of a body, trimmed, ignoring the very short connective ones that
 *  are SUPPOSED to recur ("Yes." / "No comment."). A repeat only reads as a
 *  fault once there is enough of it to notice. */
const sentencesOf = (body: string): string[] =>
  body.split(/\n+/).map(s => s.trim()).filter(s => s.length >= 25)

// ---------------------------------------------------------------------------
// 1. NO GENERATED ITEM REPEATS ITSELF
//
// Careers across both worlds and the whole reputation range, because the bug
// lived in ONE branch - low reputation, mood under 62 - and a probe that only
// ever builds a giant would have walked past it exactly as the suite did.
// ---------------------------------------------------------------------------
say('\n--- 1. no item the game writes repeats itself')
const CAREERS = 240
let itemsRead = 0
const offenders: string[] = []

for (const gender of ['m', 'w'] as const) {
  const leagues = LEAGUE_DEFS(gender)
  for (let i = 0; i < CAREERS / 2; i++) {
    // spread across leagues and clubs so reputation varies the whole way down
    const league = leagues[i % leagues.length]
    const club = league.clubs[(i * 7) % league.clubs.length]
    const state = newGame(club.id, 'Variety', 90000 + i, undefined, 'coach', gender)
    for (const item of state.news) {
      itemsRead++
      const seen = new Set<string>()
      for (const s of sentencesOf(item.body ?? '')) {
        if (seen.has(s)) {
          offenders.push(`${club.id} seed ${90000 + i}: "${s.slice(0, 64)}..." twice in "${item.subject}"`)
        }
        seen.add(s)
      }
    }
  }
}
ok(offenders.length === 0,
  `${itemsRead} opening items across ${CAREERS} careers, none repeating a line${offenders.length ? ` - ${offenders[0]}` : ''}`)
if (offenders.length) offenders.slice(1, 4).forEach(o => console.log(`        ${o}`))

// ---------------------------------------------------------------------------
// 2. NO SINGLE LINE DOMINATES ITS BANK
//
// A bank of ten where one line is drawn most of the time reads, to a player,
// as a bank of one. The threshold is deliberately generous: a fair draw from
// three gives 33%, from five gives 20%, and weighting on purpose is allowed.
// What is not allowed is a bank whose top line is most of its output.
// ---------------------------------------------------------------------------
say('\n--- 2. no single line is most of what a bank ever says')
{
  const counts = new Map<string, number>()
  for (let i = 0; i < 400; i++) {
    const league = LEAGUE_DEFS('m')[i % LEAGUE_DEFS('m').length]
    const club = league.clubs[(i * 3) % league.clubs.length]
    const state = newGame(club.id, 'Variety', 50000 + i, undefined, 'coach', 'm')
    for (const item of state.news) {
      for (const s of sentencesOf(item.body ?? '')) counts.set(s, (counts.get(s) ?? 0) + 1)
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [topLine, topN] = ranked[0]
  const share = topN / total
  say(`    ${counts.size} distinct lines over ${total} printed`)
  // Lines that appear in EVERY item by design (the sign-off of a standard
  // letter) are legitimate, so the test is on the pool of lines that vary.
  const varying = ranked.filter(([, n]) => n < CAREERS * 0.9)
  const varyTotal = varying.reduce((s, [, n]) => s + n, 0)
  const worst = varying[0]
  ok(worst[1] / varyTotal < 0.25,
    `the most common varying line is ${((worst[1] / varyTotal) * 100).toFixed(1)}% of them: "${worst[0].slice(0, 48)}..."`)
  ok(counts.size >= 30, `the opening inbox draws on at least thirty distinct lines (${counts.size})`)
  void topLine; void share
}

// ---------------------------------------------------------------------------
// 3. THE PRESS ROOM DOES NOT ASK THE SAME THING TWICE IN A ROW
//
// A season is thirty-odd weeks of questions and the room is the most-read
// prose in the game after the commentary. Two identical stems back to back is
// the version of this bug a player meets weekly rather than once.
// ---------------------------------------------------------------------------
say('\n--- 3. the press room varies week to week')
{
  const league = LEAGUE_DEFS('m')[0]
  const state: GameState = newGame(league.clubs[3].id, 'Variety', 777, undefined, 'coach', 'm')
  const asked: string[] = []       // the question STEM, before wording
  const rendered: string[] = []    // and the sentence a player actually reads
  const rng = mulberry32(777)
  for (let w = 1; w <= 30; w++) {
    state.week = w
    const before = state.press.length
    generatePress(state, rng)
    // qk is the QUESTION key - the stem, before its wording is chosen. Two
    // items with the same qk are the same question asked twice.
    for (const p of state.press.slice(before)) { asked.push(p.qk ?? ''); rendered.push(p.question ?? '') }
    // and answer them, because the room stops asking while questions are left
    // open. A probe that never replies measures a manager ignoring the press,
    // which is a different thing from the press having nothing to say.
    for (const p of state.press) p.answered = true
  }
  // THE SAME STEM IS NOT A REPEAT. "Six weeks on the bench for X" two weeks
  // running, about two different players, is a newspaper doing its job. The
  // first draft of this probe failed on exactly that and was wrong to. What is
  // a repeat is the same WORDS about the same subject - the reader cannot tell
  // that apart from a bug, because it is one.
  const repeats = rendered.filter((q, i) => i > 0 && q === rendered[i - 1] && q !== '')
  ok(repeats.length === 0,
    `${rendered.length} questions over thirty weeks, none printing the same sentence twice running${repeats.length ? ` - "${repeats[0].slice(0, 60)}..."` : ''}`)

  // and no one question shape is most of a season. This is the measurable
  // version of "it feels repetitive": a stem the room reaches for again and
  // again reads as a game with one question, however many players it names.
  const byStem = new Map<string, number>()
  for (const k of asked.filter(Boolean)) byStem.set(k, (byStem.get(k) ?? 0) + 1)
  const worstStem = [...byStem.entries()].sort((a, b) => b[1] - a[1])[0]
  const share = worstStem[1] / asked.filter(Boolean).length
  ok(share <= 0.35,
    `the most-used question is ${(share * 100).toFixed(0)}% of the season's press (${worstStem[0]}, ${worstStem[1]} of ${asked.filter(Boolean).length})`)
  const distinct = byStem.size
  ok(distinct >= 8, `and the room draws on at least eight different questions in a season (${distinct})`)
}

// ---------------------------------------------------------------------------
// 4. TWO DIFFERENT STORIES DO NOT REACH FOR THE SAME ENDING
//
// The owner's rule for the whole dictionary was "does this line add something?
// If not then scrap it", and the surest sign that a line adds nothing is the
// game already having used it somewhere else.
//
// Five unrelated stories - a testimonial, a shirt going up over the tunnel, a
// career-games milestone, an old boy scoring against you, and the venue for a
// final - all closed on the same sentiment in slightly different words:
//
//     "Days like this are why the game matters."
//     "The game moves on; days like his are why it matters."
//     "Days like this are why anybody does this job."
//
// Not one of them carried a fact, a consequence or an instruction, and all
// five are gone.
//
// WHAT IS ALLOWED IS TWO TELLINGS OF ONE EVENT. news.lionsCallA and
// news.lionsCallB are the same tour call written twice, and a manager sees one
// or the other and never both; ending them alike is not repetition. The test
// for "the same event" is the key stem, because that is how this dictionary
// has always named a pair - appoint/appointChallenge, bowOne/bowTwo,
// debtConcern/debtDemand, loanOneMore/loanManyMore. The five faults above
// shared no stem at all, which is exactly what made them stock endings rather
// than variants.
// ---------------------------------------------------------------------------
say('\n--- 4. two unrelated stories do not end the same way')
{
  const EN = JSON.parse(readFileSync('src/locales/en.json', 'utf8')) as { news: Record<string, string> }
  const base = (k: string) => k.replace(/_(fw|f|w)$/, '')
  const shared = (a: string, b: string) => {
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    return i
  }
  const closes = new Map<string, Set<string>>()
  for (const [k, v] of Object.entries(EN.news)) {
    if (typeof v !== 'string' || v.split(/\s+/).length < 15) continue
    const parts = v.trim().split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean)
    const last = parts[parts.length - 1] ?? ''
    if (last.split(/\s+/).length < 5) continue
    const key = last.replace(/\{[^}]*\}/g, 'X').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
    if (!closes.has(key)) closes.set(key, new Set())
    closes.get(key)!.add(base(k))
  }
  // 'bow' is the shortest real stem in the dictionary (bowOne / bowTwo), so
  // three characters is the line. The stock endings shared none.
  const STEM = 3
  const stock: string[] = []
  let pairs = 0
  for (const [line, keys] of closes) {
    const ks = [...keys]
    if (ks.length < 2) continue
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        pairs++
        if (shared(ks[i], ks[j]) < STEM) stock.push(`${ks[i]} and ${ks[j]} both end "${line.slice(0, 52)}..."`)
      }
    }
  }
  ok(stock.length === 0,
    `${pairs} stories share an ending, and every one of them is the same event told twice${stock.length ? ` - ${stock[0]}` : ''}`)
  stock.slice(1, 4).forEach(x => console.log(`        ${x}`))
}

console.log(fails
  ? `\nVARIETY PROBE FAILED (${fails})`
  : '\nVARIETY PROBE PASSED: the game does not say the same thing twice')
if (fails) process.exit(1)
