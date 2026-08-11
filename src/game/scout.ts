// Scouting knowledge: attributes of unscouted players show as ranges.
// Knowledge grows by shortlisting, playing against them, and via the
// chief scout. Your own squad is always fully known.

import type { Attrs, GameState, Player, Pos } from './model'
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
    const alert = p.transferListed ? `has been TRANSFER LISTED by ${state.clubs[p.clubId]?.short}. He can be had cheap - move before someone else does.`
      : p.contractEnds <= state.season ? `is out of contract this summer. ${state.clubs[p.clubId]?.short} haven't tied him down - a free transfer in the making.`
      : p.form >= 8.2 ? `is in the form of his life (${p.form.toFixed(1)}). His price is climbing by the week.`
      : null
    if (alert) {
      state.slAlerted.push(id)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `🔔 Shortlist alert: ${p.name}`,
        body: `The chief scout rings it in: ${p.name} (${p.pos}, ${state.clubs[p.clubId]?.short}) ${alert}`,
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
  const needs: { pos: Pos; why: string }[] = []
  for (const pos of POSN) if (at(pos).length < 2) needs.push({ pos, why: 'one injury from a crisis there' })
  for (const pos of POSN) {
    if (needs.length >= 3 || needs.some(n => n.pos === pos)) continue
    const best = seniors.filter(p => p.pos === pos).sort((a, b) => b.ca - a.ca)[0]
    if (best && best.age >= 32) needs.push({ pos, why: `${best.name} is ${best.age} and the clock is honest` })
  }
  for (const pos of [...POSN].sort((a, b) => bestAt(a) - bestAt(b))) {
    if (needs.length >= 3) break
    if (!needs.some(n => n.pos === pos)) needs.push({ pos, why: 'the weakest shirt in the side' })
  }
  const wageRoom = club.wageBudget - club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  const picks: { p: Player; why: string; fee: number }[] = []
  for (const need of needs.slice(0, 3)) {
    const cand = Object.values(state.players)
      .filter(p => p.clubId && p.clubId !== club.id && !p.acad && p.pos === need.pos &&
        p.age <= 31 && !p.retiring && !picks.some(x => x.p.id === p.id))
      .map(p => ({ p, fee: Math.round(p.value * 1.15) }))
      .filter(x => x.fee <= club.budget && x.p.wage <= Math.max(20_000, wageRoom))
      .filter(x => fuzzedCa(state, x.p) >= bestAt(need.pos) - 4)
      .sort((a, b) => (fuzzedCa(state, b.p) - b.p.age * 0.4) - (fuzzedCa(state, a.p) - a.p.age * 0.4))[0]
    if (cand) picks.push({ p: cand.p, why: need.why, fee: cand.fee })
  }
  if (!picks.length) return
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `🤝 Recruitment meeting: ${picks.length === 1 ? 'one name' : picks.length === 2 ? 'two names' : 'three names'} on the board`,
    body: picks.map(x =>
      `${x.p.name} (${x.p.pos}, ${x.p.age}, ${state.clubs[x.p.clubId!]?.short ?? 'abroad'}) - ${x.why}. About ${fmtMoney(x.fee)}, ${fmtMoney(x.p.wage)}/wk.`,
    ).join('\n') + '\n\nTap a name to open his profile and make the bid. The window does not wait.',
    playerIds: picks.map(x => x.p.id),
  })
}
