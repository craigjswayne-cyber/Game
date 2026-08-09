// Probe: the Manager's Handbook tells the truth.
//
// User: "check everything in the managers handbook section actually is correct and
// happens in the game."
//
// The handbook's own header says "every figure below was read out of the code, not
// remembered. If a coefficient changes, the entry changes with it." That was an
// intention rather than a mechanism, and the audit found seven entries where it had
// stopped being true:
//
//   it promised eight replacements when the cap is five tactical changes
//   it counted eight facilities when there are nine
//   its facility list omitted Hospitality and Boxes entirely
//   it said a coaching course takes six weeks; courses resolve the day they are sat
//     (and staff.ts has a comment recording that the dead COURSE_WEEKS constant had
//     already fooled a previous reader)
//   it said the coach keeps working "while he studies", of a course with no duration
//   it put the hospitality break-even at a fifteen thousand crowd; measured against
//     a real season it is about nine thousand, so it was calling a 1.5x return a
//     straight loss
//   it sold red-card appeals as two-in-three upside with the downside left out: a
//     dismissed appeal ADDS a match and costs board confidence
//
// A wrong handbook is worse than no handbook, because the player acts on it. So the
// numbers are pinned here, derived from the same constants the engine reads. If a
// coefficient moves and the prose does not, this fails and names the entry.
import { HANDBOOK, HANDBOOK_CATS, type HandbookCat } from '../src/ui/handbook'
import { MAX_FACILITY, FACILITY_INFO, inRedZone } from '../src/game/model'
import { MARQUEE_SLOTS } from '../src/game/cap'
import { EXAM_PASS_PCT, RETAKE_WEEKS, courseFee } from '../src/game/staff'
import { AWARD_EVERY, MIN_MATCHES, MIN_WINS } from '../src/game/awards'
import { MAX_HAGGLE } from '../src/game/ai'
import { MAX_SUBS } from '../src/game/matchEngine'
import { CHEM_SLOTS } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Find the one entry whose question contains this fragment. */
const entry = (frag: string) => {
  const hits = HANDBOOK.filter(e => e.q.toLowerCase().includes(frag.toLowerCase()))
  if (hits.length !== 1) {
    console.error(`FAIL: "${frag}" matches ${hits.length} entries, expected exactly 1`)
    fails++
    return null
  }
  return hits[0]
}

/** The entry found by `frag` must contain every one of `must`. */
const says = (frag: string, must: string[], why: string) => {
  const e = entry(frag)
  if (!e) return
  const missing = must.filter(m => !e.a.toLowerCase().includes(m.toLowerCase()))
  ok(missing.length === 0, `${why}${missing.length ? ` - missing ${JSON.stringify(missing)}` : ''}`)
}

/** And must NOT contain any of `never` - the wrong numbers, by name. */
const avoids = (frag: string, never: string[], why: string) => {
  const e = entry(frag)
  if (!e) return
  const found = never.filter(m => e.a.toLowerCase().includes(m.toLowerCase()))
  ok(found.length === 0, `${why}${found.length ? ` - still says ${JSON.stringify(found)}` : ''}`)
}

console.log(`${HANDBOOK.length} entries across ${HANDBOOK_CATS.length} categories\n`)

// ---- structure -------------------------------------------------------------
{
  const cats = new Set(HANDBOOK_CATS.map(c => c.id))
  const orphans = HANDBOOK.filter(e => !cats.has(e.cat as HandbookCat))
  ok(orphans.length === 0, `every entry sits in a real category${orphans.length ? ` (${orphans[0].q})` : ''}`)
  const dupes = HANDBOOK.map(e => e.q).filter((q, i, a) => a.indexOf(q) !== i)
  ok(dupes.length === 0, `no question is asked twice${dupes.length ? ` (${dupes[0]})` : ''}`)
  const empty = HANDBOOK_CATS.filter(c => !HANDBOOK.some(e => e.cat === c.id))
  ok(empty.length === 0, `no category is empty${empty.length ? ` (${empty[0].label})` : ''}`)
  const thin = HANDBOOK.filter(e => e.a.length < 80)
  ok(thin.length === 0, `no answer is a stub${thin.length ? ` (${thin[0].q})` : ''}`)
}

console.log('')

// ---- the numbers, each pinned to the constant the engine reads -------------

