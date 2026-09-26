/**
 * ---- 1.7.1's NEW DOORS, KICKED ----
 *
 * Release audit, pass 6 (hostile input and old saves) on the code 1.7.1 adds:
 * the medical joker, playing through a knock, and the home-crowd lean. The bar
 * is the audit's: a refusal is fine, a throw is not, and no NaN may reach a
 * figure that is shown or multiplied.
 *
 * What it found: a knock whose return week was lost (NaN, as a damaged save
 * can leave it) never cleared - the man carried it for ever and the treatment
 * room would have printed "Fit in NaN wk" - and homeCrowdLean answered NaN to
 * a NaN gate. Both fixed; both held here.
 *
 * Run: npx vite-node scripts/hostile171.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch, homeCrowdLean, beginMatch } from '../src/game/matchEngine'
import { signMedicalJoker, settleJokers } from '../src/game/joker'
import { flareChance, playThrough, restKnock, settleKnocks } from '../src/game/knock'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const safe = <T>(f: () => T): T | 'THREW' => { try { return f() } catch { return 'THREW' } }

const g = newGame('bath', 'Hostile', 5)
const me = g.clubs[g.userClubId]
const [a, b] = me.players.map(id => g.players[id])

console.log('--- 1. garbage ids are refused, never thrown on')
for (const bad of [NaN, Infinity, -1, 1e12, undefined as unknown as number]) {
  const r = [safe(() => signMedicalJoker(g, bad, bad)), safe(() => playThrough(g, bad)), safe(() => restKnock(g, bad))]
  ok(r.every(x => x !== 'THREW' && (x as { ok: boolean }).ok === false), `id ${bad}: joker, knock and rest all refuse`)
}

console.log('--- 2. a knock or a joker a damaged save left behind')
a.knock = { dk: '', desc: '', until: NaN, weeks: NaN, early: NaN, mins: NaN }
ok(safe(() => settleKnocks(g)) !== 'THREW', 'settling a NaN knock does not throw')
ok(a.knock === undefined, 'and a knock with no return week is cleared, not carried for ever')
ok(Number.isFinite(flareChance(NaN)), `flareChance never answers NaN (${flareChance(NaN)})`)
b.joker = 99999999
ok(safe(() => settleJokers(g)) !== 'THREW' && b.joker == null, 'a joker covering nobody is let go')

console.log('--- 3. the home crowd with a gate that is not a number')
const fx = g.fixtures.find(f => f.homeId === me.id)!
for (const att of [NaN, Infinity, -5]) {
  const lean = homeCrowdLean(g, { ...fx, att })
  ok(Number.isFinite(lean) && lean >= 0 && lean <= 0.07, `gate ${att}: the lean is a number in range (${lean})`)
  const c = beginMatch(g, { ...fx, id: 880000 + String(att).length, att }, mulberry32(3), false)
  ok([c.home.penRisk, c.away.penRisk].every(Number.isFinite), `and the match's penalty rates are finite`)
}

console.log('--- 4. and a season on')
const ran = safe(() => { for (let i = 0; i < 12; i++) { const f = userFixtureThisWeek(g); if (f) simMatch(g, f, weekRng(g), false); processWeekAndAdvance(g) } })
ok(ran !== 'THREW', 'twelve weeks play on after all of it')

console.log(fails ? `\nHOSTILE 1.7.1 FAILED (${fails})` : '\nHOSTILE 1.7.1 PASSED: every new door refuses garbage, and nothing new leaks a NaN')
process.exit(fails ? 1 : 0)
