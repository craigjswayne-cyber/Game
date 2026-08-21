// Probe: the 2026-27 Premiership transfer window is in the world.
//
// Source: Wikipedia's List of 2026-27 Premiership Rugby transfers, supplied by
// the user as screenshots of all nine club sections, plus the league's own
// club-by-club captains article. Neither page is reachable from this
// environment - the egress proxy refuses both - so the screenshots ARE the
// source, and this probe is what keeps them from rotting.
//
// Five claims:
//
//   1. Men who moved between clubs the game models are at their new clubs.
//   2. Men who left the game's world are gone from their old clubs.
//   3. A `name@club` pin binds ONE LISTING, not a name: the Leicester lock
//      George Martin goes to Saracens while the Esher winger of the same name
//      is left alone. This is the mechanism the window needed, because nine of
//      its names belong to two different men in this data.
//   4. Men Northampton let go are at the clubs that signed them, restored from
//      the entries the Saints commit deleted - not invented.
//   5. The captains the league names are the captains the game names.
import { newGame } from '../src/game/newgame'
import { CLUB_CAPTAINS } from '../src/data/captains'
import { verifiedClub } from '../src/data/verified'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('bath', 'Window', 61)
const clubOf = (name: string) => {
  const p = Object.values(g.players).find(x => x.name === name)
  return p?.clubId ?? null
}
const squad = (cid: string) => new Set(g.clubs[cid].players.map(id => g.players[id]?.name))

// ---- 1. the moves landed ----
console.log('\nplayers at their new clubs:\n')
const MOVES: [string, string][] = [
  ['George Martin', 'saracens'], ['Tomos Williams', 'saracens'], ['Alex Lozowski', 'sale'],
  ['Joe Marchant', 'sale'], ['Nicky Smith', 'sale'], ['Christ Tshiunza', 'sale'],
  ['Jac Morgan', 'gloucester'], ['Dewi Lake', 'gloucester'], ['Jean Kleyn', 'gloucester'],
  ['Hoskins Sotutu', 'newcastle'], ['Raffi Quirke', 'newcastle'], ['Josh Hodge', 'newcastle'],
  ['Aaron Wainwright', 'leicester'], ['Joel Sclavi', 'leicester'], ['Joe Jenkins', 'leicester'],
  ['James Dun', 'harlequins'], ['Dan du Preez', 'bath'], ['Jamie Bhatti', 'bath'],
  ['Will Rigg', 'newcastle'], ['Benjamin Elizalde', 'newcastle'], ['Sam Wolstenholme', 'exeter'],
]
for (const [name, want] of MOVES) ok(clubOf(name) === want, `${name} is at ${want}${clubOf(name) === want ? '' : ` (found ${clubOf(name) ?? 'nowhere'})`}`)

// ---- 2. the departures are gone ----
console.log('\nreleased and departed men are out of their old squads:\n')
const GONE: [string, string][] = [
  ['Will Capon', 'bristol'], ['Khwezi Mona', 'exeter'], ['Nepo Laulala', 'gloucester'],
  ['Joe Jones', 'harlequins'], ["James O'Connor", 'leicester'], ['Sam Stuart', 'newcastle'],
  ['Elliott Obatoyinbo', 'newcastle'], ['WillGriff John', 'sale'], ['Sam Spink', 'saracens'],
]
for (const [name, from] of GONE) ok(!squad(from).has(name), `${name} has left ${from}`)

// ---- 3. a pin binds a LISTING, not a name ----
console.log('\nthe scoped pin picks the right man:\n')
ok(verifiedClub('George Martin', 'leicester') === 'saracens', 'the Leicester lock is bound for Saracens')
ok(verifiedClub('George Martin', 'esher') === null, 'the Esher winger of the same name is not')
ok(verifiedClub('George Martin') === null, 'and a nameless enquiry gets no answer at all')
ok(verifiedClub('Jordie Barrett') === 'hurricanes', 'plain-name pins still answer as they always did')

// ---- 4. Northampton's departures, restored where they signed ----
console.log("\nthe Saints' leavers are at the clubs that signed them:\n")
for (const [name, want] of [['Tom West', 'newcastle'], ['Elliot Millar Mills', 'newcastle'],
  ['Sam Graham', 'newcastle'], ['George Furbank', 'harlequins']] as [string, string][]) {
  ok(clubOf(name) === want, `${name} -> ${want}${clubOf(name) === want ? '' : ` (found ${clubOf(name) ?? 'nowhere'})`}`)
}
ok(clubOf('Tom James') === 'pirates',
  'Tom James stays a Cornish Pirate - the Saracens man of that name is the one signing this world cannot hold')

// ---- 5. the armbands ----
console.log('\nthe captains the league names:\n')
for (const [cid, want] of [['bath', 'Ben Spencer'], ['bristol', 'Fitz Harding'], ['exeter', 'Dafydd Jenkins'],
  ['harlequins', 'Alex Dombrandt'], ['leicester', 'Ollie Chessum'], ['newcastle', 'George McGuigan'],
  ['northampton', 'Fraser Dingwall'], ['sale', 'Ernst van Rhyn'], ['saracens', 'Maro Itoje']] as [string, string][]) {
  ok(CLUB_CAPTAINS[cid] === want, `${cid}: ${want}${CLUB_CAPTAINS[cid] === want ? '' : ` (found ${CLUB_CAPTAINS[cid] ?? 'none'})`}`)
  ok(squad(cid).has(want), `  and ${want} is actually in the ${cid} squad`)
}
ok(CLUB_CAPTAINS['gloucester'] === undefined,
  'Gloucester name nobody - the league says the job is TBC after Tomos Williams left')

console.log(fails ? `\nTRANSFER WINDOW PROBE FAILED (${fails})` : '\nTRANSFER WINDOW PROBE PASSED: the window is in the world')
process.exit(fails ? 1 : 0)
