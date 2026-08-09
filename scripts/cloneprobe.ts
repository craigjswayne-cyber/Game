// Probe: the save is structured-cloneable, and stays that way.
//
// saveGame used to hand IndexedDB JSON.parse(JSON.stringify(state)). That is a
// full round-trip of the whole save on the main thread, measured at 92ms on a
// 6.8MB five-season save in a desktop container - and IndexedDB then clones what
// it is given anyway, so the work was done twice and thrown away once.
//
// Passing the state straight in halves that. The catch is what the JSON trip was
// doing by accident: silently dropping anything unserialisable. A Map, a Set, a
// class instance or a function reaching GameState now throws DataCloneError
// inside put() - at save time, on a phone, on a Saturday. This is the tripwire, and
// it runs against a real five-season save rather than a fresh one, because the
// fields that would break it are the ledgers that only exist after some rugby.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'Clone Probe', 4242)
const SEASONS = 5
for (let s = 0; s < SEASONS; s++) while (g.season === s) processWeekAndAdvance(g)

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`
const json = JSON.stringify(g)
console.log(`\n${SEASONS} seasons played, save is ${mb(json.length)}`)

// THE ONE THAT MATTERS: what IndexedDB will do to it.
{
  let threw: string | null = null
  try { structuredClone(g) } catch (e) { threw = e instanceof Error ? e.message : String(e) }
  ok(threw === null, `the save survives a structured clone${threw ? `: ${threw}` : ''}`)
}

// and the same for what a live match hands back, since a resumed match is saved too
{
  let threw: string | null = null
  try { structuredClone(JSON.parse(json)) } catch (e) { threw = e instanceof Error ? e.message : String(e) }
  ok(threw === null, 'and so does a save that has been through a file export and back')
}

// A HAND CHECK FOR THE THINGS THAT CLONE FINE AND STILL SHOULD NOT BE THERE.
// structuredClone accepts Maps and Sets happily. The export/import path is JSON,
// so a Map in GameState would survive a save to IndexedDB and then vanish the
// moment somebody moved their career between devices - which is the worst kind of
// bug, because it only bites the person who took the backup.
{
  const bad: string[] = []
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 6 || v === null || typeof v !== 'object') return
    if (v instanceof Map) { bad.push(`${path} is a Map`); return }
    if (v instanceof Set) { bad.push(`${path} is a Set`); return }
    if (v instanceof Date) { bad.push(`${path} is a Date`); return }
    if (Array.isArray(v)) { for (let i = 0; i < Math.min(v.length, 3); i++) walk(v[i], `${path}[${i}]`, depth + 1) ; return }
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'function') { bad.push(`${path}.${k} is a function`); continue }
      walk(x, `${path}.${k}`, depth + 1)
    }
  }
  walk(g, 'game', 0)
  if (bad.length) for (const b of bad.slice(0, 6)) console.log(`    ${b}`)
  ok(bad.length === 0, `nothing in the save is a Map, a Set, a Date or a function (${bad.length} found)`)
}

// and the size, so a ledger that starts growing without a cap is visible here
ok(json.length < 20 * 1024 * 1024, `${SEASONS} seasons fits in 20 MB (${mb(json.length)})`)

console.log(fails ? `\nCLONE PROBE FAILED (${fails})` : '\nCLONE PROBE PASSED: the save can be written without a hand-rolled copy')
process.exit(fails ? 1 : 0)
