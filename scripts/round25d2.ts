// Probe: Round 25D-2 - hidden character, the big day, and the fog of war.
//
// From the FM blueprint the user pasted: "hidden attributes like consistency
// and big match temperament", plus the Fire Emblem/XCOM idea of assistant
// reports instead of exact bars. Five properties pinned here:
//
//   THE TRAITS ARE REAL AND BOUNDED. Consistency sits in [0.02, 0.07],
//   temperament in [-1, 1] with a world mean on zero - pure functions of
//   (seed, id), deterministic, nothing stored.
//
//   THE WOBBLE IS PER-FIXTURE AND ZERO-MEAN. The same lineup reads differently
//   on different days, identically on the same day (so a resumed match is the
//   match you left), and its average over many days is the trait-free number -
//   nobody gets stronger on average, they get less predictable.
//
//   THE FOG OF WAR HOLDS. A preview (teamUnits without a day) never sees the
//   wobble.
//
//   TEMPERAMENT ONLY WAKES ON THE BIG DAY. A side of big-game players reads
//   higher in a knockout tie than in a league match; a side of chokers lower.
//
//   FAVOURITE PRESSURE SQUEEZES THE GAP. In a final the stronger side's
//   attack/defence mods dip and the underdog's rise, zero-sum, and a league
//   match between the same clubs is untouched.
import { newGame } from '../src/game/newgame'
import { bigMatchTemper, consistency } from '../src/game/attributes'
import { beginMatch, teamUnits } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length

const g = newGame('northampton', 'Wobble', 9)
const ids = Object.values(g.players).map(p => p.id)

// ---- the traits are real and bounded ----------------------------------------
{
  const amps = ids.map(id => consistency(g.seed, id))
  const tems = ids.map(id => bigMatchTemper(g.seed, id))
  ok(amps.every(a => a >= 0.02 && a <= 0.07), `consistency spans [0.02, 0.07] (saw ${Math.min(...amps).toFixed(3)}..${Math.max(...amps).toFixed(3)})`)
  ok(tems.every(t => t >= -1 && t <= 1), 'temperament spans [-1, 1]')
  ok(Math.abs(mean(tems)) < 0.03, `the world's temperament mean sits on zero (${mean(tems).toFixed(4)})`)
  ok(consistency(g.seed, ids[0]) === consistency(g.seed, ids[0]), 'both are pure functions: same player, same answer')
}

// ---- the wobble: per-fixture, deterministic, zero-mean, fogged --------------
{
  const lineup = g.clubs[g.userClubId].players.slice(0, 23)
  const base = teamUnits(g, lineup).attack
  const day1 = teamUnits(g, lineup, { fxId: 1001, big: false }).attack
  const day2 = teamUnits(g, lineup, { fxId: 1002, big: false }).attack
  ok(day1 !== day2, `different days read differently (${day1.toFixed(3)} vs ${day2.toFixed(3)})`)
  ok(day1 === teamUnits(g, lineup, { fxId: 1001, big: false }).attack, 'the same day always reads the same - a resumed match is the match you left')
  ok(base === teamUnits(g, lineup).attack, 'the fog of war holds: a preview never sees the wobble')
  const days = Array.from({ length: 400 }, (_, i) => teamUnits(g, lineup, { fxId: 5000 + i, big: false }).attack)
  const drift = mean(days) / base - 1
  ok(Math.abs(drift) < 0.005, `zero-mean over 400 days: average sits on the trait-free number (${(drift * 100).toFixed(2)}% drift)`)
}

// ---- temperament wakes on the big day ---------------------------------------
{
  const seniors = Object.values(g.players).filter(p => !p.acad && p.ca >= 60)
  const heroes = seniors.filter(p => bigMatchTemper(g.seed, p.id) > 0.4).slice(0, 15).map(p => p.id)
  const chokers = seniors.filter(p => bigMatchTemper(g.seed, p.id) < -0.4).slice(0, 15).map(p => p.id)
  const avg = (lu: number[], big: boolean) =>
    mean(Array.from({ length: 200 }, (_, i) => teamUnits(g, lu, { fxId: 9000 + i, big }).attack))
  ok(avg(heroes, true) > avg(heroes, false), `big-game players grow on the big day (${avg(heroes, true).toFixed(3)} > ${avg(heroes, false).toFixed(3)})`)
  ok(avg(chokers, true) < avg(chokers, false), `and the big day finds the chokers out (${avg(chokers, true).toFixed(3)} < ${avg(chokers, false).toFixed(3)})`)
}

// ---- favourite pressure squeezes the gap, and only on the big day -----------
{
  // strongest against weakest, no derby history between them
  const clubs = Object.values(g.clubs).sort((a, b) => b.rep - a.rep)
  const strong = clubs[0], weak = clubs[clubs.length - 1]
  const play = (stage?: string) => {
    const fx: Fixture = {
      id: 424242, compId: 'prem', round: 0, week: g.week, homeId: strong.id, awayId: weak.id,
      played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage,
    }
    const ctx = beginMatch(structuredClone(g), fx, mulberry32(7), false)
    return { fav: ctx.home.mods.attack, dog: ctx.away.mods.attack }
  }
  const final = play('F')
  const league = play(undefined)
  ok(final.fav < league.fav, `the favourite carries the weight in a final (attack mod ${final.fav.toFixed(3)} < ${league.fav.toFixed(3)})`)
  ok(final.dog > league.dog, `the underdog plays with freedom (${final.dog.toFixed(3)} > ${league.dog.toFixed(3)})`)
  const squeeze = league.fav / final.fav
  ok(Math.abs(final.dog / league.dog - squeeze) < 0.001, 'and the squeeze is zero-sum: one side gives exactly what the other gets')
}

console.log(fails ? `\n${fails} FAILURES` : '\nROUND 25D-2 PROBE PASSED')
process.exit(fails ? 1 : 0)
