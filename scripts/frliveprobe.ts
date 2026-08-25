// Probe: play a French career and read everything it says.
//
// Every other language probe reads the DICTIONARY - does the key exist, do the
// holes match, is the French there. None of them reads what the game actually
// produces, and the gap between those two is where the real failures live: a
// story whose key is right and whose fragment names a key that is not, a
// plural entry called without the number it pluralises on, a hole nobody
// fills. All three render as something a player can see, and all three pass a
// dictionary check.
//
// So this plays several careers in French, several seasons each, and renders
// EVERY line the engine files - every story, every commentary event, every
// decision - the way a screen would. Then it reads them.
//
//   1. NOTHING IS ENGLISH. Words that appear in the English dictionary and in
//      no French sentence.
//   2. NOTHING HAS A HOLE IN IT. A surviving {placeholder} is a variable the
//      caller forgot; it reaches the screen as literal braces.
//   3. NOTHING IS A KEY. t() returns the key's own name when it cannot find
//      it, so "news.transferDone" on screen is the loudest failure there is.
//   4. NOTHING IS EMPTY. A story with a blank subject is a blank row in the
//      inbox.
//
// Run: npx vite-node scripts/frliveprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { newsBody, newsSubject, eventText, decisionText, type GameState } from '../src/game/model'
import { setLang } from '../src/game/i18n'

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// Words that are English and are not also French. Deliberately short and
// deliberately common: a longer list finds false positives in proper nouns and
// stops being read.
// Words that are English and are NOT also French. The first version of this
// list had "match", "staff", "coach", "note" and "score" in it, all of which
// are ordinary French - as are "club" and "but" - and it reported 290 lines - a probe with that many
// false positives is one nobody reads twice. Everything here is a word that
// cannot appear in a correct French sentence.
const ENGLISH = /\b(the|and|with|your|yours|their|theirs|his|hers|from|that|this|these|those|which|when|what|where|there|here|have|has|had|been|was|were|will|would|should|could|shall|might|are|isn|aren|you|they|them|him|its|into|onto|over|under|after|before|about|because|while|until|than|then|only|very|just|also|still|never|always|every|another|through|against|between|during|without|within|upon|says|said|goes|went|came|took|made|gets|got|puts|keeps|looks|feels|seems|wants|needs|week|weeks|season|seasons|player|players|team|teams|board|money|wages|squad|next|last|first|good|better|best|worse|worst|home|away|down|back|again|enough|already|nothing|something|anything|everyone|nobody|somebody)\b/i

type Line = { where: string; text: string }

const collect = (g: GameState): Line[] => {
  const out: Line[] = []
  for (const n of g.news) {
    out.push({ where: `news.subject ${n.k ?? '(no key)'}`, text: newsSubject(n) })
    out.push({ where: `news.body ${n.k ?? '(no key)'}`, text: newsBody(n) })
  }
  for (const f of g.fixtures) {
    for (const e of f.events ?? []) out.push({ where: `comm ${e.k ?? '(no key)'}`, text: eventText(e) })
  }
  for (const d of g.decisions ?? []) out.push({ where: `decision ${d.k ?? '(no key)'}`, text: decisionText(d) })
  return out
}

/** Every proper noun the world contains, so the English test does not trip over
 *  "Northampton 26 - 27 Gloucester" or a first cap won with England. A name is
 *  data: it is the same word in both dictionaries and always will be. */
