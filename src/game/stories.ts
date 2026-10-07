/**
 * ---- A FEW MEN WITH A STORY (1.8.4) ----
 *
 * The player page listed a man's numbers and nothing of what he had been to
 * the manager: the boy he gave a debut, the record fee, the captain, the man
 * he sold, the promise he kept. All of it was already written down somewhere
 * (the academy stamps, the record book, the memory log, the legends, the
 * career rows); this reads it back as one to three short lines.
 *
 * ONLY THE FEW. A line needs a reason the manager would remember: his own
 * graduate, his record signing, his captain, a club legend, a notable man he
 * sold or let go, an old boy with twenty games for the club, a promise, a
 * transfer request answered, or a hundred appearances. Anybody else has no
 * story, and the page says nothing rather than something generic.
 *
 * Derived on every read from fields that already exist: nothing is stored,
 * nothing draws from an rng, and the same save always tells the same story.
 * Each line carries `why`, so scripts/storyprobe.ts can check it against the
 * fields it was read from.
 */
import type { GameState, Player } from './model'
import { careerRows, fmtMoney, oldBoyApps, seasonLabel } from './model'
import { recall, type MemoryKind } from './memory'
import { service } from './legends'
import { madeBy } from './records'
import type { Vars } from './i18n'

export type StoryWhy = 'grad' | 'record' | 'captain' | 'legend' | 'sold' | 'released' | 'let-go' | 'promise' | 'request' | 'oldboy' | 'service'
export interface StoryLine { why: StoryWhy; k: string; v: Vars }

/** Most lines on one man's page. */
export const STORY_LINES = 3
/** Games for the club before an old boy is one, and before service alone is a story. */
export const OLD_BOY_APPS = 20
export const SERVICE_APPS = 100

/** Appearances for a club from a season on, this season included. */
export function appsSince(p: Player, clubId: string, from: number): number {
  let n = 0
  for (const c of careerRows(p)) if (c.clubId === clubId && c.season >= from) n += c.apps
  return n + (p.clubId === clubId ? p.stats.apps : 0)
}

/** The memory's latest entry of these kinds about him, if any. */
function latest(state: GameState, p: Player, kind: MemoryKind[]) {
  const all = recall(state, { kind, playerId: p.id })
  return all[all.length - 1]
}

/**
 * His story, at most STORY_LINES lines, most telling first. Empty for almost
 * everybody. `made` is madeBy(state), passed in when a caller reads many men.
 */
