import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { isPlayable, migrate } from '../src/game/save'
import { type GameState } from '../src/game/model'
import { bad, ok, finite, checkWorld, failCount } from './worldcheck'

/**
 * ---- THE SAVE FILE, DAMAGED ----
 *
 * Everything else in this suite tests a world the engine built. This tests a
 * world handed to it by a file - and the file is the one thing in the game that
 * outlives the code. A save written months ago by an older build has fields that
 * no longer exist and lacks fields that now do; a save on a phone that ran out of
 * disk mid-write is simply truncated; a save copied between devices can arrive
 * with anything at all in it.
 *
 * There is exactly one gate between that file and the game: migrate(). So each
 * damaged save below goes through migrate and then plays five weeks, and the bar
 * is:
 *
 *   migrate never throws - a throw is a white screen on startup
 *   a save it accepts is playable, not merely present
 *   a save too broken to accept is REFUSED, clearly, rather than half-loaded
 *   and nothing it accepts poisons the world afterwards
 *
 * "Refused" and "healed" are both good answers. "Threw" and "loaded into a career
 * that falls over three weeks later" are not.
 */

/** A pristine save, serialised the way the store serialises it. */
function pristine(): Record<string, unknown> {
  const g = newGame('northampton', 'Save Tester', 777)
  return JSON.parse(JSON.stringify(g)) as Record<string, unknown>
}

/**
 * Hand a damaged save to migrate and then try to play it.
 *
 * `mustPlay` says whether this damage is the kind the game should heal and carry
 * on from. Where it is not - a save with no clubs in it is not a rugby save at
 * all - refusing it is the right answer, and the only thing checked is that the
 * refusal is clean.
 */
function damaged(label: string, wreck: (s: Record<string, unknown>) => void, mustPlay = true) {
  const s = pristine()
  try {
    wreck(s)
  } catch (e) {
    bad('SETUP', `${label}: damaging the save threw ${String(e).split('\n')[0].slice(0, 110)}`)
    return
  }

  let g: GameState | null = null
  let threw = ''
  try {
    g = migrate(s as unknown as GameState)
  } catch (e) {
    threw = String(e).split('\n')[0].slice(0, 120)
  }

  if (threw) {
    bad('MIGRATE-THREW', `${label}: loading threw instead of refusing - ${threw}`)
    return
  }
  ok(true, `${label}: loading it does not throw`)
  // This is the decision the loader makes: a healed save is played, a file that
  // is not a rugby world at all reads as an empty slot. Both are fine answers;
  // half-loading one is not.
  if (!g || !isPlayable(g)) {
    ok(!mustPlay, `${label}: refused as unplayable, which is the right answer for this one`)
    return
  }
  ok(true, `${label}: accepted as playable`)

  // now play it, which is the only proof that "loaded" meant anything
  let thrown = 0
  for (let w = 0; w < 5; w++) {
    try {
      g.newsFrom = g.nextId
      processWeekAndAdvance(g)
    } catch (e) {
      thrown++
      if (thrown === 1) bad('PLAY-THREW', `${label}: week ${g.week} after loading threw ${String(e).split('\n')[0].slice(0, 120)}`)
      break
    }
  }
  ok(thrown === 0, `${label}: and five weeks play out afterwards`)
  checkWorld(g, label, true)
}

// -------------------------------------------------- fields that went missing
// Every one of these is what an older save looks like: the field simply is not
// there, because the build that wrote it had never heard of it.
const OPTIONAL_FIELDS = [
  'shortlist', 'staff', 'mgr', 'vacancies', 'devFocus', 'natTeam', 'natOffer',
  'natLineup', 'objectives', 'finHist', 'boardOwed', 'news', 'press', 'offers',
  'mentors', 'pledges', 'preContracts', 'history', 'comps', 'fixtures',
  'natSquads', 'natRank', 'commission', 'tryOfSeason', 'day', 'newsFrom',
].filter(f => f !== 'comps')
console.log('--- fields an older save simply does not have')
for (const f of OPTIONAL_FIELDS) {
  damaged(`no "${f}" field at all`, s => { delete s[f] })
}
// comps is not an optional extra: with no competitions there is nothing to play,
// so this belongs with the files that are refused rather than healed
damaged('no "comps" field at all', s => { delete s.comps }, false)

