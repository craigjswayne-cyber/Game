// Probe: development focus and personal plans take ANY player who qualifies.
//
// Owner (1.8.0): "I also want to update development focus and personal plans -
// they need to be more so I can select any player who reaches the criteria."
//
// The old Training screen offered the ten under-27s with the biggest gap to
// their potential for development focus, and the twelve best senior players by
// rating for personal plans, and nobody else. The game itself had no such
// limit. This pins, against a real squad:
//
//   the lists are the rules, not a top ten: every qualifying man is offered,
//     and one the old screen could not show can be picked and takes effect;
//   the places are the game's: three for focus, planCap for plans; a full
//     book refuses a new man instead of silently dropping the oldest;
//   a man who stops qualifying gives his place back instead of holding it
//     invisibly (a focused man who turned 27 used to sit in one of the three
//     places doing nothing, and the screen had no way to remove him);
//   a plan held by a man who has left is cleared on the next change.
import { newGame } from '../src/game/newgame'
import { activePlan, planCap } from '../src/game/season'
import { FOCUS_MAX_AGE, FOCUS_SLOTS, focusBlock, focusIds, planBlock, planIds, setFocus, setPlan } from '../src/game/development'
import type { Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'Picker', 41)
const club = g.clubs[g.userClubId]
const squad = () => club.players.map(id => g.players[id]).filter((p): p is Player => !!p)

console.log('--- development focus')
{
  const u27 = squad().filter(p => p.age <= FOCUS_MAX_AGE)
  const eligible = squad().filter(p => !focusBlock(p))
  // the old screen: the ten under-27s with the biggest gap, nothing else
  const oldShown = new Set([...u27].sort((a, b) => b.pa - b.ca - (a.pa - a.ca)).slice(0, 10).map(p => p.id))
  const beyond = eligible.filter(p => !oldShown.has(p.id))
  console.log(`  squad ${squad().length}: ${u27.length} aged ${FOCUS_MAX_AGE} or under, ${eligible.length} qualify, the old screen showed 10`)
  ok(eligible.length > 10, `more men qualify than the old screen could show (${eligible.length})`)
  ok(eligible.every(p => p.age <= FOCUS_MAX_AGE && p.ca < p.pa), 'everyone offered is 26 or under and below his potential')
  ok(squad().filter(p => focusBlock(p)).every(p => p.age > FOCUS_MAX_AGE || p.ca >= p.pa), 'and everyone refused has a reason that is the rule')

  const pick = beyond[beyond.length - 1]
  ok(!!pick, `there is a qualifying man the old screen hid (${pick?.name}, ${pick?.age})`)
  g.devFocus = []
  ok(setFocus(g, pick.id, true), 'he can be picked')
  ok(focusIds(g).includes(pick.id), 'and the weekly roll reads him (focusIds, the list season.ts rolls)')

  // FIVE PLACES (owner, 1.8.1). The book fills at five and refuses a sixth.
  ok(FOCUS_SLOTS === 5, `the book has five places (${FOCUS_SLOTS})`)
  const others = eligible.filter(p => p.id !== pick.id).slice(0, FOCUS_SLOTS)
  const fill = others.slice(0, FOCUS_SLOTS - 1)
  ok(fill.every(p => setFocus(g, p.id, true)), `${fill.length} more fill the ${FOCUS_SLOTS} places`)
  const spare = others[FOCUS_SLOTS - 1]
  ok(!setFocus(g, spare.id, true), `a sixth is refused while all ${FOCUS_SLOTS} places are taken`)
  ok(focusIds(g).includes(pick.id) && g.devFocus.length === FOCUS_SLOTS && focusIds(g).length === FOCUS_SLOTS,
    'and nobody was dropped to make room (the old tap evicted the oldest)')

  // a focused man turns 27: his place comes back
  const old = g.players[others[0].id]!
  const age0 = old.age
  old.age = FOCUS_MAX_AGE + 1
  ok(focusBlock(old) === 'training.whyFocusAge', 'a focused man who turns 27 no longer qualifies, and says why')
  ok(setFocus(g, spare.id, true), 'so a new man can take the place he was holding')
  ok(!g.devFocus.includes(old.id), 'and the man who no longer qualifies is cleared out of it')
  old.age = age0
  ok(setFocus(g, pick.id, false) && !g.devFocus.includes(pick.id), 'removing a man frees his place')
}

console.log('--- personal plans')
{
  g.plans = []
  g.staff.assistant = 1
  const cap = planCap(g)
  const seniors = squad().filter(p => !p.acad)
  const eligible = squad().filter(p => !planBlock(p))
  const oldShown = new Set([...seniors].sort((a, b) => b.ca - a.ca).slice(0, 12).map(p => p.id))
  const hidden = eligible.filter(p => !oldShown.has(p.id))
  console.log(`  ${eligible.length} senior-squad men qualify, the old screen showed 12; ${cap} places`)
  ok(eligible.length > 12 && hidden.length > 0, `men the old screen hid can be offered (${hidden.length} of them)`)
  ok(squad().filter(p => planBlock(p)).every(p => p.acad), 'the only men refused are academy scholars, the rule as it stood')

  const deep = hidden[hidden.length - 1]
  ok(setPlan(g, deep.id, 'defence'), `a man outside the old twelve can be put on a plan (${deep.name}, rated ${deep.ca})`)
  ok(activePlan(g, deep.id) === 'defence', 'and the weekly training reads it (activePlan)')

  const fill = eligible.filter(p => p.id !== deep.id).slice(0, cap - 1)
  for (const p of fill) setPlan(g, p.id, 'attack')
  ok(planIds(g).length === cap, `the book fills at ${cap}`)
  const extra = eligible.find(p => !planIds(g).includes(p.id))!
  ok(!setPlan(g, extra.id, 'scrum'), 'a new man into a full book is refused')
  ok(activePlan(g, deep.id) === 'defence', 'and the first man keeps his plan (the old tap dropped him)')
  ok(setPlan(g, deep.id, 'kicking') && activePlan(g, deep.id) === 'kicking', 'changing a planned man\'s programme is never refused')

  // a planned man leaves the club: his place comes back on the next change
  const gone = g.players[fill[0].id]!
  const clubId = gone.clubId
  gone.clubId = 'bath'
  ok(planIds(g).length === cap - 1, 'a man who has left no longer counts against the book')
  ok(setPlan(g, extra.id, 'scrum') && activePlan(g, extra.id) === 'scrum', 'so a new man fits')
  ok(!(g.plans ?? []).some(x => x.id === gone.id), 'and the leaver\'s plan is cleared out')
  gone.clubId = clubId
  ok(setPlan(g, extra.id, null) && activePlan(g, extra.id) == null, 'taking a man off his plan frees the place')

  const scholar = squad().find(p => p.acad)
  if (scholar) ok(!setPlan(g, scholar.id, 'fitness') && planBlock(scholar) === 'training.whyAcademy', 'an academy scholar is refused, with the reason')
}

console.log(fails ? `\nDEV PICK PROBE FAILED (${fails})` : '\nDEV PICK PROBE PASSED: every man who qualifies can be picked, and the places are the game\'s')
process.exit(fails ? 1 : 0)
