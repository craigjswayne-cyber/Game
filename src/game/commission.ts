// Commissioned scouting (8-batch feedback): send your chief scout out on a
// 3, 6 or 9-month brief. He comes back with a shortlist of mixed quality - the
// longer the trip and the better his badge, the more of it is worth signing.
import { subjectVar } from './gender'
import { POS_NAMES, fmtMoney, logDecision, type GameState, type Player, type Pos, addWeeks100, weeksBetween100, stamp100 } from './model'
import { t, tIn } from './i18n'
import { mulberry32 } from './rng'
import { bumpKnowledge } from './scoutknow'
import { BADGE } from './staff'
import { fileRec, makeRec, scoutVerdict, type ScoutRec } from './scoutrecs'
import { noteFor, type NoteRef } from './scoutnote'

export { noteFor } from './scoutnote'
export type { NoteRef } from './scoutnote'

export type SearchMonths = 3 | 6 | 9
export const SEARCH_WEEKS: Record<SearchMonths, number> = { 3: 13, 6: 26, 9: 39 }
/** A longer brief is cheaper per week but a bigger commitment up front. */
export const searchFee = (months: SearchMonths, tier: number) =>
  Math.round((60_000 + months * 22_000) * (1 + tier * 0.15) / 1000) * 1000

export interface Commission {
  pos: Pos | 'any'
  months: SearchMonths
  /** absolute week (season*100+week) the report lands */
  done: number
  fee: number
  /** league the brief was pointed at, or null for the whole world */
  leagueId: string | null
  /** men he has already sent word about, so the postcards do not repeat */
  sent?: number[]
  /** absolute week (season*100+week) of his last monthly letter */
  lastWord?: number
}

export interface ScoutFind {
  playerId: number
  /** the scout's verdict, 0 (a punt) to 3 (bring him in) */
  grade: number
  /** a string on saves written before the note became a key */
  note: NoteRef | string
}

/** Send the scout out. Returns the line to show the manager. */
export function commissionScout(state: GameState, pos: Pos | 'any', months: SearchMonths): string {
  const club = state.clubs[state.userClubId]
  const tier = state.staff.scout ?? 0
  const man = state.staffPeople?.scout
  // only the three briefs on offer, and only positions that exist: a stale
  // screen or a hand-edited save must not book a trip of NaN weeks
  if (!SEARCH_WEEKS[months]) return t('reply.briefLengths')
  if (pos !== 'any' && (!Object.prototype.hasOwnProperty.call(POS_NAMES, pos) || typeof POS_NAMES[pos] !== 'string')) {
    return t('reply.noSuchPosition')
  }
  if (!club) return t('reply.noClubToScoutFor')
  if (tier <= 0 || !man) return t('reply.noChiefScout')
  if (state.commission) {
    const left = Math.max(1, weeksBetween100(state.commission.done, stamp100(state)))
    return t('reply.scoutAlreadyOut', { ...subjectVar(man.g), scout: man.name, n: left })
  }
  const fee = searchFee(months, tier)
  if (club.balance < fee) return t('reply.briefTooDear', { months, fee: fmtMoney(fee) })
  club.balance -= fee
  const abs = state.season * 100 + state.week
  state.commission = { pos, months, done: addWeeks100(abs, SEARCH_WEEKS[months]), fee, leagueId: state.scoutFocus ?? null }
  // 'wherever the game is played' is a phrase, not a competition: it travels as
  // its own fragment key, never through {where}
  const where = state.commission.leagueId ? state.comps[state.commission.leagueId]?.short ?? '' : ''
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false, tag: 'scout',
    subject: `${man.name} sent out on a ${months}-month brief`,
    body: `${fmtMoney(fee)} of expenses, a hire car and a brief: ${pos === 'any' ? 'anyone who can play' : POS_NAMES[pos].toLowerCase()}, in ${where}. ${man.name} (${BADGE[tier].toLowerCase()} badge) files his report in ${SEARCH_WEEKS[months]} weeks. A longer trip sees more rugby and less of it in the rain.`,
    k: 'news.briefSent',
    v: {
      ...subjectVar(man.g), scout: man.name, months, fee: fmtMoney(fee), where,
      where_k: where ? 'news.inLeague' : 'news.inLeagueAny',
      brief_k: pos === 'any' ? 'news.briefAnyone' : `pos.${pos}`,
      badge_k: `staff.badge${tier}`, n: SEARCH_WEEKS[months],
    },
  })
  logDecision(state, 'dec.scoutBrief', { scout: man.name, months, fee: fmtMoney(fee), weeks: SEARCH_WEEKS[months] })
  return t('reply.scoutOnTheRoad', { scout: man.name, fee: fmtMoney(fee), weeks: SEARCH_WEEKS[months] })
}

