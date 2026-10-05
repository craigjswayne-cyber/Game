/**
 * ---- WHAT YOU ARE KNOWN FOR ----
 *
 * Two reputations, both earned and neither chosen.
 *
 * THE MANAGER'S. Every summer a row of what the season actually was is
 * written down (Conduct: the finish, the rugby played, the minutes given to
 * the academy, the fees paid, the hard calls and the kind ones), and the
 * traits are read from the last eight of those rows. Nothing is stored about
 * the traits themselves except which ones have already been announced, so a
 * trait comes and goes with the behaviour behind it:
 *
 *   youth         academy debuts and homegrown minutes, season after season
 *                 (and it says young backs or young forwards when the debuts
 *                 lean one way, and internationals when they became them)
 *   innovator     many ideas of rugby in one season, and winning with them
 *   spender       fees paid well beyond the wage bill, year on year
 *   seller        fees taken well beyond the wage bill and well beyond what
 *                 was spent: the manager who sells his best men on (1.8.5
 *                 career QA: a career that sold 38 internationals for 89
 *                 million read the same as one that sold nobody)
 *   hard          the calls that cost a player something: requests refused,
 *                 seniors dropped, staff let go, incidents confronted
 *   players       promises kept and requests granted, few broken, a happy room
 *   turnaround    clubs taken over in trouble and turned round
 *   defence       sides that concede well under their league's average
 *   attack        sides that score well over it
 *
 * Shown as a line of plain sentences on the manager's profile and cited by the
 * clubs that offer him work. No numbers anywhere. Which way each is moving
 * (mgrTrends) is a line under it. The top trait gives a small lift at a club
 * whose job it fits (jobs.ts jobFit), and the chairman reads the season's row
 * in May (chairman.ts boardMethod).
 *
 * THE CLUB'S. identity.ts forms and fades labels as the club is run. A label
 * held four summers running hardens into the club's REPUTATION ("A club built
 * on youth"), which outlasts a season or two without it and fades after
 * three. It gives players whose profile fits a little more reason to listen
 * (identity.ts identityInterestLift), which only ever touches the manager's
 * own recruitment. AI clubs never read any of this.
 */
import type { GameState, Player } from './model'
import { leagueTier } from './model'
import { sortTable } from './schedule'
import { isForward } from './bench'
import { recall } from './memory'
import { tendencyProfile } from './tendency'
import { identityOf } from './identity'
import { ARC_CAPS, ARC_OFF, arcFile, arcOf, type Conduct } from './arcbook'

export type Trait = 'youth' | 'youthBacks' | 'youthPack' | 'youthIntl' | 'innovator' | 'spender' | 'seller' | 'hard' | 'players' |
  'turnaround' | 'defence' | 'attack'

/** Seasons read for the traits, and the fewest before any can show. */
const WINDOW = 8
const MIN_SEASONS = 2
/** a label held this many summers running becomes the club's reputation */
export const REPUTE_AT = 4
/** and a reputation unheld this many summers fades */
const REPUTE_FADE = 3

// ---------------------------------------------------------------- conduct ---

/** The kind of rugby played this week, for the innovator's read (arc.ts). */
export function notePattern(state: GameState): void {
  const cur = state.arc?.cur
  if (!cur || cur.c !== state.userClubId) return
  const p = tendencyProfile(state)?.pattern
  if (!p) return
  cur.pats ??= []
  if (!cur.pats.includes(p)) cur.pats.push(p)
}

/** The season's conduct row, from facts that are still standing at the
 *  rollover. Pure apart from reading the memory. */
