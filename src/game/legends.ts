/**
 * ---- THE CLUB'S OWN GREATS, AND THE NUMBERS THEY LEAVE ----
 *
 * The game already honours a retiring servant: 100 appearances puts a name in
 * the club's record book (rollover.ts, Club.legends), 150 earns a testimonial
 * and a shirt over the tunnel. What it never did was remember him afterwards,
 * or tell the man coming up behind him whose mark he was chasing.
 *
 * THREE THINGS HERE.
 *
 *   A LEGEND IS CLAIMED WHILE HE IS STILL PLAYING. 150 appearances for the
 *   manager's club, or a club record, and the club says so. He stays in the
 *   book when he leaves, retires, or turns up on the other bench.
 *
 *   RECORDS THAT TALK. The club's all-time appearances, tries and points, and
 *   the league's single-season marks (state.records). When a man in the squad
 *   closes to within a match or two of one, the news names the holder and the
 *   season; when he passes it, the news says whose it was.
 *
 *   A LEGEND COMES BACK. As an opponent (he is in their squad the week you play
 *   them) or, once retired, on their coaching staff: a retired legend goes into
 *   coaching one time in three, at a club in the same league, chosen by a hash
 *   of his name rather than a dice roll, so it never moves the world's rng. The
 *   staff post is the book's own fact; no AI club's real staff is touched.
 *
 * Old boys scoring against you and the payoffs of men you sold belong to the
 * match engine's old-boy lines and to the consequence log (memory.ts); this
 * file only deals in the club's own history and its records.
 */
import type { GameState, Player } from './model'
import { careerRows, seasonLabel } from './model'
import type { Vars } from './i18n'
import { book, file, hashOf, moment, once, type ClubRec, type Legend, type RecStat } from './histbook'

export const LEGEND_APPS = 150
/** how big a record must be before breaking it is news */
const REC_MIN: Record<RecStat, number> = { apps: 60, tries: 15, pts: 150 }
/** how close counts as "within reach" */
const REC_NEAR: Record<RecStat, number> = { apps: 3, tries: 2, pts: 20 }
const STAT_K: Record<RecStat, string> = { apps: 'hist.statApps', tries: 'hist.statTries', pts: 'hist.statPts' }
/** the record's own name, for the annals line */
const REC_K: Record<RecStat, string> = { apps: 'hist.recApps', tries: 'hist.recTries', pts: 'hist.recPts' }

/** What a man has done in this club's shirt, past seasons plus this one. The
 *  pre-2025 estimate counts only for a man who has never played elsewhere,
 *  the same rule rollover.ts uses for the testimonial. */
export function service(p: Player, clubId: string): Record<RecStat, number> {
  let apps = 0, tries = 0, pts = 0
  for (const c of careerRows(p)) if (c.clubId === clubId) { apps += c.apps; tries += c.tries; pts += c.points }
  if (p.clubId === clubId) { apps += p.stats.apps; tries += p.stats.tries; pts += p.stats.points }
  if (careerRows(p).every(c => c.clubId === clubId) && p.clubId === clubId && !p.exClub) {
    apps += Math.max(0, (p.hist?.apps ?? 0) - (p.exApps ?? 0))
    tries += p.hist?.tries ?? 0
    pts += p.hist?.points ?? 0
  }
  return { apps, tries, pts }
}

const recLine = (r: ClubRec): Vars => (r.season < 0
  ? { when_k: 'hist.whenOld' }
  : { when_k: 'hist.whenSeason', season: seasonLabel(r.season) })

/**
 * Read a club in quietly the first time the manager is there: the men already
 * past 150 are legends, the best numbers already on the board are records. No
 * news - a career does not open with ten announcements about the past.
 */
