/**
 * ---- THE PRESS BAROMETER READS THE RESULTS, AND THE ANSWERS MATTER ----
 *
 * Owner: "Press room should be a sentiment based barometer at the top - are
 * the press warm to you. If winning yes... losing they start to pile on the
 * pressure, winning too many on the bounce and they try to unsettle your squad
 * too. Answering their questions becomes important to the mood of your team
 * and the fans."
 *
 * What this holds the maths to (pressmood.ts):
 *
 *   1. The shape of one result: a defeat as favourites costs more than one as
 *      outsiders, a win as outsiders earns more than one as favourites, and
 *      the third result of a run moves further than the first.
 *   2. Runs of real results: three straight defeats from level reads
 *      sceptical with the reason "3 defeats in a row"; a long slump reads
 *      hostile; the same slump as favourites gets there sooner.
 *   3. THE FLIP: five straight wins turns the press to unsettling the squad,
 *      the first defeat turns it back, and talking the run up brings the flip
 *      a win closer.
 *   4. The questions follow the needle: a hostile press asks about the job, a
 *      stirring one about the squad.
 *   5. Answers move squad morale, fan mood and the needle the way the option
 *      says, and the coverage card can say so in words.
 *   6. Modest: no barometer answer moves squad morale more than half a point,
 *      the fans more than two and a half, or the needle more than eight.
 *   7. Old saves: no stored mood reads as the season so far without writing
 *      anything, and a new job starts level.
 *
 * Run: npx vite-node scripts/pressmoodprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { answerPress, generatePress } from '../src/game/media'
import { processWeekAndAdvance } from '../src/game/season'
import {
  bandOf, currentMood, effectLines, pressWhy, resultShift, settlePressMood, stirAt,
} from '../src/game/pressmood'
import { absWeek } from '../src/game/model'
import type { Fixture, GameState, PressItem } from '../src/game/model'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

// ---- 1. one result ----
{
  const lossFav = resultShift({ res: 'L', exp: 0.8, us: 10, them: 15 }, 1)
  const lossDog = resultShift({ res: 'L', exp: -0.8, us: 10, them: 15 }, 1)
  const winFav = resultShift({ res: 'W', exp: 0.8, us: 15, them: 10 }, 1)
  const winDog = resultShift({ res: 'W', exp: -0.8, us: 15, them: 10 }, 1)
  ok(lossFav < lossDog && lossDog < 0, `a defeat as favourites costs more (${lossFav.toFixed(1)}) than as outsiders (${lossDog.toFixed(1)})`)
  ok(winDog > winFav && winFav > 0, `a win as outsiders earns more (${winDog.toFixed(1)}) than as favourites (${winFav.toFixed(1)})`)
  const l1 = resultShift({ res: 'L', exp: 0, us: 10, them: 15 }, 1)
  const l3 = resultShift({ res: 'L', exp: 0, us: 10, them: 15 }, 3)
  ok(l3 < l1, `the third defeat of a run is written up harder (${l3.toFixed(1)}) than the first (${l1.toFixed(1)})`)
  ok(resultShift({ res: 'D', exp: 0.6, us: 10, them: 10 }, 1) < 0 && resultShift({ res: 'D', exp: -0.6, us: 10, them: 10 }, 1) > 0,
    "a favourite's draw costs and an outsider's earns")
  ok(bandOf(0) === 'neutral' && bandOf(-20) === 'sceptical' && bandOf(-60) === 'hostile' && bandOf(20) === 'warm' && bandOf(60) === 'adoring',
    'the five bands sit where the words say')
}

// ---- a career with a scripted season ----
const LEAGUE_OPP = (g: GameState) => g.comps[g.clubs[g.userClubId].leagueId].teamIds.filter(id => id !== g.userClubId)

function career(seed: number): GameState {
  const g = newGame('northampton', 'Barometer', seed)
  g.fixtures = []
  g.press = []
  delete g.preds
  g.week = 3
  return g
}

/** Play one competitive result for the user this week and settle the needle.
 *  `oppRep` sets who was fancied: the user's club is pinned at rep 80. */