export function conductRow(state: GameState): Conduct | null {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return null
  const uid = club.id
  const mine = state.fixtures.filter(f => f.played && f.compId !== 'fr' && (f.homeId === uid || f.awayId === uid))
  let w = 0, d = 0, l = 0, pf = 0, pa = 0
  for (const f of mine) {
    const us = f.homeId === uid ? f.homeScore : f.awayScore
    const them = f.homeId === uid ? f.awayScore : f.homeScore
    pf += us; pa += them
    if (us > them) w++; else if (us < them) l++; else d++
  }
  const lgFx = state.fixtures.filter(f => f.played && f.compId === club.leagueId)
  const lg = lgFx.length ? lgFx.reduce((s, f) => s + f.homeScore + f.awayScore, 0) / (lgFx.length * 2) : 0
  const comp = state.comps[club.leagueId]
  const table = comp?.table ?? []
  const pos = table.length ? sortTable(table).findIndex(r => r.teamId === uid) + 1 : 0
  const seniors = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.acad)
  let tot = 0, hg = 0, mor = 0, wages = 0
  for (const p of seniors) { tot += p.stats.apps; if (p.homegrown) hg += p.stats.apps; mor += p.morale; wages += p.wage }
  const since = { sinceSeason: state.season }
  const deb = recall(state, { kind: 'academy-debut', clubId: uid, ...since }).length
  // a senior left out is one hard call a season, however many weeks it runs:
  // the bonds ledger notes every match he misses, and a rotation that sat the
  // same voice twelve times read as twelve calls (1.8.5 career QA: a manager
  // pressing the auto-pick every week was "known as a disciplinarian")
  const dropped = new Set(recall(state, { kind: 'senior-dropped', ...since }).map(e => e.playerId ?? -1)).size
  const hard = recall(state, { kind: ['request-refused', 'staff-sacked'], ...since }).length + dropped +
    // a fine is a hard call, landed or challenged; a quiet word is not, though it
    // leaves the incident 'handled' too (1.8.4 career QA: a manager who only
    // ever had a word was "known as a disciplinarian")
    (state.incidents ?? []).filter(i => i.season === state.season && (i.fined || i.state === 'challenged')).length
  const kind = recall(state, { kind: ['promise-kept', 'request-granted'], ...since }).length
  const broke = recall(state, { kind: 'promise-broken', ...since }).length
  const books = state.books && state.books.clubId === uid ? state.books : null
  const m = mine.length
  return {
    s: state.season, c: uid, tier: leagueTier(club.leagueId), pos, n: table.length,
    m, w, d, l,
    pf: m ? Math.round((pf / m) * 10) / 10 : 0, pa: m ? Math.round((pa / m) * 10) / 10 : 0, lg: Math.round(lg * 10) / 10,
    deb, hg: tot ? Math.round((hg / tot) * 100) : 0,
    buy: Math.max(0, -(books?.lines.buys ?? 0)), wages: wages * 52,
    sell: Math.max(0, books?.lines.sales ?? 0),
    hard, kind, broke,
    mor: seniors.length ? Math.round((mor / seniors.length) * 10) / 10 : 0,
    pats: state.arc?.cur?.c === uid ? (state.arc.cur.pats?.length ?? 0) : 0,
  }
}

// ----------------------------------------------------------------- traits ---

/**
 * The manager's traits, strongest first. Pure: read from the conduct rows,
 * the clubs turned round and the academy men who became internationals.
 */
export function mgrTraits(state: GameState): { id: Trait; n?: number }[] {
  if (ARC_OFF.on) return []
  const rows = (state.arc?.conduct ?? []).slice(-WINDOW)
  return readTraits(state, rows, state.arc?.turned.length ?? 0)
    .sort((a, b) => b.w - a.w).slice(0, 3).map(({ id, n }) => ({ id, n }))
}