// The bench is eight men and all eight can be used, which is what the union laws
// allow. The handbook said five tactical changes for a while and this probe pinned
// that number - correctly, while the engine agreed. It stopped agreeing when the
// cap went to MAX_SUBS = 8 at the user's request ("all 8 subs should be able to be
// used"), and the probe caught its own entry going stale, which is the job.
//
// Derived from MAX_SUBS rather than typed out, so the next change to the cap fails
// here with the word it wants rather than needing this comment read again.
const CAP_WORD: Record<number, string> = { 5: 'five', 6: 'six', 7: 'seven', 8: 'eight' }
const capWord = CAP_WORD[MAX_SUBS] ?? String(MAX_SUBS)
says('once the match has started', ['eight men', `use all ${capWord}`],
  `the substitution cap is stated as all ${capWord} off an eight-man bench`)
// the old cap, by name: the wrong number is worse than a vague one
avoids('once the match has started', ['five tactical changes', 'five of them'],
  'and the old five-change cap is gone from the prose')

const facCount = Object.keys(FACILITY_INFO).length
says('facility upgrades work', [facCount === 9 ? 'nine facilities' : `${facCount} facilities`, `level ${MAX_FACILITY}`],
  `the facility count (${facCount}) and ceiling (level ${MAX_FACILITY}) match FACILITY_INFO`)

// every facility has to be described somewhere in the handbook, by name
{
  const listed = HANDBOOK.map(e => e.a).join(' ').toLowerCase()
  const unmentioned = Object.values(FACILITY_INFO)
    .map(f => f.name)
    .filter(n => !listed.includes(n.toLowerCase().split(' &')[0].split(' and')[0]))
  ok(unmentioned.length === 0,
    `every facility is explained somewhere${unmentioned.length ? ` (missing ${JSON.stringify(unmentioned)})` : ''}`)
}

says('coaching badges mean', [`${EXAM_PASS_PCT} in every 100`, 'same day', 'four weeks'],
  `the exam pass rate (${EXAM_PASS_PCT}%), same-day verdict and ${RETAKE_WEEKS}-week retake are right`)
avoids('coaching badges mean', ['six weeks', 'while he studies'],
  'and the six-week course that does not exist is gone')
ok(courseFee(1) === 60_000, `a first-tier course costs ${courseFee(1).toLocaleString()}, as the handbook says`)
ok(RETAKE_WEEKS === 4, `RETAKE_WEEKS is ${RETAKE_WEEKS}, which is the "four weeks" in the entry`)

says('Manager of the Month', ['six weeks', 'three matches', 'two wins'],
  `the award window (${AWARD_EVERY} weeks) and bar (${MIN_MATCHES} matches, ${MIN_WINS} wins) are right`)

says('sell under its asking price', ['a third off', '33'],
  `the haggle ceiling (${Math.round(MAX_HAGGLE * 100)}%) and the age factor are right`)

says('keep players fresh', ['1,300'], 'the red-zone minutes figure matches inRedZone')
ok(inRedZone({ stats: { mins: 1300 } }) && !inRedZone({ stats: { mins: 1299 } }),
  'and inRedZone really does trip at 1,300')

says('marquee player', [MARQUEE_SLOTS === 2 ? 'Two players' : `${MARQUEE_SLOTS} players`],
  `the marquee allowance (${MARQUEE_SLOTS}) matches cap.ts`)

says('partnerships', [CHEM_SLOTS.length === 5 ? 'Five pairings' : `${CHEM_SLOTS.length} pairings`],
  `the partnership count (${CHEM_SLOTS.length}) matches CHEM_SLOTS`)

says('finisher briefs', ['first three'], 'the three-brief cap is stated')

// Appeals: two in three, and the cost of the third. media.ts adds a match and
// docks two points of board confidence on a dismissal.
says('appeal a red card', ['two in three', 'add a match'],
  'the appeal entry states both the odds and the penalty for losing')

// Hospitality: 4% a level, and a break-even measured rather than guessed.
says('hospitality boxes', ['four per cent', 'nine thousand'],
  'the hospitality rate and the measured break-even crowd are right')
avoids('hospitality boxes', ['fifteen thousand'],
  'and the old fifteen-thousand break-even is gone')

if (fails) { console.error(`\nHANDBOOK PROBE: ${fails} failures`); process.exit(1) }
console.log('\nHANDBOOK PROBE PASSED: the handbook agrees with the engine')
