/**
 * ---- THE LOAD SCREEN READS LABELS, NOT CAREERS (1.9.2; was
 * scripts/listsavesprobe.ts) ----
 *
 * listSaves used to read every career (5 to 11 MB each) to show a few bytes
 * of meta. Each save now writes its label under slot::meta, and the list
 * reads only those. Held here against save.ts's in-memory store:
 *
 *   two careers are two rows, newest first, each its own career
 *   live-match records and the labels themselves are not listed as saves
 *   a slot written before 1.9.1 (no label) is still listed, and labelled
 *   with every slot labelled, listing reads no career at all
 *   deleting a save takes its label with it
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { _rawKeysForProbe, _rawPutForProbe, _readsForProbe, deleteSave, listSaves, putResume, saveGame } from '../src/game/save'

beforeAll(async () => {
  const a = newGame('leicester', 'Ann', 3)
  const b = newGame('northampton', 'Bea', 4)
  await saveGame('slot1', a)
  await new Promise(r => setTimeout(r, 5))
  await saveGame('slot2', b)
  await putResume('slot1', { v: 1, pre: a, cmds: [] }, true)
}, 60_000)

describe('listSaves', () => {
  it('lists two careers as two rows, newest first, each its own', async () => {
    const rows = await listSaves()
    expect(rows.map(r => r.slot)).toEqual(['slot2', 'slot1'])
    expect(rows.map(r => r.managerName)).toEqual(['Bea', 'Ann'])
  })

  it('lists a slot written before labels, and labels it', async () => {
    const c = newGame('bath', 'Cal', 5)
    await _rawPutForProbe('slot3', { meta: { slot: 'slot3', club: 'Bath', season: c.season, week: c.week, savedAt: Date.now() + 1000, managerName: 'Cal' }, state: c })
    const rows = await listSaves()
    expect(rows.some(r => r.slot === 'slot3' && r.managerName === 'Cal')).toBe(true)
    expect(await _rawKeysForProbe()).toContain('slot3::meta')
  })

  it('reads no career once every slot has a label', async () => {
    const careers = () => _readsForProbe().filter(k => !k.includes('::')).length
    const before = careers()
    const rows = await listSaves()
    expect(careers() - before).toBe(0)
    expect(rows).toHaveLength(3)
  })

  it('deletes the label with the save', async () => {
    await deleteSave('slot2')
    const keys = await _rawKeysForProbe()
    expect(keys).not.toContain('slot2')
    expect(keys).not.toContain('slot2::meta')
    const rows = await listSaves()
    expect(rows.map(r => r.slot)).not.toContain('slot2')
    expect(rows).toHaveLength(2)
  })
})
