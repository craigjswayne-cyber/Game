// The referee has opinions, and a 23 has to be legal.
//
// Two things a screenshot cannot check and the existing audits do not touch:
//
//   The referee panel must be MEAN-NEUTRAL. A referee should change which side an
//   afternoon suits, never how much rugby gets played. The first cut of the panel
//   was not neutral and quietly cost the whole world three and a half points a
//   game before simtest caught it. This makes that a permanent tripwire rather
//   than a thing somebody noticed once.
//
//   Law 3 must bite, and must bite the right way. Uncontested scrums remove the
//   EDGE, not the scrum. The first cut set both sides' scrum unit to 1 on the
//   assumption these were multipliers; they run at 15-20, so it deleted the set
//   piece instead of neutralising it.
import { newGame } from '../src/game/newgame'
import { weekRng, processWeekAndAdvance } from '../src/game/season'
import { beginMatch, frontRowCover, refFor, refNotes } from '../src/game/matchEngine'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

// ---- the panel is balanced -------------------------------------------------
const refs = Array.from({ length: 400 }, (_, i) => refFor(i))
const mean = (f: (r: (typeof refs)[number]) => number) => refs.reduce((s, r) => s + f(r), 0) / refs.length
const dials = {
  scrum: mean(r => r.scrum),
  breakdown: mean(r => r.breakdown),
  flow: mean(r => r.flow),
  cards: mean(r => r.cards),
}
for (const [k, v] of Object.entries(dials)) {
  console.log(`  mean ${k}: ${v.toFixed(3)}`)
  // cards may sit a shade above 1 because the old three-bucket model did too
  const hi = k === 'cards' ? 1.05 : 1.03
  ok(v >= 0.97 && v <= hi, `the ${k} dial averages out (${v.toFixed(3)})`)
}

// ---- and it is actually varied, not thirteen identical men ----------------
const spread = (f: (r: (typeof refs)[number]) => number) => Math.max(...refs.map(f)) - Math.min(...refs.map(f))
ok(spread(r => r.scrum) >= 0.15, 'scrum pedantry genuinely varies across the panel')
ok(spread(r => r.breakdown) >= 0.15, 'breakdown tolerance genuinely varies')
ok(new Set(refs.map(r => r.patience)).size >= 3, 'patience takes at least three values')
// Not every referee: two of the thirteen are deliberately unremarkable men with
// every dial near neutral, and the briefing says so rather than inventing a
// tendency. What matters is that the panel is mostly legible, so the appointment
// is usually worth reading.
const blank = new Set(refs.filter(r => refNotes(r).length === 0).map(r => r.name)).size
const named = new Set(refs.map(r => r.name)).size
console.log(`  ${named - blank} of ${named} referees have a readable tendency`)
ok(named - blank >= named - 3, `most of the panel is legible (${named - blank}/${named})`)

// a strict man and a permissive man must not read the same
const strict = refFor(0)
const notes = refNotes(strict)
console.log(`  ${strict.name}: ${notes.join(' / ')}`)

// ---- Law 3 -----------------------------------------------------------------
const g = newGame('northampton', 'Probe', 7)
const club = g.clubs[g.userClubId]
const legal = frontRowCover(g, club.tactic.lineup as (number | null)[])
console.log(`  as picked: LP ${legal.LP}, HK ${legal.HK}, TP ${legal.TP}`)
ok(legal.legal, 'a normally selected 23 is legal')

/** Strip a side of everyone who can cover a shirt, the way an injury crisis does. */
const stripCover = (state: GameState, pos: 'LP' | 'HK' | 'TP') => {
  for (const id of state.clubs[state.userClubId].players) {
    const p = state.players[id]
    if (!p) continue
    if (p.pos === pos || p.alt.includes(pos)) p.injury = { desc: 'test', until: state.week + 8, weeks: 8 }
  }
}
stripCover(g, 'TP')
const short = frontRowCover(g, club.tactic.lineup as (number | null)[])
ok(!short.legal, `losing every tighthead makes the 23 illegal (TP cover ${short.TP})`)

// uncontested removes the edge, and does not delete the set piece
const fx = g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!
const ctx = beginMatch(g, fx, weekRng(g), true)
console.log(`  scrum units under uncontested: home ${ctx.home.units.scrum.toFixed(1)}, away ${ctx.away.units.scrum.toFixed(1)}`)
ok(Math.abs(ctx.home.units.scrum - ctx.away.units.scrum) < 0.01, 'neither side holds a scrum edge')
ok(ctx.home.units.scrum > 8, 'the scrum still exists rather than being clamped to nothing')
ok(ctx.events.some(e => /UNCONTESTED SCRUMS/.test(e.text)), 'the crowd is told why')

// ---- and it stays rare across a season, not a tax on every match ----------
const g2 = newGame('northampton', 'Rate', 11)
let unc = 0, tot = 0
for (let w = 0; w < 20; w++) {
  for (const f of g2.fixtures.filter(x => x.week === g2.week)) {
    if (!g2.clubs[f.homeId] || !g2.clubs[f.awayId]) continue
    const c = beginMatch(g2, f, weekRng(g2), false)
    tot++
    if (!frontRowCover(g2, c.home.lineup).legal || !frontRowCover(g2, c.away.lineup).legal) unc++
  }
  processWeekAndAdvance(g2)
}
const rate = (unc / tot) * 100
console.log(`  uncontested in ${unc}/${tot} matches (${rate.toFixed(1)}%)`)
ok(rate < 15, `front-row shortages stay uncommon (${rate.toFixed(1)}%)`)
ok(rate > 0.2, 'and they do happen, so the rule is not decoration')

console.log(fails ? `\nREF PROBE FAILED (${fails})` : '\nREF PROBE PASSED')
process.exit(fails ? 1 : 0)