export function playerStory(state: GameState, p: Player, made: (p: Player) => boolean = madeBy(state)): StoryLine[] {
  const out: StoryLine[] = []
  const uid = state.unemployed ? null : state.userClubId
  const short = (id: string) => state.clubs[id]?.short ?? id
  const add = (why: StoryWhy, k: string, v: Vars) => { if (out.length < STORY_LINES) out.push({ why, k, v }) }

  // his own graduate: where, when, and what has come of it
  if (p.homegrown && p.gradClub && p.gradS != null && made(p)) {
    const n = appsSince(p, p.gradClub, p.gradS)
    const v = { club: short(p.gradClub), season: seasonLabel(p.gradS), n }
    add('grad', (p.caps ?? 0) > 0 ? 'story.gradTest' : n > 0 ? 'story.grad' : 'story.gradNew', v)
  }
  // the most the manager has ever paid
  const rs = state.era?.recordSigning
  if (rs && rs.playerId === p.id && rs.fee > 0) {
    const v = { fee: fmtMoney(rs.fee), season: seasonLabel(rs.season) }
    if (uid && p.clubId === uid) add('record', 'story.record', { ...v, n: appsSince(p, uid, rs.season) })
    else add('record', 'story.recordGone', v)
  }
  // HIS APPEARANCES FOR A CLUB, as the book has them (1.8.4 career QA). A man
  // the career opened with carries his years before it as a lump (p.hist),
  // which service() can only credit while he is still there, so a legend
  // who was sold read "A Gloucester legend: 0 appearances" and "sold after 9
  // appearances" about a man with 160. The legend's own entry keeps the count
  // from his last match for the club, so it is the floor.
  const appsFor = (clubId: string) => Math.max(service(p, clubId).apps,
    (state.hist?.legends ?? []).find(l => l.pid === p.id && l.clubId === clubId)?.apps ?? 0)
  const capt = !!uid && p.clubId === uid && state.clubs[uid]?.captain === p.id
  const legend = (state.hist?.legends ?? []).find(l => l.pid === p.id)
  // HIS CAPTAIN AND HIS LEGEND, ONE LINE (1.8.6): the two lines gave the same
  // count twice in a row ("Your captain: 160 appearances for Northampton. A
  // Northampton legend since 2026-27: 160 appearances for the club.")
  const captLegend = capt && !!legend && legend.clubId === uid && legend.season >= 0
  if (capt && !captLegend) add('captain', 'story.captain', { club: short(uid!), n: service(p, uid!).apps })
  if (legend) {
    const n = appsFor(legend.clubId)
    add('legend', captLegend ? 'story.captainLegend' : legend.season >= 0 ? 'story.legend' : 'story.legendOld', { club: short(legend.clubId), season: seasonLabel(Math.max(0, legend.season)), n })
  }
  // a notable man who left the manager's club, and how
  const dep = latest(state, p, ['sold', 'released', 'let-go'])
  const gone = !!dep && dep.clubId != null && p.clubId !== dep.clubId && (dep.payload?.nb === 1 || dep.sal >= 2)
  if (gone) {
    const from = dep!.clubId!
    const n = Math.max(appsFor(from), Number(dep!.payload?.ap ?? 0) || 0)
    const to = typeof dep!.payload?.to === 'string' ? dep!.payload.to : ''
    const fee = Number(dep!.payload?.fee ?? 0)
    const v = { club: short(from), season: seasonLabel(dep!.season), n }
    if (n > 0) {
      if (dep!.kind === 'sold' && to && fee > 0) add('sold', 'story.sold', { ...v, buyer: short(to), fee: fmtMoney(fee) })
      else if (dep!.kind === 'released') add('released', 'story.released', v)
      else if (dep!.kind === 'let-go') add('let-go', 'story.letGo', v)
    } else if (dep!.kind === 'sold' && to && fee > 0) {
      // SOLD BEFORE HE PLAYED (1.8.5): the boy with a ceiling the manager
      // cashed in on had no line at all, the one a career is asked about
      add('sold', 'story.soldYoung', { ...v, buyer: short(to), fee: fmtMoney(fee) })
    }
  }
  // what he was promised, and whether the word held
  const pr = latest(state, p, ['promise-kept', 'promise-broken'])
  if (pr) {
    const role = recall(state, { kind: 'role-promised', playerId: p.id, sinceSeason: pr.season }).some(e => e.season === pr.season)
    const what = role ? 'role' : String(pr.payload?.what ?? 'plans')
    add('promise', pr.kind === 'promise-kept' ? 'story.promiseKept' : 'story.promiseBroken', {
      season: seasonLabel(pr.season), what_k: `story.what.${['plans', 'minutes', 'deal', 'role', 'start'].includes(what) ? what : 'plans'}`,
    })
  }
  // a transfer request, and the answer
  const rq = latest(state, p, ['request-refused', 'request-granted'])
  if (rq) add('request', rq.kind === 'request-granted' ? 'story.reqGranted' : 'story.reqRefused', { season: seasonLabel(rq.season) })
  // an old boy, when nothing above has said so already
  if (uid && !gone && !legend && p.clubId && p.clubId !== uid) {
    const n = oldBoyApps(p, uid)
    if (n >= OLD_BOY_APPS) add('oldboy', 'story.oldBoy', { club: short(uid), n })
  }
  // and the long servant, when nothing above has given his number
  if (uid && p.clubId === uid && !capt && !legend && !out.some(l => l.why === 'grad' || l.why === 'record')) {
    const n = service(p, uid).apps
    if (n >= SERVICE_APPS) add('service', 'story.service', { club: short(uid), n })
  }
  return out
}
