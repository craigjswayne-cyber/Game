// ---- KICKING STYLE AND THE BREAKDOWN (1.7.3) ----
//
// Owner, 26 Sep 2026: "kick strategy, breakdown commitments" - four kicking
// styles, and two breakdown dials, attack and defence separately. The design
// rests on the rules every tactic in this engine keeps:
//
//   ABSENT IS FREE. No style, 'balanced', or a dial at 50 must play the old
//   game bit for bit, or every save changes under the player's feet.
//   EVERY CHOICE IS A TRADE, priced in the engine's own currencies, and each
//   one pays in the conditions it is built for: contest in the wet, attack
//   behind a rushing line, territory with the better lineout.
//   NOTHING IS A META. Over a pile of full matches no style and no extreme of
//   either dial moves the mean margin by more than a few points: if one did,
//   every save would end up there.
//
// Run: npx vite-node scripts/kickbreakprobe.ts
import { newGame } from '../src/game/newgame'
import { weekRng } from '../src/game/season'
import { beginMatch, simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState, Tactic } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const userFixture = (g: GameState) =>
  g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!
const mine = (g: GameState, ctx: ReturnType<typeof beginMatch>) => (ctx.home.teamId === g.userClubId ? ctx.home : ctx.away)
const theirs = (g: GameState, ctx: ReturnType<typeof beginMatch>) => (ctx.home.teamId === g.userClubId ? ctx.away : ctx.home)

console.log('--- absent is free')
for (const seed of [7, 31]) {
  const a = newGame('northampton', 'KB', seed), b = newGame('northampton', 'KB', seed)
  for (const c of Object.values(a.clubs)) { delete c.tactic.kickStyle; delete c.tactic.ruckCommit; delete c.tactic.ruckContest }
  for (const c of Object.values(b.clubs)) { c.tactic.kickStyle = 'balanced'; c.tactic.ruckCommit = 50; c.tactic.ruckContest = 50 }
  const fa = userFixture(a), fb = userFixture(b)
  const ra = simMatch(a, fa, weekRng(a), false), rb = simMatch(b, fb, weekRng(b), false)
  ok(fa.homeScore === fb.homeScore && fa.awayScore === fb.awayScore && ra.events.length === rb.events.length,
    `seed ${seed}: no style and no dials is the same game as balanced and 50 (${fa.homeScore}-${fa.awayScore})`)
}

/** Build the user's side for a fixture with his tactic set as asked, and the
 *  opponent's too, on a chosen day. Returns the two sides at kick-off. */
function kickoff(set: Partial<Tactic>, opp: Partial<Tactic> = {}, weather?: 'Rain' | 'Fine', seed = 7) {
  const g = newGame('northampton', 'KB', seed)
  const fx = userFixture(g)
  const oppId = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
  const neutral = { kickStyle: undefined, ruckCommit: undefined, ruckContest: undefined }
  Object.assign(g.clubs[g.userClubId].tactic, neutral, set)
  Object.assign(g.clubs[oppId].tactic, neutral, opp)
  // the day is drawn from the match rng; pick a rng that draws the one asked for
  let ctx = beginMatch(g, fx, mulberry32(1), false)
  for (let s = 2; weather && s < 400 && (weather === 'Rain' ? ctx.weather !== 'Rain' : ctx.weather === 'Rain' || ctx.weather === 'Snow'); s++) {
    ctx = beginMatch(g, fx, mulberry32(s), false)
  }
  return { g, ctx, me: mine(g, ctx), them: theirs(g, ctx) }
}

console.log('--- the kicking styles, priced')
{
  const base = kickoff({ kicking: 70 }, {}, 'Fine')
  const terr = kickoff({ kicking: 70, kickStyle: 'territory' }, {}, 'Fine')
  ok(terr.me.units.kicking > base.me.units.kicking, `territory: every kick gains more ground (${base.me.units.kicking.toFixed(3)} -> ${terr.me.units.kicking.toFixed(3)})`)

  const dry = { b: kickoff({ kicking: 70 }, {}, 'Fine'), c: kickoff({ kicking: 70, kickStyle: 'contest' }, {}, 'Fine') }
  const wet = { b: kickoff({ kicking: 70 }, {}, 'Rain'), c: kickoff({ kicking: 70, kickStyle: 'contest' }, {}, 'Rain') }
  const dryGain = dry.c.me.units.attack / dry.b.me.units.attack, wetGain = wet.c.me.units.attack / wet.b.me.units.attack
  ok(wetGain > 1 && dryGain < 1, `contest: an attacking platform in the wet (x${wetGain.toFixed(3)}), a gift in the dry (x${dryGain.toFixed(3)})`)
  ok(dry.c.me.units.breakdown > dry.b.me.units.breakdown, 'and the chase is a breakdown battle either way')

  const passive = { b: kickoff({ kicking: 70 }, { defLine: 20 }, 'Fine'), a: kickoff({ kicking: 70, kickStyle: 'attack' }, { defLine: 20 }, 'Fine') }
  const blitz = { b: kickoff({ kicking: 70 }, { defLine: 90 }, 'Fine'), a: kickoff({ kicking: 70, kickStyle: 'attack' }, { defLine: 90 }, 'Fine') }
  const vsPassive = passive.a.me.units.attack / passive.b.me.units.attack, vsBlitz = blitz.a.me.units.attack / blitz.b.me.units.attack
  ok(vsBlitz > vsPassive && vsPassive > 1, `attack: deadlier behind a rushing line (x${vsBlitz.toFixed(3)}) than a patient one (x${vsPassive.toFixed(3)})`)
  ok(passive.a.me.units.kicking < passive.b.me.units.kicking, 'and it gives up territory')
  const wetAttack = kickoff({ kicking: 70, kickStyle: 'attack' }, { defLine: 20 }, 'Rain'), wetBase = kickoff({ kicking: 70 }, { defLine: 20 }, 'Rain')
  ok(wetAttack.me.units.attack / wetBase.me.units.attack < vsPassive, 'and a wet ball does not bounce where you want it')

  const quiet = kickoff({ kicking: 10, kickStyle: 'territory' }, {}, 'Fine'), quietBase = kickoff({ kicking: 10 }, {}, 'Fine')
  const loud = terr.me.units.kicking / base.me.units.kicking, soft = quiet.me.units.kicking / quietBase.me.units.kicking
  ok(soft < loud, `a side that barely kicks barely cares what kind (x${soft.toFixed(3)} at kicking 10, x${loud.toFixed(3)} at 70)`)
}

