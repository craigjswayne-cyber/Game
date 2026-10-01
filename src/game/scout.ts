// Scouting knowledge: attributes of unscouted players show as ranges.
import { userWageBudget } from './grants'
import { askingPrice } from './ai'
import { playerValue } from './attributes'
// Knowledge grows by shortlisting, playing against them, and via the
// chief scout. Your own squad is always fully known, bar a young man's ceiling
// (youthPaMargin below: nobody can read what he will become as a number).

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

/**
 * ---- THE CEILING IS FOUND, NOT GIVEN (1.8.2) ----
 *
 * Owner: "It shouldn't be easy to see the best youngsters and free agents;
 * you should have to research and do deep dives."
 *
 * A man's potential is the most valuable secret in the game, and until now the
 * World screen listed the eight highest in any league, free agents included,
 * the pre-season circular named five of them, the market sorted on the true
 * rating and priced on the true ceiling, and a player page put a Wonderkid
 * chip on any teenager with one, scouted or not. So the ceiling is now read
 * the way the attributes always were: through knowledge. Nothing the manager
 * sees reads p.pa for a man at another club except through paRange, and
 * everything that ranks or filters for him ranks on the reading.
 *
 *   under 35 knowledge  no reading at all: a name on a team sheet
 *   35 to 54            a wide band, twelve either side
 *   55 to 74            seven either side (WATCH_KNOW: a proper report)
 *   75 to 94            four either side
 *   95 and over         the number
 *
 * The band is skewed by a fixed per-man amount, like the attribute ranges, so
 * its middle is not the truth. The only ways up the ladder are the ones that
 * always raised knowledge: the shortlist, the league background and focus,
 * facing him, and the chief scout's brief (weeklyScouting, scoutOpponent,
 * commission.ts). AI clubs never read any of this; they see true values.
 */
export const WATCH_KNOW = 55

/** Margin on the ceiling at a knowledge level, or -1 for no reading at all. */
export function paMargin(k: number): number {
  if (k >= 95) return 0
  if (k >= 75) return 4
  if (k >= 55) return 7
  if (k >= 35) return 12
  return -1
}

/**
 * ---- A YOUNG MAN'S CEILING IS AN ESTIMATE, WHOEVER WATCHES HIM (1.8.2) ----
 *
 * Knowledge reads what a man IS. What he will become is still being decided
 * (devproject.ts: the ceiling moves with his seasons until his early twenties),
 * so no file, not even your own staff's on your own academy, reads it as a
 * number while he is young. The floor on the margin runs from seven points at
 * 18 to two at 23, and the club's own development staff see further: a
 * level-3 assistant and a level-3 Centre of Excellence take a point each off
 * it for the club's own men (never under one before 24). From 24 the full
 * file is the number again, as it always was.
 */
export function youthPaMargin(state: GameState, p: Player): number {
  if (p.age >= 24) return 0
  const base = p.age <= 18 ? 7 : p.age <= 20 ? 5 : p.age <= 22 ? 4 : 2
  if (p.clubId !== state.userClubId) return base
  const club = state.clubs[state.userClubId]
  const sight = ((state.staff?.assistant ?? 0) >= 3 ? 1 : 0) + ((club?.facilities?.academy ?? 0) >= 3 ? 1 : 0)
  return Math.max(1, base - sight - (secondOpinion(state, p) ? 1 : 0))
}

/**
 * A SECOND OPINION (1.8.2, rewarded.ts): a watched spot buys the development
 * staff the look they would otherwise take a season or a better setup to
 * reach, which is one more point of sight on this man's ceiling, this season.
 * It sits under the same floor of one as the assistant and the Centre of
 * Excellence, so a young man's ceiling is never read as a number early. Your
 * own players only; it changes what the club reads of him (the band, and the
 * middle of it the club's own lists sort on), never the man or any AI club.
 */
export function secondOpinion(state: GameState, p: Player): boolean {
  const o = state.rewarded?.opinion
  return p.clubId === state.userClubId && !!o && typeof o === 'object' && o[p.id] === state.season
}

/** The scouts' band on his ceiling, or null when they have not read it. */
export function paRange(state: GameState, p: Player): [number, number] | null {
  const km = paMargin(knowledge(state, p))
  if (km < 0) return null
  const m = Math.max(km, youthPaMargin(state, p))
  if (m === 0) return [p.pa, p.pa]
  const c = clamp(p.pa + skew(p, 98, m), 1, 99)
  const floor = Math.round(fuzzedCa(state, p))
  const lo = clamp(Math.max(floor, c - m), 1, 99)
  return [lo, clamp(Math.max(lo, c + m), 1, 99)]
}

