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
import { derbyName } from '../src/game/rivalries'
import { NAMES as SPONSORS } from '../src/game/commercial'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import { newsBody, newsSubject, eventText, decisionText, pressQuestion, pressLabel, pressAnswer, pressReaction, type GameState } from '../src/game/model'
import { ensureLang, setLang } from '../src/game/i18n'
import EN from '../src/locales/en.json'
import FR from '../src/locales/fr.json'

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// WHAT COUNTS AS ENGLISH.
//
// This was a hand-written list of forty function words, and it passed clean
// while five English phrases were reaching French screens - "a new
// nutritionist", "one season", "free agency", "a club abroad", "the chief
// scout". None of them contains "the" or "with", so none of them was seen.
//
// The list is derived now, which is what the header above always claimed: every
// word that appears somewhere in the English dictionary and NOWHERE in the
// French one. A word that is French keeps itself out by being used in a French
// sentence, so "match", "club", "staff", "note" and "week-end" need no special
// case; a word that is only ever English has nothing to hide behind. Proper
// nouns are stripped from the line before the test, because a club is called
// the same thing in both languages.
const words = (v: unknown, out: Set<string>): Set<string> => {
  if (typeof v === 'string') {
    for (const w of v.split(/[^A-Za-z]+/)) if (w.length >= 4) out.add(w.toLowerCase())
  } else if (v && typeof v === 'object') {
    for (const x of Object.values(v as Record<string, unknown>)) words(x, out)
  }
  return out
}
const FR_WORDS = words(FR, new Set<string>())
const ENGLISH_ONLY = new Set([...words(EN, new Set<string>())].filter(w => !FR_WORDS.has(w)))

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
  // THE PRESS ROOM, which this probe did not read until the whole of it was
  // found to be English. Every question, every button, every reply the room
  // gives back - it is one of the few screens a manager touches every week.
  for (const pr of g.press ?? []) {
    out.push({ where: `press.q ${pr.qk ?? '(no key)'}`, text: pressQuestion(pr) })
    for (const o of pr.options) out.push({ where: `press.opt ${o.lk ?? '(no key)'}`, text: pressLabel(o) })
    if (pr.answered) {
      out.push({ where: `press.answer ${pr.alk ?? '(no key)'}`, text: pressAnswer(pr) })
      out.push({ where: `press.reaction ${pr.rk ?? '(no key)'}`, text: pressReaction(pr) })
    }
  }
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
  // a derby's name is data too: "The East Midlands Derby" is what that fixture
  // is called in any language, the way a stadium is
  const ids = Object.keys(g.clubs)
  for (const a of ids) for (const b of ids) if (a < b) add(derbyName(a, b))
  for (const p of Object.values(g.players)) add(p.name)
  for (const c of Object.values(g.comps)) { add(c.name); add(c.short) }
  for (const f of g.fixtures) { add(f.venue?.name); add(f.venue?.city) }
  add(g.managerName)
  // a sponsor is a name like a club is a name, and it lives in a pool rather
  // than on the state - "Norlander Logistics" is not the game speaking English
  for (const pool of Object.values(SPONSORS)) for (const n of pool) add(n)
  return out
}

await ensureLang('fr')
setLang('fr')
const lines: Line[] = []
const NOUNS = new Set<string>()
// Ten careers across every tier and every country, eight seasons each. The
// rare stories are the whole point of the length: a testimonial, an unbeaten
// run, a takeover, administration, a coach sacked, a challenge finished, a
// squad rift, an injury crisis in one unit. Widening from three careers of
// three seasons to six of five found three more leaks on its own, so the
// number is not decoration.
const CLUBS = [
  'northampton', 'ealing', 'bath', 'toulouse', 'cinderford', 'newcastle',
  'leinster', 'perpignan', 'coventry', 'glasgow',
]
// PROBE_QUICK (v1.2.2): on a push the Gate plays four careers for four
// seasons instead of ten for eight - the same reader over a quarter of the
// prose, which still catches a broken key on the first page it appears on.
// The full sweep runs in the release deep test.
const QUICK = !!process.env.PROBE_QUICK
const CLUBS_RUN = QUICK ? CLUBS.slice(0, 4) : CLUBS
const SEASONS_RUN = QUICK ? 4 : 8
for (let i = 0; i < CLUBS_RUN.length; i++) {
  const g = newGame(CLUBS_RUN[i], 'Sondeur', 700 + i * 13)
  let answers = 0
  for (let w = 0; w < 44 * SEASONS_RUN; w++) {
    processWeekAndAdvance(g)
    // ANSWER THE PRESS. A career that never opens the press room leaves every
    // reaction and every answer label unrendered, which is exactly the half of
    // it that stayed English longest. Rotate the button so all of them fire.
    for (const pr of g.press) if (!pr.answered) answerPress(g, pr.id, answers++ % pr.options.length)
    // every season, not just at the end: a man who retires in season three is
    // gone from g.players by season eight, and his surname is still sitting in
    // the story that announced he had left
    if (w % 44 === 0) for (const n of properNouns(g)) NOUNS.add(n)
  }
  lines.push(...collect(g))
  for (const n of properNouns(g)) NOUNS.add(n)
}
say(`--- ${lines.length} lines rendered from ${CLUBS.length} French careers, eight seasons each`)

// ---- 1. nothing is English ------------------------------------------------
say(`\n--- 1. nothing the game says is English`)
const hits = new Map<string, Line>()
for (const l of lines) {
  // proper nouns out first: a club, a stadium, a player and a nation are the
  // same word in every language, and "week-end" is French whatever \bweek\b
  // thinks about it.
  for (const w of l.text.split(/[^A-Za-zÀ-ÿ]+/)) {
    const lw = w.toLowerCase()
    if (lw.length < 4 || NOUNS.has(lw) || !ENGLISH_ONLY.has(lw)) continue
    hits.set(`${lw}|${l.where}`, l)
    break
  }
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
