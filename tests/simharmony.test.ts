// HARMONY, THE QUICK VERSION (2.0.0, overseer).
//
// Owner: "commentary, graphics and animation are all doing different things,
// they need to be in harmony." The full check is scripts/harmonycheck.ts
// (300 seeds, 20 real fixtures, commentary and pitch). This runs the rules
// that need only the match record, on 40 seeds, one test per rule, so a
// failure names the rule, the seed and the play. The checklist the rules
// come from is docs/acceptance-2.0.0.md.
//
// Rates (penalties a match, kicks out on the full, ball in play) are left to
// the script: 40 matches are too few to hold an average to a tight band.
import { describe, expect, it } from 'vitest'
import { RULES, checkDecision, checkRecord, skeletonMatches, type Fail } from '../scripts/harmonycheck'

const matches = skeletonMatches(Array.from({ length: 40 }, (_, i) => 7001 + i))
const fails = new Map<string, { seed: number; f: Fail }[]>()
for (const m of matches) for (const f of checkRecord(m)) {
  if (!fails.has(f.rule)) fails.set(f.rule, [])
  fails.get(f.rule)!.push({ seed: m.seed, f })
}

describe('the match record keeps the rules the owner set', () => {
  for (const r of RULES.filter(x => x.kind === 'match' && x.id.startsWith('R'))) {
    it(`${r.id}: ${r.title}`, () => {
      const list = fails.get(r.id) ?? []
      const first = list[0]
      expect(list.length, first ? `${list.length} failures; first seed ${first.seed} play ${first.f.n}: ${first.f.msg}` : '').toBe(0)
    })
  }

  it('R35-decision: a change from minute 40 leaves the first half the same', () => {
    const row = checkDecision(Array.from({ length: 10 }, (_, i) => 7101 + i))
    expect(row.msg.startsWith('0 matches changed'), row.msg).toBe(true)
  })
})
