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
  //
  // TEN SIMS A FIXTURE, RESTORED RATHER THAN CLONED (28 Sep 2026). One sim
  // of each of the 96 fixtures still left a standard error near 1.9 points on
  // each row (a paired match's margin moves about 19 points once the streams
  // part), so seven rows against a band of 3 failed a run in two: four
  // shifted seed lists read attack -4.53 (FAIL) and contest 0 +3.45 (FAIL)
  // among rows that otherwise sat within a point or two. Each fixture is now
  // played ten times on ten streams, every setting on the same ten, from a
  // kick-off restored in place (the two clubs, their men and the chemistry
  // ledger, which is everything a match reads or writes that the next could
  // feel) instead of a 150 ms structuredClone. 960 pairs a row, a standard
  // error near 0.6, the same band.
  type Entry = { g: GameState; fx: Fixture; restore: () => void }
  const K = 10
  const play = (e: Entry, set: Partial<Tactic>, seed: number) => {
    e.restore()
    Object.assign(e.g.clubs[e.g.userClubId].tactic, set)
    const f: Fixture = { ...e.fx, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 }
    simMatch(e.g, f, mulberry32(seed), false)
    return f.homeId === e.g.userClubId ? f.homeScore - f.awayScore : f.awayScore - f.homeScore
  }
  const seedOf = (i: number, k: number) => (9000 + i * 17 + k * 104729) >>> 0
  const margin = (set: Partial<Tactic>, fxs: Entry[]) => {
    let sum = 0
    fxs.forEach((e, i) => { for (let k = 0; k < K; k++) sum += play(e, set, seedOf(i, k)) })
    return sum / (fxs.length * K)
  }
  const pool: Entry[] = []
  // 24 WORLDS, NOT 8 (1.8.0): at 32 pairs "contest 0" read +4.44 after the
  // unit rebalance and +0.07 over 96 on the same commit - common random
  // numbers only hold until the first event differs, and 32 matches could not
  // resolve a 3-point band. optionsprobe asks the same at 120 on the slow list.
  for (const seed of [3, 11, 29, 47, 83, 101, 131, 157, 181, 211, 239, 263, 281, 307, 331, 353, 379, 401, 421, 443, 463, 487, 503, 521]) {
    for (const club of ['northampton', 'bath', 'exeter', 'sale']) {
      const g = newGame(club, 'KB', seed)
      for (const c of Object.values(g.clubs)) { delete c.tactic.kickStyle; c.tactic.ruckCommit = 50; c.tactic.ruckContest = 50 }
      const fx = userFixture(g)
      const clubIds = [fx.homeId, fx.awayId]
      const pids = clubIds.flatMap(c => g.clubs[c].players)
      const snapC = structuredClone(clubIds.map(c => g.clubs[c]))
      const snapP = structuredClone(pids.map(id => g.players[id]))
      const snapChem = structuredClone(g.chem)
      const snapMisc = { news: g.news.slice(), nextId: g.nextId, grudges: structuredClone(g.grudges) }
      const restore = () => {
        clubIds.forEach((c, j) => { g.clubs[c] = structuredClone(snapC[j]) })
        pids.forEach((id, j) => { g.players[id] = structuredClone(snapP[j]) })
        g.chem = structuredClone(snapChem)
        // a match also files news, takes ids and can start a grudge the next
        // one reads, so those go back too
        g.news = snapMisc.news.slice(); g.nextId = snapMisc.nextId; g.grudges = structuredClone(snapMisc.grudges)
      }
      pool.push({ g, fx, restore })
    }
  }
  // the pairing is only as good as the restore: the same setting on the same
  // stream from the same kick-off has to replay the same match
  const neutralSet = { kickStyle: 'balanced', ruckCommit: 50, ruckContest: 50, kicking: 60 } as Partial<Tactic>
  const replays = pool.slice(0, 8).filter((e, i) => {
    // with a different match in between, so anything left behind would show
    const first = play(e, neutralSet, seedOf(i, 0)); play(e, { ruckContest: 100 }, seedOf(i, 1))
    return first === play(e, neutralSet, seedOf(i, 0))
  }).length
  ok(replays === 8, `a restored kick-off replays the same match on the same stream (${replays}/8)`)
  const base = margin(neutralSet, pool)
  const rows: [string, Partial<Tactic>][] = [
    ['territory', { kickStyle: 'territory', kicking: 60 }], ['contest', { kickStyle: 'contest', kicking: 60 }], ['attack', { kickStyle: 'attack', kicking: 60 }],
    ['commit 100', { ruckCommit: 100 }], ['commit 0', { ruckCommit: 0 }], ['contest 100', { ruckContest: 100 }], ['contest 0', { ruckContest: 0 }],
  ]
  for (const [name, set] of rows) {
    const m = margin({ kicking: 60, ...set }, pool) - base
    ok(Math.abs(m) <= 3, `${name}: ${m >= 0 ? '+' : ''}${m.toFixed(2)} points a match against balanced, over ${pool.length * K} paired matches (within 3)`)
  }
}

console.log(fails ? `\nKICK & BREAKDOWN PROBE FAILED (${fails})` : '\nKICK & BREAKDOWN PROBE PASSED: every choice is a trade that pays in its own conditions, and none is a meta')
process.exit(fails ? 1 : 0)
