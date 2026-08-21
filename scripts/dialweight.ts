/**
 * ---- DOES EVERY DIAL EARN ITS PLACE? (release audit, Pass 2, qualitative half)
 *
 * disttest already proves the match engine produces plausible rugby. What
 * nothing else measures is whether the SIX TACTICAL DIALS are six decisions or
 * two decisions and four pieces of furniture. That is the balance hole a
 * manager game dies of quietly: each dial is wired up exactly as written, each
 * has a probe proving it is wired up, and four of them could still be
 * decoration.
 *
 * ---- COMMON RANDOM NUMBERS, OR WHY VERSIONS 1 AND 2 COULD NOT BE TRUSTED --
 *
 * Version 1 measured league points over separate careers and reported kicking
 * at +11 a season. Version 2 measured points difference per match, still over
 * separate careers - one career per (dial, setting) - and its own header
 * records the tell: style's measured swing moved from +5.16 to +2.09 to -0.10
 * across three runs IN WHICH STYLE'S CODE WAS NEVER TOUCHED. Two careers
 * diverge on tick one - different results, different morale, different
 * injuries, different opponents' form - so the world's noise voted in every
 * comparison, and the estimator's error bar was bigger than most effects it
 * was ranking. Three calibrations were tuned against that slop and all three
 * were reverted (docs/audit-handoff.md).
 *
 * This version holds the world still and moves ONLY the dial:
 *
 *   ONE CANONICAL CAREER advances at dials 50. At each competitive user
 *   fixture, the state is cloned twice per dial and the SAME fixture is simmed
 *   from the SAME state with the SAME rng seed - once at 10, once at 90. The
 *   paired difference is the dial's effect on that afternoon; everything else
 *   is common to both arms and cancels exactly. A dial that never crosses a
 *   threshold produces a difference of exactly zero, which no
 *   separate-careers design can ever say.
 *
 *   The rng for each sim is mulberry32 on (fixture id, dial) - deterministic,
 *   never the shared match stream, so the probe repeats to the digit.
 *
 *   TWO CLUBS, NOT ONE. philosophy.ts pairs every club to the shape of its
 *   squad, so "expansive wins at Northampton" was only ever a squad read. The
 *   same sweep runs at the most pack-leaning club in the same league, and the
 *   dominant-strategy test is the two-club one the handoff scoped: no dial may
 *   pay big in the SAME direction at BOTH clubs. That is the test the kicking
 *   free lunch would have failed, and it had never been run until now.
 *
 * THE SHEET MUST BE THE MANAGER'S (learned by difficultyprobe): userPicked is
 * set, or the auto-picker quietly retakes the lineup underneath the experiment.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { autoSelect, refFor, simMatch } from '../src/game/matchEngine'
import { packTilt } from '../src/game/philosophy'
import { mulberry32 } from '../src/game/rng'
import type { GameState, Player, Tactic } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEEDS = [4, 88, 1201, 77]
const SEASONS = 1
type Dial = 'style' | 'tempo' | 'kicking' | 'aggression' | 'defLine' | 'defWidth'
const DIALS: Dial[] = ['style', 'tempo', 'kicking', 'aggression', 'defLine', 'defWidth']

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const se = (a: number[]) => {
  if (a.length < 2) return Infinity
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length)
}

interface ClubSweep {
  diffs: Record<Dial, number[]>
  /** paired lenient-minus-fussy aggression swings, referee controlled by id */
  aggRefPairs: number[]
  zeros: Record<Dial, number>
}

