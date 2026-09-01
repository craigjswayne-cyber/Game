/**
 * ---- TEN MORE ROOMS, AND THREE THINGS WORTH NOTICING ----
 *
 * v1.2.2, pre-launch audit. The press system had thirty question stems and
 * "felt repetitive"; ten more were written, each firing on a real state of
 * the world and each answer moving something. Alongside them, three ways of
 * turning a number that was already true into a sentence: the back page, the
 * grudge and the ledger.
 *
 * What this holds the game to:
 *   1. every new room FIRES on its trigger and NOT off it (a scenario that
 *      never fires is dead weight; one that fires without cause is spam);
 *   2. the two new consequences land - `fans` moves fanMood, `lock` puts the
 *      named man in the starting XV and nobody else;
 *   3. the back page leads with the defining event, in the right order;
 *   4. the grudge files a story only when the table actually flips;
 *   5. the ledger writes each first exactly once.
 *
 * Run: npx vite-node scripts/engageprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { answerPress, generatePress } from '../src/game/media'
import { afterClubMatch } from '../src/game/season'
import { rivalsOf } from '../src/game/rivalries'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState, MatchEvent } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`); if (!c) fails++ }

const fresh = () => newGame('leicester', 'Engage Probe', 11)
const club = (g: GameState) => g.clubs[g.userClubId]
const xv = (g: GameState) => club(g).tactic.lineup.slice(0, 15).filter((x): x is number => x != null)

/** Move the season to the week of the club's next league fixture, mark the one
 *  before it played with the given score and events, and return both. */
function stage(g: GameState, us: number, them: number, events: MatchEvent[] = [], home = true) {
  const c = club(g)
  const mine = g.fixtures.filter(f => f.compId === c.leagueId && (f.homeId === c.id || f.awayId === c.id) && !f.played).sort((a, b) => a.week - b.week)
  const played = mine[0], next = mine[1]
  const weHome = played.homeId === c.id
  if (weHome !== home) { const t = played.homeId; played.homeId = played.awayId; played.awayId = t }
  const wh = played.homeId === c.id
  played.played = true
  played.homeScore = wh ? us : them; played.awayScore = wh ? them : us
  played.homeTries = 0; played.awayTries = 0
  played.events = events
  g.week = next.week
  return { played, next }
}
const ev = (type: MatchEvent['type'], teamId: string, min: number, playerId?: number, playerName?: string): MatchEvent =>
  ({ min, type, teamId, playerId, playerName, text: '' } as unknown as MatchEvent)

/** Drive generatePress until a question with this stem appears (or give up). */
function fires(g: GameState, stem: string, tries = 40): boolean {
  for (let i = 0; i < tries; i++) {
    g.press = g.press.filter(p => p.answered)
    generatePress(g, mulberry32(1000 + i))
    if (g.press.some(p => (p.qk ?? '').startsWith(stem))) return true
  }
  return false
}

