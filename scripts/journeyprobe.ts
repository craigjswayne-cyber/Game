/**
 * ---- PLAY THE WHOLE MATCH, THEN CHECK THE CARD TELLS THE TRUTH ----
 *
 * "I didnt make any subs and it said I completed my goal."
 *
 * That is a bug report about a JOURNEY, and it is the reason this file exists.
 * Every part of it worked. gradeFixes did exactly what it was written to do.
 * coachFixes returned the right two fixes. MatchDay rendered them correctly.
 * The fault lived in the seam: the coach set homework called "using the bench",
 * the manager ignored it, the complaint happened not to fire the following week
 * for unrelated reasons, and silence was read as compliance. No unit was wrong.
 * The story the game told across two match days was.
 *
 * Two hundred and fifteen probes call functions. Almost none of them PLAY, and
 * the ones that do play stop at the whistle. So the blind spot is exact:
 *
 *     A UNIT TEST ASKS WHETHER A FUNCTION IS RIGHT.
 *     THIS ASKS WHETHER THE GAME IS TELLING THE TRUTH ABOUT WHAT JUST HAPPENED.
 *
 * Three managers play the same fixtures, tick by tick, and are judged on what
 * the full-time card then says to them:
 *
 *   THE MANAGER WHO NEVER GOES TO HIS BENCH. He must never once be told he did.
 *     This is the reported bug, held shut.
 *   THE MANAGER WHO EMPTIES IT. He must be able to be told he did - a job that
 *     can never be marked done is a nag, not a loop, and the safe direction of
 *     the fix (assume not done) makes that failure easy to ship and invisible.
 *   THE MANAGER WHO LOSES A MAN. The card has to name him, and the arithmetic
 *     of fourteen against fifteen has to survive to full time.
 *
 * And underneath all three, the numbers on the card are checked against the
 * match that produced them: the score against the events that scored it, the
 * try count against the tries, the men on the pitch against the men sent off.
 * A scoreboard that disagrees with its own commentary is the most-read lie a
 * sports game can tell.
 *
 * Run: npx vite-node scripts/journeyprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { beginMatch, playSegment, makeSubstitution, matchStats, MAX_SUBS } from '../src/game/matchEngine'
import type { LiveCtx, SideCtx } from '../src/game/matchEngine'
import { coachFixes, gradeFixes, type FixTag } from '../src/game/coachfix'
import { mulberry32 } from '../src/game/rng'
import { rolesForSlot } from '../src/game/roles'
import type { GameState, Fixture } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const say = (s: string) => console.log(s)

type Journey = 'none' | 'empty'

interface Played {
  ctx: LiveCtx
  mine: SideCtx
  opp: SideCtx
  fx: Fixture
  fixes: { head: string; how: string; tag: FixTag }[]
}

/**
 * Eighty minutes, played the way a real manager plays them.
 *
 * playSegment is what the Skip button does: it runs to the next stoppage and
 * answers any kickable penalty by taking the points. Substitutions happen at
 * the stoppages, because that is when the game offers them - a probe that
 * reached into ctx and set subsUsed would prove nothing about the seam that
 * broke.
 */
function playMatch(g: GameState, fx: Fixture, journey: Journey): Played {
  const rng = mulberry32(fx.id * 7919 + 13)
  const ctx = beginMatch(g, fx, rng, true, g.userClubId)
  const mine = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  let guard = 0
  while (ctx.seg !== 3 && guard++ < 12) {
    playSegment(g, ctx)
    if (journey === 'empty' && ctx.seg !== 3) spendBench(g, ctx, mine)
  }
  const club = g.clubs[mine.teamId]
  return { ctx, mine, opp, fx, fixes: coachFixes(g, ctx, mine, opp, club?.tactic ?? null, 2) }
}

/** Take the tiredest men off for whoever is fit on the bench, up to the cap. */
function spendBench(g: GameState, ctx: LiveCtx, mine: SideCtx) {
  let sane = 0
  while (ctx.subsUsed < MAX_SUBS && sane++ < 40) {
    const starters = mine.lineup.slice(0, 15).filter((id): id is number => id != null)
    const bench = mine.lineup.slice(15).filter((id): id is number => id != null)
    const tired = starters
      // only men who are actually out there: a shirt in the XV with nobody in
      // it (sent off, taken off under Law 3.20) is not a substitution
      .filter(id => mine.onPitch.has(id))
      .sort((a, b) => (mine.energy.get(a) ?? 100) - (mine.energy.get(b) ?? 100))
    const fresh = bench.filter(id => !mine.onPitch.has(id) && !g.players[id]?.injury)
    if (!tired.length || !fresh.length) break
    const before = ctx.subsUsed
    for (const inId of fresh) {
      makeSubstitution(g, ctx, tired[0], inId)
      if (ctx.subsUsed > before) break
    }
    if (ctx.subsUsed === before) break   // nobody legal left: stop, do not spin
  }
}