function play(g: GameState, res: 'W' | 'L' | 'D', oppRep = 80, oppIdx = 0) {
  const me = g.userClubId
  const opps = LEAGUE_OPP(g)
  const opp = opps[oppIdx % opps.length]
  g.clubs[me].rep = 80
  g.clubs[opp].rep = oppRep
  const [us, them] = res === 'W' ? [24, 13] : res === 'L' ? [13, 24] : [17, 17]
  const home = g.week % 2 === 0
  const fx = {
    id: g.nextId++, compId: g.clubs[me].leagueId, round: g.week, week: g.week,
    homeId: home ? me : opp, awayId: home ? opp : me, played: true,
    homeScore: home ? us : them, awayScore: home ? them : us, homeTries: 2, awayTries: 1,
  } as Fixture
  g.fixtures.push(fx)
  settlePressMood(g)
  g.week++
}

// ---- 2. runs ----
{
  const g = career(501)
  ok(currentMood(g).v === 0 && bandOf(currentMood(g).v) === 'neutral', 'a fresh career starts neutral')
  ok(pressWhy(g).k === 'world.prBaroWhyNone', 'and the reason says there are no results yet')
  for (let i = 0; i < 3; i++) play(g, 'L', 80, i)
  const why = pressWhy(g)
  ok(bandOf(g.pressMood!.v) === 'sceptical', `three straight defeats from level reads sceptical (${g.pressMood!.v})`)
  ok(why.k === 'world.prBaroWhyLosses' && why.v?.n === 3, `with the reason "3 defeats in a row" (${why.k} n=${why.v?.n})`)
  for (let i = 0; i < 3; i++) play(g, 'L', 80, i)
  ok(bandOf(g.pressMood!.v) === 'hostile', `six straight defeats reads hostile (${g.pressMood!.v})`)

  const fav = career(502)
  const dog = career(503)
  for (let i = 0; i < 4; i++) { play(fav, 'L', 64, i); play(dog, 'L', 96, i) }
  ok(fav.pressMood!.v < dog.pressMood!.v - 15,
    `four defeats as favourites (${fav.pressMood!.v}) are far worse than four as outsiders (${dog.pressMood!.v})`)
  ok(bandOf(fav.pressMood!.v) === 'hostile', `four defeats as favourites is already hostile (${fav.pressMood!.v})`)

  const up = career(504)
  play(up, 'W', 96)
  ok(pressWhy(up).k === 'world.prBaroWhyUpsetW', `a single win against a far bigger club is written up as an upset (${pressWhy(up).k})`)
  const down = career(505)
  play(down, 'L', 64)
  ok(pressWhy(down).k === 'world.prBaroWhyUpsetL', `a single defeat by a far smaller club is written up as one (${pressWhy(down).k})`)
}

// ---- 3. the flip ----
{
  const g = career(510)
  for (let i = 0; i < 4; i++) play(g, 'W', 80, i)
  ok(!g.pressMood!.stir, `four straight wins: still warm, not stirring (${g.pressMood!.v})`)
  ok(bandOf(g.pressMood!.v) === 'warm' || bandOf(g.pressMood!.v) === 'adoring', `and warm by now (${g.pressMood!.v})`)
  play(g, 'W', 80, 4)
  ok(!!g.pressMood!.stir, 'the fifth straight win flips the press to unsettling the squad')
  ok(pressWhy(g).k === 'world.prBaroWhyStir' && pressWhy(g).v?.n === 5, 'and the reason says so, with the count')
  play(g, 'L', 80, 5)
  ok(!g.pressMood!.stir, 'the first defeat ends it')
  ok(stirAt({ hype: 0 }) === 5 && stirAt({ hype: 1 }) === 4 && stirAt({ hype: 9 }) === 3, 'talking it up brings the flip closer, never below three wins')
}

