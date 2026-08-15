// Probe: the coach's verdict names fixes the manager can actually act on.
//
// User: "on coaches verdict it should outline what the two fixes would be etc so
// the player can keep tweaking the tactics." The old line was "Fine margins. Fix
// two moments and that is our game", which names nothing.
//
// Five things are checked over a season of real matches, and the third is the one
// that would catch a careless edit:
//
//   every finished match yields fixes, win or lose. "Nothing to fix" teaches the
//     manager that the panel is decoration.
//   no two fixes in the same list say the same thing. The dedupe is by subject
//     tag, so an empty tank and an unused bench cannot both appear.
//   the numbers quoted agree with the unit battle rows on the same card. The
//     percentages used to be computed inline in MatchDay; if a copy of that maths
//     ever drifts, the verdict says 39% under a row that says 44%.
//   the advice is deterministic. It is a reading of a finished match, so reading
//     it twice must not change it - and it must never touch the match rng.
//   every fix names a control that exists. A screen name that has been renamed
//     out from under the text is worse than vague advice.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { beginMatch, makeSubstitution, playSegment, MAX_SUBS } from '../src/game/matchEngine'
import { coachFixes, gradeFixes, gradeLine, unitBattles } from '../src/game/coachfix'
import { mulberry32 } from '../src/game/rng'
import { rolesForSlot } from '../src/game/roles'
import type { GameState, Fixture } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// Every control a fix is allowed to point the manager at. Adding a fix that
// names something else is fine, but it has to be added here too, which is the
// moment to check the thing is really called that.
const CONTROLS = [
  'Selection', 'Tactics', 'Roles tab', 'Set Piece', 'Bench', 'Prep', 'Game Plan',
  'Match-Day Squad', 'Style', 'Tempo', 'Kicking', 'Physicality',
  'leadership group', 'preset', 'Club Infrastructure',
]

const g: GameState = newGame('northampton', 'Fix Probe', 1717)
const club = g.clubs[g.userClubId]

// The probe has to manage competently before it can judge the advice (same
// lesson as the substitutions below): a manager who never touches the Roles
// tab or names a kicker DESERVES the same nag every week, so the admin fixes
// drowned the panel - the 25D-2 wobble tipped it past the dominance line.
// Do the admin once, like a real manager, and judge the variety that remains.
club.tactic.roles = Array.from({ length: 15 }, (_, i) => rolesForSlot(i)[0]?.id ?? null)
club.tactic.kickers = club.players.slice(0, 2)

// Play the user's league fixtures out for real, tick by tick, so the numbers the
// verdict reads are the numbers a live match produces.
const seen: { fx: Fixture; fixes: { head: string; how: string }[] }[] = []
const start = g.season
let guard = 0
while (g.season === start && guard++ < 40 && seen.length < 14) {
  const mine = g.fixtures.find(f =>
    f.week === g.week && !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId))
  if (mine) {
    const rng = mulberry32(mine.id * 7919 + 13)
    // playSegment stops at HT and the hour, and answers any kickable penalty by
    // taking the points, which is what Skip does from the touchline.
    //
    // AND IT MAKES SUBSTITUTIONS AT THE HOUR. The first version of this probe
    // never touched the bench, and a manager who never subs is genuinely tired at
    // full time, so the fitness advice was correct fourteen times out of fourteen
    // and told us nothing about whether the panel varies. The probe has to manage
    // competently before it can judge the advice.
    const ctx = beginMatch(g, mine, rng, true, g.userClubId)
    const me0 = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
    while (ctx.seg !== 3) {
      if (ctx.seg === 2 && ctx.subsUsed < 4) {
        const tired = [...me0.onPitch]
          .sort((a, b) => (me0.energy.get(a) ?? 100) - (me0.energy.get(b) ?? 100))
        for (const out of tired) {
          if (ctx.subsUsed >= 4) break
          const fresh = [...me0.benchIds].find(id => !me0.onPitch.has(id))
          if (fresh == null) break
          makeSubstitution(g, ctx, out, fresh)
        }
      }
      playSegment(g, ctx)
    }
    const me = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
    const them = me === ctx.home ? ctx.away : ctx.home
    const fixes = coachFixes(g, ctx, me, them, club.tactic, 2)
    const again = coachFixes(g, ctx, me, them, club.tactic, 2)
    const units = unitBattles(ctx, me, them)

    // determinism, on the spot
    if (JSON.stringify(fixes) !== JSON.stringify(again)) {
      console.error(`FAIL: week ${g.week} gave different advice on a second read`)
      fails++
    }
    // any percentage quoted has to be one of the three on the card
    for (const f of fixes) {
      for (const m of f.head.matchAll(/(\d+)% won/g)) {
        if (!units.some(u => u.pct === Number(m[1]))) {
          console.error(`FAIL: week ${g.week} quotes ${m[1]}% but the rows read ${units.map(u => u.pct).join('/')}`)
          fails++
        }
      }
    }
    seen.push({ fx: mine, fixes })
  }
  processWeekAndAdvance(g)
  if (g.season !== start) break
}