/**
 * ---- POSTCARDS FROM THE ROAD ----
 *
 * A nine-month brief used to be thirty-nine weeks of silence and then a report,
 * which is a long time to hear nothing about money you have already spent (user:
 * "when a scout goes on the road - they should drip feed their finds and
 * suggestions. they should come into the inbox").
 *
 * Once a month (every fourth week) he writes in: where the brief has him, how
 * long until the report, and what he has turned up so far. Most months that is
 * one new name he has been watching, and that man becomes properly scouted
 * there and then - so a postcard is worth something beyond the reading. He
 * never sends the same name twice, and the final report still lands at the end
 * with the graded shortlist.
 *
 * A month with nobody new still gets its letter (owner: "there should be an
 * update in news once a month for the period of time"): a narrow brief, a
 * hooker in one league, used to run dry and go silent for the rest of the
 * trip. The month is stamped on the brief (lastWord), so the cadence holds
 * across a save and a load and never files twice in one week.
 *
 * The pick is a deterministic gate on (seed, week, brief) - never the shared
 * match stream - and it is drawn from the same ranked pool the report uses, so
 * the names he mentions on the way are the names he is actually looking at.
 */
export function scoutPostcard(state: GameState) {
  const c = state.commission
  if (!c) return
  const abs = state.season * 100 + state.week
  if (abs >= c.done) return
  // a month since his last letter, and never in the last fortnight of the
  // trip - the report itself is the news by then. A brief from before the
  // stamp keeps the old week-4, 8, 12 cadence until its first letter.
  const weeksIn = SEARCH_WEEKS[c.months] - weeksBetween100(c.done, abs)
  if (weeksIn <= 0) return
  const since = c.lastWord != null ? weeksBetween100(abs, c.lastWord) : weeksIn % 4 === 0 ? 4 : 0
  if (since < 4) return
  if (c.done - abs <= 2) return
  const man = state.staffPeople?.scout
  if (!man) return
  const tier = state.staff.scout ?? 1
  c.lastWord = abs
  const rng = mulberry32((state.seed ^ Math.imul(abs, 40503) ^ (c.months * 104729)) >>> 0)
  const pool = Object.values(state.players).filter(p =>
    p.clubId && p.clubId !== state.userClubId && !p.acad && p.age <= 32 &&
    (c.pos === 'any' || p.pos === c.pos || p.alt.includes(c.pos)) &&
    (!c.leagueId || state.clubs[p.clubId]?.leagueId === c.leagueId) &&
    !(c.sent ?? []).includes(p.id))
  const worthOf = (p: Player) => (p.ca - 60) * 1.8 + (p.pa - p.ca) * 1.8 + (30 - p.age) * 0.8
  const ranked = pool.map(p => ({ p, worth: worthOf(p) })).sort((a, b) => b.worth - a.worth)
  const bias = 1.6 + tier * 0.6
  const pick = ranked.length
    ? ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * Math.pow(rng(), bias)))]
    : undefined
  const before = (c.sent ?? []).filter(id => state.players[id])
  const p = pick?.p
  if (p) {
    c.sent = [...(c.sent ?? []), p.id]
    // the real payoff: a man he has watched in person is a man you know about
    bumpKnowledge(p, 26 + tier * 6)
  }
  // his first verdict on the new name, told in this letter: a month's look,
  // so a rougher read than the final report's (scoutrecs.ts)
  const rec = p ? makeRec(state, p, Math.min(weeksIn, 8), 'road', true) : null
  if (rec) fileRec(state, rec)
  const club = p ? state.clubs[p.clubId ?? ''] : undefined
  const weeksLeft = c.done - abs
  const where = c.leagueId ? state.comps[c.leagueId]?.short ?? '' : ''
  const found = before.length + (p ? 1 : 0)
  const brief = c.pos === 'any' ? 'anyone who can play' : POS_NAMES[c.pos].toLowerCase()
  const s = weeksLeft === 1 ? '' : 's'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false, tag: 'scout',
    subject: `Word from ${man.name}: ${weeksLeft} week${s} to go`,
    body: `${weeksIn} weeks on the road. Brief: ${brief} ${where ? `in ${where}` : 'wherever the game is played'}.\n\n`
      + (p ? `New name: ${p.name}, ${p.age}, ${POS_NAMES[p.pos]} ${club ? `at ${club.name}` : 'at a club abroad'}. First verdict: ${tIn('en', `news.grade${rec!.grade}`)}.` : 'No new names this month.')
      + ` Names so far: ${found}. Report in ${weeksLeft} week${s}.`,
    k: p ? 'news.scoutMonthlyRec' : 'news.scoutMonthlyNone',
    v: {
      ...subjectVar(man.g), scout: man.name, weeksIn, n: weeksLeft, found, where,
      where_k: where ? 'news.inLeague' : 'news.inLeagueAny',
      brief_k: c.pos === 'any' ? 'news.briefAnyone' : `pos.${c.pos}`,
      ...(p ? {
        player: p.name, age: p.age, pos_k: `pos.${p.pos}`, club: club?.name ?? '',
        at_k: club ? 'news.atClub' : 'news.atClubAbroad',
        grade_k: `news.grade${rec!.grade}`,
      } : {}),
    },
    ...(p ? { playerId: p.id } : {}),
    // the names from earlier months ride along as chips under the story
    ...(before.length ? { playerIds: before.slice(-8) } : {}),
  })
}