function seed(state: GameState, clubId: string): void {
  const h = book(state)
  if (h.seeded.includes(clubId)) return
  h.seeded.push(clubId)
  const club = state.clubs[clubId]
  if (!club) return
  const recs = (h.recs[clubId] ??= {})
  const offer = (stat: RecStat, r: ClubRec) => {
    const cur = recs[stat]
    if (!cur || r.val > cur.val) recs[stat] = r
  }
  for (const l of club.legends ?? []) {
    offer('apps', { name: l.name, val: l.apps, season: -1 })
    offer('tries', { name: l.name, val: l.tries, season: -1 })
    offer('pts', { name: l.name, val: l.pts, season: -1 })
  }
  for (const id of club.players) {
    const p = state.players[id]
    if (!p || p.youth) continue
    const s = service(p, clubId)
    for (const stat of ['apps', 'tries', 'pts'] as RecStat[]) offer(stat, { name: p.name, pid: p.id, val: s[stat], season: -1 })
    if (s.apps >= LEGEND_APPS && !h.legends.some(l => l.pid === p.id && l.clubId === clubId)) {
      h.legends.push({ pid: p.id, name: p.name, clubId, apps: s.apps, tries: s.tries, pts: s.pts, season: -1 })
    }
  }
  trimLegends(state)
}

function trimLegends(state: GameState): void {
  const h = book(state)
  if (h.legends.length <= 40) return
  // the ones still playing stay; of the rest, the fewest appearances go first,
  // however recently. How long ago a man left does not enter into it: the
  // book keeps its biggest names, and a 400-game man gone twenty years
  // outlasts a 150-game man gone one (1.8.3: this comment used to say the
  // longest-gone went first, which the sort has never done)
  h.legends.sort((a, b) => (a.gone == null ? 0 : 1) - (b.gone == null ? 0 : 1) || b.apps - a.apps)
  h.legends.length = 40
}

function claim(state: GameState, p: Player, clubId: string, s: Record<RecStat, number>, why: 'apps' | 'record'): Legend {
  const h = book(state)
  const l: Legend = { pid: p.id, name: p.name, clubId, apps: s.apps, tries: s.tries, pts: s.pts, season: state.season }
  h.legends.push(l)
  trimLegends(state)
  file(state, why === 'apps' ? 'hist.legendApps' : 'hist.legendRecord',
    { player: p.name, apps: s.apps, n: s.apps, club: state.clubs[clubId]?.short ?? '' }, { type: 'award', playerId: p.id })
  moment(state, clubId, 60, 'hist.anLegend', { player: p.name })
  return l
}

/**
 * After every competitive match of the manager's: legends claimed, club
 * records chased and broken, the league's season marks threatened. Reads the
 * squad and the book; never touches a player.
 */