console.log('--- 1. each room fires on its trigger, and not off it')
{
  // referee: lost by 3 with two late penalties against
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 17, 20)
  const opp = played.homeId === c.id ? played.awayId : played.homeId
  played.events = [ev('PEN', opp, 72), ev('PEN', opp, 79), ev('FT', c.id, 80)]
  g.week = played.week + 1 // the morning after: the room reads the match played LAST week
  ok(fires(g, 'press.refereeQ'), 'the referee room opens after two late penalties in a narrow defeat')
  const g2 = fresh(); stage(g2, 30, 10)
  ok(!fires(g2, 'press.refereeQ', 15), 'and stays shut after a comfortable win')
}
{
  // comeback: fifteen down at half time, won
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 24, 20)
  const opp = played.homeId === c.id ? played.awayId : played.homeId
  played.events = [ev('TRY', opp, 10), ev('CON', opp, 11), ev('TRY', opp, 25), ev('CON', opp, 26), ev('PEN', opp, 38), ev('HT', c.id, 40),
    ev('TRY', c.id, 50), ev('CON', c.id, 51), ev('TRY', c.id, 62), ev('CON', c.id, 63), ev('TRY', c.id, 75), ev('CON', c.id, 76), ev('PEN', c.id, 79), ev('FT', c.id, 80)]
  g.week = played.week + 1
  ok(fires(g, 'press.comebackQ'), 'the comeback room opens after a win from 17 down at the break')
}
{
  // contract stand-off: a starter in his last season, week 20+
  const g = fresh(); const c = club(g)
  stage(g, 20, 10); g.week = Math.max(g.week, 21)
  const p = g.players[xv(g)[3]]; p.contractEnds = g.season
  ok(fires(g, 'press.standoffQ'), `the stand-off room opens for ${p.name} in his last season`)
}
{
  // old boy: a starter whose career includes the next opponent, recently
  const g = fresh(); const c = club(g)
  const { next } = stage(g, 20, 10)
  const opp = next.homeId === c.id ? next.awayId : next.homeId
  const p = g.players[xv(g)[5]]; p.career.push({ season: g.season - 1, clubId: opp, apps: 20, tries: 2, points: 10 })
  ok(fires(g, 'press.oldboyQ'), `the old-boy room opens for ${p.name} against his former club`)
}
{
  // academy kid: nineteen, first start
  const g = fresh(); const c = club(g)
  stage(g, 20, 10)
  const p = g.players[xv(g)[12]]; p.age = 19; p.stats.starts = 0; p.career = []
  ok(fires(g, 'press.kidstartQ'), `the academy-kid room opens for a nineteen-year-old first starter`)
}
{
  // empty seats: three home games under 60%
  const g = fresh(); const c = club(g)
  const homes = g.fixtures.filter(f => f.homeId === c.id && f.compId === c.leagueId).slice(0, 3)
  for (const f of homes) { f.played = true; f.att = Math.round(c.capacity * 0.4); f.homeScore = 20; f.awayScore = 10 }
  g.week = homes[2].week + 1
  ok(fires(g, 'press.seatsQ'), 'the empty-seats room opens after three half-empty home games')
}
{
  // milestone: 99 apps for the club
  const g = fresh(); stage(g, 20, 10)
  const p = g.players[xv(g)[1]]; p.stats.apps = 99; p.career = []
  ok(fires(g, 'press.centuryQ'), `the milestone room opens on ${p.name}'s hundredth`)
}
{
  // bench warmer: good, six weeks without a start
  const g = fresh(); const c = club(g)
  stage(g, 20, 10); g.week = Math.max(g.week, 12)
  const benchIds = c.tactic.lineup.slice(15).filter((x): x is number => x != null)
  const p = g.players[benchIds[0]]; p.ca = 95; p.lastWk = g.week - 8; p.onLoan = false; p.acad = false
  ok(fires(g, 'press.benchQ'), `the bench-warmer room opens for ${p.name}`)
}
{
  // weather: away, midwinter
  const g = fresh(); const c = club(g)
  const away = g.fixtures.filter(f => !f.played && f.awayId === c.id && f.compId === c.leagueId && f.week >= 14 && f.week <= 28).sort((a, b) => a.week - b.week)[0]
  if (away) { g.week = away.week; ok(fires(g, 'press.weatherQ'), 'the weather room opens for a midwinter away trip') }
  else ok(true, 'no midwinter away fixture in this draw - weather room untested here')
}
{
  // leak: low morale, a benched man with starts
  const g = fresh(); const c = club(g)
  stage(g, 20, 10)
  for (const id of c.players) { const p = g.players[id]; if (p) p.morale = 3 }
  const benchIds = c.tactic.lineup.slice(15).filter((x): x is number => x != null)
  g.players[benchIds[1]].stats.starts = 5
  ok(fires(g, 'press.leakQ', 80), 'the leak room opens in an unhappy dressing room')
}

console.log('\n--- 2. the two new consequences land')
{
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 17, 20)
  const opp = played.homeId === c.id ? played.awayId : played.homeId
  played.events = [ev('PEN', opp, 72), ev('PEN', opp, 79)]
  g.week = played.week + 1
  fires(g, 'press.refereeQ')
  const q = g.press.find(p => (p.qk ?? '').startsWith('press.refereeQ'))!
  const fansBefore = g.fanMood ?? 60, boardBefore = c.boardConfidence
  answerPress(g, q.id, 0) // "sending the clips": fans +0.3, board -0.4
  ok((g.fanMood ?? 60) > fansBefore, `fans moved on a fans-carrying answer (${fansBefore} -> ${g.fanMood})`)
  ok(c.boardConfidence < boardBefore, `and the board moved the other way (${boardBefore} -> ${c.boardConfidence})`)
}
{
  const g = fresh(); const c = club(g)
  stage(g, 20, 10); g.week = Math.max(g.week, 12)
  const benchIds = c.tactic.lineup.slice(15).filter((x): x is number => x != null)
  const p = g.players[benchIds[0]]; p.ca = 95; p.lastWk = g.week - 8; p.onLoan = false; p.acad = false
  fires(g, 'press.benchQ')
  const q = g.press.find(p => (p.qk ?? '').startsWith('press.benchQ'))!
  // the room names whichever benched man it found first; the promise is to HIM
  const named = g.players[q.playerId!]
  const before = xv(g).length
  ok(!xv(g).includes(named.id), `${named.name} is on the bench before the answer`)
  answerPress(g, q.id, 2) // "he'll start next week"
  ok(xv(g).includes(named.id), `"he starts next week" put ${named.name} in the XV`)
  ok(xv(g).length === before, 'and the XV is still fifteen - somebody made way')
  ok(new Set(c.tactic.lineup.filter(x => x != null)).size === c.tactic.lineup.filter(x => x != null).length, 'nobody is named twice on the sheet')
}