console.log(`\n${seen.length} matches read by the assistant:\n`)
for (const { fx, fixes } of seen.slice(0, 6)) {
  const home = g.clubs[fx.homeId]?.short ?? fx.homeId
  const away = g.clubs[fx.awayId]?.short ?? fx.awayId
  console.log(`  ${home} ${fx.homeScore}-${fx.awayScore} ${away}`)
  for (const f of fixes) console.log(`    ${f.head}\n      ${f.how}`)
}

console.log('')
ok(seen.length >= 8, `enough matches to judge (${seen.length})`)
ok(seen.every(s => s.fixes.length >= 1), 'every match produced at least one fix')
ok(seen.every(s => s.fixes.length <= 2), 'never more than the two asked for')

const dupes = seen.filter(s => s.fixes.length === 2 && s.fixes[0].head === s.fixes[1].head)
ok(dupes.length === 0, `no list repeated itself${dupes.length ? ` (${dupes.length} did)` : ''}`)

const noControl = seen.flatMap(s => s.fixes).filter(f => !CONTROLS.some(k => f.how.includes(k)))
ok(noControl.length === 0,
  `every fix names a real control${noControl.length ? ` (${noControl.length} do not: "${noControl[0].how.slice(0, 60)}")` : ''}`)

// and the advice has to VARY. A panel that says the same two things every week is
// the old problem wearing a numbered list.
const norm = (h: string) => h.replace(/\d+/g, 'N')
const heads = new Set(seen.flatMap(s => s.fixes.map(f => norm(f.head))))
ok(heads.size >= 4, `the assistant found ${heads.size} distinct things to complain about`)

// AND NO SINGLE COMPLAINT MAY DOMINATE. This caught a real one on the first run:
// the tank candidate read absolute energy, and since eighty minutes drains
// everybody it fired in all fourteen matches and sat top of every list. Variety
// in the set is not enough if one line is always item 1.
const tally = new Map<string, number>()
for (const s of seen) for (const f of s.fixes) tally.set(norm(f.head), (tally.get(norm(f.head)) ?? 0) + 1)
const hog = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
ok(hog[1] <= Math.ceil(seen.length * 0.6),
  `the most common complaint appears ${hog[1]} times in ${seen.length} matches: "${hog[0].slice(0, 46)}"`)

const dashes = seen.flatMap(s => s.fixes).filter(f => (f.head + f.how).includes('—'))
ok(dashes.length === 0, 'no em dashes in the advice')