// ---- 4 and 5. the questions follow the needle; the answers move things ----
/** Run the weekly press until the room asks a question from `stem`. */
function askUntil(g: GameState, stem: string, seed: number): PressItem | null {
  const rng = mulberry32(seed)
  for (let i = 0; i < 40; i++) {
    g.press = []
    g.pressMood!.at = absWeek(g.season, g.week)   // no new results: hold the needle where the test put it
    generatePress(g, rng)
    const q = g.press.find(p => (p.qk ?? '').startsWith(stem))
    if (q) return q
    g.week = 3 + ((g.week - 2) % 30)
  }
  return null
}
const squadAvg = (g: GameState) => {
  const ps = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && !p.onLoan)
  return ps.reduce((a, p) => a + p.morale, 0) / ps.length
}
const setMorale = (g: GameState, m: number) => { for (const id of g.clubs[g.userClubId].players) if (g.players[id]) g.players[id].morale = m }
{
  const g = career(520)
  for (let i = 0; i < 6; i++) play(g, 'L', 70, i)
  const hostileQ = askUntil(g, 'press.baroHostile', 1)
  ok(!!hostileQ, `a hostile press asks about the job (${hostileQ?.qk})`)
  if (hostileQ) {
    // each answer, from the same starting point
    const tryAnswer = (idx: number) => {
      const c = JSON.parse(JSON.stringify(g)) as GameState
      setMorale(c, 5)
      c.fanMood = 50
      const pmBefore = c.pressMood!.v
      const m0 = squadAvg(c)
      answerPress(c, hostileQ.id, idx)
      const item = c.press.find(p => p.id === hostileQ.id)!
      return { dm: squadAvg(c) - m0, df: (c.fanMood ?? 0) - 50, dp: c.pressMood!.v - pmBefore, item }
    }
    const defend = tryAnswer(0), onMe = tryAnswer(1), deflect = tryAnswer(2), bite = tryAnswer(3), blame = tryAnswer(4)
    ok(defend.dm > 0.3 && defend.dp < 0, `defending the players lifts the squad (+${defend.dm.toFixed(2)}) and irritates the press (${defend.dp})`)
    ok(onMe.dp > 0, `taking responsibility calms the press (+${onMe.dp})`)
    ok(deflect.dp > 0 && Math.abs(deflect.dm) < 0.01, `deflecting calms the press (+${deflect.dp}) and leaves the squad as it was`)
    ok(bite.df > 2 && bite.dp <= -8, `biting back pleases the fans (+${bite.df}) and inflames the press (${bite.dp})`)
    ok(blame.dm < -0.3 && blame.dp > 0, `blaming the squad hurts morale (${blame.dm.toFixed(2)}) and feeds the press (+${blame.dp})`)
    const lines = effectLines(defend.item).map(l => l.k)
    ok(lines.includes('world.prFxSquadUp') && lines.includes('world.prFxPressDown'),
      `the coverage card says what defending did in words (${lines.join(', ')})`)
    const biteLines = effectLines(bite.item).map(l => l.k)
    ok(biteLines.includes('world.prFxFansUp') && biteLines.includes('world.prFxPressDown'), `and what biting back did (${biteLines.join(', ')})`)
  }

  const w = career(530)
  for (let i = 0; i < 6; i++) play(w, 'W', 80, i)
  ok(!!w.pressMood!.stir, 'six straight wins: stirring')
  const stirQ = askUntil(w, 'press.baro', 2)
  const stirStems = ['press.baroDeal', 'press.baroSuitor', 'press.baroRow', 'press.baroSmug']
  ok(!!stirQ && stirStems.some(s => (stirQ.qk ?? '').startsWith(s)),
    `a stirring press asks about the squad - contract, suitor, row or complacency (${stirQ?.qk})`)
  ok(!(stirQ?.qk ?? '').startsWith('press.baroWarm'), 'not the friendly question')

  // talking up a run brings the flip a win closer
  const h = career(540)
  for (let i = 0; i < 3; i++) play(h, 'W', 80, i)
  const warmQ = askUntil(h, 'press.baroWarm', 3)
  ok(!!warmQ, `a warm press asks a friendly question (${warmQ?.qk})`)
  if (warmQ) {
    const i = warmQ.options.findIndex(o => o.hype)
    answerPress(h, warmQ.id, i)
    ok((h.pressMood!.hype ?? 0) === 1, 'saying the side can go all the way is recorded as hype')
    ok(effectLines(h.press.find(p => p.id === warmQ.id)!).some(l => l.k === 'world.prFxHype'), 'and the card warns the press will be looking for a fall')
    play(h, 'W', 80, 3)
    ok(!!h.pressMood!.stir, 'so the press start stirring after four wins instead of five')
  }
}