/** Weekly: a finished brief lands on the desk. */
export function resolveCommission(state: GameState) {
  const c = state.commission
  if (!c) return
  const abs = state.season * 100 + state.week
  if (abs < c.done) return
  state.commission = null
  const man = state.staffPeople?.scout
  const tier = state.staff.scout ?? 1
  // deterministic per (seed, week, brief): the trip is not a dice roll the
  // player can reload away, and it never touches the shared match stream
  const rng = mulberry32((state.seed ^ Math.imul(c.done, 2654435761) ^ (c.months * 7919)) >>> 0)
  const pool = Object.values(state.players).filter(p =>
    p.clubId && p.clubId !== state.userClubId && !p.acad && p.age <= 32 &&
    (c.pos === 'any' || p.pos === c.pos || p.alt.includes(c.pos)) &&
    (!c.leagueId || state.clubs[p.clubId]?.leagueId === c.leagueId))
  if (!pool.length) return
  // a longer brief means more names and a better hit rate; the badge helps too
  const n = c.months === 3 ? 3 : c.months === 6 ? 5 : 7
  const skill = Math.min(1, (c.months / 9) * 0.65 + tier * 0.12)
  // a scout looks for talent: rank the pool and sample from the top, with the
  // bias sharpening as the trip lengthens and the badge improves. A poor brief
  // still turns up men who had one good afternoon, which is the point.
  const worthOf = (p: Player) => (p.ca - 60) * 1.8 + (p.pa - p.ca) * 1.8 + (30 - p.age) * 0.8
  const ranked = pool
    .map(p => ({ p, worth: worthOf(p) }))
    .sort((a, b) => b.worth - a.worth)
  const finds: ScoutFind[] = []
  const seen = new Set<number>()
  const recs: ScoutRec[] = []
  const bias = 1.8 + skill * 4.5
  for (let i = 0; i < n * 12 && finds.length < n; i++) {
    const idx = Math.min(ranked.length - 1, Math.floor(ranked.length * Math.pow(rng(), bias)))
    const { p } = ranked[idx]
    if (!p || seen.has(p.id)) continue
    seen.add(p.id)
    // real benefit: the men he watched are properly known to you now
    bumpKnowledge(p, 40 + Math.round(skill * 45))
    // HIS VERDICT IS AN OPINION (scoutrecs.ts). It was graded off the man's
    // true ability and ceiling, so every "bring him in" was right. Now it is
    // read off the file he just filled in plus his own judgement, which can
    // miss, by less for a better badge and a longer trip.
    const est = scoutVerdict(state, p, SEARCH_WEEKS[c.months])
    const note = noteFor(est.grade, est.pot - est.cur, rng)
    finds.push({ playerId: p.id, grade: est.grade, note })
    recs.push({ playerId: p.id, ...est, note, season: state.season, week: state.week, src: 'brief', posted: false })
  }
  if (!finds.length) return
  finds.sort((a, b) => b.grade - a.grade)
  state.scoutFinds = finds
  // every name on it is a recommendation with a story of its own to come
  // (scoutDesk); the man at the top is told in the report itself
  for (const r of recs) fileRec(state, { ...r, posted: r.playerId === finds[0].playerId })
  const best = state.players[finds[0].playerId]
  const good = finds.filter(f => f.grade >= 2).length
  // built by noteFor just above, so it is always the object form here
  const note = finds[0].note as NoteRef
  logDecision(state, 'dec.scoutBriefBack', {
    months: c.months, n: finds.length, good, best: best.name,
    names_k: finds.length === 1 ? 'count.nameOne' : 'count.nameMany',
  }, good > 0)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false, tag: 'scout',
    subject: `${man?.name ?? 'The chief scout'} files his report: ${finds.length} names`,
    body: `${c.months} months, ${finds.length} names, ${good} of them he would sign tomorrow. Top of the list: ${best.name}, ${best.age}, ${POS_NAMES[best.pos].toLowerCase()} at ${state.clubs[best.clubId ?? '']?.name ?? 'a club abroad'} - ${tIn('en', note.k, note)} The full report is in the Transfer Centre, and every man on it is now properly known to your recruitment staff.`,
    k: 'news.scoutReport',
    v: {
      ...subjectVar(man?.g), scout: man?.name ?? '', scout_k: man ? 'news.scoutNamed' : 'news.theChiefScout',
      n: finds.length, months: c.months, good,
      names_k: finds.length === 1 ? 'count.nameOne' : 'count.nameMany',
      player: best.name, age: best.age, pos_k: `pos.${best.pos}`,
      club: state.clubs[best.clubId ?? '']?.name ?? '',
      at_k: state.clubs[best.clubId ?? ''] ? 'news.atClub' : 'news.atClubAbroad',
      note_k: note.k, ...note,
    },
    playerIds: finds.slice(0, 6).map(f => f.playerId),
  })
}