// ---- AND THE NEXT VERDICT MARKS THEM (C2) ---------------------------------
//
// The fixes were a lecture, not a loop: two jobs named, and nothing ever
// mentioned again whether they got done. gradeFixes is the other half. What it
// must never do is congratulate a manager for something still broken, or nag
// about something that has gone away, and 'admin' - the coach saying nothing
// broke - must never be marked at all, or a winning side gets told off for
// homework it was never set.
{
  const g1 = gradeFixes(['setpiece', 'discipline'], ['discipline', 'attack'])
  ok(g1.fixed.join() === 'setpiece', 'a complaint the coach can no longer make is marked done')
  ok(g1.missed.join() === 'discipline', 'and one he can still make is not')

  const both = gradeFixes(['setpiece', 'kicking'], ['attack', 'fitness'])
  ok(both.fixed.length === 2 && both.missed.length === 0, 'two out of two reads as two out of two')

  const neither = gradeFixes(['setpiece', 'kicking'], ['setpiece', 'kicking'])
  ok(neither.fixed.length === 0 && neither.missed.length === 2, 'and nothing done reads as nothing done')

  const admin = gradeFixes(['admin', 'setpiece'], ['attack'])
  ok(!admin.fixed.includes('admin') && !admin.missed.includes('admin'),
    '"nothing broke" is never homework, so it is never graded')
  ok(admin.fixed.join() === 'setpiece', 'but the real job alongside it still is')

  ok(gradeLine([], []) === null, 'a first match has nothing to grade and says nothing')
  const line = gradeLine(g1.fixed, g1.missed) ?? ''
  console.log(`\n  grade line: "${line}"`)
  ok(/is sorted/.test(line) && /is not/.test(line), 'the mixed verdict says which is which')
  // NOT a check for the absence of the tag words: FIX_LABEL.discipline is "the
  // discipline", so that assertion failed on a line that was perfectly good. What
  // matters is that the joined tag forms never reach a screen.
  ok(!/setpiece|admin/.test(line), 'and no raw tag name reaches the screen')
  ok(/^[A-Z]/.test(line) && !/\. [a-z]/.test(line), 'every sentence in it starts with a capital')
  const allLines = [
    gradeLine(['setpiece'], []), gradeLine(['setpiece', 'kicking'], []),
    gradeLine([], ['attack']), gradeLine([], ['attack', 'fitness']),
    gradeLine(['setpiece'], ['attack']),
  ].filter((l): l is string => !!l)
  ok(allLines.length === 5, 'every combination has words for it')
  ok(allLines.every(l => !l.includes('—')), 'no em dashes in the grades')
  ok(new Set(allLines).size === 5, 'and one match does not get another match\'s sentence')
}

// ---- THE BENCH LINE QUOTES THE REAL CAP (round 22, the RC battery) ---------
//
// "One replacement used out of five" survived two rounds after the bench grew
// to eight (F4), because the number lived in prose where no compiler could see
// it. The count now derives from MAX_SUBS, and this holds it there: play with
// an untouched bench and read the complaint back. The bench candidate shares
// its 'fitness' tag with the late-points complaint and loses the seat whenever
// the opposition scored 10+ after the hour, so it can take a few matches to
// surface - hence the loop rather than one shot.
{
  const CAP_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten'][MAX_SUBS] ?? String(MAX_SUBS)
  let benchLine: { head: string; how: string } | null = null
  let tried = 0
  let guard2 = 0
  while (!benchLine && tried < 8 && guard2++ < 40) {
    const mine = g.fixtures.find(f =>
      f.week === g.week && !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId))
    if (mine) {
      tried++
      const ctx = beginMatch(g, mine, mulberry32(mine.id * 7919 + 13), true, g.userClubId)
      while (ctx.seg !== 3) playSegment(g, ctx)
      const me = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
      const them = me === ctx.home ? ctx.away : ctx.home
      benchLine = coachFixes(g, ctx, me, them, club.tactic, 12).find(f => /used out of/.test(f.head)) ?? null
    }
    processWeekAndAdvance(g)
  }
  ok(!!benchLine, `an untouched bench surfaces the complaint (${tried} matches tried)`)
  if (benchLine) {
    ok(benchLine.head.includes(`out of ${CAP_WORD}`),
      `and it quotes the engine's cap, not a remembered one: "${benchLine.head}"`)
    ok(benchLine.how.includes(`${CAP_WORD} changes`),
      'the advice under it agrees with the headline')
  }
}

if (fails) { console.error(`\nFIX PROBE: ${fails} failures`); process.exit(1) }
console.log('\nFIX PROBE PASSED: two jobs named, and the next verdict marks them')
