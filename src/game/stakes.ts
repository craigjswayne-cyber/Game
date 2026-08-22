/**
 * ---- WHAT THIS MATCH MEANS ----
 *
 * The design review's cheapest finding: the engine already knows every reason a
 * fixture matters - the table maths, the boardroom temperature, the grudge, the
 * player one try short of fifty, the unbeaten run, the dream - and it has never
 * once said any of it at the moment of maximum tension. A manager pressed
 * Continue into a blank week and a blank week is what he got.
 *
 * So: one line, before kick-off, naming the single most interesting true thing
 * about this fixture.
 *
 * The rules that keep it from becoming noise:
 *
 *   1. ONE LINE, NEVER A LIST. Four reasons a match matters is a screen nobody
 *      reads; the best one is a sentence everybody does. Every candidate carries
 *      a weight and the loudest wins.
 *   2. NEVER SAY ANYTHING FALSE. Every line is arithmetic on state that has
 *      already happened. "Win and you go top" is only offered when winning
 *      really would, on the table as it stands.
 *   3. NEVER SAY ANYTHING EMPTY. If nothing about this fixture is interesting -
 *      a mid-table Tuesday in October - the function returns null and the screen
 *      says nothing at all. A billing on every match is a billing on none.
 *   4. IT CHANGES NOTHING. Like the Dream, this is a lens: it reads state, draws
 *      no rng and writes nothing back, so it cannot move a single result.
 */
import { grudgeBetween, unbeatenRun } from './model'
// WIN_MARKS lives in season.ts (legacy.ts imports it the same way)
import { WIN_MARKS } from './season'
import type { Fixture, GameState } from './model'
import { sortTable } from './schedule'
import { dreamState } from './dream'

export interface Stake {
  text: string
  /** loudest wins. Roughly: a title/relegation swing beats the boardroom beats
   *  a milestone beats a grudge beats a nice run. */
  weight: number
}

const ord = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

/** Head-to-head over the seasons on the record: [ourWins, theirWins, lastRun]. */
function headToHead(state: GameState, oppId: string): { theirs: number; ours: number; streak: number } {
  const uid = state.userClubId
  const met = state.fixtures
    .filter(f => f.played && ((f.homeId === uid && f.awayId === oppId) || (f.homeId === oppId && f.awayId === uid)))
    .sort((a, b) => a.week - b.week)
  let ours = 0, theirs = 0, streak = 0
  for (const f of met) {
    const us = f.homeId === uid ? f.homeScore : f.awayScore
    const them = f.homeId === uid ? f.awayScore : f.homeScore
    if (us > them) ours++
    else if (them > us) theirs++
  }
  // how many in a row they have won, most recent first
  for (let i = met.length - 1; i >= 0; i--) {
    const f = met[i]
    const us = f.homeId === uid ? f.homeScore : f.awayScore
    const them = f.homeId === uid ? f.awayScore : f.homeScore
    if (them > us) streak++
    else break
  }
  return { ours, theirs, streak }
}

/**
 * The billing for the user's next match, or null when there is honestly nothing
 * to say. Pure: reads state, writes nothing.
 */