/** Every trait the rows show, with its strength. Unsorted. */
function readTraits(state: GameState, rows: Conduct[], turned: number): { id: Trait; n?: number; w: number }[] {
  const out: { id: Trait; n?: number; w: number }[] = []
  if (turned > 0) out.push({ id: 'turnaround', n: turned, w: 60 + turned * 10 })
  if (rows.length < MIN_SEASONS) return out
  const avg = (f: (r: Conduct) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length
  const played = rows.filter(r => r.m > 0)
  const avgP = (f: (r: Conduct) => number) => played.length ? played.reduce((s, r) => s + f(r), 0) / played.length : 0

  // youth: debuts and homegrown minutes, and what the debutants became
  const deb = avg(r => r.deb), hg = avg(r => r.hg)
  if (deb >= 1.5 && hg >= 22) {
    const grads = gradsOf(state)
    const intl = grads.filter(p => (p.caps ?? 0) > 0).length
    const backs = grads.filter(p => !isForward(p.pos)).length
    const fwd = grads.length - backs
    const id: Trait = intl >= 2 ? 'youthIntl'
      : grads.length >= 4 && backs >= grads.length * 0.7 ? 'youthBacks'
      : grads.length >= 4 && fwd >= grads.length * 0.7 ? 'youthPack'
      : 'youth'
    out.push({ id, n: intl, w: 40 + deb * 8 + hg / 2 })
  }
  // innovator: several ideas of rugby a season, and winning with them
  const pats = avg(r => r.pats), winRate = avgP(r => r.w / Math.max(1, r.m))
  if (pats >= 3 && winRate >= 0.5) out.push({ id: 'innovator', w: 30 + pats * 8 + winRate * 20 })
  // spender: fees well beyond the wage bill
  const spend = avg(r => (r.wages > 0 ? r.buy / r.wages : 0))
  if (spend >= 0.45) out.push({ id: 'spender', w: 30 + spend * 30 })
  // seller: fees taken well beyond the wage bill, and twice what was spent
  const sold = avg(r => (r.wages > 0 ? (r.sell ?? 0) / r.wages : 0))
  if (sold >= 0.6 && sold >= spend * 2) out.push({ id: 'seller', w: 30 + sold * 20 })
  // the hard calls and the kind ones
  const hard = avg(r => r.hard), kind = avg(r => r.kind), broke = avg(r => r.broke), mor = avgP(r => r.mor)
  if (hard >= 3 && hard >= kind * 1.5) out.push({ id: 'hard', w: 25 + hard * 5 })
  if (kind >= 2 && broke <= 0.5 && mor >= 6.5 && kind >= hard) out.push({ id: 'players', w: 25 + kind * 5 + mor })
  // defence and attack, against the league's own average
  const lgAvg = avgP(r => r.lg)
  if (lgAvg > 0 && played.length >= MIN_SEASONS) {
    const pa = avgP(r => r.pa) / lgAvg, pf = avgP(r => r.pf) / lgAvg
    if (pa <= 0.82) out.push({ id: 'defence', w: 30 + (1 - pa) * 100 })
    if (pf >= 1.18) out.push({ id: 'attack', w: 30 + (pf - 1) * 100 })
  }
  return out
}

/**
 * ---- WHERE THE NAME IS GOING ----
 *
 * The traits say what the manager is known for; this says which way it is
 * moving. The same reading is taken twice, over the rows as they stand and
 * over the rows as they stood TREND_GAP seasons ago, and the two compared: a
 * trait that was not there then is forming, one clearly stronger is growing,
 * one that was there and has gone is fading. Nothing is stored, so change the
 * conduct and the line changes with it.
 *
 * The youth variants are one family here (the variant reads today's
 * graduates, which a past reading cannot see). A club turned round carries no
 * date, so the past reading counts only the clubs he had already left.
 */
export const TREND_GAP = 3
/** how much stronger a trait must read now than then to be growing */
const TREND_RISE = 1.12
export type TraitFamily = 'youth' | Exclude<Trait, 'youthBacks' | 'youthPack' | 'youthIntl'>
export type Trend = { id: TraitFamily; dir: 'new' | 'rise' | 'fade'; now: number; then: number }

const familyOf = (id: Trait): TraitFamily => id.startsWith('youth') ? 'youth' : id as TraitFamily

/** Each trait's movement, strongest first. Pure. */
export function mgrTrends(state: GameState): Trend[] {
  if (ARC_OFF.on || !state.arc) return []
  const all = state.arc.conduct ?? []
  const last = all.length ? all[all.length - 1].s : state.season
  const thenRows = all.filter(r => r.s <= last - TREND_GAP)
  // When the club was turned (turnedAt, 1.8.4), or failing a date, a club
  // he has already left. Without the date the club he is still at never
  // aged into the past reading, and "you are developing a reputation for
  // turning clubs round" read every summer of a long stay (1.8.4 career QA:
  // six seasons running at Esher)
  const turnedThen = state.arc.turned.filter(c => {
    const when = state.arc!.turnedAt?.[c]
    if (when != null) return when <= last - TREND_GAP
    const at = all.filter(r => r.c === c)
    return at.length > 0 && at.every(r => r.s <= last - TREND_GAP)
  }).length
  const read = (rows: Conduct[], turned: number) => {
    const m = new Map<TraitFamily, number>()
    for (const tr of readTraits(state, rows.slice(-WINDOW), turned)) m.set(familyOf(tr.id), Math.max(m.get(familyOf(tr.id)) ?? 0, tr.w))
    return m
  }
  const now = read(all, state.arc.turned.length), then = read(thenRows, turnedThen)
  const out: Trend[] = []
  for (const [id, w] of now) {
    const was = then.get(id)
    if (was == null) out.push({ id, dir: 'new', now: w, then: 0 })
    else if (w >= was * TREND_RISE) out.push({ id, dir: 'rise', now: w, then: was })
  }
  for (const [id, was] of then) if (!now.has(id)) out.push({ id, dir: 'fade', now: 0, then: was })
  return out.sort((a, b) => Math.max(b.now, b.then) - Math.max(a.now, a.then))
}

/** At most two lines for the profile: the strongest movement up, and a fade. */
export function trendLines(state: GameState): { k: string; trait_k: string }[] {
  const ts = mgrTrends(state)
  const up = ts.find(x => x.dir !== 'fade'), down = ts.find(x => x.dir === 'fade')
  return [up, down].filter((x): x is Trend => !!x).map(x => ({ k: `arc.trend.${x.dir}`, trait_k: `arc.trait.${x.id}` }))
}

/** Academy players the manager's jobs gave a debut, as they are now. */
function gradsOf(state: GameState): Player[] {
  const ids = new Set<number>()
  for (const e of recall(state, { kind: 'academy-debut' })) if (e.playerId != null) ids.add(e.playerId)
  for (const id of state.arc?.cur?.grads ?? []) ids.add(id)
  return [...ids].map(id => state.players[id]).filter((p): p is Player => !!p)
}

/** A trait as the sentence a club or a profile would say it. */
export function traitLine(tr: { id: Trait; n?: number }): { k: string; v?: { n: number } } {
  return tr.id === 'turnaround' || tr.id === 'youthIntl' ? { k: `arc.cite.${tr.id}`, v: { n: tr.n ?? 1 } } : { k: `arc.cite.${tr.id}` }
}

/** The year end: new traits are announced once, in the papers. */
export function announceTraits(state: GameState): void {
  if (ARC_OFF.on || state.unemployed) return
  const a = arcOf(state)
  for (const tr of mgrTraits(state)) {
    const key = tr.id === 'turnaround' ? `turnaround${tr.n ?? 1}` : tr.id
    if (a.told.includes(key)) continue
    a.told.push(key)
    if (a.told.length > ARC_CAPS.told) a.told.splice(0, a.told.length - ARC_CAPS.told)
    const line = traitLine(tr)
    arcFile(state, 'arc.traitNews', { trait_k: line.k, n: line.v?.n ?? 0 }, { type: 'gossip', summer: true })
    break // one a summer: a reputation is noticed, not published
  }
}

// ----------------------------------------------------- the club's repute ---

/** The year end: the club's labels are counted, and a long one sticks. */
export function reputeYearEnd(state: GameState): void {
  if (ARC_OFF.on || state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const a = arcOf(state)
  if (a.idc !== club.id) { a.idc = club.id; a.idRun = {} }
  const held = identityOf(state).labels
  for (const l of Object.keys(a.idRun)) if (!held.includes(l as never)) a.idRun[l] = 0
  for (const l of held) a.idRun[l] = (a.idRun[l] ?? 0) + 1
  const rep = a.repute && a.repute.c === club.id ? a.repute : null
  if (rep) {
    rep.miss = held.includes(rep.l as never) ? 0 : rep.miss + 1
    if (rep.miss >= REPUTE_FADE) {
      delete a.repute
      arcFile(state, 'arc.reputeFades', { club: club.short, label_k: `arc.repute.${rep.l}` }, { summer: true })
    }
    return
  }
  const best = Object.entries(a.idRun).filter(([, n]) => n >= REPUTE_AT).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]
  if (!best) return
  a.repute = { c: club.id, l: best[0], s: state.season, miss: 0 }
  arcFile(state, 'arc.reputeForms', { club: club.short, label_k: `arc.repute.${best[0]}` }, { summer: true })
}

/** The club's reputation, if its identity has hardened into one. */
export function clubRepute(state: GameState): string | null {
  if (ARC_OFF.on || state.unemployed) return null
  const r = state.arc?.repute
  return r && r.c === state.userClubId ? r.l : null
}