const properNouns = (g: GameState): Set<string> => {
  const out = new Set<string>()
  const add = (v?: string | null) => {
    if (!v) return
    for (const w of v.split(/[^A-Za-zÀ-ÿ'-]+/)) if (w.length > 2) out.add(w.toLowerCase())
  }
  for (const c of Object.values(g.clubs)) { add(c.name); add(c.short); add(c.stadium); add(c.city); add(c.coach) }
  for (const p of Object.values(g.players)) add(p.name)
  for (const c of Object.values(g.comps)) { add(c.name); add(c.short) }
  for (const f of g.fixtures) { add(f.venue?.name); add(f.venue?.city) }
  add(g.managerName)
  return out
}

setLang('fr')
const lines: Line[] = []
const NOUNS = new Set<string>()
// Six careers across three tiers and both countries, five seasons each. The
// rarer stories are the point: a testimonial, an unbeaten run, a takeover, a
// club going into administration, a coach sacked, a challenge finished. Three
// careers of three seasons found five English leaks; the ones that are left
// are the ones that need a longer run to appear at all.
const CLUBS = ['northampton', 'ealing', 'bath', 'toulouse', 'cinderford', 'newcastle']
for (let i = 0; i < CLUBS.length; i++) {
  const g = newGame(CLUBS[i], 'Sondeur', 700 + i * 13)
  for (let w = 0; w < 44 * 5; w++) processWeekAndAdvance(g)
  lines.push(...collect(g))
  for (const n of properNouns(g)) NOUNS.add(n)
}
say(`--- ${lines.length} lines rendered from ${CLUBS.length} French careers, five seasons each`)

// ---- 1. nothing is English ------------------------------------------------
say(`\n--- 1. nothing the game says is English`)
const hits = new Map<string, Line>()
for (const l of lines) {
  // proper nouns out first: a club, a stadium, a player and a nation are the
  // same word in every language, and "week-end" is French whatever \bweek\b
  // thinks about it.
  const stripped = l.text.replace(/week-end/gi, '')
    .split(/[^A-Za-zÀ-ÿ'-]+/).filter(w => !NOUNS.has(w.toLowerCase())).join(' ')
  const m = ENGLISH.exec(stripped)
  if (m) hits.set(`${m[0].toLowerCase()}|${l.where}`, l)
}
const byWord = new Map<string, number>()
for (const k of hits.keys()) {
  const w = k.split('|')[0]
  byWord.set(w, (byWord.get(w) ?? 0) + 1)
}
say(`  ${hits.size} line(s) contain an English word`)
for (const [w, n] of [...byWord].sort((a, b) => b[1] - a[1]).slice(0, 12)) say(`    "${w}" x${n}`)
for (const [k, l] of [...hits].slice(0, 10)) say(`  [${k.split('|')[0]}] ${l.where}\n    ${l.text.slice(0, 160)}`)
ok(hits.size === 0, 'every line a French career produces is in French')

// ---- 2. nothing has a hole in it -----------------------------------------
say('\n--- 2. no line reaches the screen with an unfilled hole')
const holes = lines.filter(l => /\{[a-zA-Z_]\w*\}/.test(l.text))
for (const l of holes.slice(0, 10)) say(`  ${l.where}\n    ${l.text.slice(0, 150)}`)
ok(holes.length === 0, `no line has a {placeholder} left in it${holes.length ? ` - ${holes.length}` : ''}`)

// ---- 3. nothing is a key --------------------------------------------------
say('\n--- 3. no line is a key that failed to resolve')
const raw = lines.filter(l => /^[a-z][\w]*(\.[\w]+)+$/.test(l.text.trim()))
for (const l of raw.slice(0, 10)) say(`  ${l.where} -> ${l.text}`)
ok(raw.length === 0, `no line rendered as its own key name${raw.length ? ` - ${raw.length}` : ''}`)

// ---- 4. nothing is blank --------------------------------------------------
say('\n--- 4. no line is blank')
const blank = lines.filter(l => l.text.trim() === '')
for (const l of blank.slice(0, 10)) say(`  ${l.where}`)
ok(blank.length === 0, `no line rendered as nothing${blank.length ? ` - ${blank.length}` : ''}`)

say(fails ? `\nFR LIVE PROBE FAILED (${fails})` : `\nFR LIVE PROBE PASSED: ${lines.length} lines, all of them French, filled, resolved and non-empty`)
process.exitCode = fails ? 1 : 0