/** A season of the user's own fixtures, played out under one journey. */
function season(seed: number, journey: Journey, want: number, aggression?: number): Played[] {
  const g: GameState = newGame('northampton', 'Journey', seed)
  const club = g.clubs[g.userClubId]
  // manage the admin like a grown-up, so the admin fixes do not crowd the panel
  club.tactic.roles = Array.from({ length: 15 }, (_, i) => rolesForSlot(i)[0]?.id ?? null)
  club.tactic.kickers = club.players.slice(0, 2)
  if (aggression != null) club.tactic.aggression = aggression
  const out: Played[] = []
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 44 && out.length < want) {
    const fx = g.fixtures.find(f =>
      f.week === g.week && !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId))
    if (fx) out.push(playMatch(g, fx, journey))
    processWeekAndAdvance(g)
  }
  return out
}

const WANT = 14
const untouched = season(4242, 'none', WANT)
const emptied = season(4242, 'empty', WANT)

/**
 * THE THIRD MANAGER: the one who plays on the edge and loses a man.
 *
 * A sending-off is the rarest of the three journeys and the one most likely to
 * leave a screen lying, because it changes a number every later tick reads. It
 * cannot be waited for - a red is about one afternoon in thirty even with the
 * Physicality dial buried - and it must not be faked either, because a ctx with
 * `sent` poked into it proves nothing about the path that sets it.
 *
 * So the same afternoon is played over and over with the dice re-rolled, which
 * is the cheap way to reach a rare branch honestly: every one of these is a real
 * match, played tick by tick, and the reds in them are reds the engine awarded.
 * A different fixture id each time means a different referee too, so the sample
 * is not one whistle's opinion repeated.
 */