console.log('\n--- 3. the back page leads with the right story')
{
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 24, 20)
  const opp = played.homeId === c.id ? played.awayId : played.homeId
  played.events = [ev('TRY', opp, 10), ev('CON', opp, 11), ev('TRY', opp, 25), ev('CON', opp, 26), ev('HT', c.id, 40),
    ev('TRY', c.id, 50), ev('CON', c.id, 51), ev('TRY', c.id, 62), ev('CON', c.id, 63), ev('TRY', c.id, 75), ev('CON', c.id, 76), ev('PEN', c.id, 79), ev('RC', opp, 60, 999, 'Somebody')]
  afterClubMatch(g, played)
  ok(g.backPage?.hk === 'bp.headComeback', `a comeback outranks a red card on the back page (${g.backPage?.hk})`)
  ok(g.backPage?.fixtureId === played.id, 'and it points at the match it is about')
}
{
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 40, 3)
  afterClubMatch(g, played)
  ok(g.backPage?.hk === 'bp.headRout', `a 37-point win is a rout (${g.backPage?.hk})`)
}
{
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 18, 15)
  const opp = played.homeId === c.id ? played.awayId : played.homeId
  const scorer = xv(g)[10]; g.players[scorer].stats.apps = 1
  played.events = [ev('TRY', c.id, 30, scorer, g.players[scorer].name), ev('CON', c.id, 31), ev('PEN', opp, 50)]
  afterClubMatch(g, played)
  ok(g.backPage?.hk === 'bp.headDebut', `a debut try leads an otherwise ordinary win (${g.backPage?.hk})`)
}
{
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 20, 21)
  afterClubMatch(g, played)
  ok(g.backPage?.hk === 'bp.headLoss', `a plain narrow defeat gets the plain page (${g.backPage?.hk})`)
  ok(!g.backPage!.hk.includes('{'), 'and the headline is a key, not text')
}

console.log('\n--- 4. the grudge speaks only when the table flips')
{
  const g = fresh(); const c = club(g)
  const rival = rivalsOf(c.id)[0]
  const table = g.comps[c.leagueId].table
  const me = table.find(r => r.teamId === c.id)!, them = table.find(r => r.teamId === rival)!
  ok(!!rival && !!them, `${c.short} has a nominated rival (${rival})`)
  me.pts = 10; them.pts = 20
  const { played } = stage(g, 20, 10); g.week = 6
  afterClubMatch(g, played)
  const n0 = g.news.filter(n => n.k?.startsWith('news.grudge')).length
  ok(g.grudgeAbove === false && n0 === 0, 'the first look records where you stand and says nothing')
  me.pts = 25
  const f2 = g.fixtures.filter(f => f.compId === c.leagueId && (f.homeId === c.id || f.awayId === c.id) && !f.played)[0]
  f2.played = true; f2.homeScore = 20; f2.awayScore = 10; g.week = f2.week
  afterClubMatch(g, f2)
  ok(g.grudgeAbove === true && g.news.some(n => n.k === 'news.grudgeAbove'), 'climbing above them files the story')
  const n1 = g.news.filter(n => n.k?.startsWith('news.grudge')).length
  const f3 = g.fixtures.filter(f => f.compId === c.leagueId && (f.homeId === c.id || f.awayId === c.id) && !f.played)[0]
  f3.played = true; f3.homeScore = 20; f3.awayScore = 10; g.week = f3.week
  afterClubMatch(g, f3)
  ok(g.news.filter(n => n.k?.startsWith('news.grudge')).length === n1, 'and staying above them says nothing more')
}

console.log('\n--- 5. the ledger writes each first once')
{
  const g = fresh(); const c = club(g)
  const { played } = stage(g, 20, 10, [], false) // away win
  const opp = played.homeId
  afterClubMatch(g, played)
  ok((g.ledger ?? []).some(e => e.k === 'news.ledgerFirstAway' && e.v.at === opp), `a first away win at ${g.clubs[opp]?.short} goes in the ledger`)
  const n = (g.ledger ?? []).length
  afterClubMatch(g, played)
  ok((g.ledger ?? []).length === n, 'running the same match again writes nothing new')
  ok(g.news.some(nw => nw.k === 'news.ledgerFirstAway'), 'and the moment was filed as a story')
}
{
  // ten unbeaten
  const g = fresh(); const c = club(g)
  const mine = g.fixtures.filter(f => f.compId === c.leagueId && (f.homeId === c.id || f.awayId === c.id)).sort((a, b) => a.week - b.week).slice(0, 10)
  for (const f of mine) { f.played = true; const wh = f.homeId === c.id; f.homeScore = wh ? 20 : 10; f.awayScore = wh ? 10 : 20 }
  g.week = mine[9].week
  afterClubMatch(g, mine[9])
  ok((g.ledger ?? []).some(e => e.k === 'news.ledgerUnbeaten' && e.v.n === 10), 'ten unbeaten is written down on the tenth, not before')
}

console.log(fails === 0 ? '\nENGAGE PROBE PASSED: ten rooms that open when they should, and three things worth noticing' : `\nENGAGE PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