export function matchStakes(state: GameState, fx: Fixture): string | null {
  const uid = state.userClubId
  if (fx.homeId !== uid && fx.awayId !== uid) return null
  const club = state.clubs[uid]
  if (!club) return null
  const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
  const opp = state.clubs[oppId]
  const oppName = opp?.short ?? oppId
  const out: Stake[] = []

  // ---- the table: what a win would actually do ----
  const comp = state.comps[fx.compId]
  if (comp && comp.type === 'league' && comp.table?.length) {
    const table = sortTable(comp.table)
    const meIdx = table.findIndex(r => r.teamId === uid)
    const mine = table[meIdx]
    if (mine && meIdx >= 0) {
      const pos = meIdx + 1
      // four points is a win with a try bonus: the honest "if we win" figure is
      // four, and using it keeps the claim conservative
      const after = mine.pts + 4
      const above = table.slice(0, meIdx).filter(r => r.pts <= after)
      const played = mine.p
      // WEEK ONE IS NOT A STORY. Every club sits on 0 points before a ball is
      // kicked, which makes "climb to the top" trivially true for everyone at
      // once - the exact bug the season objectives shipped with, now caught
      // before it shipped here. A table has nothing to say about itself until
      // there is a table: four rounds in is the same floor unbeatenRun already
      // uses for "a run worth mentioning".
      // the fixture list is the honest denominator: how many league games this
      // club is down to play at all, rather than a guess from the table size
      const total = state.fixtures.filter(f =>
        f.compId === comp.id && !f.stage && (f.homeId === uid || f.awayId === uid)).length
      const late = played >= total - 5
      if (played >= 4 && meIdx > 0 && above.length > 0) {
        const climbTo = meIdx + 1 - above.length
        if (climbTo === 1) out.push({ text: 'Win and you go top of the league.', weight: 100 })
        else out.push({ text: `Win and you climb to ${ord(climbTo)}.`, weight: 55 + (late ? 20 : 0) })
      } else if (played >= 4 && meIdx === 0) {
        const chaser = table[1]
        const gap = mine.pts - (chaser?.pts ?? 0)
        out.push({
          text: gap <= 4
            ? `Top of the league by ${gap} point${gap === 1 ? '' : 's'} - and ${state.clubs[chaser.teamId]?.short ?? 'the chasers'} are right behind you.`
            : `Top of the league. Win and the gap goes out to ${gap + 4}.`,
          weight: gap <= 4 ? 92 : 60,
        })
      }
      // the wrong end of it
      const relegates = ['prem', 'champ', 'top14'].includes(comp.id)
      if (played >= 4 && relegates && pos >= table.length - 1 && late) {
        out.push({ text: 'A relegation six-pointer in all but name: the drop is one bad afternoon away.', weight: 105 })
      } else if (played >= 4 && relegates && pos >= table.length - 2) {
        out.push({ text: `${ord(pos)} of ${table.length}. The bottom of this table is close enough to read.`, weight: 62 })
      }
      // the run-in
      if (late && comp.playoffTeams > 0) {
        const cut = table[comp.playoffTeams - 1]
        if (cut && Math.abs(mine.pts - cut.pts) <= 5 && pos > comp.playoffTeams) {
          out.push({ text: `The playoff places are ${Math.max(0, cut.pts - mine.pts)} points away with ${Math.max(0, total - played)} to play.`, weight: 95 })
        }
      }
    }
  }

  // ---- the boardroom ----
  if (club.boardConfidence <= 22) {
    out.push({
      text: club.boardConfidence <= 12
        ? 'The board meets on Monday either way. What you hand them tonight decides the meeting.'
        : 'The boardroom has gone quiet on you. A result here would change the temperature.',
      weight: club.boardConfidence <= 12 ? 110 : 70,
    })
  }

  // ---- the grudge, the derby, the bogey side ----
  const grudge = grudgeBetween(state, uid, oppId)
  if (fx.derby) out.push({ text: `Derby day. ${oppName}, and the city stops for it.`, weight: 80 })
  if (grudge) out.push({ text: `Bad blood: ${grudge.reason}. Nobody at either club has forgotten.`, weight: 78 })
  const h2h = headToHead(state, oppId)
  if (h2h.streak >= 3) out.push({ text: `${oppName} have beaten you ${h2h.streak} times in a row. At some point that has to stop.`, weight: 76 })

  // ---- runs, ours and theirs ----
  const run = unbeatenRun(state, uid)
  if (run >= 6) out.push({ text: `${run} unbeaten. The whole league is waiting for it to end.`, weight: 58 + Math.min(20, run) })

  // ---- a man on the edge of something ----
  {
    const squad = (club.players ?? []).map(id => state.players[id]).filter(Boolean)
    for (const p of squad) {
      if (!p) continue
      for (const mark of [50, 100, 150, 200, 250]) {
        if (p.stats.apps === mark - 1) out.push({ text: `${p.name} makes appearance number ${mark} for the club tonight.`, weight: 66 })
      }
      for (const mark of [25, 50, 75, 100]) {
        if (p.stats.tries === mark - 1) out.push({ text: `${p.name} is one try short of ${mark} for the club.`, weight: 68 })
      }
    }
  }

  // ---- the manager's own marks ----
  {
    const nextWin = WIN_MARKS.find((x: number) => x > state.mgr.w)
    if (nextWin && state.mgr.w === nextWin - 1) out.push({ text: `Win this and it is career victory number ${nextWin}.`, weight: 72 })
  }

  // ---- the dream, when this fixture is on its road ----
  {
    const d = dreamState(state)
    if (d && !d.progress.done) {
      if ((fx.compId === 'cc') && !!fx.stage && (d.def.id === 'europe' || d.def.id === 'double')) {
        out.push({ text: `European Club Cup knockout rugby - the exact road your career was pointed down.`, weight: 88 })
      }
    }
  }

  // ---- a final is a final ----
  if (fx.stage === 'F') out.push({ text: 'A final. Everything a season is for, in eighty minutes.', weight: 120 })
  else if (fx.stage === 'SF') out.push({ text: 'A semi-final: win and you are eighty minutes from silverware.', weight: 108 })

  if (!out.length) return null
  out.sort((a, b) => b.weight - a.weight)
  return out[0].text
}

/**
 * The season's landmark weeks, for the calendar strip.
 *
 * Anticipation needs dates. Everything here already fires on schedule somewhere
 * in the engine; the player has simply never been able to see it coming.
 */
export interface Tentpole { week: number; icon: string; label: string }

export function seasonTentpoles(state: GameState): Tentpole[] {
  const uid = state.userClubId
  const out: Tentpole[] = []
  for (const fx of state.fixtures) {
    if (fx.homeId !== uid && fx.awayId !== uid) continue
    if (fx.derby) out.push({ week: fx.week, icon: '🔥', label: `Derby: ${state.clubs[fx.homeId === uid ? fx.awayId : fx.homeId]?.short ?? ''}` })
    if (fx.stage === 'F') out.push({ week: fx.week, icon: '🏆', label: 'A FINAL' })
    else if (fx.stage === 'SF') out.push({ week: fx.week, icon: '🏆', label: 'Semi-final' })
  }
  // the fixed furniture of a season
  out.push({ week: 7, icon: '📝', label: 'Transfer deadline' })
  out.push({ week: 24, icon: '🏛', label: 'Half-term report card' })
  out.push({ week: 27, icon: '📝', label: 'Mid-season deadline' })
  out.push({ week: 30, icon: '🎓', label: 'Academy class preview' })
  out.push({ week: 44, icon: '🎓', label: 'Intake day' })
  out.sort((a, b) => a.week - b.week)
  // one entry per week, the most interesting kept: a derby beats the calendar
  const seen = new Set<number>()
  return out.filter(t => (seen.has(t.week) ? false : (seen.add(t.week), true)))
}
