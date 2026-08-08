// Probe: the team the manager picked is the team that runs out.
//
// Live report, in two messages: "I'm not sure if you make changes to the match
// day 23 it's actually putting those players on the pitch" and "just made a load
// of changes in a match and there's players I can sub in and out that weren't
// selected."
//
// Both are one bug. lineupFor() carries a "stale sheet" tidy-up, added for a real
// complaint (a flanker wore 8 for eighteen straight games while a specialist
// number eight sat outside the 23). But the rule fires whenever ANY of the
// fifteen is not a natural for his shirt AND any better natural exists anywhere
// in the squad - which is the ordinary state of affairs the moment a manager
// plays somebody out of position on purpose. And when it fires it does not fix
// the one shirt: it replaces the WHOLE twenty-three with autoSelect's pick and
// writes that over the manager's sheet.
//
// So the manager picks a 23, kicks off, and finds a different 23 on the field,
// with men on the bench he never named.
//
// The standard this probe holds: a valid sheet the manager picked himself comes
// back from lineupFor untouched, every time, including when it contains a
// deliberate out-of-position selection. An unavailable man is still covered - a
// sheet with an injury in it may be repaired, because somebody has to wear the
// shirt.
import { newGame } from '../src/game/newgame'
import { lineupFor, autoSelect } from '../src/game/matchEngine'
import { availablePlayers } from '../src/game/matchEngine'
import { XV_SLOTS } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

const show = (g: GameState, lu: (number | null)[]) =>
  lu.map(id => (id == null ? '-' : g.players[id]?.name.split(' ').slice(-1)[0] ?? '?')).join(',')

/** A deliberate manager's sheet: the auto pick, with two shirts swapped so that
 *  two men are playing out of position on purpose. */
function deliberateSheet(g: GameState): (number | null)[] {
  const club = g.clubs[g.userClubId]
  const lu = [...club.tactic.lineup]
  // swap a forward pair and a back pair, which is exactly the sort of call the
  // tidy-up was treating as an accident
  const swap = (a: number, b: number) => { const t = lu[a]; lu[a] = lu[b]; lu[b] = t }
  swap(5, 6)   // blindside and openside
  swap(11, 12) // wing and outside centre
  return lu
}

for (const [club, seed] of [['harlequins', 12345], ['northampton', 777], ['bath', 4242], ['leicester', 31337]] as const) {
  const g: GameState = newGame(club, 'Sheet Probe', seed)
  const c = g.clubs[g.userClubId]

  // ---- 1. the sheet the game itself picked must survive
  {
    const before = [...c.tactic.lineup]
    const after = lineupFor(g, c.id)
    if (before.join(',') !== after.join(',')) {
      bad(`${c.short}: the opening sheet was rewritten before a ball was kicked\n    was ${show(g, before)}\n    now ${show(g, after)}`)
    }
  }

  // ---- 2. a deliberate out-of-position sheet must survive
  {
    c.tactic.lineup = deliberateSheet(g)
    c.tactic.userPicked = true
    const mine = [...c.tactic.lineup]
    const after = lineupFor(g, c.id)
    const same = mine.join(',') === after.join(',')
    console.log(`${c.short}: deliberate sheet survives kick-off: ${same}`)
    if (!same) {
      const lost = mine.filter(id => id != null && !after.includes(id)).map(id => g.players[id!]?.name)
      const added = after.filter(id => id != null && !mine.includes(id)).map(id => g.players[id!]?.name)
      bad(`${c.short}: the manager's own sheet was replaced at kick-off\n` +
        `    dropped: ${lost.join(', ') || 'nobody'}\n` +
        `    brought in: ${added.join(', ') || 'nobody'}`)
    }
    // and it must still be his sheet on the club afterwards
    if (c.tactic.lineup.join(',') !== mine.join(',')) {
      bad(`${c.short}: the stored sheet was overwritten, so the Selection screen now shows a side he did not pick`)
    }
  }

  // ---- 3. every man who takes the field was named in the 23
  {
    const named = new Set(c.tactic.lineup.filter((x): x is number => x != null))
    const played = lineupFor(g, c.id).filter((x): x is number => x != null)
    const strangers = played.filter(id => !named.has(id)).map(id => g.players[id]?.name)
    if (strangers.length) bad(`${c.short}: ${strangers.length} men in the 23 were never selected: ${strangers.join(', ')}`)
  }

  // ---- 4. ONE unavailable man costs ONE shirt, not the whole team sheet.
  //
  // This is the case that reads as "the 23 I picked is not the 23 that played".
  // A single Test call-up or hamstring makes the stored sheet invalid, and the
  // engine answered that by re-picking all twenty-three from scratch - so a
  // manager who loses his hooker on the Thursday can find four different men on
  // his bench on the Saturday, while the Selection screen still shows the sheet
  // he wrote. A repair should be a repair.
  {
    const mine = [...c.tactic.lineup]
    const victim = g.players[mine[3]!]
    if (victim) {
      victim.injury = { desc: 'a hamstring', weeks: 3, serious: false } as never
      const after = lineupFor(g, c.id)
      if (after[3] === victim.id) bad(`${c.short}: an injured man was left in the starting XV`)

      // every other man he named, in the shirt he was given
      let heldShirt = 0, lostAltogether: string[] = []
      for (let i = 0; i < 23; i++) {
        const want = mine[i]
        if (want == null || want === victim.id) continue
        if (after[i] === want) heldShirt++
        else if (!after.includes(want)) lostAltogether.push(g.players[want]?.name ?? String(want))
      }
      const strangers = after.filter(id => id != null && !mine.includes(id) && id !== victim.id).length
      console.log(`  ${c.short}: one man injured -> ${heldShirt}/22 kept their shirt, ` +
        `${lostAltogether.length} dropped from the 23, ${strangers} men brought in`)
      if (heldShirt < 21) {
        bad(`${c.short}: losing one man rewrote the sheet - only ${heldShirt} of the other 22 kept their shirt` +
          (lostAltogether.length ? `, dropped: ${lostAltogether.slice(0, 6).join(', ')}` : ''))
      }
      if (strangers > 1) {
        bad(`${c.short}: losing one man brought ${strangers} unselected men into the 23, and one shirt was empty`)
      }
      victim.injury = undefined
    }
  }
}

// ---- 5. and the case the tidy-up was built for is still ANSWERED, just not by
// silently re-picking: a manager who leaves a specialist out has to be told.
{
  const g: GameState = newGame('northampton', 'Sheet Probe', 4242)
  const c = g.clubs[g.userClubId]
  const pool = availablePlayers(g, c.players, false)
  const auto = autoSelect(g, pool)
  // put a flanker in the number eight shirt with a real eight left out
  const eight = pool.find((p: Player) => p.pos === 'N8' && !auto.slice(0, 15).includes(p.id))
  const flanker = pool.find((p: Player) => p.pos === 'FL')
  if (eight && flanker) {
    const lu = [...auto]
    const n8Slot = XV_SLOTS.findIndex(s => s.pos === 'N8')
    lu[n8Slot] = flanker.id
    c.tactic.lineup = lu
    c.tactic.userPicked = true
    const after = lineupFor(g, c.id)
    const kept = after[n8Slot] === flanker.id
    console.log(`\na flanker deliberately picked at 8 with a specialist left out: kept ${kept}`)
    if (!kept) bad('a deliberate out-of-position pick at 8 was overruled')
  } else {
    console.log('\n(no spare specialist number eight to build the deliberate case with)')
  }
}

if (fails) { console.error(`\nSHEET PROBE: ${fails} failures`); process.exit(1) }
console.log('\nSHEET PROBE PASSED')
