// Probe: the Load screen lists careers from their labels alone (1.9.1).
//
// listSaves used to getAll() the save store, structured-cloning every career
// (5 to 11 MB each) and every live match's pre-match copy to read a few bytes
// of meta from each. Each save now writes its label under slot::meta.
//
// This holds:
//   two careers list as two rows, newest first, with the right clubs
//   live-match records and the labels themselves are not listed as saves
//   a slot written before 1.9.1 (no label key) is still listed, and is given a
//     label so the next listing reads only labels
//   deleting a save removes its label too
//   listing never reads a career once every slot has a label
//
// Run: npx vite-node scripts/listsavesprobe.ts
import { newGame } from '../src/game/newgame'
import { deleteSave, listSaves, putResume, saveGame } from '../src/game/save'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const a = newGame('leicester', 'Ann', 3)
const b = newGame('northampton', 'Bea', 4)
await saveGame('slot1', a)
await new Promise(r => setTimeout(r, 5))
await saveGame('slot2', b)
await putResume('slot1', { v: 1, pre: a, cmds: [] }, true)

let rows = await listSaves()
ok(rows.length === 2, `two careers, two rows (${rows.map(r => r.slot).join(', ')})`)
ok(rows[0]?.slot === 'slot2' && rows[1]?.slot === 'slot1', 'newest first')
ok(rows[0]?.managerName === 'Bea' && rows[1]?.managerName === 'Ann', 'each row is its own career')

// ---- a slot written before 1.9.1: the career row with no label beside it ----
// The in-memory database stands in for IndexedDB in node; reach it through the
// same module by writing a row the old way.
const { _rawPutForProbe, _rawKeysForProbe, _readsForProbe } = await import('../src/game/save')
const c = newGame('bath', 'Cal', 5)
await _rawPutForProbe('slot3', { meta: { slot: 'slot3', club: 'Bath', season: c.season, week: c.week, savedAt: Date.now() + 1000, managerName: 'Cal' }, state: c })
rows = await listSaves()
ok(rows.some(r => r.slot === 'slot3' && r.managerName === 'Cal'), 'a slot with no label is still listed')
const keys = await _rawKeysForProbe()
ok(keys.includes('slot3::meta'), 'and is given a label for next time')

const before = _readsForProbe()
rows = await listSaves()
const careerReads = _readsForProbe().filter(k => !k.includes('::')).length - before.filter(k => !k.includes('::')).length
ok(careerReads === 0, `with every slot labelled, listing reads no career (${careerReads} read)`)
ok(rows.length === 3, `three rows (${rows.length})`)

await deleteSave('slot2')
const keys2 = await _rawKeysForProbe()
ok(!keys2.includes('slot2') && !keys2.includes('slot2::meta'), 'deleting a save removes its label as well')
rows = await listSaves()
ok(rows.length === 2 && !rows.some(r => r.slot === 'slot2'), 'and it is gone from the list')

console.log(fails ? `\nLIST SAVES PROBE FAILED (${fails})` : '\nLIST SAVES PROBE PASSED: the Load screen reads labels, not careers')
process.exit(fails ? 1 : 0)
