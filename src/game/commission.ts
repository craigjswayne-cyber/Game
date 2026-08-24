// Commissioned scouting (8-batch feedback): send your chief scout out on a
// 3, 6 or 9-month brief. He comes back with a shortlist of mixed quality - the
// longer the trip and the better his badge, the more of it is worth signing.
import { POS_NAMES, fmtMoney, logDecision, type GameState, type Player, type Pos } from './model'
import { tIn } from './i18n'
import { mulberry32 } from './rng'
import { bumpKnowledge } from './scout'
import { BADGE } from './staff'

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
}

/** The scout's line, stored as a key and its fragments rather than a sentence:
 *  it sits in the save and is read on the Transfer Centre for weeks. */
export interface NoteRef {
  k: string
  open_k: string
  body_k: string
  grade_k: string
  growth_k: string
  /** so it can be passed straight to t() as its own variables */
  [x: string]: string
}

export interface ScoutFind {
  playerId: number
  /** the scout's verdict, 0 (a punt) to 3 (bring him in) */
  grade: number
  /** a string on saves written before the note became a key */
  note: NoteRef | string
}

const GRADE_WORD = ['a punt', 'worth watching', 'a good fit', 'sign him']

/** Send the scout out. Returns the line to show the manager. */
export function commissionScout(state: GameState, pos: Pos | 'any', months: SearchMonths): string {
  const club = state.clubs[state.userClubId]
  const tier = state.staff.scout ?? 0
  const man = state.staffPeople?.scout
  // only the three briefs on offer, and only positions that exist: a stale
  // screen or a hand-edited save must not book a trip of NaN weeks
  if (!SEARCH_WEEKS[months]) return 'The scout takes a three, six or nine-month brief, nothing else.'
  if (pos !== 'any' && (!Object.prototype.hasOwnProperty.call(POS_NAMES, pos) || typeof POS_NAMES[pos] !== 'string')) {
    return 'That is not a position anyone plays.'
  }
  if (!club) return 'You have no club to scout for.'
  if (tier <= 0 || !man) return 'You have no chief scout to send. Appoint one from Training & Coaching first.'
  if (state.commission) {
    const left = Math.max(1, state.commission.done - (state.season * 100 + state.week))
    return `${man.name} is already out on a brief. He reports back in about ${left} week${left === 1 ? '' : 's'}.`
  }
  const fee = searchFee(months, tier)
  if (club.balance < fee) return `A ${months}-month brief costs ${fmtMoney(fee)} in expenses and the money is not there.`
  club.balance -= fee
  const abs = state.season * 100 + state.week
  state.commission = { pos, months, done: abs + SEARCH_WEEKS[months], fee, leagueId: state.scoutFocus ?? null }
  const where = state.commission.leagueId ? state.comps[state.commission.leagueId]?.short ?? 'the focus league' : 'wherever the game is played'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false, tag: 'scout',
    subject: `🔭 ${man.name} sent out on a ${months}-month brief`,
    body: `${fmtMoney(fee)} of expenses, a hire car and a brief: ${pos === 'any' ? 'anyone who can play' : POS_NAMES[pos].toLowerCase()}, in ${where}. ${man.name} (${BADGE[tier].toLowerCase()} badge) files his report in ${SEARCH_WEEKS[months]} weeks. A longer trip sees more rugby and less of it in the rain.`,
    k: 'news.briefSent',
    v: {
      scout: man.name, months, fee: fmtMoney(fee), where,
      brief_k: pos === 'any' ? 'news.briefAnyone' : `pos.${pos}`,
      badge_k: `staff.badge${tier}`, n: SEARCH_WEEKS[months],
    },
  })
  logDecision(state, `Sent ${man.name} out on a ${months}-month brief: ${fmtMoney(fee)} of expenses, report in ${SEARCH_WEEKS[months]} weeks.`)
  return `${man.name} is on the road. ${fmtMoney(fee)} spent, report in ${SEARCH_WEEKS[months]} weeks.`
}

