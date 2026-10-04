/**
 * ---- WHAT THE PLAYER SEES OF THE WORLD'S MEMORY (1.8.5 release audit) ----
 *
 * memoryprobe holds that the log records and the payoffs fire; storyprobe
 * that a man's page is backed. This one plays whole careers as a manager
 * who makes the calls a career is remembered for (sells his young lads,
 * buys stars, promotes from the academy, makes promises and breaks some,
 * changes job, meets his rival, wins and loses finals) and asks, at the
 * moment each memorable thing happens, whether the game said so where the
 * player was looking:
 *
 *   before the match   the opposition report, the desk's thread, the match
 *                      billing, the Old Boys card on the preview
 *   during             the commentary
 *   after              the full-time card's line, the news
 *
 * and counts, by kind, moments against moments surfaced. Then it holds:
 *
 *   1. A man you sold, released or let go is NAMED as yours before you meet
 *      him, every time, with what he has done since (the report and the
 *      Old Boys card); one who decides the match against you is said so at
 *      full time.
 *   2. ORDINARY MEN STAY QUIET: a squad man of no note who left is not on the
 *      report, and no man the manager never touched has a line.
 *   3. NOTHING NAGS: no desk line or news headline is shown in most weeks of
 *      a season; the wage line says itself and then only when it changes.
 *   4. Every surfaced line reads as a sentence in all six languages.
 *
 * Run: npx vite-node scripts/memoryauditprobe.ts   (SEASONS=n, CAREERS=n)
 */
