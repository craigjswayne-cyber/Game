// Scouting knowledge: attributes of unscouted players show as ranges.
import { userWageBudget } from './grants'
// Knowledge grows by shortlisting, playing against them, and via the
// chief scout. Your own squad is always fully known.

import type { Attrs, GameState, Player, Pos } from './model'
import { tIn } from './i18n'
import { ATTR_KEYS, fmtMoney } from './model'
import { clamp, hashString, mulberry32 } from './rng'

export function knowledge(state: GameState, p: Player): number {
  if (p.clubId === state.userClubId) return 100
  return clamp(p.sc ?? 20, 0, 100)
}

/** Uncertainty margin in attribute points at a knowledge level. */
export function margin(k: number): number {
  if (k >= 95) return 0
  if (k >= 75) return 1
  if (k >= 55) return 2
  if (k >= 35) return 3
  return 4
}

/** Deterministic skew so the displayed range doesn't centre on the truth. */
function skew(p: Player, idx: number, m: number): number {
  if (m === 0) return 0
  const r = mulberry32(hashString(`${p.id}:${idx}`))()
  return Math.round((r * 2 - 1) * (m / 2))
}

/** Visible [lo, hi] for one attribute. Exact when fully scouted. */
export function attrRange(state: GameState, p: Player, key: keyof Attrs): [number, number] {
  const k = knowledge(state, p)
  const m = margin(k)
  if (m === 0) return [p.a[key], p.a[key]]
  const idx = ATTR_KEYS.indexOf(key)
  const c = clamp(p.a[key] + skew(p, idx, m), 1, 20)
  return [clamp(c - m, 1, 20), clamp(c + m, 1, 20)]
}

/** Fuzzed overall ability for star displays. */
export function fuzzedCa(state: GameState, p: Player): number {
  const k = knowledge(state, p)
  const m = margin(k)
  if (m === 0) return p.ca
  return clamp(p.ca + skew(p, 99, m * 3), 30, 99)
}

export function bumpKnowledge(p: Player, amt: number) {
  p.sc = clamp((p.sc ?? 20) + amt, 0, 100)
}

/** THE STAGED REPORT (four pillars, pillar 3's last piece). Numbers arriving
 *  as ranges was already built; this staggers everything that is NOT a
 *  number. A weekend's tape tells you how a man plays. It does not tell you
 *  who he is - that takes months of calls to people who have shared a
 *  dressing room with him, which is why character is the LAST thing a report
 *  fills in, and why signing an unscouted star is a gamble twice over. */
export type ReportStage = 0 | 1 | 2 | 3

export function reportStage(state: GameState, p: Player): ReportStage {
  const k = knowledge(state, p)
  if (k >= 90) return 3      // the full file: character, temperament, the lot
  if (k >= 55) return 2      // a proper report: role, kicking, durability read
  if (k >= 35) return 1      // a weekend of tape: broad numbers only
  return 0                   // a name and a shirt number
}

/** Is his character known? Stage 3 only - who a man is takes the longest. */
export function persKnown(state: GameState, p: Player): boolean {
  return reportStage(state, p) >= 3
}

export const STAGE_WORD: Record<ReportStage, string> = {
  0: 'Unscouted: a name on a team sheet. The numbers below are guesswork.',
  1: 'Initial report: a weekend of tape. Broad numbers, nothing behind them.',
  2: 'Detailed report: strengths and role are clear. Character still unknown.',
  3: 'Full file: numbers, character and temperament all verified.',
}

/** Weekly knowledge gathering. */
export function weeklyScouting(state: GameState) {
  const scoutLvl = state.staff.scout
  const userLeague = state.clubs[state.userClubId].leagueId
  // shortlisted players: focused reports
  for (const id of state.shortlist) {
    const p = state.players[id]
    if (p) bumpKnowledge(p, 15 + scoutLvl * 6)
  }
  // background knowledge of your own league
  if (state.week % 2 === 0) {
    for (const p of Object.values(state.players)) {
      if (p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId]?.leagueId === userLeague) {
        bumpKnowledge(p, 1 + scoutLvl)
      }
    }
  }
  // the network's assignment: a focus league gets eyes every single week
  if (state.scoutFocus && state.comps[state.scoutFocus]) {
    for (const p of Object.values(state.players)) {
      if (p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId]?.leagueId === state.scoutFocus) {
        bumpKnowledge(p, 2 + scoutLvl * 1.5)
      }
    }
  }
  // shortlist alerts: the scouts ring when a target's situation changes
  state.slAlerted ??= []
  for (const id of state.shortlist) {
    const p = state.players[id]
    if (!p || !p.clubId || p.clubId === state.userClubId || state.slAlerted.includes(id)) continue
    const alertKey = p.transferListed ? 'news.slListed'
      : p.contractEnds <= state.season ? 'news.slExpiring'
      : p.form >= 8.2 ? 'news.slForm'
      : null
    const alertV = { short: state.clubs[p.clubId]?.short ?? '', form: p.form.toFixed(1) }
    const alert = alertKey ? tIn('en', alertKey, alertV) : null
    if (alert) {
      state.slAlerted.push(id)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `🔔 Shortlist alert: ${p.name}`,
        body: `The chief scout rings it in: ${p.name} (${p.pos}, ${state.clubs[p.clubId]?.short}) ${alert}`,
        k: 'news.shortlistAlert',
        v: { player: p.name, pos: p.pos, ...alertV, alert_k: alertKey! },
        playerId: p.id,
      })
    }
  }
}