console.log('--- the breakdown, priced')
{
  const b = kickoff({}, {}, 'Fine')
  const many = kickoff({ ruckCommit: 100 }, {}, 'Fine'), few = kickoff({ ruckCommit: 0 }, {}, 'Fine')
  ok((many.me.ruckSecure ?? 1) > 1 && many.me.units.attack < b.me.units.attack, `commit many: the ball is safer (x${(many.me.ruckSecure ?? 1).toFixed(2)}) and the attacking line is thinner`)
  ok((few.me.ruckSecure ?? 1) < 1 && few.me.units.attack > b.me.units.attack, 'commit few: the reverse')
  const hard = kickoff({ ruckContest: 100 }, {}, 'Fine'), fan = kickoff({ ruckContest: 0 }, {}, 'Fine')
  ok((hard.me.ruckContest ?? 1) > 1 && hard.me.units.defence < b.me.units.defence && hard.me.penRisk > b.me.penRisk,
    `compete hard: bites on their ball (x${(hard.me.ruckContest ?? 1).toFixed(2)}), a thinner line, and more penalties (${b.me.penRisk.toFixed(4)} -> ${hard.me.penRisk.toFixed(4)})`)
  ok((fan.me.ruckContest ?? 1) < 1 && fan.me.units.defence > b.me.units.defence && fan.me.penRisk < b.me.penRisk, 'fan out: the reverse')
  ok(hard.me.cardRisk > b.me.cardRisk, 'and a little more card risk')
}

console.log('--- nothing is a meta')
{
  // paired full matches: the same fixture, the same state and the same rng,
  // only the setting differs (common random numbers, as dialweight does)
  const margin = (set: Partial<Tactic>, fxs: { g: GameState; fx: Fixture }[]) => {
    let sum = 0
    fxs.forEach(({ g, fx }, i) => {
      const h = structuredClone(g)
      Object.assign(h.clubs[h.userClubId].tactic, set)
      const f = h.fixtures.find(x => x.id === fx.id)!
      simMatch(h, f, mulberry32(9000 + i * 17), false)
      sum += f.homeId === h.userClubId ? f.homeScore - f.awayScore : f.awayScore - f.homeScore
    })
    return sum / fxs.length
  }
  const pool: { g: GameState; fx: Fixture }[] = []
  for (const seed of [3, 11, 29, 47, 83, 101, 131, 157]) {
    for (const club of ['northampton', 'bath', 'exeter', 'sale']) {
      const g = newGame(club, 'KB', seed)
      for (const c of Object.values(g.clubs)) { delete c.tactic.kickStyle; c.tactic.ruckCommit = 50; c.tactic.ruckContest = 50 }
      pool.push({ g, fx: userFixture(g) })
    }
  }
  const base = margin({ kickStyle: 'balanced', ruckCommit: 50, ruckContest: 50, kicking: 60 }, pool)
  const rows: [string, Partial<Tactic>][] = [
    ['territory', { kickStyle: 'territory', kicking: 60 }], ['contest', { kickStyle: 'contest', kicking: 60 }], ['attack', { kickStyle: 'attack', kicking: 60 }],
    ['commit 100', { ruckCommit: 100 }], ['commit 0', { ruckCommit: 0 }], ['contest 100', { ruckContest: 100 }], ['contest 0', { ruckContest: 0 }],
  ]
  for (const [name, set] of rows) {
    const m = margin({ kicking: 60, ...set }, pool) - base
    ok(Math.abs(m) <= 3, `${name}: ${m >= 0 ? '+' : ''}${m.toFixed(2)} points a match against balanced, over ${pool.length} paired matches (within 3)`)
  }
}

console.log(fails ? `\nKICK & BREAKDOWN PROBE FAILED (${fails})` : '\nKICK & BREAKDOWN PROBE PASSED: every choice is a trade that pays in its own conditions, and none is a meta')
process.exit(fails ? 1 : 0)