// -------------------------------------------------- fields of the wrong type
// A hand-edited save, or one mangled by a bad sync. Every one of these is a
// field the game reads without asking what it is.
console.log('\n--- fields holding the wrong kind of thing')
const WRONG_TYPES: [string, unknown][] = [
  ['news', 'not an array'], ['news', 42], ['news', {}],
  ['press', 'nope'], ['offers', 0], ['fixtures', {}],
  ['history', 'none'], ['mentors', 7], ['pledges', 'x'],
  ['staff', 'none'], ['mgr', []], ['objectives', 'youth'],
  ['week', 'three'], ['week', -5], ['week', 9999], ['week', NaN],
  ['season', -1], ['season', 'first'], ['season', NaN],
  ['seed', 'abc'], ['seed', NaN], ['nextId', -10], ['nextId', NaN],
  ['day', 99], ['day', -1], ['day', 'monday'],
]
for (const [field, value] of WRONG_TYPES) {
  damaged(`"${field}" holding ${JSON.stringify(value)}`, s => { s[field] = value })
}
// A save whose manager works for a club that is not in the file cannot be played
// as that career: there is no squad, no fixture list and no board. Refusing it is
// the answer, so the slot reads empty rather than opening a career with a hole
// where the club should be.
for (const bogus of ['no-such-club', 42, null]) {
  damaged(`"userClubId" holding ${JSON.stringify(bogus)}`, s => { s.userClubId = bogus }, false)
}

// ------------------------------------------------------ arrays full of holes
console.log('\n--- arrays with holes and rubbish in them')
damaged('a news list full of nulls', s => { s.news = [null, null, null] })
damaged('a news list of half-written stories', s => {
  s.news = [{ id: 1 }, { subject: 'no id' }, { id: 2, subject: null, body: null }]
})
damaged('a fixture list of nonsense', s => {
  s.fixtures = [{ id: 1 }, null, { id: 2, homeId: 'nowhere', awayId: 'nowhere', week: -3 }]
})
damaged('an offers list of ghosts', s => {
  s.offers = [{ id: 1, playerId: 999_999, fromClubId: 'nowhere', fee: NaN, status: 'pending', forUser: true }]
})
damaged('mentoring pairs pointing at nobody', s => {
  s.mentors = [{ senior: 999_998, kid: 999_999, since: 1 }]
})

// -------------------------------------------------- the world itself broken
console.log('\n--- the world itself, broken')
damaged('a squad listing players who are gone', s => {
  const clubs = s.clubs as Record<string, { players: number[] }>
  const first = Object.values(clubs)[0]
  first.players = [...first.players, 999_997, 999_998]
})
damaged('a player whose club does not exist', s => {
  const players = s.players as Record<string, { clubId: string | null }>
  const first = Object.values(players)[0]
  first.clubId = 'no-such-club'
})
damaged('a player with no attributes', s => {
  const players = s.players as Record<string, Record<string, unknown>>
  const first = Object.values(players)[0]
  delete first.a
})
damaged('every player stripped of stats', s => {
  const players = s.players as Record<string, Record<string, unknown>>
  for (const p of Object.values(players)) delete p.stats
})
damaged('a club with no tactic', s => {
  const clubs = s.clubs as Record<string, Record<string, unknown>>
  delete Object.values(clubs)[0].tactic
})
damaged('a club with no players array', s => {
  const clubs = s.clubs as Record<string, Record<string, unknown>>
  delete Object.values(clubs)[0].players
})
damaged('a league table that disagrees with the fixtures', s => {
  const comps = s.comps as Record<string, { table?: { p: number; w: number; d: number; l: number; pts: number }[] }>
  for (const c of Object.values(comps)) {
    if (c.table) for (const row of c.table) { row.p = 40; row.w = 40; row.pts = 200 }
  }
})

// ------------------------------------------------- not a rugby save at all
// These are the ones it is allowed to refuse. What it must not do is throw.
console.log('\n--- files that are not a save at all')
damaged('no players at all in the file', s => { delete s.players }, false)
damaged('no clubs at all in the file', s => { delete s.clubs }, false)
damaged('players holding an array instead of a map', s => { s.players = [] }, false)
damaged('clubs holding a string', s => { s.clubs = 'northampton' }, false)
damaged('an empty object', s => {
  for (const k of Object.keys(s)) delete s[k]
}, false)

// ------------------------------------------------------------ the truncation
// A phone that ran out of disk halfway through a write. Cut the serialised save
// at several points and try to read each one - the parse will usually fail, and
// the only thing that matters is that a failed parse is a refusal rather than a
// crash on the way to the title screen.
console.log('\n--- a save cut off halfway through being written')
{
  const whole = JSON.stringify(pristine())
  for (const frac of [0.1, 0.5, 0.9, 0.999]) {
    const cut = whole.slice(0, Math.floor(whole.length * frac))
    let parsed: unknown = null
    let parseThrew = false
    try { parsed = JSON.parse(cut) } catch { parseThrew = true }
    ok(parseThrew || !!parsed, `a save cut at ${Math.round(frac * 100)}% either fails to parse or parses`)
    if (parseThrew) continue
    let threw = ''
    try { migrate(parsed as GameState) } catch (e) { threw = String(e).split('\n')[0].slice(0, 100) }
    ok(!threw, `and a truncated save that DOES parse loads without throwing (${threw || 'clean'})`)
  }
}

console.log(failCount()
  ? `\nSAVE FUZZ FOUND ${failCount()} PROBLEM(S)`
  : '\nSAVE FUZZ PASSED: every damaged save was healed or refused, and none of them threw')
if (failCount()) process.exit(1)
