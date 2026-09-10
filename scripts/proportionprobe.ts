/**
 * ---- EVERY FIGURE, AGAINST THE CLUB THAT PAYS IT ----
 *
 * The pre-season press room asked every club in the game for £400,000 to take
 * the squad somewhere warm. Toulouse have a £6.5m budget and shrugged. A club
 * in the women's Championship has £41,000, and was being asked for ten times
 * everything it had, in a menu, as though it were an ordinary choice.
 *
 * Nothing caught it, and nothing could have, because every probe in this
 * repository asks whether a number is CORRECT and none of them asks what it
 * LOOKS LIKE to the person being shown it. £400,000 is a correct number. It is
 * a fine number. It is the wrong number to put in front of that club, and the
 * only way to see that is to hold it up against the budget on the same screen.
 *
 * So this walks every club in both worlds - 158 times the budget from the
 * poorest to the richest - and asks three questions of every sum the game
 * quotes:
 *
 *   IS IT PROPORTIONATE. A cost is a share of what the club has, or it is a
 *     joke at one end of the league pyramid and an irrelevance at the other.
 *   DOES IT MOVE. A figure that is the same for a £41,000 club and a £6,500,000
 *     one is a constant somebody forgot to attach to anything.
 *   DOES THE PROSE AGREE WITH THE LEDGER. This is the half that bit twice. The
 *     camp cost was scaled and the story that followed it was not, so a club
 *     paid £38,000 and was told by its own inbox that £400,000 had been well
 *     spent. A number written into a translated sentence can never scale, and
 *     there is no compiler on earth that will tell you.
 *
 * Run: npx vite-node scripts/proportionprobe.ts
 */
import { readFileSync } from 'node:fs'
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { campCost, tourFee, generatePress, answerPress } from '../src/game/media'
import { objectiveBonus } from '../src/game/objectives'
import { INJECT_TIERS } from '../src/game/grants'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const say = (s: string) => console.log(s)

/** Every club the game can start you at, with the budget it starts with. */
const CLUBS = (['m', 'w'] as const).flatMap(g =>
  LEAGUE_DEFS(g).flatMap(l => l.clubs.map(c => ({ g, league: l.id, id: c.id, budget: c.budget }))))
const budgets = CLUBS.map(c => c.budget).sort((a, b) => a - b)
say(`${CLUBS.length} clubs, from ${budgets[0].toLocaleString()} to ${budgets[budgets.length - 1].toLocaleString()} `
  + `- a spread of ${Math.round(budgets[budgets.length - 1] / budgets[0])}x\n`)

/** fmtMoney, read backwards: "£1.2m" -> 1200000. */
function parseMoney(s: string): number | null {
  const m = /£\s?([\d.,]+)\s?(bn|m|k)?/i.exec(s)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const mult = { bn: 1e9, m: 1e6, k: 1e3 }[(m[2] ?? '').toLowerCase() as 'bn' | 'm' | 'k'] ?? 1
  return n * mult
}

// ---------------------------------------------------------------------------
// 1. WHAT THE GAME ASKS FOR, AS A SHARE OF WHAT THE CLUB HAS
// ---------------------------------------------------------------------------
say('--- 1. every quoted sum is a share of the budget, not a number in the air')
{
  // The ceiling is a SHARE, because what makes a cost absurd is what fraction
  // of the club it is. The floor is an ABSOLUTE, because these figures are
  // capped at the top - the objective bonus stops at £250,000 - and at a club
  // with a £6.5m budget that is a small share and still plainly worth having.
  // Testing the floor as a share failed on exactly that and was wrong to.
  const QUOTES: [string, (b: number) => number, number, number][] = [
    // name, function, ceiling as a share of budget, floor in pounds
    ['the warm-weather camp', campCost, 0.16, 5_000],
    ["the sponsor's tour", tourFee, 0.22, 8_000],
    ['a met side objective', objectiveBonus, 0.40, 15_000],
  ]
  for (const [name, fn, hi, floor] of QUOTES) {
    const shares = CLUBS.map(c => fn(c.budget) / c.budget)
    const worstHigh = Math.max(...shares)
    const at = CLUBS[shares.indexOf(worstHigh)]
    ok(worstHigh <= hi,
      `${name}: never more than ${(hi * 100).toFixed(0)}% of a budget `
      + `(worst is ${(worstHigh * 100).toFixed(0)}% at ${at.id}, budget ${at.budget.toLocaleString()})`)
    const least = Math.min(...CLUBS.map(c => fn(c.budget)))
    ok(least >= floor,
      `${name}: and never so small it is not worth the tap (least is ${least.toLocaleString()})`)
  }
}

