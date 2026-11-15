// Scouting knowledge: attributes of unscouted players show as ranges.
import { userWageBudget } from './grants'
import { askingPrice } from './transferRules'
import { playerValue } from './attributes'
// Knowledge grows by shortlisting, playing against them, and via the
// chief scout. Your own squad is always fully known, bar a young man's ceiling
// (youthPaMargin below: nobody can read what he will become as a number).

import type { GameState, Player, Pos } from './model'
import { tIn } from './i18n'
import { fmtMoney } from './model'
import { clamp, hashString, mulberry32 } from './rng'
import { fileRec, makeRec } from './scoutrecs'
import { rivalTalk, talkSpell } from './recruit'
import { FREE_CAP, LEAGUE_CAP, MATCH_CAP, WATCH_KNOW, bumpKnowledge, fadeKnowledge, fuzzedCa, shownCa, knowledge, scoutPa } from './scoutknow'

// The knowledge ladder and its readings live in scoutknow.ts (a leaf) so the
// recommendation modules can read a man without an import cycle.
export { knowledge, margin, attrRange, fuzzedCa, caKnown, shownCa, CA_KNOW, WATCH_KNOW, FREE_CAP, LEAGUE_CAP, MATCH_CAP, youthPaMargin, secondOpinion, paRange, scoutPa, bumpKnowledge, fadeKnowledge } from './scoutknow'

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
  return key === 'ca' ? shownCa(state, p) ?? -1 : seenValue(state, p)
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

/** What the club would know of a man with nobody watching him: what it knew
 *  on the first day (seedKnowledge). A file fades back to this and no lower. */
export function baseKnowledge(state: GameState, p: Player): number {
  const userLeague = state.clubs[state.userClubId]?.leagueId
  const sameLeague = !!p.clubId && state.clubs[p.clubId]?.leagueId === userLeague
  return clamp((sameLeague ? 45 : 18) + (p.intl ? 20 : 0) + (p.ca >= 88 ? 10 : 0), 0, 90)
}

/** How many men the chief scout can keep under watch at once: one for each
 *  badge, three at most. No scout, nobody watched. */
export const watchSlots = (state: GameState): number => clamp(state.staff?.scout ?? 0, 0, 3)

/** The men under the scout's own eye (1.9.12), tidied: gone, signed and
 *  retired men drop off, and the list never outgrows his badge. */
export function scoutWatchList(state: GameState): number[] {
  const ok = (state.scoutWatch ?? []).filter(id => {
    const p = state.players[id]
    return !!p && !p.retiring && p.clubId !== state.userClubId
  })
  return ok.slice(0, watchSlots(state))
}

/** Put a man under the scout's watch, or take him off. Returns a reply key. */
export function toggleScoutWatch(state: GameState, playerId: number): { ok: boolean; k: string; v?: Record<string, string | number> } {
  const p = state.players[playerId]
  const list = scoutWatchList(state)
  if (list.includes(playerId)) {
    state.scoutWatch = list.filter(id => id !== playerId)
    return { ok: true, k: 'reply.watchOff', v: { player: p?.name ?? '' } }
  }
  if (!p || p.clubId === state.userClubId) return { ok: false, k: 'reply.watchNobody' }
  const slots = watchSlots(state)
  if (slots <= 0) return { ok: false, k: 'reply.noChiefScout' }
  if (knowledge(state, p) >= 100) return { ok: false, k: 'reply.watchKnown', v: { player: p.name } }
  if (list.length >= slots) return { ok: false, k: 'reply.watchFull', v: { n: slots } }
  state.scoutWatch = [...list, playerId]
  const weeks = watchWeeks(state, p)
  return { ok: true, k: weeks === 1 ? 'reply.watchOnOne' : 'reply.watchOn', v: { player: p.name, weeks } }
}

/** What a week of the scout's own eye is worth, and how long the file takes. */
const watchGain = (state: GameState) => 9 + (state.staff?.scout ?? 0) * 3
export const watchWeeks = (state: GameState, p: Player): number =>
  Math.max(1, Math.ceil((100 - knowledge(state, p)) / watchGain(state)))

