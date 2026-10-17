/**
 * ---- ONE CREDIT, ONE EFFECT, ON DISK (1.9.2; was the core of
 * scripts/spendprobe.ts) ----
 *
 * ui/purchase.spendCredit takes a banked credit, grants its effect and writes
 * the career before it answers. Every door used to grant first and take the
 * credit after without reading the answer, so a phone whose ledger would not
 * write got the effect and kept the credit. What holds:
 *
 *   a ledger that will not write: nothing granted, the credit kept ('storage')
 *   nothing banked: 'none', and nothing granted
 *   a grant the career refuses, or one that throws: the credit given back
 *   mid-match: 'storage', nothing taken (the career is not written until FT)
 *   a career write that fails: the credit given back and the career reopened
 *     from disk, so the effect and the credit are never both kept or both lost
 *   a grant that lands: one credit gone, and the career on disk at the answer
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../src/game/save', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/game/save')>()
  return { ...real, saveGame: vi.fn(real.saveGame) }
})

// the ledger lives in localStorage: a fake one that can be made to refuse
const mem = new Map<string, string>()
let readOnly = false
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { if (readOnly) throw new Error('QuotaExceededError'); mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
})

const M = await import('../src/game/monetise')
const { spendCredit } = await import('../src/ui/purchase')
const { useStore } = await import('../src/store')
const { newGame } = await import('../src/game/newgame')
const { loadGame, saveGame } = await import('../src/game/save')

const SKU = M.HEAL_SKU
const SLOT = 'slot1'

beforeAll(async () => {
  await saveGame(SLOT, newGame('leicester', 'Spender', 5))
  useStore.getState().setGame((await loadGame(SLOT))!, SLOT)
  await useStore.getState().persistNow()
}, 60_000)

describe('spendCredit', () => {
  it('a ledger that will not write grants nothing and keeps the credit', async () => {
    M.creditAdd(SKU, 1)
    readOnly = true
    let granted = 0
    const r = await spendCredit(SKU, () => { granted++; return true }).finally(() => { readOnly = false })
    expect(r).toBe('storage')
    expect(granted).toBe(0)
    expect(M.creditCount(SKU)).toBe(1)
  })

  it('nothing banked says none, not storage, and grants nothing', async () => {
    let ran = 0
    expect(await spendCredit('phase.nothing', () => { ran++; return true })).toBe('none')
    expect(ran).toBe(0)
  })

  it('a refused grant gives the credit back', async () => {
    expect(await spendCredit(SKU, () => false)).toBe('refused')
    expect(M.creditCount(SKU)).toBe(1)
  })

  it('a grant that throws surfaces the throw and gives the credit back', async () => {
    await expect(spendCredit(SKU, () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(M.creditCount(SKU)).toBe(1)
  })

  it('mid-match nothing is spent', async () => {
    useStore.setState({ liveMatch: {} as never })
    let ran = 0
    const r = await spendCredit(SKU, () => { ran++; return true }).finally(() => useStore.setState({ liveMatch: null }))
    expect(r).toBe('storage')
    expect(ran).toBe(0)
    expect(M.creditCount(SKU)).toBe(1)
  })

  it('a career write that fails gives the credit back and reopens the career from disk', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(saveGame).mockRejectedValueOnce(new Error('QuotaExceededError'))
    const r = await spendCredit(SKU, () => {
      useStore.getState().game!.managerName = 'Never saved'
      useStore.getState().touch()
      return true
    })
    spy.mockRestore()
    expect(r).toBe('storage')
    expect(M.creditCount(SKU)).toBe(1)
    expect(useStore.getState().game!.managerName).toBe('Spender')
    expect((await loadGame(SLOT))?.managerName).toBe('Spender')
  })

  it('a grant that lands spends exactly one credit, and the career is on disk at the answer', async () => {
    const r = await spendCredit(SKU, () => {
      useStore.getState().game!.managerName = 'Spent'
      useStore.getState().touch()
      return true
    })
    expect(r).toBe('done')
    expect(M.creditCount(SKU)).toBe(0)
    expect((await loadGame(SLOT))?.managerName).toBe('Spent')
  })
})