const REDS_WANTED = 3
function edgeMatches(tries: number): Played[] {
  const g: GameState = newGame('northampton', 'Journey', 3131)
  const club = g.clubs[g.userClubId]
  club.tactic.roles = Array.from({ length: 15 }, (_, i) => rolesForSlot(i)[0]?.id ?? null)
  club.tactic.kickers = club.players.slice(0, 2)
  club.tactic.aggression = 100
  const base = g.fixtures.find(f =>
    f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!
  const out: Played[] = []
  let reds = 0
  // keep going until enough sendings-off have really happened, rather than
  // playing a fixed number and hoping: a probe whose sample size depends on the
  // engine's card rate goes quietly vacuous the day that rate is tuned down
  for (let k = 0; k < tries && reds < REDS_WANTED; k++) {
    // BOTH treatment rooms are emptied between attempts: this is many goes at
    // one afternoon, not two squads played into the ground. Missing the away
    // side the first time round had Glasgow finishing with twelve men by the
    // hundredth replay, which the probe duly reported as an engine fault.
    for (const side of [base.homeId, base.awayId]) {
      for (const id of g.clubs[side]?.players ?? []) {
        const p = g.players[id]
        if (p) { p.injury = null; p.bans = 0 }
      }
    }
    const played = playMatch(g, { ...base, id: base.id + k * 37, played: false, events: undefined }, 'empty')
    if (played.ctx.events.some(e => e.type === 'RC' && e.teamId === played.mine.teamId)) reds++
    out.push(played)
  }
  return out
}
const edge = edgeMatches(600)
say(`${WANT} matches with the bench untouched, ${WANT} with it emptied, `
  + `${edge.length} played on the edge\n`)

// ---------------------------------------------------------------------------
// 1. THE SCOREBOARD AGREES WITH THE COMMENTARY THAT BUILT IT
//
// Reconstructed from the events the player read, because that is the version he
// can check. A five-point try that never appears in the feed, or a feed that
// awards points the scoreboard does not, is the game contradicting itself in
// front of him.
// ---------------------------------------------------------------------------
say('--- 1. the score on the card is the score the commentary described')
{
  const POINTS: Record<string, number> = { TRY: 5, CON: 2, PEN: 3, DG: 3 }
  let checked = 0
  const wrong: string[] = []
  for (const p of [...untouched, ...emptied, ...edge]) {
    for (const side of [p.ctx.home, p.ctx.away]) {
      const from = p.ctx.events
        .filter(e => e.teamId === side.teamId && POINTS[e.type] !== undefined)
        .reduce((s, e) => s + POINTS[e.type], 0)
      checked++
      if (from !== side.score) wrong.push(`fx ${p.fx.id} ${side.teamId}: card ${side.score}, commentary ${from}`)
      const tries = p.ctx.events.filter(e => e.teamId === side.teamId && e.type === 'TRY').length
      if (tries !== side.tries) wrong.push(`fx ${p.fx.id} ${side.teamId}: ${side.tries} tries claimed, ${tries} described`)
    }
    const st = matchStats(p.ctx)
    if (st.tries[0] !== p.ctx.home.tries || st.tries[1] !== p.ctx.away.tries) {
      wrong.push(`fx ${p.fx.id}: the stats panel and the scoreboard disagree about tries`)
    }
    if (p.fx.homeScore !== p.ctx.home.score || p.fx.awayScore !== p.ctx.away.score) {
      wrong.push(`fx ${p.fx.id}: the result written to the league is not the result played`)
    }
  }
  ok(wrong.length === 0, `${checked} scorelines rebuilt from their own commentary${wrong.length ? ` - ${wrong[0]}` : ''}`)
  wrong.slice(1, 4).forEach(w => console.log(`        ${w}`))
}

// ---------------------------------------------------------------------------
// 2. THE MANAGER WHO NEVER USED HIS BENCH IS NEVER TOLD HE DID
//
// The reported bug, held shut. The homework is set to the job he ignored and
// the grade is taken exactly as MatchDay takes it.
// ---------------------------------------------------------------------------
say('\n--- 2. the bench job cannot be marked done by a manager who never went to it')
{
  let told = 0
  for (const p of untouched) {
    const grade = gradeFixes(['fitness', 'setpiece'], p.fixes.map(f => f.tag), { fitness: p.ctx.subsUsed > 0 })
    if (grade.fixed.includes('fitness')) told++
  }
  ok(untouched.every(p => p.ctx.subsUsed === 0), `${untouched.length} matches played without a single change`)
  ok(told === 0, `and not one of them was told the bench job was done (${told})`)
}

// ---------------------------------------------------------------------------
// 3. AND THE MANAGER WHO DID USE IT CAN BE TOLD SO
//
// The other half, and the one a careless fix breaks. gradeFixes was made
// stricter to close the bug above; strict enough that the job could NEVER be
// completed would turn the coach into a man who repeats himself for ever, and
// nothing in the first assertion would notice.
// ---------------------------------------------------------------------------
say('\n--- 3. and the manager who emptied it can complete the job')
{
  const used = emptied.filter(p => p.ctx.subsUsed > 0).length
  const closable = emptied.filter(p =>
    gradeFixes(['fitness'], p.fixes.map(f => f.tag), { fitness: p.ctx.subsUsed > 0 }).fixed.includes('fitness')).length
  const changes = emptied.reduce((s, p) => s + p.ctx.subsUsed, 0)
  ok(used === emptied.length, `${used} of ${emptied.length} matches saw the bench used (${changes} changes in all)`)
  ok(closable > 0, `the coach's bench homework can actually be finished (${closable} of ${emptied.length})`)
}

// ---------------------------------------------------------------------------
// 4. FOURTEEN MEN STAY FOURTEEN MEN
//
// A sending-off is the journey most likely to leave a screen lying, because it
// changes a number the whole rest of the match reads. The card also has to name
// him: "ten minutes a man short" is a statistic, a name is a selection.
// ---------------------------------------------------------------------------
say('\n--- 4. a man lost is a man missing, and the verdict names him')
{
  const all = [...untouched, ...emptied, ...edge]
  const miscount: string[] = []
  for (const p of all) {
    for (const side of [p.ctx.home, p.ctx.away]) {
      // fifteen shirts, less anyone sent off, anyone the referee took off under
      // Law 3.20, anyone hurt with an empty bench behind him, and anyone still
      // sitting out a bin at the final whistle
      const sittingOut = [...side.binned].filter(id => (side.yellowUntil.get(id) ?? 0) > p.ctx.lastMin).length
      const expect = 15 - side.sent - side.short - sittingOut
      if (side.onPitch.size !== expect) {
        miscount.push(`fx ${p.fx.id} ${side.teamId}: ${side.onPitch.size} on the pitch, ${expect} accounted for `
          + `(sent ${side.sent}, short ${side.short}, in the bin ${sittingOut})`)
      }
    }
  }
  ok(miscount.length === 0,
    `${all.length * 2} sides finished with every missing man accounted for${miscount.length ? ` - ${miscount[0]}` : ''}`)
  miscount.slice(1, 4).forEach(m => console.log(`        ${m}`))

  // WHENEVER the coach raises discipline he has to name somebody, and it has to
  // be somebody who was actually carded. Tested on yellows as well as reds
  // because they are the same sentence with a different noun, and a probe that
  // only ever sees the rare case has almost no sample.
  let raised = 0, named = 0
  const wrongName: string[] = []
  for (const p of all) {
    const disc = p.fixes.find(f => f.tag === 'discipline')
    if (!disc) continue
    raised++
    const cards = p.ctx.events
      .filter(e => (e.type === 'YC' || e.type === 'RC') && e.teamId === p.mine.teamId)
    // WHO THE SENTENCE IS ABOUT. A sending-off is about the man sent off; a
    // single bin is about the man binned. Two yellows to two men is deliberately
    // a statistic ("2 yellows, 20 minutes a man short"), because picking one of
    // them to name would be picking at random.
    const sent = cards.find(e => e.type === 'RC')
    const subject = sent ?? (cards.length === 1 ? cards[0] : null)
    if (!subject) { named++; continue }
    const name = String(subject.v?.player ?? '')
    if (!name || disc.head.includes(name)) named++
    else wrongName.push(`fx ${p.fx.id}: "${disc.head}" is about ${name}, and does not say so`)
  }
  ok(named === raised,
    `every discipline verdict names a man who was carded (${named} of ${raised})${wrongName.length ? ` - ${wrongName[0]}` : ''}`)

  // and a sending-off is severe enough to reach the card every single time
  const sentOff = all.filter(p => p.ctx.events.some(e => e.type === 'RC' && e.teamId === p.mine.teamId))
  const reached = sentOff.filter(p => p.fixes.some(f => f.tag === 'discipline')).length
  ok(sentOff.length >= REDS_WANTED,
    `${sentOff.length} matches ended with the user's side down to fourteen`)
  ok(reached === sentOff.length, `and every one of them reached the coach's verdict (${reached} of ${sentOff.length})`)
}

// ---------------------------------------------------------------------------
// 5. EVERY MATCH LEAVES A CARD WORTH READING
//
// The panel's own promise: a star man who played, settled ratings for the men
// who played, and two things to work on. Any of the three coming back empty is
// a full-time screen with a hole in it.
// ---------------------------------------------------------------------------
say('\n--- 5. every full-time card has something on it')
{
  const all = [...untouched, ...emptied, ...edge]
  const noStar = all.filter(p => p.ctx.motmId == null).length
  const ghostStar = all.filter(p =>
    p.ctx.motmId != null && !p.mine.ratings.has(p.ctx.motmId) && !p.opp.ratings.has(p.ctx.motmId)).length
  const noFinal = all.filter(p => !p.mine.finalR || p.mine.finalR.size === 0).length
  // The panel asks for two and renders however many it gets, with a singular
  // label for one (matchday.theFix). One is a quiet afternoon, not a fault.
  // NONE is a hole in the screen, and coachFixes promises never to return none.
  const empty = all.filter(p => p.fixes.length === 0).length
  const pair = all.filter(p => p.fixes.length === 2).length
  const dupe = all.filter(p => p.fixes.length === 2 && p.fixes[0].tag === p.fixes[1].tag).length
  ok(noStar === 0, `every match named a star man (${all.length - noStar} of ${all.length})`)
  ok(ghostStar === 0, `and he played in it (${ghostStar} ghosts)`)
  ok(noFinal === 0, `every match settled its ratings before the card read them (${noFinal} unsettled)`)
  ok(empty === 0, `every match gave the manager something to work on (${empty} blank)`)
  ok(pair >= all.length * 0.8, `and nearly all of them gave him two (${pair} of ${all.length})`)
  ok(dupe === 0, `never the same thing twice (${dupe})`)
}

console.log(fails
  ? `\nJOURNEY PROBE FAILED (${fails})`
  : '\nJOURNEY PROBE PASSED: the card tells the truth about the match that was played')
if (fails) process.exit(1)