/**
 * One number for "how high could he go", as far as the club knows: the middle
 * of the band, or with no band at all a generic projection from what can be
 * seen (his rating as read, plus the years he has left to grow). It never
 * reads the ceiling of a man the scouts have not read.
 */
export function scoutPa(state: GameState, p: Player): number {
  const r = paRange(state, p)
  if (r) return (r[0] + r[1]) / 2
  return clamp(fuzzedCa(state, p) + Math.max(0, 23 - p.age) * 2.5, 1, 99)
}

/** His price as the club reads it: the market's own formula fed the scouts'
 *  reading instead of the truth, so a sort by value is not a hidden sort by
 *  ceiling. Exact once he is fully known. */
export function seenValue(state: GameState, p: Player): number {
  if (knowledge(state, p) >= 95) return p.value
  return playerValue(Math.round(fuzzedCa(state, p)), p.age, Math.round(scoutPa(state, p)), p.pos, p.form,
    p.clubId ? p.contractEnds - state.season : undefined, p.caps)
}

/** The Wonderkid chip: the staff's estimate at your own club (1.8.2: an
 *  estimate there too, devproject.ts), a proper report elsewhere. */
export function wonderkidKnown(state: GameState, p: Player): boolean {
  if (p.age > 21) return false
  if (p.clubId === state.userClubId) return scoutPa(state, p) >= 86
  return knowledge(state, p) >= WATCH_KNOW && scoutPa(state, p) >= 86
}

/** What a market list sorts on, for the columns that carry a hidden number. */
export function searchKey(state: GameState, p: Player, key: 'ca' | 'value'): number {
  return key === 'ca' ? fuzzedCa(state, p) : seenValue(state, p)
}

/**
 * World > Team of the Season > Ones to Watch. Named: under-21s at clubs in
 * the league (never free agents: owner, 1.8.2, a ranking list is no shop
 * window for the unattached) the scouts have properly read, best reading first, plus the
 * club's own. Leads: up to three the scouts have only heard about, at clubs in
 * the league, never free agents, and never named: a position, an age and the
 * league, to be followed up. The whisper behind a lead is the ceiling with a
 * wide fixed error, and the three passed on are drawn at random from those it
 * clears, so a lead is a tip and not a ranking.
 */
export function onesToWatch(state: GameState, leagueId: string): { named: Player[]; leads: Player[] } {
  const pool = Object.values(state.players).filter(p =>
    p.age <= 21 && !p.retiring && p.clubId != null && state.clubs[p.clubId]?.leagueId === leagueId)
  const read = (p: Player) => p.clubId === state.userClubId || knowledge(state, p) >= WATCH_KNOW
  const named = pool.filter(read)
    .sort((a, b) => scoutPa(state, b) - scoutPa(state, a) || a.id - b.id)
    .slice(0, 8)
  const whisper = (p: Player) => p.pa + (mulberry32(hashString(`lead|${p.id}|${state.season}`))() * 2 - 1) * 8
  // a whisper passes the bar or it does not; which three of those the scouts
  // pass on is luck of the season, not an order, so the leads are no ranking
  const draw = (p: Player) => mulberry32(hashString(`leadpick|${p.id}|${state.season}`))()
  const leads = pool.filter(p => p.clubId && !read(p) && whisper(p) >= 80)
    .sort((a, b) => draw(a) - draw(b) || a.id - b.id)
    .slice(0, 3)
  return { named, leads }
}

/** The row for a lead, as a key and its variables (news and the World screen). */
export function leadRow(state: GameState, p: Player): { k: string; [x: string]: string | number } {
  const lid = p.clubId ? state.clubs[p.clubId]?.leagueId : undefined
  // the full English name: i18n.COMP_VARS translates a `league` on the way out
  return { k: 'news.watchLead', age: p.age, pos_k: posNounKey(p.pos), league: (lid && state.comps[lid]?.name) || '' }
}

const POS_NOUN: Record<Pos, string> = {
  LP: 'prop', TP: 'prop', HK: 'hooker', LK: 'lock', FL: 'flanker', N8: 'number8',
  SH: 'scrumHalf', FH: 'flyHalf', CE: 'centre', WG: 'winger', FB: 'fullBack',
}
export const posNounKey = (pos: Pos) => `posNoun.${POS_NOUN[pos] ?? 'player'}`

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
        subject: `Shortlist alert: ${p.name}`,
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
      // the fee his club would actually ask (askingPrice): `value * 1.15`
      // quoted a key man at two thirds of the real price, so the memo
      // recommended signings the budget could not in fact reach (1.8.1)
      .map(p => ({ p, fee: askingPrice(state, p) }))
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