import { newGame } from '../src/game/newgame'
import { matchRng, processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { beginMatch, forfeitSide, lineupFor, playHalf, settleForfeit } from '../src/game/matchEngine'
import { fileFindings } from '../src/game/matchfindings'
import { fileEvidence } from '../src/game/evidence'
import { executeTransfer } from '../src/game/ai'
import { playerWage } from '../src/game/attributes'
import { answerJobOffer } from '../src/game/jobs'
import { seasonLabel, oldBoyApps, type GameState, type Player, type Fixture } from '../src/game/model'
import { formerDecided, formerFacing, recall } from '../src/game/memory'
import { buildReport } from '../src/game/oppreport'
import { buildDesk, deskText } from '../src/game/desk'
import { matchStakes } from '../src/game/stakes'
import { rivalCoach } from '../src/game/rivalcoach'
import { formerTenure } from '../src/game/history'
import { legendsFacing, service } from '../src/game/legends'
import { madeBy } from '../src/game/records'
import { playerStory } from '../src/game/stories'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'

const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
for (const l of LANGS) await ensureLang(l)

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const SEASONS = Number(process.env.SEASONS ?? 9)
const CAREERS = Number(process.env.CAREERS ?? 3)
const say = (k: string, v: Record<string, string | number> = {}) => tIn('en', k, v)
const t0 = Date.now()

// the surfaces (1.8.5); AUDIT=1 reads the game as it was before them
const BEFORE = process.env.AUDIT === '1'
const formerOf = BEFORE ? undefined : formerFacing
const decidedBy = BEFORE ? undefined : formerDecided

type Kind = 'meetFormer' | 'meetMinor' | 'meetOrdinary' | 'formerScores' | 'formerDecides' | 'formerStar' | 'acadCapped'
  | 'promiseBroken' | 'promiseReturns' | 'rivalMeet' | 'oldClub' | 'legendBack' | 'badTermsMeet'
interface Tally { n: number; pre: number; during: number; after: number; any: number; ex: string[]; ft?: number }
const tally: Record<string, Tally> = {}
const T = (k: Kind) => (tally[k] ??= { n: 0, pre: 0, during: 0, after: 0, any: 0, ex: [] })
function moment(k: Kind, pre: boolean, during: boolean, after: boolean, ex?: string) {
  const x = T(k)
  x.n++
  if (pre) x.pre++
  if (during) x.during++
  if (after) x.after++
  if (pre || during || after) x.any++
  if (ex && x.ex.length < 3) x.ex.push(ex)
}

/** the repetition ledger: line -> weeks it was on show, per career */
const deskWeeks = new Map<string, number>()
const newsWeeks = new Map<string, number>()
let weeksSeen = 0
const ordinaryLeaks: string[] = []
const rawLeaks: string[] = []
const samples: string[] = []
const misses: string[] = []

interface Ledger { sold: Map<number, { season: number; young: boolean; bad: boolean; ordinary: boolean; caps: number; minor: boolean }>; promoted: Set<number>; capped: Set<number>; star: Set<number> }

function career(clubId: string, seed: number, seasons: number, moveAt: number | null): GameState {
  const g = newGame(clubId, 'Audit Tester', seed)
  const L: Ledger = { sold: new Map(), promoted: new Set(), capped: new Set(), star: new Set() }
  const end = g.season + seasons
  let lastSeason = -1
  const first = g.season
  let moved = false
  const brokenSeen = new Set<number>()
  while (g.season < end) {
    const c = g.clubs[g.userClubId]
    if (!g.unemployed && c) c.boardConfidence = Math.max(c.boardConfidence, 60)
    if (moveAt != null && !moved && g.season - first === moveAt && g.week === 2 && !g.unemployed) { moved = true; move(g) }
    if (g.season !== lastSeason && g.week >= 3 && !g.unemployed) { lastSeason = g.season; decide(g, L) }
    // ---- the week as the manager sees it, before the match ----
    weeksSeen++
    const desk = buildDesk(g)
    // the status rows (how the side plays, where it stands) are the desk's
    // gauges and change when the state does; the rest is what it tells you
    const deskLines = [...desk.rows.filter(r => r.id !== 'tactics' && r.id !== 'season').flatMap(r => r.lines), ...(desk.thread?.lines ?? [])].map(l => deskText(l))
    for (const s of new Set(deskLines)) deskWeeks.set(s, (deskWeeks.get(s) ?? 0) + 1)
    const fx = userFixtureThisWeek(g)
    const live = fx && !fx.played && fx.compId !== 'fr' && g.clubs[fx.homeId] && g.clubs[fx.awayId] ? fx : null
    const newsBefore = new Set(g.news.map(n => n.id))
    if (live) {
      const opp = live.homeId === g.userClubId ? live.awayId : live.homeId
      const report = buildReport(g, opp)
      const repText = report.lines.map(l => say(l.k, l.v ?? {}))
      const thread = desk.thread?.lines.map(l => deskText(l)).join(' ') ?? ''
      const stake = matchStakes(g, live) ?? ''
      const theirXv = lineupFor(g, opp).slice(0, 23)
      const facing = formerOf ? formerOf(g, opp, theirXv, Infinity) : []
      // your rival as he was before the whistle (this match may make him one)
      const rc = rivalCoach(g)
      const rcCoach = g.clubs[opp].coach
      const preNews = g.news.filter(n => n.season === g.season && n.week === g.week)
      const where = (p: Player) => [repText.some(s => s.includes(p.name)) && 'report', thread.includes(p.name) && 'desk', facing.some(f => f.p.id === p.id) && 'former',
        preNews.some(n => n.playerId === p.id && /^(mem|hist)\./.test(n.k ?? '')) && 'news', oldBoyApps(p, g.userClubId) > 0 && 'card'].filter(Boolean).join('+')
      const named = (p: Player) => /report|desk|former|news/.test(where(p))
      for (const f of facing) for (const l of LANGS) {
        const s = tIn(l, f.k, f.v)
        if (/[{}]|\b[a-z]+\.[a-zA-Z_]+\b/.test(s.replace(/\d+\.\d+/g, ''))) rawLeaks.push(`${l}: ${s}`)
      }
      if (facing[0] && samples.length < 4) samples.push(`report: ${tIn('en', facing[0].k, facing[0].v)}`)
      // ---- play it, watched ----
      const forfeit = forfeitSide(g, live)
      let events: { type: string; teamId: string; playerId?: number; k?: string }[] = []
      let motm: number | null = null
      let theirIds: number[] = []
      let us = 0, them = 0
      if (forfeit) settleForfeit(g, live, forfeit)
      else {
        const ctx = beginMatch(g, live, matchRng(g), true, g.userClubId)
        ctx.assistantSubs = true
        playHalf(g, ctx); playHalf(g, ctx)
        fileFindings(g, ctx)
        fileEvidence(g, ctx)
        events = ctx.events as typeof events
        motm = ctx.motmId ?? null
        const theirSide = ctx.home.teamId === opp ? ctx.home : ctx.away
        us = (theirSide === ctx.home ? ctx.away : ctx.home).score
        them = theirSide.score
        theirIds = theirSide.lineup.filter((x): x is number => x != null)
      }
      const usScore = us, themScore = them
      const ft = decidedBy && !forfeit ? decidedBy(g, opp, us, them, events, motm) : null
      if (ft && samples.length < 8) samples.push(`full time: ${say(ft.k, ft.v)}`)
      // the settle: news filed for this week
      processWeekAndAdvance(g)
      const after = g.news.filter(n => !newsBefore.has(n.id))
      // ---- the moments ----
      const played = new Set(theirIds)
      for (const [pid, d] of L.sold) {
        const p = g.players[pid]
        if (!p || !played.has(pid) || p.clubId !== opp) continue
        const comm = events.some(e => e.playerId === pid && /^comm\.(oldBoy|tryNoCelebration|former)/.test(e.k ?? ''))
        const newsAfter = after.some(n => n.playerId === pid)
        if (d.minor) { moment('meetMinor', named(p), comm, newsAfter, `${p.name} [${where(p)}]`); continue }
        if (d.ordinary) {
          moment('meetOrdinary', named(p), comm, newsAfter, `${p.name} [${where(p)}] ${after.filter(n => n.playerId === pid).map(n => n.k).join(',')}`)
          if (facing.some(f => f.p.id === pid) || thread.includes(p.name)) ordinaryLeaks.push(`${p.name} (ca ${p.ca}) named before the match`)
          const loud = after.filter(n => n.playerId === pid && /^mem\.(met|try)Vs$/.test(n.k ?? ''))
          if (loud.length) ordinaryLeaks.push(`${p.name}: ${loud.map(n => n.k).join(',')}`)
          continue
        }
        if (!named(p) && misses.length < 12) {
          const all = formerOf ? formerOf(g, opp) : []
          misses.push(`${p.name} in23=${theirXv.includes(pid)} facingAll=${all.map(f => f.p.name).join('/')} n=${all.length}`)
        }
        moment('meetFormer', named(p), comm, newsAfter, `${p.name} (${d.young ? 'young' : 'senior'}, sold ${seasonLabel(d.season)}) [${where(p)}] ${after.filter(n => n.playerId === pid).map(n => n.k).join(',')}`)
        if (d.bad) moment('badTermsMeet', facing.some(f => f.p.id === pid && /faceBroken|faceRefused/.test(String(f.v.extra_k ?? ''))), false, newsAfter, p.name)
        const scored = events.some(e => e.type === 'TRY' && e.playerId === pid)
        if (scored) moment('formerScores', false, comm || events.some(e => e.playerId === pid && e.type === 'SUB'), newsAfter || ft?.p === pid, p.name)
        // decided it: his try was worth the margin of a defeat, or he was the
        // best man on the pitch in one
        const decides = themScore > usScore && ((scored && themScore - usScore <= 5) || motm === pid)
        if (decides) {
          moment('formerDecides', false, comm, ft?.p === pid || after.some(n => n.playerId === pid && /motm|tryVs|oldBoy/.test(n.k ?? '')), `${p.name} ${usScore}-${themScore}${motm === pid ? ' motm' : ''}`)
          if (decidedBy) { const x = T('formerDecides'); x.ft = (x.ft ?? 0) + (ft?.p === pid ? 1 : 0) }
        }
        if (ft && ft.p !== pid && L.sold.get(ft.p)?.ordinary) ordinaryLeaks.push(`full time names ${g.players[ft.p]?.name}`)
      }
      if (rc && rc.at === opp && rc.n === rcCoach) moment('rivalMeet', thread.includes(rc.n) || stake.includes(rc.n) || repText.some(x => x.includes(rc.n)), false, false, rc.n)
      if (formerTenure(g, opp)) moment('oldClub', preNews.some(n => /hist\.return/.test(n.k ?? '')) || !!stake, false, false, g.clubs[opp].short)
      // a legend of the club in their twenty-three or on their staff: told
      // by the news (the first meeting only), the billing, or the report
      for (const { l, as } of legendsFacing(g, opp)) {
        if (as === 'player' && !theirXv.includes(l.pid)) continue
        moment('legendBack', preNews.some(n => /^hist\.legend(Back|Coach)$/.test(n.k ?? '') && n.v?.player === l.name) || stake.includes(l.name) || repText.some(x => x.includes(l.name)), false, false, `${l.name} (${as})`)
      }
    } else {
      processWeekAndAdvance(g)
    }
    // the week's headlines, for the repetition count
    for (const n of g.news.filter(n => !newsBefore.has(n.id))) {
      const s = n.k ? say(`${n.k}Subj`, n.v ?? {}) : n.subject
      const head = s && !s.endsWith('Subj') ? s : n.subject
      newsWeeks.set(head, (newsWeeks.get(head) ?? 0) + 1)
    }
    // ---- the world's milestones of men you made or let go ----
    for (const [pid, d] of L.sold) {
      const p = g.players[pid]
      if (!p || d.ordinary) continue
      const star = d.caps === 0 && (p.caps ?? 0) > 0 && !L.capped.has(pid)
      if (star) {
        L.capped.add(pid)
        const told = g.news.some(n => n.playerId === pid && /^mem\.sold(Cap|Poty|Toty)$/.test(n.k ?? ''))
        moment('formerStar', false, false, told, `${p.name} capped`)
      }
    }
    for (const pid of L.promoted) {
      const p = g.players[pid]
      if (!p || !(p.caps ?? 0) || L.capped.has(pid)) continue
      L.capped.add(pid)
      moment('acadCapped', false, false, g.news.some(n => n.playerId === pid && n.k === 'mem.acadIntl') || playerStory(g, p).some(l => l.k === 'story.gradTest'), p.name)
    }
    for (const e of recall(g, { kind: 'promise-broken' })) {
      if (brokenSeen.has(e.id)) continue
      brokenSeen.add(e.id)
      moment('promiseBroken', true, false, true, String(e.payload?.name ?? ''))
    }
  }
  // a broken promise that came back: the grudge, the agents, or his page
  for (const e of recall(g, { kind: 'promise-broken' })) {
    const p = g.players[e.playerId ?? -1]
    const back = g.news.some(n => (n.k === 'mem.grudge' && n.playerId === e.playerId) || (n.k === 'mem.agents' && n.v?.player === e.payload?.name))
    moment('promiseReturns', false, false, back || (!!p && playerStory(g, p).some(l => l.why === 'promise')), String(e.payload?.name ?? ''))
  }
  // ordinary men stay quiet: nobody the manager never touched has a line
  const made = madeBy(g)
  const strangers = Object.values(g.players).filter(p => !made(p) && !recall(g, { playerId: p.id }).length && oldBoyApps(p, g.userClubId) === 0 && p.clubId !== g.userClubId)
  const loud = strangers.filter(p => playerStory(g, p, made).length)
  if (loud.length) ordinaryLeaks.push(...loud.slice(0, 3).map(p => `${p.name} has a page story`))
  return g
}

/** A job in the same league: the old club becomes a fixture. */
function move(g: GameState) {
  const me = g.clubs[g.userClubId]
  const to = Object.values(g.clubs).filter(c => c.id !== me.id && c.leagueId === me.leagueId).sort((a, b) => a.rep - b.rep)[2]
  if (!to) return
  g.vacancies.push({ clubId: to.id, week: g.week })
  g.jobOffer = { clubId: to.id, week: g.week }
  answerJobOffer(g, true)
}

/** The manager's hand at a season start. */
function decide(g: GameState, L: Ledger): void {
  const club = g.clubs[g.userClubId]
  const sell = (p: Player, to: string, fee: number, young: boolean, bad: boolean, ordinary: boolean, minor = false) => {
    L.sold.set(p.id, { season: g.season, young, bad, ordinary, caps: p.caps ?? 0, minor })
    executeTransfer(g, p, to, fee)
  }
  const rivals = Object.values(g.clubs).filter(c => c.leagueId === club.leagueId && c.id !== club.id).sort((a, b) => b.balance - a.balance)
  if (!rivals.length) return
  const buyer = (i: number) => rivals[i % rivals.length]
  const mine = () => club.players.map(id => g.players[id]).filter(p => p && !p.acad && !p.injury)
  // a young lad with a ceiling, sold before he is anything
  const lad = mine().filter(p => p.age <= 21 && p.contractEnds > g.season).sort((a, b) => b.pa - a.pa)[0]
  // (a lad without a ceiling is neither: he is named if he becomes somebody)
  if (lad) sell(lad, buyer(1).id, Math.max(50_000, Math.round(lad.value)), true, false, false, lad.pa < 78)
  // a senior first-teamer
  const sr = mine().filter(p => p.id !== club.captain && p.contractEnds > g.season).sort((a, b) => b.ca - a.ca)[3]
  if (sr) sell(sr, buyer(0).id, Math.max(50_000, Math.round(sr.value)), false, false, false)
  // a man whose promise was broken last season leaves on bad terms
  const sour = recall(g, { kind: 'promise-broken', sinceSeason: g.season - 1 }).map(e => g.players[e.playerId ?? -1]).find(p => p && p.clubId === club.id && !p.acad)
  if (sour) sell(sour, buyer(2).id, Math.max(50_000, Math.round(sour.value)), false, true, false)
  // an ordinary squad man, the weakest senior, let go to a league side
  // (ordinary by the club's own book: under ten games for it, below the
  // squad's middle, not one of its own)
  const cas = mine().map(p => p.ca).sort((a, b) => a - b)
  const forUs = (p: Player) => service(p, club.id).apps
  const ord = mine().filter(p => p.contractEnds > g.season && p.age >= 24 && !p.homegrown && forUs(p) < 10 && p.ca < cas[Math.floor(cas.length / 2)] && p.pa < 78)
    .sort((a, b) => a.ca - b.ca)[0]
  if (ord) sell(ord, buyer(3).id, Math.max(20_000, Math.round(ord.value)), false, false, true)
  // a star bought
  const star = buyer(0).players.map(id => g.players[id]).filter(p => p && !p.acad && !p.injury && p.ca < 88).sort((a, b) => b.ca - a.ca)[0]
  if (star) executeTransfer(g, star, club.id, Math.max(50_000, Math.round(star.value * 1.3)))
  // the academy's best promoted (the Promote button's own fields)
  const ac = club.players.map(id => g.players[id]).filter(p => p && p.acad && !p.demoted).sort((a, b) => b.pa - a.pa)[0]
  if (ac) {
    ac.acad = false; ac.demoted = false; ac.homegrown = true
    ac.gradClub ??= club.id; ac.gradS ??= g.season
    ac.wage = playerWage(ac.ca, ac.age)
    L.promoted.add(ac.id)
  }
  // two promises: a place in the plans to a fringe man, and minutes to another
  const fringe = mine().filter(p => p.stats.apps === 0 && p.age >= 21).sort((a, b) => b.ca - a.ca)
  if (fringe[0]) (g.pledges ??= []).push({ playerId: fringe[0].id, kind: 'plans', week: g.week, season: g.season, due: g.week + 10, baseApps: fringe[0].stats.apps })
  if (fringe[3]) (g.pledges ??= []).push({ playerId: fringe[3].id, kind: 'minutes', week: g.week, season: g.season, due: g.week + 8, baseApps: fringe[3].stats.apps })
}

// ------------------------------------------------------------------ play
const plan: [string, number, number | null][] = [['leicester', 18_501, null], ['bedford', 18_502, null], ['gloucester', 18_503, 4]]
const runs: GameState[] = []
for (const [club, seed, mv] of plan.slice(0, CAREERS)) runs.push(career(club, seed, SEASONS, mv))
console.log(`\n${runs.length} careers x ${SEASONS} seasons, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`)

console.log('MOMENTS (n: before / during / after / told at all)')
for (const [k, x] of Object.entries(tally)) {
  console.log(`  ${k.padEnd(15)} ${String(x.n).padStart(4)}: ${x.pre} / ${x.during} / ${x.after} / ${x.any}${x.ft != null ? ` (full time ${x.ft})` : ''}   e.g. ${x.ex.join('; ')}`)
}
const recorded = runs.reduce((n, g) => n + (g.memory?.entries.length ?? 0), 0)
console.log(`  memory entries at the end: ${recorded}`)
console.log('\nMOST REPEATED DESK LINES (weeks on show of ' + weeksSeen + ')')
const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
for (const [s, n] of top(deskWeeks)) console.log(`  ${String(n).padStart(4)} (${Math.round(n / weeksSeen * 100)}%)  ${s}`)
console.log('\nMOST REPEATED HEADLINES (weeks filed)')
for (const [s, n] of top(newsWeeks)) console.log(`  ${String(n).padStart(4)} (${Math.round(n / weeksSeen * 100)}%)  ${s}`)
if (misses.length) { console.log('\nMISSED'); for (const m of misses) console.log(`  ${m}`) }
console.log('\nSAMPLES')
for (const s of samples) console.log(`  ${s}`)
console.log('')

// ------------------------------------------------------------------ hold
if (formerOf) {
  const m = tally.meetFormer
  ok(!!m && m.n > 0 && m.pre === m.n, `every man you let go is named before you meet him (${m?.pre}/${m?.n})`)
  const d = tally.formerDecides
  if (d?.n) ok(d.ft === d.n, `a former man who decides it is said so at full time (${d.ft}/${d.n})`)
  ok(ordinaryLeaks.length === 0, `ordinary men stay quiet${ordinaryLeaks.length ? `: ${ordinaryLeaks.slice(0, 3).join('; ')}` : ''}`)
  ok(rawLeaks.length === 0, `every former line reads as a sentence in six languages${rawLeaks.length ? `: ${rawLeaks[0]}` : ''}`)
  const rv = tally.rivalMeet
  if (rv?.n) ok(rv.pre === rv.n, `your rival is named before every meeting (${rv.pre}/${rv.n})`)
  const lg = tally.legendBack
  if (lg?.n) ok(lg.pre === lg.n, `a legend of yours in their colours is told before every meeting (${lg.pre}/${lg.n})`)
  const nag = top(deskWeeks).filter(([, n]) => n / weeksSeen > 0.25)
  ok(nag.length === 0, `no desk line on show in more than a week in four${nag.length ? `: ${nag.map(([s, n]) => `${s} ${Math.round(n / weeksSeen * 100)}%`).join('; ')}` : ''}`)
}
if (fails) { console.log(`\n${fails} FAILED`); process.exit(1) }
console.log('\nMEMORY AUDIT PROBE PASSED')