/** Facing a team teaches you plenty about their matchday squad. */
export function scoutOpponent(state: GameState, clubId: string) {
  const club = state.clubs[clubId]
  if (!club) return
  for (const id of club.players) {
    const p = state.players[id]
    if (p) bumpKnowledge(p, 12)
  }
}

/** Initial knowledge levels at new-game time. */
export function seedKnowledge(state: GameState) {
  const userLeague = state.clubs[state.userClubId].leagueId
  for (const p of Object.values(state.players)) {
    if (p.clubId === state.userClubId) { p.sc = 100; continue }
    const sameLeague = p.clubId && state.clubs[p.clubId]?.leagueId === userLeague
    p.sc = clamp((sameLeague ? 45 : 18) + (p.intl ? 20 : 0) + (p.ca >= 88 ? 10 : 0), 0, 90)
  }
}

/**
 * The recruitment meeting (audit 20B). Twice a season, at the top of each
 * window, the scouting department puts three names on the board instead of
 * leaving the manager to trawl Find A Player with a budget and a blank page.
 *
 * The needs are read off the squad in priority order - shirts one injury from
 * a crisis, then shirts whose best man is into his thirties, then simply the
 * weakest position - and each need gets the best AFFORDABLE candidate: fee
 * inside the budget, wage inside the room, and judged on the scouts' own
 * fuzzed view of him, so a well-run department proposes better names than a
 * blind one. Entirely deterministic: same squad, same market, same three
 * names. No rng is drawn and nothing is reserved - the names are a shortlist,
 * not a commitment.
 */
export function recruitmentMeeting(state: GameState): void {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const seniors = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.acad)
  const POSN: Pos[] = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']
  const at = (pos: Pos) => seniors.filter(p => p.pos === pos || p.alt.includes(pos))
  const bestAt = (pos: Pos) => at(pos).reduce((m, p) => Math.max(m, p.ca), 0)
  // The reason a shirt is on the board is a clause inside the line about the
  // man proposed for it, so it cannot be hoisted out of the list: it travels
  // as its own key and is rendered per row. `who`/`yrs` rather than name/age,
  // because the incumbent whose clock is honest is not the recruit named in
  // the same line and two `name`s in one row would collide.
  type Need = { pos: Pos; whyK: string; whyV?: Record<string, string | number> }
  const needs: Need[] = []
  for (const pos of POSN) if (at(pos).length < 2) needs.push({ pos, whyK: 'news.scoutWhyThin' })
  for (const pos of POSN) {
    if (needs.length >= 3 || needs.some(n => n.pos === pos)) continue
    const best = seniors.filter(p => p.pos === pos).sort((a, b) => b.ca - a.ca)[0]
    if (best && best.age >= 32) needs.push({ pos, whyK: 'news.scoutWhyOld', whyV: { who: best.name, yrs: best.age } })
  }
  for (const pos of [...POSN].sort((a, b) => bestAt(a) - bestAt(b))) {
    if (needs.length >= 3) break
    if (!needs.some(n => n.pos === pos)) needs.push({ pos, whyK: 'news.scoutWhyWeakest' })
  }
  const wageRoom = userWageBudget(state, club) - club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  const picks: { p: Player; need: Need; fee: number }[] = []
  for (const need of needs.slice(0, 3)) {
    const cand = Object.values(state.players)
      .filter(p => p.clubId && p.clubId !== club.id && !p.acad && p.pos === need.pos &&
        p.age <= 31 && !p.retiring && !picks.some(x => x.p.id === p.id))
      .map(p => ({ p, fee: Math.round(p.value * 1.15) }))
      // nine tenths of the budget, not all of it: the meeting runs BEFORE the
      // week's value refresh (weeklyTraining), so a man picked at 100.0% of
      // the budget can drift over it by the time the memo is read - which is
      // exactly how officeprobe caught it when the v1.1.10 fitness change
      // nudged the world's values. Advice that spends the whole budget to the
      // pound was bad advice anyway.
      .filter(x => x.fee <= club.budget * 0.9 && x.p.wage <= Math.max(20_000, wageRoom))
      .filter(x => fuzzedCa(state, x.p) >= bestAt(need.pos) - 4)
      .sort((a, b) => (fuzzedCa(state, b.p) - b.p.age * 0.4) - (fuzzedCa(state, a.p) - a.p.age * 0.4))[0]
    if (cand) picks.push({ p: cand.p, need, fee: cand.fee })
  }
  if (!picks.length) return
  // Two row keys rather than one with an "abroad" variable in it: a variable
  // holds a club's short name, which is the same word in any language, and the
  // moment it can also hold the WORD "abroad" it is smuggling English into a
  // French line. The fallback is a sentence, so it gets a sentence's key.
  const rows = picks.map(x => ({
    k: state.clubs[x.p.clubId!]?.short ? 'news.scoutRow' : 'news.scoutRowAbroad',
    pname: x.p.name,
    ppos: x.p.pos,
    page: x.p.age,
    pclub: state.clubs[x.p.clubId!]?.short ?? '',
    why_k: x.need.whyK,
    ...(x.need.whyV ?? {}),
    fee: fmtMoney(x.fee),
    wage: fmtMoney(x.p.wage),
  }))
  const names_k = picks.length === 1 ? 'news.scoutOneName'
    : picks.length === 2 ? 'news.scoutTwoNames' : 'news.scoutThreeNames'
  const v = { rows_ll: JSON.stringify(rows), names_k }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false, tag: 'scout',
    subject: tIn('en', 'news.scoutMeetingSubj', v),
    body: tIn('en', 'news.scoutMeeting', v),
    k: 'news.scoutMeeting', v,
    playerIds: picks.map(x => x.p.id),
  })
}
