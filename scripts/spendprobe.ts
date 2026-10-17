// Probe: a banked credit is spent on its effect in the order that cannot give
// it twice or lose it (1.9.1, ui/purchase.spendCredit).
//
// Every door (Full Fitness, the cash injections, the second ground, the tip
// jar) used to grant first and call creditTake after without reading its
// answer. creditTake refuses when the ledger cannot be written, so a full
// phone got the effect and kept the credit. The grant was also left to the
// save queue's idle timer, so a phone that killed the app straight after a
// purchase had spent the credit on an effect that never reached the disk.
//
// This holds:
//   a ledger that will not write: no grant, credit still there, says 'storage'
//   a grant the career refuses: credit given back, says 'refused'
//   a grant that throws: credit given back, and the throw still surfaces
//   a grant that lands: one credit gone, and the career is on disk before the
//     call returns
//
// Run: npx vite-node scripts/spendprobe.ts
const mem = new Map<string, string>()
let readOnly = false
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { if (readOnly) throw new Error('QuotaExceededError'); mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
} as Storage

const M = await import('../src/game/monetise')
const { spendCredit } = await import('../src/ui/purchase')
const { useStore } = await import('../src/store')
const { newGame } = await import('../src/game/newgame')
const { loadGame, saveGame } = await import('../src/game/save')

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const SKU = M.HEAL_SKU

const g = newGame('leicester', 'Spender', 5)
await saveGame('slot1', g)
useStore.getState().setGame((await loadGame('slot1'))!, 'slot1')
await new Promise(r => setTimeout(r, 200))

// ---- a ledger that will not write ----
M.creditAdd(SKU, 1)
readOnly = true
let granted = 0
const r1 = await spendCredit(SKU, () => { granted++; return true })
readOnly = false
ok(r1 === 'storage', `a ledger that will not write says so (${r1})`)
ok(granted === 0, 'and nothing is granted')
ok(M.creditCount(SKU) === 1, `and the credit is still banked (${M.creditCount(SKU)})`)

// ---- nothing banked at all ----
{
  let ran = 0
  const r0 = await spendCredit('phase.nothing', () => { ran++; return true })
  ok(r0 === 'none' && ran === 0, `no credit says so, not storage, and grants nothing (${r0})`)
}

// ---- a grant the career refuses ----
const r2 = await spendCredit(SKU, () => false)
ok(r2 === 'refused' && M.creditCount(SKU) === 1, `a refused grant gives the credit back (${r2}, ${M.creditCount(SKU)})`)

// ---- a grant that throws ----
let threw = false
try { await spendCredit(SKU, () => { throw new Error('boom') }) } catch { threw = true }
ok(threw && M.creditCount(SKU) === 1, `a grant that throws surfaces and gives the credit back (${M.creditCount(SKU)})`)

// ---- a grant that lands, on disk before the answer ----
const r4 = await spendCredit(SKU, () => {
  const live = useStore.getState().game!
  live.managerName = 'Spent'
  useStore.getState().touch()
  return true
})
ok(r4 === 'done' && M.creditCount(SKU) === 0, `a landed grant spends exactly one credit (${r4}, ${M.creditCount(SKU)} left)`)
const disk = await loadGame('slot1')
ok(disk?.managerName === 'Spent', `and the career is on disk when the call returns (${disk?.managerName})`)

console.log(fails ? `\nSPEND PROBE FAILED (${fails})` : '\nSPEND PROBE PASSED: one credit, one effect, on disk')
process.exit(fails ? 1 : 0)
