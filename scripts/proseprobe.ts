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
//   replies     and what it says back everywhere else: the transfer table, the
//               office, the treatment room, the board. These are toasts rather
//               than records, so they are translated where they are returned -
//               there is nothing to keep and nothing to migrate.
//
// Run: npx vite-node scripts/proseprobe.ts
import { readFileSync, readdirSync } from 'node:fs'

/** ONLY EVER DECREASE. */
const BUDGET = { decisions: 0, press: 0, touchline: 0, replies: 0 }

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
  // Strip the ${...} holes before judging. `${date} ${month} ${year}` is three
  // spaces and no English at all, and counting it made the money formatter and
  // the date formatter look like prose that needed translating.
  return quoted
    .map(q => q.replace(/\$\{[^}]*\}/g, ' '))
    .some(q => /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(q))
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
// THIS COUNTED THE WRONG FIELDS AND SAID ZERO.
//
// It looked for `q:` and `text:`. media.ts passes the question POSITIONALLY to
// mk() and names its option fields `label:` and `reaction:`, so the pattern
// matched nothing and the budget of zero read as "the press room is done" while
// every question, every button and every reply in it was English. A probe that
// cannot see its subject is worse than no probe: it is a green light.
//
// So: no field names. Every quoted literal in the file that reads like a
// sentence, minus the outlet mastheads, which are titles and stay as they are.
const press: string[] = []
// authority.ts as well as media.ts: the discipline conversation is a press item
// too, built in the incident machine rather than the press generator, and it sat
// there in English while the whole of media.ts was translated around it. Any
// file that pushes onto state.press belongs in this list.
for (const file of ['src/game/media.ts', 'src/game/authority.ts']) {
  const src = readFileSync(file, 'utf8')
  const OUTLETS = src.slice(src.indexOf('OUTLETS'), src.indexOf('OUTLETS') + 400)
  // a quoted literal, and NOT across a line break: `[^']*` happily runs from an
  // apostrophe in one import to a quote three lines later, which is how the
  // first version of this reported thirty-one imports as English prose
  let inBlockComment = false
  // a state.news.push({...}) inside these files carries the SANCTIONED stored
  // English - the body a save keeps beside its key - and newsprobe already
  // guarantees every one of them has that key. Skip those blocks, or this
  // check reports the thing the design asks for.
  let newsDepth = 0
  src.split('\n').forEach((raw, i) => {
    const trimmed = raw.trimStart()
    if (inBlockComment) { if (raw.includes('*/')) inBlockComment = false; return }
    if (trimmed.startsWith('/*')) { if (!raw.includes('*/')) inBlockComment = true; return }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
    const code = raw.split('//')[0]
    if (newsDepth === 0 && /state\.news\.push\(/.test(code)) newsDepth = 1
    if (newsDepth > 0) {
      newsDepth += (code.match(/\(/g) ?? []).length - (code.match(/\)/g) ?? []).length
      if (newsDepth <= 0) newsDepth = 0
      return
    }
    for (const m of code.matchAll(/(`[^`\n]{14,}`|'[^'\n]{14,}'|"[^"\n]{14,}")/g)) {
      if (OUTLETS.includes(m[1])) continue
      if (isProse(m[1])) press.push(`${file}:${i + 1}`)
    }
  })
}
say(`  ${press.length} press line(s) written as English (budget ${BUDGET.press})`)
if (press.length) say('  ' + press.slice(0, 12).join('\n  ') + (press.length > 12 ? `\n  ...and ${press.length - 12} more` : ''))
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

say('\n--- 4. and what it says back everywhere else')
// Everything in the engine that returns a sentence for a screen to show. The
// touchline files are counted above and skipped here so one line is not two
// failures; everything else in src/game is fair game, because a reply is a
// reply whichever screen asked for it.
const replies: string[] = []
for (const f of files) {
  if (f.endsWith('matchEngine.ts')) continue
  const src = readFileSync(f, 'utf8')
  // A few functions return something that LOOKS like a sentence and is not: a
  // trait's id, which traitName() turns into a key, and the English body a
  // story stores next to its own key. Both are correct as they stand and both
  // would be made wrong by "fixing" them, so they are bracketed in the source
  // with i18n-exempt-start / i18n-exempt-end and skipped here. The marker is
  // deliberately ugly and greppable: it should be hard to add without meaning
  // to, and easy to find when auditing what this probe does not see.
  const exempt: [number, number][] = []
  for (const m of src.matchAll(/i18n-exempt-start/g)) {
    const end = src.indexOf('i18n-exempt-end', m.index)
    exempt.push([m.index!, end === -1 ? src.length : end])
  }
  for (const m of src.matchAll(/\breturn\s+(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*')/g)) {
    if (exempt.some(([a, b]) => m.index! > a && m.index! < b)) continue
    if (isProse(m[1])) replies.push(`${f}:${src.slice(0, m.index).split('\n').length}`)
  }
}
const byFile = new Map<string, number>()
for (const r of replies) byFile.set(r.split(':')[0], (byFile.get(r.split(':')[0]) ?? 0) + 1)
say(`  ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'} written as English (budget ${BUDGET.replies})`)
if (byFile.size) {
  say('  ' + [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, n]) => `${n} ${f}`).join('\n  '))
}
ok(replies.length <= BUDGET.replies, `no reply beyond the budget of ${BUDGET.replies} is written as English`)
if (replies.length < BUDGET.replies) {
  ok(false, `THE REPLIES BUDGET IS STALE: ${replies.length} left but it still says ${BUDGET.replies}. Lower it`)
}

say(fails ? `\nPROSE PROBE FAILED (${fails})` : '\nPROSE PROBE PASSED: nothing reaches a reader in a language they did not choose')
process.exitCode = fails ? 1 : 0
