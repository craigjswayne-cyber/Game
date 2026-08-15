// Probe: Round 25D-3 - the weather in the staff room.
//
// The Motorsport Manager idea the user picked out: coaches whose philosophies
// click or clash. Three properties pinned:
//
//   THE SCORE IS ARITHMETIC, NOT MOOD. A click pair counts +1, a clash pair
//   -1, an unrelated pair 0, and the whole room is the sum over every pair -
//   deterministic, no rng, nothing stored beyond the staff themselves.
//
//   DEVELOPMENT READS THE WEATHER. A young pro at a club whose coaches click
//   grows faster than the same boy under a feuding staff room, and a neutral
//   room sits exactly between.
//
//   HIRE DAY SAYS SO. The appointment letter names the click or the clash
//   with the colleague already in the building, which is how the manager
//   learns the pairs - by reading the news, not a tooltip.
import { newGame } from '../src/game/newgame'
import { appointStaff, staffCandidates, staffChem } from '../src/game/staff'
import { devFactor } from '../src/game/rollover'
import type { GameState, StaffPerson } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const person = (trait: string): StaffPerson =>
  ({ name: 'Test Coach', nat: 'ENG', age: 45, tier: 2, wage: 5_000, trait, since: 0, course: null })

const g: GameState = newGame('northampton', 'Chem', 9)

// ---- the score is arithmetic ------------------------------------------------
{
  const at = (traits: string[]) => {
    const fork = structuredClone(g)
    fork.staffPeople = Object.fromEntries(
      ['attack', 'defence', 'physio', 'scout'].slice(0, traits.length).map((r, i) => [r, person(traits[i])]))
    return staffChem(fork)
  }
  ok(at(['Analyst at heart', 'Detail merchant']) === 1, 'the numbers men click: +1')
  ok(at(['Old-school hard yards', 'Sports scientist']) === -1, 'hill runs against GPS vests: -1')
  ok(at(['Calm head', 'Youth whisperer']) === 0, 'an unrelated pair is just colleagues: 0')
  ok(at(['Man-manager', 'Motivator', 'Old-school hard yards', 'Sports scientist']) === 0,
    'a click and a clash cancel across the room: 0')
  // chosen so no cross-pair is itself listed (Detail merchant + Motivator,
  // say, is a clash in its own right and would pull the room back to +1)
  ok(at(['Man-manager', 'Motivator', 'Youth whisperer', 'Ex-international']) === 2,
    'two clicks stack: +2')
  const fork = structuredClone(g)
  ok(staffChem(fork) === staffChem(fork), 'and the same room always has the same weather')
}

// ---- development reads the weather ------------------------------------------
{
  const kid = Object.values(g.players).find(p => p.clubId === g.userClubId && !p.acad && p.age <= 22)!
  const withRoom = (traits: string[]) => {
    const fork = structuredClone(g)
    fork.staffPeople = Object.fromEntries(traits.map((t, i) => [['attack', 'defence'][i], person(t)]))
    return devFactor(fork, fork.players[kid.id])
  }
  const happy = withRoom(['Man-manager', 'Motivator'])
  const plain = withRoom(['Calm head', 'Youth whisperer'])
  const feud = withRoom(['Old-school hard yards', 'Sports scientist'])
  ok(happy > plain && plain > feud,
    `a kid grows with the room: clicks ${happy.toFixed(3)} > neutral ${plain.toFixed(3)} > feud ${feud.toFixed(3)}`)
}

// ---- hire day says so -------------------------------------------------------
{
  // partner-by-trait for the pairs the probe knows; a candidate whose trait
  // has no partner is skipped until one turns up
  const CLICK_PARTNER: Record<string, string> = {
    'Analyst at heart': 'Detail merchant', 'Detail merchant': 'Analyst at heart',
    'Man-manager': 'Motivator', 'Motivator': 'Man-manager',
    'Set-piece obsessive': 'Old-school hard yards', 'Old-school hard yards': 'Set-piece obsessive',
    'Youth whisperer': 'Ex-international', 'Ex-international': 'Youth whisperer',
  }
  const fork = structuredClone(g)
  fork.clubs[fork.userClubId].balance = 100_000_000
  let told = false
  for (const role of ['attack', 'defence', 'kicking', 'scrumCoach'] as const) {
    const cands = staffCandidates(fork, role)
    const idx = cands.findIndex(c => CLICK_PARTNER[c.trait])
    if (idx < 0) continue
    // put his perfect partner in a DIFFERENT chair before the hire
    const partnerRole = role === 'physio' ? 'assistant' : 'physio'
    fork.staffPeople = { ...(fork.staffPeople ?? {}), [partnerRole]: person(CLICK_PARTNER[cands[idx].trait]) }
    const msg = appointStaff(fork, role, idx)
    if (!msg.includes('is your new')) continue // he turned the job down - try the next chair
    const letter = fork.news[fork.news.length - 1]
    told = letter.subject.includes('appointed') && letter.body.includes('The staff room approves')
    break
  }
  ok(told, 'the appointment letter names the click with the man already in the building')
}

console.log(fails ? `\n${fails} FAILURES` : '\nROUND 25D-3 PROBE PASSED')
process.exit(fails ? 1 : 0)
