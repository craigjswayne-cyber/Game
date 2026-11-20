/**
 * ---- THE REAL SQUADS ARE IN THE WORLD (1.9.16) ----
 *
 * data/intl2026.ts names each union's real autumn 2026 squad and the caps each
 * man took into it. A name the world cannot find does nothing at all: no
 * caps, no squad place, no warning. So this reads the table against a fresh
 * world and says who is missing, which is also the work list for the player
 * audit (a missing international is a missing player, a wrong nationality or
 * a wrong spelling).
 *
 * Fails when a nation's named squad is less than three-quarters found, or
 * when a found man does not carry the caps the table gave him.
 *
 * Run: npx vite-node scripts/intlaudit.ts
 */
import { newGame } from '../src/game/newgame'
import { INTL_2026 } from '../src/data/intl2026'
import { federationPick } from '../src/game/nations'
import { ok, done } from './lib/probe'

const plain = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

for (const gender of ['m', 'w'] as const) {
  const table = INTL_2026[gender]
  if (!Object.keys(table).length) continue
  const g = gender === 'm' ? newGame('leicester', 'Audit', 2026) : newGame('w:saracens', 'Audit', 2026, undefined, 'coach', 'w')
  for (const [nat, rows] of Object.entries(table)) {
    const mine = Object.values(g.players).filter(p => p.nat === nat)
    const find = (name: string) => mine.filter(p => plain(p.name) === plain(name)).sort((a, b) => b.ca - a.ca)[0]
    const squad = rows.filter(r => r.squad !== false)
    const missing = rows.filter(r => !find(r.name))
    const elsewhere = missing.map(r => {
      const any = Object.values(g.players).find(p => plain(p.name) === plain(r.name))
      return any ? `${r.name} (in the world as ${any.nat})` : r.name
    })
    const foundSquad = squad.filter(r => find(r.name)).length
    console.log(`\n--- ${gender === 'm' ? "men's" : "women's"} ${nat}: ${foundSquad}/${squad.length} of the named squad found, ${rows.filter(r => r.caps == null).length} caps unchecked`)
    if (elsewhere.length) console.log(`  missing: ${elsewhere.join(', ')}`)
    ok(foundSquad >= Math.ceil(squad.length * 0.75), `${nat}: at least three-quarters of the named squad are in the world (${foundSquad}/${squad.length})`)
    const wrong = rows.filter(r => r.caps != null && find(r.name) && find(r.name)!.caps !== r.caps)
    ok(wrong.length === 0, `${nat}: every found man carries his real caps${wrong.length ? ` (not: ${wrong.map(r => r.name).join(', ')})` : ''}`)
    // the federation's first squad is the real one, as far as the world has it
    const pick = federationPick(g, nat, 32)
    const real = pick.filter(p => p.sq26).length
    const avail = mine.filter(p => p.sq26 && p.clubId && !p.injury && !p.onLoan).length
    ok(real >= Math.min(avail, 32) - 3, `${nat}: the opening squad is built from the real one (${real} of 32 picked, ${avail} available)`)
  }
}
done('INTL AUDIT', 'the real squads and caps are in the world')
