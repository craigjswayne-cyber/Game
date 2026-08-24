// Probe: what a French manager can still be shown in English.
//
// The inbox and the commentary each got a probe and each got to zero, and both
// times the same thing was true first: nobody could say how much was left. A
// number that only falls is worth more than a promise, so this is the number
// for everything else.
//
// It counts PROSE REACHING A READER: a string literal in the engine long
// enough to be a sentence, in a place a screen will show it. The engine is
// full of English that is not prose - keys, ids, css, format strings - so the
// test is deliberately narrow, and each counter is separately budgeted so one
// category getting worse cannot hide behind another getting better.
//
//   decisions   logDecision() writes the manager's own history, and the
//               profile screen shows it back. A decision recorded in English
//               is English in that history for the life of the career.
//   press       the questions the media ask and the answers on the buttons.
//   touchline   what the game says back when a touchline button is pressed.
//
// Run: npx vite-node scripts/proseprobe.ts
import { readFileSync, readdirSync } from 'node:fs'

/** ONLY EVER DECREASE. */
const BUDGET = { decisions: 0, press: 0, touchline: 0 }

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const GAME = 'src/game'
const files = readdirSync(GAME).filter(f => f.endsWith('.ts')).map(f => `${GAME}/${f}`)

/** Does this argument carry a SENTENCE, rather than a key or an expression that
 *  picks between keys?
 *
 *  The test is the quoted text inside it, not the argument's own shape: the
 *  argument is often a ternary spanning three lines, which has plenty of
 *  whitespace in it and no prose whatsoever. A key is 'a.b' with no space in
 *  it; a sentence has spaces. So: pull out every quoted literal and ask whether
 *  any of them reads like something a person wrote. */
const isProse = (arg: string): boolean => {
  const quoted = [...arg.matchAll(/`([^`]*)`|'([^']*)'|"([^"]*)"/g)]
    .map(m => m[1] ?? m[2] ?? m[3] ?? '')
  return quoted.some(q => q.trim().length > 12 && /\s/.test(q))
}

/** The argument after `fn(state, ` in a call, to the comma that closes it. */
function secondArg(src: string, callIdx: number, fn: string): string {
  let i = callIdx + fn.length + 1
  let depth = 0, argN = 0, start = i
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth-- }
    else if (c === ',' && depth === 0) {
      argN++
      if (argN === 1) start = i + 1
      else break
    }
  }
  return src.slice(start, i)
}

say('--- 1. the manager\'s own decision history')
const decisions: string[] = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (let i = src.indexOf('logDecision('); i !== -1; i = src.indexOf('logDecision(', i + 1)) {
    if (/function\s+$/.test(src.slice(Math.max(0, i - 24), i))) continue
    if (isProse(secondArg(src, i, 'logDecision('))) {
      decisions.push(`${f}:${src.slice(0, i).split('\n').length}`)
    }
  }
}
say(`  ${decisions.length} decision(s) recorded as English (budget ${BUDGET.decisions})`)
if (decisions.length) say('  ' + decisions.slice(0, 10).join('\n  ') + (decisions.length > 10 ? `\n  ...and ${decisions.length - 10} more` : ''))
ok(decisions.length <= BUDGET.decisions, `no decision beyond the budget of ${BUDGET.decisions} is recorded as English`)
if (decisions.length < BUDGET.decisions) {
  ok(false, `THE DECISIONS BUDGET IS STALE: ${decisions.length} left but it still says ${BUDGET.decisions}. Lower it`)
}

say('\n--- 2. the press questions and the answers on the buttons')
// A press item is built with `q:` and its options with `text:`; both reach a
// button. A key has no spaces in it.
const press: string[] = []
{
  const src = readFileSync('src/game/media.ts', 'utf8')
  for (const m of src.matchAll(/\b(q|text):\s*(`[^`]{14,}`|'[^']{14,}')/g)) {
    if (isProse(m[2])) press.push(`media.ts:${src.slice(0, m.index).split('\n').length}`)
  }
}
say(`  ${press.length} press line(s) written as English (budget ${BUDGET.press})`)
ok(press.length <= BUDGET.press, `no press line beyond the budget of ${BUDGET.press} is written as English`)
if (press.length < BUDGET.press) {
  ok(false, `THE PRESS BUDGET IS STALE: ${press.length} left but it still says ${BUDGET.press}. Lower it`)
}

say('\n--- 3. what the touchline says back')
// Every touchline action returns a line the screen shows as a toast. They are
// bare `return '...'` in matchEngine, which is easy to grep and easy to miss.
const touchline: string[] = []
{
  // src/store.ts as well as the engine: the same replies are given there when
  // the action arrives after the whistle, and only counting one file is how a
  // category gets declared finished while half of it is still English.
  for (const f of ['src/game/matchEngine.ts', 'src/store.ts']) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/\breturn\s+(`[^`]{14,}`|'[^']{14,}')/g)) {
      if (isProse(m[1])) touchline.push(`${f}:${src.slice(0, m.index).split('\n').length}`)
    }
  }
}
say(`  ${touchline.length} touchline reply/replies written as English (budget ${BUDGET.touchline})`)
if (touchline.length) say('  ' + touchline.slice(0, 10).join('\n  ') + (touchline.length > 10 ? `\n  ...and ${touchline.length - 10} more` : ''))
ok(touchline.length <= BUDGET.touchline, `no touchline reply beyond the budget of ${BUDGET.touchline} is written as English`)
if (touchline.length < BUDGET.touchline) {
  ok(false, `THE TOUCHLINE BUDGET IS STALE: ${touchline.length} left but it still says ${BUDGET.touchline}. Lower it`)
}

say(fails ? `\nPROSE PROBE FAILED (${fails})` : '\nPROSE PROBE PASSED: nothing reaches a reader in a language they did not choose')
process.exitCode = fails ? 1 : 0