/** Advance one canonical career at dials 50; paired-sim every user fixture. */
function sweep(clubId: string): ClubSweep {
  const out: ClubSweep = {
    diffs: Object.fromEntries(DIALS.map(d => [d, []])) as Record<Dial, number[]>,
    aggRefPairs: [],
    zeros: Object.fromEntries(DIALS.map(d => [d, 0])) as Record<Dial, number>,
  }
  for (const seed of SEEDS) {
    const g: GameState = newGame(clubId, 'Dials', seed)
    const setDials = (s: GameState) => {
      const t = s.clubs[s.userClubId].tactic as Tactic
      t.style = 50; t.tempo = 50; t.kicking = 50; t.aggression = 50
      t.defLine = 50; t.defWidth = 50
      const club = s.clubs[s.userClubId]
      const pool = club.players.map(id => s.players[id])
        .filter((p): p is Player => !!p && !p.injury && p.bans === 0 && !p.onLoan && !p.natSquad)
      if (pool.length >= 23) {
        t.lineup = autoSelect(s, pool, t.split)
        t.userPicked = true
      }
    }
    const target = g.season + SEASONS
    let guard = 0
    while (g.season < target && guard++ < 55 * SEASONS) {
      setDials(g)
      const fx = userFixtureThisWeek(g)
      if (fx && fx.compId !== 'fr') {
        // one paired sim per dial: same pre-match state, same rng seed, the
        // dial at 10 then at 90 - the difference is the dial and only the dial
        const marginAt = (dial: Dial, v: number): number => {
          const c: GameState = structuredClone(g)
          ;(c.clubs[c.userClubId].tactic as unknown as Record<string, number>)[dial] = v
          const f = c.fixtures.find(x => x.id === fx.id)!
          simMatch(c, f, mulberry32(((fx.id * 6 + DIALS.indexOf(dial)) * 2654435761) >>> 0), false)
          return (f.homeId === c.userClubId ? 1 : -1) * (f.homeScore - f.awayScore)
        }
        for (const dial of DIALS) {
          const d = marginAt(dial, 90) - marginAt(dial, 10)
          out.diffs[dial].push(d)
          if (d === 0) out.zeros[dial]++
        }
        // THE REFEREE READ, CONTROLLED. The first version bucketed the
        // observational pairs above by the fixture's own whistle - different
        // MATCHES in each bucket, so between-match variance (+/- 1.7 a mean)
        // buried a slope worth well under a point, and the assert passed or
        // failed on which afternoons the calendar happened to deal. refFor is
        // a hash of the fixture id, so the same snapshot re-simmed under a
        // swapped id changes the referee and nothing else, and the same rng
        // seed makes it common random numbers across the whistle too: each
        // fixture yields ONE paired lenient-minus-fussy swing, and the noise
        // that buried the slope cancels inside the pair.
        if (out.aggRefPairs.length < 60) {
          const dUnder = (fid: number, v: number): number => {
            const c: GameState = structuredClone(g)
            ;(c.clubs[c.userClubId].tactic as unknown as Record<string, number>)['aggression'] = v
            const f = c.fixtures.find(x => x.id === fx.id)!
            f.id = fid
            simMatch(c, f, mulberry32(((fx.id * 6 + DIALS.indexOf('aggression')) * 2654435761) >>> 0), false)
            return (f.homeId === c.userClubId ? 1 : -1) * (f.homeScore - f.awayScore)
          }
          let idL = -1, idF = -1
          for (let k = 1; k < 400 && (idL < 0 || idF < 0); k++) {
            const cand = 500_000 + fx.id * 199 + k
            const rp = 2 - refFor(cand).breakdown
            if (rp < 0.98 && idL < 0) idL = cand
            else if (rp > 1.02 && idF < 0) idF = cand
          }
          if (idL >= 0 && idF >= 0) {
            const dL = dUnder(idL, 90) - dUnder(idL, 10)
            const dF = dUnder(idF, 90) - dUnder(idF, 10)
            out.aggRefPairs.push(dL - dF)
          }
        }
      }
      processWeekAndAdvance(g)
    }
  }
  return out
}

// the contrast club: most pack-leaning squad in Northampton's own league, so
// the opposition pool is the same and only the squad shape differs
const probeWorld = newGame('northampton', 'Dials', 4)
const packClub = Object.values(probeWorld.clubs)
  .filter(c => c.leagueId === probeWorld.clubs['northampton'].leagueId && c.id !== 'northampton')
  .sort((a, b) => packTilt(probeWorld, b) - packTilt(probeWorld, a))[0]
console.log(`  paired sims: ${SEEDS.length} seeds x ${SEASONS} season, dial 10 v 90 from the same state and rng`)
console.log(`  clubs: northampton (backs-leaning) and ${packClub.id} (pack tilt ${packTilt(probeWorld, packClub).toFixed(1)}, the league's most forward-leaning)\n`)

const at: Record<string, ClubSweep> = {
  northampton: sweep('northampton'),
  [packClub.id]: sweep(packClub.id),
}