// ---- 6. modest ----
{
  const all: PressItem[] = []
  for (const [seed, res] of [[550, 'L'], [551, 'W'], [552, 'W']] as const) {
    const g = career(seed)
    for (let i = 0; i < (seed === 552 ? 6 : seed === 551 ? 3 : 6); i++) play(g, res, 80, i)
    const rng = mulberry32(seed)
    for (let k = 0; k < 60; k++) {
      g.press = []
      g.pressMood!.at = absWeek(g.season, g.week)
      generatePress(g, rng)
      all.push(...g.press.filter(p => (p.qk ?? '').startsWith('press.baro')))
      g.week = 3 + ((g.week - 2) % 30)
    }
  }
  const opts = all.flatMap(q => q.options)
  const worst = (f: (o: typeof opts[number]) => number) => Math.max(0, ...opts.map(o => Math.abs(f(o))))
  ok(opts.length > 0, `barometer questions were asked across three careers (${all.length} questions)`)
  ok(worst(o => o.squad ?? 0) <= 0.5, `no answer moves squad morale more than 0.5 (max ${worst(o => o.squad ?? 0)})`)
  ok(worst(o => (o.fans ?? 0) * 5) <= 2.5, `no answer moves fan mood more than 2.5 points (max ${worst(o => (o.fans ?? 0) * 5)})`)
  ok(worst(o => o.press ?? 0) <= 8, `no answer moves the needle more than 8 (max ${worst(o => o.press ?? 0)})`)
  const stems = new Set(all.map(q => (q.qk ?? '').replace(/Q\d$/, '')))
  ok(['press.baroDeal', 'press.baroSuitor', 'press.baroRow', 'press.baroSmug'].filter(s => stems.has(s)).length >= 3,
    `a stirring press varies its subject (${[...stems].join(', ')})`)
  ok(all.every(q => q.options.length >= 3), 'every barometer question offers at least three ways to answer')
}

// ---- 7. old saves and new jobs ----
{
  const g = career(560)
  for (let i = 0; i < 3; i++) play(g, 'L', 80, i)
  const stored = g.pressMood!.v
  delete g.pressMood
  const read = currentMood(g)
  ok(g.pressMood === undefined, 'reading an old save does not write to it')
  ok(Math.abs(read.v - stored) < 0.2, `an old save reads the season so far (${read.v} against ${stored} settled week by week)`)
  settlePressMood(g)
  ok(g.pressMood != null && Math.abs(g.pressMood.v - stored) < 0.2, 'and the first weekly settle stores the same answer')

  const other = LEAGUE_OPP(g)[3]
  g.userClubId = other
  settlePressMood(g)
  ok(g.pressMood!.v === 0 && g.pressMood!.club === other, 'a new job starts level')
}

// ---- 8. the real weekly settle ----
{
  const g = newGame('northampton', 'Barometer', 570)
  for (let i = 0; i < 12; i++) processWeekAndAdvance(g)
  const pm = g.pressMood
  const played = g.fixtures.filter(f => f.played && f.compId !== 'fr' && (f.homeId === g.userClubId || f.awayId === g.userClubId)).length
  ok(!!pm && pm.at >= absWeek(g.season, g.week) - 1, `twelve real weeks: the settle keeps the needle current (at ${pm?.at}, now ${absWeek(g.season, g.week)})`)
  ok(!!pm && pm.v !== 0 && Math.abs(pm.v) <= 100, `and it has moved with ${played} real results (${pm?.v}, ${pm ? bandOf(pm.v) : '-'})`)
}

console.log(fails === 0
  ? '\nPRESS BAROMETER PASSED: results move it, runs and upsets move it more, five wins turn it on the squad, and the answers matter a little'
  : `\nPRESS BAROMETER FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
