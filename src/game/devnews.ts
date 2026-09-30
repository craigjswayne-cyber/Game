// ---- WHAT THE DEVELOPMENT STAFF WRITE TO THE MANAGER (1.8.2) ----
//
// Owner, adding to the development brief: the academy director should single
// out a few of each new intake with a projected ceiling as a range and one
// plain line; a revised projection should say what it was and what it is; and
// a breakthrough or a stall should be a short item in the inbox. Three rules
// hold all of it: the ranges are the fog's (scout.ts paRange), never the
// number behind them; the lines are the hidden learning profile in plain words
// (devproject.ts), never a label; and nothing here draws from the rng, so the
// world is the same world whether or not the manager reads a word of it.
//
// The projection revision itself lives in rollover.ts, beside the summer's
// season review that moves the ceilings.
import type { GameState, Player } from './model'
import { absWeek } from './model'
import { devPhase, learning } from './devproject'
import { paRange, scoutPa } from './scout'
import { tIn } from './i18n'
import { clamp, hashString, mulberry32 } from './rng'

/** The academy coach's read of a ceiling in next summer's class, before the
 *  lad is a player at all: the truth with a fixed error of up to five either
 *  way, per name, so the week-30 preview grades a belief like everything else. */
export function previewRead(seed: number, name: string, pa: number): number {
  const u = mulberry32((seed ^ hashString(`preview|${name}`)) >>> 0)()
  return clamp(Math.round(pa + (u * 2 - 1) * 5), 1, 99)
}

const band = (r: [number, number] | null) => (r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`) : '?')

/** Intake day: up to three of the new class, best projection first, each
 *  with the director's range and one line on how he looks to learn. */
export function intakePicks(state: GameState, intake: Player[]) {
  if (!intake.length || state.unemployed) return
  const picks = [...intake].sort((a, b) => scoutPa(state, b) - scoutPa(state, a) || a.id - b.id).slice(0, 3)
  const rows = picks.map(p => {
    const l = learning(state.seed, p)
    return {
      k: 'news.intakePick', name: p.name, pos: p.pos, age: p.age, range: band(paRange(state, p)),
      q_k: l.quick ? `dev.intakeQuick.${l.quick}` : 'dev.intakeQuickNone',
      s_k: l.slow ? `dev.intakeSlow.${l.slow}` : 'common.nothing',
    }
  })
  const v = { rows_ll: JSON.stringify(rows) }
  state.news.push({
    id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
    subject: tIn('en', 'news.intakePicksSubj', v),
    body: tIn('en', 'news.intakePicks', v),
    k: 'news.intakePicks', v,
    playerIds: picks.map(p => p.id),
  })
}

/** Has this story already been written about him this season? */
const told = (state: GameState, k: string, id: number) =>
  state.news.some(n => n.season === state.season && n.playerId === id && (n.k === k || (k === 'news.devStalled' && n.k === 'news.devStalledMins')))

/**
 * The weekly word from the coaches, at most one item a week, once per man per
 * season each way. Read off numbers the week already has: a breakthrough is a
 * young man four or more points up on the season whose month is going well
 * (devproject devPhase), checked as each four-week spell begins; a stall is
 * one who has not moved all season with room the staff can see, at weeks 20
 * and 34, and says he needs minutes when he has barely started.
 */
export function devNewsWeek(state: GameState) {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const men = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && p.age <= 23 && !p.onLoan)
  const spellStart = absWeek(state.season, state.week) % 4 === 0
  for (const p of men) {
    if (!spellStart || state.week < 8) break
    if (p.ca - (p.ca0 ?? p.ca) >= 4 && devPhase(state, p) === 'surge' && !told(state, 'news.devBreakthrough', p.id)) {
      const v = { player: p.name }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: tIn('en', 'news.devBreakthroughSubj', v), body: tIn('en', 'news.devBreakthrough', v),
        k: 'news.devBreakthrough', v, playerId: p.id,
      })
      return
    }
  }
  if (state.week !== 20 && state.week !== 34) return
  for (const p of men) {
    if (p.age > 22 || p.ca - (p.ca0 ?? p.ca) > 0 || scoutPa(state, p) - p.ca < 4 || told(state, 'news.devStalled', p.id)) continue
    const k = !p.acad && p.stats.starts <= 2 ? 'news.devStalledMins' : 'news.devStalled'
    const v = { player: p.name }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
      subject: tIn('en', 'news.devStalledSubj', v), body: tIn('en', k, v),
      k, v, playerId: p.id,
    })
    return
  }
}