/** Weekly knowledge gathering. */
export function weeklyScouting(state: GameState) {
  const scoutLvl = state.staff.scout
  const userLeague = state.clubs[state.userClubId].leagueId
  const watched = scoutWatchList(state)
  state.scoutWatch = watched
  // the scout's own eye: the one free road to a full file, a man at a time.
  // When the file is complete he comes off the list and the verdict is filed
  // (scoutrecs.ts carries it to the inbox), so the slot is free again.
  for (const id of watched) {
    const p = state.players[id]
    if (!p) continue
    bumpKnowledge(p, watchGain(state))
    if (knowledge(state, p) >= 100) {
      state.scoutWatch = state.scoutWatch.filter(x => x !== id)
      fileRec(state, makeRec(state, p, 12, 'watch', false))
    }
  }
  // shortlisted players: the department's weekly reports, up to a proper one
  for (const id of state.shortlist) {
    const p = state.players[id]
    if (p) bumpKnowledge(p, 15 + scoutLvl * 6, FREE_CAP)
  }
  // background knowledge of your own league
  if (state.week % 2 === 0) {
    for (const p of Object.values(state.players)) {
      if (p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId]?.leagueId === userLeague) {
        bumpKnowledge(p, 1 + scoutLvl, FREE_CAP)
      }
    }
  }
  // the network's assignment: a focus league gets eyes every single week
  if (state.scoutFocus && state.comps[state.scoutFocus]) {
    for (const p of Object.values(state.players)) {
      if (p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId]?.leagueId === state.scoutFocus) {
        bumpKnowledge(p, 2 + scoutLvl * 1.5, LEAGUE_CAP)
      }
    }
  }
  // and what nobody is looking at goes stale (scoutknow.ts fadeKnowledge)
  // (a man whose file was finished this week is still fresh)
  const held = new Set<number>([...state.shortlist, ...watched])
  for (const p of Object.values(state.players)) {
    if (p.clubId === state.userClubId || held.has(p.id)) continue
    // a league under watch holds what the watch can see, and so does your own
    const lid = p.clubId ? state.clubs[p.clubId]?.leagueId : undefined
    const kept = lid && lid === state.scoutFocus ? LEAGUE_CAP : lid && lid === userLeague ? FREE_CAP : 0
    fadeKnowledge(p, Math.max(baseKnowledge(state, p), Math.min(kept, p.sc ?? 0)))
  }
  // shortlist alerts: the scouts ring when a target's situation changes
  // (1.9.12: the men on the scout's watch count as targets too)
  state.slAlerted ??= []
  const targets = [...new Set([...state.shortlist, ...scoutWatchList(state)])]
  const ring = (p: Player, alertKey: string, alertV: Record<string, string | number>) => {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: `Shortlist alert: ${p.name}`,
      body: `The chief scout rings it in: ${p.name} (${p.pos}, ${state.clubs[p.clubId!]?.short}) ${tIn('en', alertKey, alertV)}`,
      k: 'news.shortlistAlert',
      v: { player: p.name, pos: p.pos, ...alertV, alert_k: alertKey },
      playerId: p.id,
    })
  }
  for (const id of targets) {
    const p = state.players[id]
    if (!p || !p.clubId || p.clubId === state.userClubId) continue
    // RIVALS IN THE HUNT (1.9.12): once per spell of talk, the week the
    // scouts first hear another club is after him, with the chief scout's
    // read of it. The line on his report was always there; nobody rang.
    const talk = rivalTalk(state, p)
    const spell = talkSpell(state)
    if (talk && state.slRival?.[id] !== spell) {
      (state.slRival ??= {})[id] = spell
      ring(p, `news.slRival_${talk.read}`, { short: state.clubs[p.clubId]?.short ?? '', rival: state.clubs[talk.clubId]?.short ?? '' })
      continue
    }
    if (state.slAlerted.includes(id)) continue
    const alertKey = p.transferListed ? 'news.slListed'
      : p.contractEnds <= state.season ? 'news.slExpiring'
      : p.form >= 8.2 ? 'news.slForm'
      : null
    if (alertKey) {
      state.slAlerted.push(id)
      ring(p, alertKey, { short: state.clubs[p.clubId]?.short ?? '', form: p.form.toFixed(1) })
    }
  }
  // spells that have passed are forgotten, so the map stays small
  if (state.slRival) for (const k of Object.keys(state.slRival)) if (state.slRival[+k] !== talkSpell(state)) delete state.slRival[+k]
}

/** Facing a team teaches you plenty about their matchday squad. */
export function scoutOpponent(state: GameState, clubId: string) {
  const club = state.clubs[clubId]
  if (!club) return
  for (const id of club.players) {
    const p = state.players[id]
    // half what it was, and short of the full file: two meetings a season
    // used to finish the whole league's files by themselves (1.9.12)
    if (p) bumpKnowledge(p, 6, MATCH_CAP)
  }
}

/** Initial knowledge levels at new-game time. */
export function seedKnowledge(state: GameState) {
  for (const p of Object.values(state.players)) {
    if (p.clubId === state.userClubId) { p.sc = 100; continue }
    p.sc = baseKnowledge(state, p)
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
  // the names go on the Scouting page with the department's verdict; this
  // story is their news, so none is owed (scoutrecs.ts)
  for (const x of picks) fileRec(state, makeRec(state, x.p, 6, 'meeting', true))
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