export function legendsAfterMatch(state: GameState): void {
  const uid = state.userClubId
  const club = state.clubs[uid]
  if (!club || state.unemployed) return
  seed(state, uid)
  const h = book(state)
  const recs = (h.recs[uid] ??= {})
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.youth)
  // a record the book has never held is read in quietly from the best in the
  // squad, never "broken" one man at a time in squad order
  for (const stat of ['apps', 'tries', 'pts'] as RecStat[]) {
    if (recs[stat]) continue
    let best: ClubRec | null = null
    for (const p of squad) {
      const val = service(p, uid)[stat]
      if (val > 0 && (!best || val > best.val)) best = { name: p.name, pid: p.id, val, season: -1 }
    }
    if (best) recs[stat] = best
  }

  for (const p of squad) {
    const s = service(p, uid)
    let mine = h.legends.find(l => l.pid === p.id && l.clubId === uid)
    if (mine) { mine.apps = s.apps; mine.tries = s.tries; mine.pts = s.pts }

    for (const stat of ['apps', 'tries', 'pts'] as RecStat[]) {
      const rec = recs[stat]
      const val = s[stat]
      if (!rec) { if (val > 0) recs[stat] = { name: p.name, pid: p.id, val, season: state.season }; continue }
      if (rec.pid === p.id) { rec.val = Math.max(rec.val, val); continue }
      if (val > rec.val) {
        if (rec.val >= REC_MIN[stat] && once(state, `rb:${uid}:${stat}`)) {
          file(state, 'hist.recBroken', {
            player: p.name, stat_k: STAT_K[stat], n: val, old: rec.name, oldN: rec.val, ...recLine(rec),
          }, { type: 'award', playerId: p.id })
          moment(state, uid, 65, 'hist.anRecord', { player: p.name, rec_k: REC_K[stat] })
          if (!mine) mine = claim(state, p, uid, s, 'record')
        }
        recs[stat] = { name: p.name, pid: p.id, val, season: state.season }
      } else if (rec.val >= REC_MIN[stat] && rec.val - val <= REC_NEAR[stat] && val > 0
          && once(state, `rn:${uid}:${stat}:${p.id}`)) {
        file(state, 'hist.recNear', {
          player: p.name, stat_k: STAT_K[stat], n: rec.val - val, old: rec.name, oldN: rec.val, ...recLine(rec),
        }, { playerId: p.id })
      }
    }
    if (!mine && s.apps >= LEGEND_APPS) claim(state, p, uid, s, 'apps')
  }

  // the league's single-season marks (state.records, settled each summer by
  // rollover.ts): this season's chase, named against the holder
  const lrec = state.records?.[club.leagueId]
  const comp = state.comps[club.leagueId]
  if (lrec && comp) {
    const LEAGUE: [('pts' | 'tries'), number, string, string][] = [['pts', 25, 'hist.statPts', 'hist.recPts'], ['tries', 2, 'hist.statTries', 'hist.recTries']]
    for (const [stat, near, statK, recK] of LEAGUE) {
      const rec = lrec[stat]
      if (!rec || rec.season === state.season || rec.val < (stat === 'pts' ? 120 : 10)) continue
      for (const p of squad) {
        const val = stat === 'pts' ? p.stats.points : p.stats.tries
        if (val > rec.val) {
          if (once(state, `lb:${club.leagueId}:${stat}`)) {
            file(state, 'hist.lgRecBroken', {
              player: p.name, comp: comp.short, stat_k: statK, n: val, old: rec.name, oldN: rec.val, season: seasonLabel(rec.season),
            }, { type: 'award', playerId: p.id })
            moment(state, uid, 62, 'hist.anLgRecord', { player: p.name, comp: comp.short, rec_k: recK })
          }
        } else if (rec.val - val <= near && val > 0 && once(state, `ln:${club.leagueId}:${stat}`)) {
          file(state, 'hist.lgRecNear', {
            player: p.name, comp: comp.short, stat_k: statK, n: rec.val - val, old: rec.name, oldN: rec.val, season: seasonLabel(rec.season),
          }, { playerId: p.id })
        }
      }
    }
  }
}

/**
 * The summer: who has gone. A legend no longer in the world has retired; one
 * at another club has moved on. A retired legend may take a coaching post -
 * one in three, by his name's hash, at a club in the league he served in.
 */
export function legendsYearEnd(state: GameState): void {
  const h = book(state)
  for (const l of h.legends) {
    if (l.gone != null) continue
    const p = state.players[l.pid]
    if (p && p.clubId === l.clubId) continue
    l.gone = state.season
    if (!p) {
      l.retired = true
      const home = state.clubs[l.clubId]
      const hash = hashOf(l.name)
      if (home && hash % 3 === 0) {
        const pool = Object.keys(state.clubs)
          .filter(id => id !== l.clubId && state.clubs[id].leagueId === home.leagueId).sort()
        if (pool.length) l.staffAt = pool[(hash >>> 3) % pool.length]
      }
      if (l.clubId === state.userClubId && !state.unemployed) {
        moment(state, l.clubId, 80, 'hist.anFarewell', { player: l.name, apps: l.apps, n: l.apps })
      }
    }
  }
}

/** Legends of the manager's club who will be on the other side this week. */
export function legendsFacing(state: GameState, oppId: string): { l: Legend; as: 'player' | 'coach' }[] {
  const uid = state.userClubId
  const opp = state.clubs[oppId]
  if (!opp) return []
  const out: { l: Legend; as: 'player' | 'coach' }[] = []
  for (const l of state.hist?.legends ?? []) {
    if (l.clubId !== uid || l.gone == null) continue
    if (!l.retired && state.players[l.pid]?.clubId === oppId) out.push({ l, as: 'player' })
    else if (l.retired && l.staffAt === oppId) out.push({ l, as: 'coach' })
  }
  return out
}
