// A SKELETON MATCH IN WORDS (2.0.0 stage 1), for a person to read for sense.
// Run: npx vite-node scripts/simread.ts [seed] [from minute] [to minute] [real]
// With "real" the match is the user's first fixture in a new game on that
// seed: real team sheets, real strengths, and the men named (stage 2).
import { simSkeleton } from '../src/game/sim/skeleton'
import type { Play } from '../src/game/sim/record'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'
import { worldFromMatch } from '../src/game/sim/fromMatch'
const real = process.argv.includes('real')
const args = process.argv.slice(2).filter(a => a !== 'real')
const seed = Number(args[0] ?? 1), from = Number(args[1] ?? 0), to = Number(args[2] ?? 80)
let T = ['Home', 'Away']
const names = new Map<string, string>()
let r
if (real) {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  if (!fx) throw new Error('no fixture for the user in the first twelve weeks')
  const { world, home, away } = worldFromMatch(g, fx, mulberry32(seed))
  T = [home.name, away.name]
  for (const p of [...home.players, ...away.players]) names.set(p.id, `${p.shirt}.${p.name.split(' ').slice(1).join(' ') || p.name}`)
  r = simSkeleton({ seed, world })
} else r = simSkeleton({ seed })
const NAMED = new Set(['try', 'lineBreak', 'knockOn', 'forwardPass', 'kick', 'catch', 'penaltyGoal', 'conversion', 'dropGoal', 'yellowCard', 'redCard', 'heldUp', 'lineout'])
const man = (p: Play): string => {
  if (!real) return ''
  const id = p.kind === 'ruck' && p.result === 'turnover' ? p.vs?.[0] : NAMED.has(p.kind) || p.result === 'intoTouch' || p.result === 'overTheLine' ? p.who : undefined
  const nm = id ? names.get(id) : undefined
  return nm ? `  [${nm}]` : ''
}
const where = (p: Play, s: 0 | 1) => { const d = s === 0 ? 100 - p.x : p.x; return d <= 0 ? 'over the line' : d < 22 ? `${d.toFixed(0)} m out` : d < 50 ? 'in their half' : d < 78 ? 'in their own half' : 'in their own 22' }
const say = (p: Play): string | null => {
  const a = T[p.side], b = T[p.side === 0 ? 1 : 0]
  switch (p.kind) {
    case 'kickoff': return `${a} kick off.`
    case 'dropout22': return `22 drop-out, ${a}.`
    case 'goalLineDropout': return `Goal-line drop-out, ${a}.`
    case 'catch': return p.result === 'chargeDownRegathered' ? `${a} are on to the loose ball first, ${where(p, p.side)}.` : p.result === 'regathered' ? `${a} win it back in the air.` : `${a} take it.`
    case 'carry': return p.result === 'intoTouch' ? `${a} go wide and are bundled into touch.` : p.result === 'knockedOn' || p.result === 'forwardPass' ? null : p.result === 'overTheLine' ? `${a} carry over the line.` : null
    case 'ruck': return p.result === 'turnover' ? `Turnover: ${b} steal it at the ruck, ${where(p, p.ball)}.` : p.result === 'recycled' && p.phase && p.phase % 4 === 0 ? `${a} through ${p.phase} phases, ${where(p, p.side)}.` : null
    case 'lineBreak': return `Line break by ${a}! ${p.result === 'clean' ? 'Nobody near him.' : `Hauled down ${where(p, p.side)}.`}`
    case 'kick': return p.result === 'chargedDown' ? `${a} kick... CHARGED DOWN by ${b}!` : p.result === 'touch' ? `${a} kick to touch.` : p.result === 'penaltyToTouch' ? `${a} kick the penalty to touch, ${where(p, p.side)}.` : p.result === 'outOnFull' ? `${a} kick it out on the full.` : p.result === 'fiftyTwentyTwo' ? `50:22 by ${a}!` : p.result === 'dead' ? `${a} kick, and it is too long.` : `${a} kick (${p.kick}).`
    case 'knockOn': return `Knock-on by ${a}.`
    case 'forwardPass': return `Forward pass by ${a}.`
    case 'notStraight': return `Not straight from ${a}.`
    case 'unplayable': return `The ball is not coming out.`
    case 'restartError': return `${a} get the restart wrong.`
    case 'intoTouch': return p.result === 'bounced' ? `It bounces into touch.` : null
    case 'deadBall': return p.result === 'touchedDown' ? `${b} touch it down.` : `It runs dead.`
    case 'heldUp': return `${a} are held up over the line!`
    case 'scrum': return p.result === 'won' ? `Scrum ${a}, ${where(p, p.side)}. Ball out.` : p.result === 'againstTheHead' ? `Scrum ${a}: lost against the head!` : `Scrum ${a}: ${p.result === 'penaltyWon' ? 'they win a penalty' : p.result === 'penaltyLost' ? 'they are penalised' : 'free kick'}.`
    case 'lineout': return p.result === 'won' ? `Lineout ${a}, ${where(p, p.side)}. Won.` : p.result === 'stolen' ? `Lineout ${a}: stolen by ${b}!` : p.result === 'notStraight' ? `Lineout ${a}.` : `Lineout ${a}: the referee has seen something.`
    case 'maul': return p.result === 'driven' ? `${a} drive the maul over the line.` : p.result === 'pulledDown' ? `${a} maul, and it is pulled down.` : p.result === 'stopped' ? `${a} maul, stopped.` : `${a} maul for ${p.gain?.toFixed(0)} metres.`
    case 'penalty': return `PENALTY to ${a}, ${where(p, p.side)}.`
    case 'freeKick': return `Free kick to ${a}.`
    case 'tap': return `${a} tap and go.`
    case 'try': return `TRY ${a}! (${p.result})  ${p.score[0]}-${p.score[1]}`
    case 'conversion': return p.good ? `Converted. ${p.score[0]}-${p.score[1]}` : `The conversion is missed.`
    case 'penaltyGoal': return p.good ? `${a} kick the penalty. ${p.score[0]}-${p.score[1]}` : `${a} miss the penalty.`
    case 'yellowCard': return `YELLOW CARD, ${a}. Ten minutes.`
    case 'redCard': return `RED CARD, ${a}.`
    case 'dropGoal': return p.good ? `DROP GOAL, ${a}! ${p.score[0]}-${p.score[1]}` : `${a} try a drop goal. Wide.`
    case 'halfTime': return `--- HALF-TIME ${p.score[0]}-${p.score[1]} ---`
    case 'fullTime': return `--- FULL TIME ${p.score[0]}-${p.score[1]} ---`
    default: return null
  }
}
for (const p of r.plays) { const m = Math.floor(p.t / 60); if (m < from || m > to) continue; const s = say(p); if (s) console.log(String(Math.min(80, m + 1)).padStart(2) + "'", s + man(p)) }
console.log(`\n${r.plays.length} entries. ${T[0]} ${r.score[0]} (${r.tries[0]} tries), ${T[1]} ${r.score[1]} (${r.tries[1]} tries).`)
