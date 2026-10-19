/**
 * ---- A SPARE COPY, AND A DAMAGED SAVE SET ASIDE (1.9.3) ----
 *
 * The first save of a session also writes the career under slot::bak. When
 * the main record cannot be read, loadGame sets it aside under slot::corrupt
 * and loads the spare instead of reporting an empty slot. Held here against
 * save.ts's in-memory store.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { _rawKeysForProbe, _rawPutForProbe, deleteSave, listSaves, loadGame, saveGame } from '../src/game/save'

describe('save backup', () => {
  it('keeps a spare copy from the first save of the session', async () => {
    const g = newGame('leicester', 'Dee', 7)
    await saveGame('bslot', g)
    expect(await _rawKeysForProbe()).toContain('bslot::bak')
  }, 60_000)

  it('loads the spare when the main record is damaged, and sets the damage aside', async () => {
    await _rawPutForProbe('bslot', { meta: { slot: 'bslot' }, state: { nonsense: true } })
    const g = await loadGame('bslot')
    expect(g?.managerName).toBe('Dee')
    const keys = await _rawKeysForProbe()
    expect(keys).toContain('bslot::corrupt')
    // neither the spare nor the set-aside record is listed as a save
    expect((await listSaves()).map(r => r.slot).filter(s => s.startsWith('bslot'))).toEqual(['bslot'])
  }, 60_000)

  it('deleting the save takes the spare and the set-aside record with it', async () => {
    await deleteSave('bslot')
    const keys = await _rawKeysForProbe()
    expect(keys.filter(k => k.startsWith('bslot'))).toEqual([])
  })
})