// ---------------------------------------------------------------------------
// 2. AND IT MOVES WITH THE CLUB
//
// The tell for an unmoored constant: quote it to the poorest club in the game
// and to the richest, and see whether the answer changes.
// ---------------------------------------------------------------------------
say('\n--- 2. the figure is different for a different club')
{
  const poor = CLUBS.reduce((a, b) => (a.budget <= b.budget ? a : b))
  const rich = CLUBS.reduce((a, b) => (a.budget >= b.budget ? a : b))
  for (const [name, fn] of [['camp', campCost], ["tour", tourFee], ['objective', objectiveBonus]] as const) {
    const p = fn(poor.budget), r = fn(rich.budget)
    ok(r > p * 2,
      `${name}: ${poor.id} is quoted ${p.toLocaleString()} and ${rich.id} ${r.toLocaleString()}`)
  }
}

// ---------------------------------------------------------------------------
// 3. THE PROSE QUOTES THE LEDGER
//
// The camp was taken in a real career, at a small club and a large one, and the
// story that followed is read back for its money. This is the assertion that
// would have caught "£400k well spent, probably" landing in the inbox of a club
// that had just paid thirty-eight thousand.
// ---------------------------------------------------------------------------
say('\n--- 3. the story quotes the figure the club actually paid')
{
  let checked = 0
  const wrong: string[] = []
  // one big club and one small one in each world, so the story is read back at
  // both ends of the range the scaling has to cover
  const PAIRS: [string, 'm' | 'w'][] = [
    ['northampton', 'm'], ['pirates', 'm'], ['w:quins', 'w'], ['w:lichfield', 'w'],
  ]
  for (const [clubId, gender] of PAIRS) {
    if (!CLUBS.some(c => c.id === clubId && c.g === gender)) continue
    for (const want of ['heat', 'tour'] as const) {
      const g = newGame(clubId, 'Proportion', 606, undefined, 'coach', gender)
      const club = g.clubs[g.userClubId]
      const before = club.balance
      const rng = mulberry32(606)
      g.week = 1
      let guard = 0
      let done = false
      while (!done && guard++ < 8) {
        generatePress(g, rng)
        for (const p of g.press) {
          if (p.answered) continue
          const i = (p.options ?? []).findIndex(o => o.camp === want)
          if (i < 0) { p.answered = true; continue }
          const newsFrom = g.news.length
          answerPress(g, p.id, i)
          const moved = Math.abs(club.balance - before)
          checked++
          // every sum this story prints has to be the sum that moved
          const story = g.news.slice(newsFrom).filter(n => n.k?.startsWith('news.camp'))
          for (const n of story) {
            for (const v of Object.values(n.v ?? {})) {
              const said = typeof v === 'string' ? parseMoney(v) : null
              if (said == null) continue
              // fmtMoney rounds, so agreement is within a rounding step
              if (Math.abs(said - moved) > Math.max(1_000, moved * 0.06)) {
                wrong.push(`${clubId} ${want}: the story says ${said.toLocaleString()}, the ledger moved ${moved.toLocaleString()}`)
              }
            }
            // and nothing in the body may be a bare number the story invented
            const bare = parseMoney(n.body ?? '')
            if (bare != null && Math.abs(bare - moved) > Math.max(1_000, moved * 0.06)) {
              wrong.push(`${clubId} ${want}: "${(n.body ?? '').slice(0, 60)}..." against a ledger move of ${moved.toLocaleString()}`)
            }
          }
          done = true
          break
        }
        g.week++
      }
    }
  }
  ok(checked > 0, `${checked} camps taken in real careers`)
  ok(wrong.length === 0, `and every one of them was reported at the price it cost${wrong.length ? ` - ${wrong[0]}` : ''}`)
  wrong.slice(1, 4).forEach(w => console.log(`        ${w}`))
}