/**
 * ---- POSTCARDS FROM THE ROAD ----
 *
 * A nine-month brief used to be thirty-nine weeks of silence and then a report,
 * which is a long time to hear nothing about money you have already spent (user:
 * "when a scout goes on the road - they should drip feed their finds and
 * suggestions. they should come into the inbox").
 *
 * Every fourth week he writes in with one name he has been watching, and that
 * man becomes properly scouted there and then - so a postcard is worth something
 * beyond the reading. He never sends the same name twice, and the final report
 * still lands at the end with the graded shortlist.
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
  // week 4, 8, 12 ... of the trip, and never in its last fortnight - the report
  // itself is the news by then
  const weeksIn = SEARCH_WEEKS[c.months] - (c.done - abs)
  if (weeksIn <= 0 || weeksIn % 4 !== 0) return
  if (c.done - abs <= 2) return
  const man = state.staffPeople?.scout
  if (!man) return
  const tier = state.staff.scout ?? 1
  const rng = mulberry32((state.seed ^ Math.imul(abs, 40503) ^ (c.months * 104729)) >>> 0)
  const pool = Object.values(state.players).filter(p =>
    p.clubId && p.clubId !== state.userClubId && !p.acad && p.age <= 32 &&
    (c.pos === 'any' || p.pos === c.pos || p.alt.includes(c.pos)) &&
    (!c.leagueId || state.clubs[p.clubId]?.leagueId === c.leagueId) &&
    !(c.sent ?? []).includes(p.id))
  if (!pool.length) return
  const worthOf = (p: Player) => (p.ca - 60) * 1.8 + (p.pa - p.ca) * 1.8 + (30 - p.age) * 0.8
  const ranked = pool.map(p => ({ p, worth: worthOf(p) })).sort((a, b) => b.worth - a.worth)
  const bias = 1.6 + tier * 0.6
  const pick = ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * Math.pow(rng(), bias)))]
  if (!pick) return
  const p = pick.p
  c.sent = [...(c.sent ?? []), p.id]
  // the real payoff: a man he has watched in person is a man you know about
  bumpKnowledge(p, 26 + tier * 6)
  const club = state.clubs[p.clubId ?? '']
  const keen = pick.worth >= 40
  const weeksLeft = c.done - abs
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false, tag: 'scout',
    subject: `🔭 Word from ${man.name}: ${p.name}`,
    body: `${weeksIn} weeks into the brief. "${keen
      ? `Watched ${p.name} twice now and I would put my name to him. ${p.age}, ${POS_NAMES[p.pos].toLowerCase()} at ${club?.name ?? 'a club abroad'}, and he does the things you cannot teach.`
      : `${p.name} is worth a mention. ${p.age}, ${POS_NAMES[p.pos].toLowerCase()} at ${club?.name ?? 'a club abroad'}. Not the answer on his own, but I would not rule him out.`}`
      + ` I will keep looking - about ${weeksLeft} week${weeksLeft === 1 ? '' : 's'} until I write it all up."\n\n`
      + `He is properly scouted now, so his page shows what he actually is rather than a range.`,
    k: 'news.postcard',
    v: {
      scout: man.name, player: p.name, weeksIn, n: weeksLeft,
      verdict_k: keen ? 'news.postcardKeen' : 'news.postcardMaybe',
      age: p.age, pos_k: `pos.${p.pos}`, club: club?.name ?? tIn('en', 'news.aClubAbroad'),
    },
    playerId: p.id,
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
  const bias = 1.8 + skill * 4.5
  for (let i = 0; i < n * 12 && finds.length < n; i++) {
    const idx = Math.min(ranked.length - 1, Math.floor(ranked.length * Math.pow(rng(), bias)))
    const { p, worth } = ranked[idx]
    if (!p || seen.has(p.id)) continue
    seen.add(p.id)
    const grade = worth >= 52 ? 3 : worth >= 34 ? 2 : worth >= 16 ? 1 : 0
    finds.push({ playerId: p.id, grade, note: noteFor(p, grade, p.pa - p.ca, rng) })
    // real benefit: the men he watched are properly known to you now
    bumpKnowledge(p, 40 + Math.round(skill * 45))
  }
  if (!finds.length) return
  finds.sort((a, b) => b.grade - a.grade)
  state.scoutFinds = finds
  const best = state.players[finds[0].playerId]
  const good = finds.filter(f => f.grade >= 2).length
  // built by noteFor just above, so it is always the object form here
  const note = finds[0].note as NoteRef
  logDecision(state, `The ${c.months}-month brief came back with ${finds.length} names, ${good} of them worth signing. Best: ${best.name}.`, good > 0)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false, tag: 'scout',
    subject: `🔭 ${man?.name ?? 'The chief scout'} files his report: ${finds.length} names`,
    body: `${c.months} months, ${finds.length} names, ${good} of them he would sign tomorrow. Top of the list: ${best.name}, ${best.age}, ${POS_NAMES[best.pos].toLowerCase()} at ${state.clubs[best.clubId ?? '']?.name ?? 'a club abroad'} - ${tIn('en', note.k, note)} The full report is in the Transfer Centre, and every man on it is now properly known to your recruitment staff.`,
    k: 'news.scoutReport',
    v: {
      scout: man?.name ?? tIn('en', 'news.theChiefScout'), n: finds.length, months: c.months, good,
      player: best.name, age: best.age, pos_k: `pos.${best.pos}`,
      club: state.clubs[best.clubId ?? '']?.name ?? tIn('en', 'news.aClubAbroad'),
      note_k: note.k, ...note,
    },
    playerIds: finds.slice(0, 6).map(f => f.playerId),
  })
}

/** The scout's line on one man, as a key and its variables.
 *
 *  STORED in state.scoutFinds and read on the Transfer Centre for weeks
 *  afterwards, so it cannot be prose: it would be the scout speaking English
 *  inside a French report. The three-way pick stays deterministic on the same
 *  rng draws it always took. */
function noteFor(p: Player, grade: number, upside: number, rng: () => number): NoteRef {
  const openers = ['news.noteOpen1', 'news.noteOpen2', 'news.noteOpen3']
  const bodies = grade >= 3 ? ['news.noteA1', 'news.noteA2', 'news.noteA3']
    : grade === 2 ? ['news.noteB1', 'news.noteB2', 'news.noteB3']
    : grade === 1 ? ['news.noteC1', 'news.noteC2', 'news.noteC3']
    : ['news.noteD1', 'news.noteD2', 'news.noteD3']
  const open_k = openers[Math.floor(rng() * 3)]
  const body_k = bodies[Math.floor(rng() * bodies.length)]
  void p
  return {
    k: 'news.scoutNote', open_k, body_k,
    grade_k: `news.grade${grade}`,
    growth_k: upside >= 12 ? 'news.notePlenty' : upside >= 6 ? 'news.noteSome' : 'common.nothing',
  }
}