const meanAbs = (a: number[]) => mean(a.map(Math.abs))
for (const [clubId, s] of Object.entries(at)) {
  console.log(`  ${clubId}:`)
  for (const dial of DIALS) {
    const d = s.diffs[dial]
    const m = mean(d)
    const sig = Math.abs(m) > 2 * se(d) ? 'real' : Math.abs(m) > se(d) ? 'weak' : 'level'
    console.log(`    ${dial.padEnd(11)} mean ${(m >= 0 ? '+' : '') + m.toFixed(2)} +/- ${se(d).toFixed(2)}, |swing| ${meanAbs(d).toFixed(2)} a match  (${sig}, n=${d.length}, exactly zero in ${s.zeros[dial]})`)
  }
}

// ---- IS ANY DIAL SIMPLY NOT PLUMBED IN? -----------------------------------
// Under common random numbers this question finally has an exact answer: a
// dial wired to nothing gives an IDENTICAL match at 10 and 90 - every paired
// difference exactly zero. Decoration and decision are no longer the same
// shape. Note what this DOESN'T ask for: a loud mean. A well-balanced dial
// reads mean-zero while still swinging real afternoons, and the old version's
// "louder than the noise" demand on the mean was the separate-careers frame
// surviving into a design where it punishes good balance. The magnitude of
// the per-match swing is the decision-ness of the dial; the mean is its BIAS,
// and bias is what the dominant-strategy test below is for.
console.log('')
for (const dial of DIALS) {
  const touched = at.northampton.diffs[dial].length - at.northampton.zeros[dial]
  ok(touched >= 5,
    `${dial} changes real afternoons (${touched} of ${at.northampton.diffs[dial].length} paired matches diverged)`)
}
// and when a dial moves an afternoon, it moves it by match-deciding amounts -
// the average absolute swing across all paired fixtures, zeros included
for (const dial of ['style', 'tempo', 'kicking', 'aggression'] as Dial[]) {
  const swing = meanAbs(at.northampton.diffs[dial])
  ok(swing >= 1.5,
    `${dial} is worth real points when it bites (mean |swing| ${swing.toFixed(2)} a match, floor 1.5)`)
}

// ---- THE TWO-CLUB DOMINANT-STRATEGY TEST ----------------------------------
// The real test, run for the first time: a dial that pays more than DOM a
// match in the SAME direction at a backs club AND at the league's most
// pack-leaning club is a setting, not a decision - the kicking free lunch
// wearing any dial's label. Paying big at one club and not the other is a
// squad read, which is what the tactics screen is for.
const DOM = 4.0
console.log('')
for (const dial of DIALS) {
  const a = mean(at.northampton.diffs[dial])
  const b = mean(at[packClub.id].diffs[dial])
  const dominant = Math.sign(a) === Math.sign(b) && Math.abs(a) > DOM && Math.abs(b) > DOM
  ok(!dominant,
    `${dial} is not a dominant strategy across squad shapes (${(a >= 0 ? '+' : '') + a.toFixed(2)} at northampton, ${(b >= 0 ? '+' : '') + b.toFixed(2)} at ${packClub.id}, bar ${DOM.toFixed(1)} both ways)`)
}

// ---- THE CONDITIONAL TEST: DOES AGGRESSION READ THE REFEREE? --------------
// Same paired differences, bucketed by the whistle the fixture was always
// going to have (refFor is deterministic on fixture id). The slope is the
// engine feature; where the split sits against zero is printed for the record.
{
  const pairs = [...at.northampton.aggRefPairs, ...at[packClub.id].aggRefPairs]
  const m = mean(pairs)
  console.log(`\n  aggression by referee, controlled: same snapshot, same rng, the whistle swapped by fixture id`)
  console.log(`  paired lenient-minus-fussy swing: ${(m >= 0 ? '+' : '') + m.toFixed(2)} +/- ${se(pairs).toFixed(2)} a match (n=${pairs.length})`)
  ok(m > 0,
    `going physical costs less in front of a lenient referee than a fussy one (paired ${(m >= 0 ? '+' : '') + m.toFixed(2)} a match)`)
}

console.log(fails ? `\n${fails} FAILURES` : '\nDIAL WEIGHT PASSED: every dial earns its place at two squad shapes, measured with the world held still')
process.exit(fails ? 1 : 0)