// ---------------------------------------------------------------------------
// 4. NO MONEY IS WRITTEN INTO A SENTENCE
//
// A figure inside a translated string cannot scale, cannot be rounded, and
// cannot be corrected without touching six files. Every one that is left is
// listed by name with the reason it is allowed to be there.
// ---------------------------------------------------------------------------
say('\n--- 4. no figure is baked into prose')
{
  /** Rates and ranges, which are facts about the game rather than a sum owed by
   *  any particular club. */
  const ALLOWED = new Map([
    ['finances.gateNoteNone', 'the gate is £30 a head for everybody, which is the rate itself'],
    ['store.fundingLine', 'the four board resolutions are real-money products at fixed prices'],
  ])
  const money = /£\s?[\d.,]+\s?(?:bn|m|k)?/i
  for (const lang of ['en', 'fr', 'es', 'it', 'ja', 'af']) {
    const out: string[] = []
    const walk = (o: unknown, path: string) => {
      if (typeof o === 'string') {
        if (money.test(o) && !ALLOWED.has(path)) out.push(`${path}: "${o.slice(0, 70)}"`)
        return
      }
      if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${i}]`)); return }
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          if (k === '_meta') continue
          walk(v, path ? `${path}.${k}` : k)
        }
      }
    }
    walk(JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8')), '')
    ok(out.length === 0, `${lang}: ${out.length} entries carry a figure in the prose${out.length ? ` - ${out[0]}` : ''}`)
    out.slice(1, 3).forEach(o => console.log(`        ${o}`))
  }
}

// ---------------------------------------------------------------------------
// 5. AND THE ONE LINE THAT IS ALLOWED TO NAME FIGURES NAMES THE RIGHT ONES
//
// store.fundingLine is on the allowlist above because the board resolutions are
// real-money products at fixed prices, so a fixed figure is the truth rather
// than a constant somebody forgot. That is only a defence while the figures
// still match, and a store line quoting a price the store does not charge is a
// worse fault than the one the allowlist was written to permit.
// ---------------------------------------------------------------------------
say('\n--- 5. and the store line names the prices the store charges')
{
  const tiers = Object.values(INJECT_TIERS).map(t => t.amount).sort((a, b) => a - b)
  const line = (JSON.parse(readFileSync('src/locales/en.json', 'utf8')) as { store: Record<string, string> }).store.fundingLine
  const said = [...line.matchAll(/£\s?([\d.,]+)\s?(bn|m|k)?/gi)].map(m => {
    const n = Number(m[1].replace(/,/g, ''))
    return n * ({ bn: 1e9, m: 1e6, k: 1e3 }[(m[2] ?? '').toLowerCase() as 'bn' | 'm' | 'k'] ?? 1)
  })
  ok(said.length === 2 && said[0] === tiers[0] && said[1] === tiers[tiers.length - 1],
    `"${line.slice(0, 46)}..." spans ${tiers[0].toLocaleString()} to ${tiers[tiers.length - 1].toLocaleString()}, `
    + `which is what the four tiers cost`)
  ok(/\b4\b|four|quatre|cuatro|quattro|vier/i.test(line) || /4/.test(line),
    `and there are ${tiers.length} of them`)
}

console.log(fails
  ? `\nPROPORTION PROBE FAILED (${fails})`
  : '\nPROPORTION PROBE PASSED: every figure is a share of what the club has, and the story says so')
if (fails) process.exit(1)
