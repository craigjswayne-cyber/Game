// Probe: finals are showpieces, not home games.
//
// Asked for directly: "the Premiership Final should always be at Twickenham.
// champions cup finals should be at random stadiums across Europe, twickenham,
// principality stadium, stadium velodrome and other 60,000+ stadiums. it
// should be a news story when its announced."
//
// Before this, a final was a fixture like any other: played at the first
// semi-final winner's ground, with his crowd, his home advantage and his
// catchment model deciding the gate. Wrong on every count for a final.
//
// What this holds, over two settled seasons:
//
//   the Premiership final is at Twickenham, every season, no draw involved.
//   the Top 14 final is at the Stade de France, same reasoning.
//   both European finals share one venue from the 60,000+ pool, the venue is
//     announced as a news story when the quarter-finals are drawn, and it is
//     never the same city two seasons running.
//   the URC and Championship finals stay at the higher seed's ground - those
//     competitions really do play home finals, and flattening every final to
//     Twickenham would be its own kind of wrong.
//   the gate reads the venue: a final's attendance is showpiece-sized, above
//     anything the finalists' own grounds could take, and never above the
//     venue's capacity.
//   the neutral ground reaches the engine: the same final simmed with and
//     without a venue produces different rugby, and the venue version leans
//     less toward the nominal home side (hfa is exactly 1 at a neutral
//     ground). Measured paired, same seeds, squads reset between sims.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { EURO_FINAL_VENUES } from '../src/game/model'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// settle two full seasons, snapshotting each final at the week it is played -
// the rollover sweeps the fixture list, so a final has to be caught in passing
const g2: GameState = newGame('northampton', 'Finals Probe', 707)
const captured: { season: number; fx: Fixture }[] = []
const announcements: { season: number; week: number }[] = []
for (let s = 0; s < 2; s++) {
  const startSeason = g2.season
  while (g2.season === startSeason) {
    processWeekAndAdvance(g2)
    for (const f of g2.fixtures) {
      if (f.stage === 'F' && f.played && g2.clubs[f.homeId] &&
        !captured.some(c => c.season === startSeason && c.fx.compId === f.compId)) {
        captured.push({ season: startSeason, fx: { ...f } })
      }
    }
    const a = g2.news.find(n => n.season === startSeason && n.subject.startsWith('🏟️ FINALS WEEKEND'))
    if (a && !announcements.some(x => x.season === startSeason)) {
      announcements.push({ season: startSeason, week: a.week })
    }
    if (g2.week > 200) { console.error('season never ended'); process.exit(1) }
  }
}

const finalOf = (season: number, compId: string) =>
  captured.find(c => c.season === season && c.fx.compId === compId)?.fx

console.log(`captured finals: ${captured.map(c => `s${c.season} ${c.fx.compId}@${c.fx.venue?.name ?? 'home ground'}`).join(', ')}\n`)

for (const s of [0, 1]) {
  const prem = finalOf(s, 'prem')
  ok(!!prem, `season ${s}: the Premiership final happened`)
  ok(prem?.venue?.name === 'Twickenham', `season ${s}: the Premiership final is at Twickenham (${prem?.venue?.name ?? 'nowhere'})`)
  const t14 = finalOf(s, 'top14')
  if (t14) ok(t14.venue?.name === 'Stade de France', `season ${s}: the Top 14 final is at the Stade de France (${t14.venue?.name ?? 'nowhere'})`)
  const cc = finalOf(s, 'cc')
  const chc = finalOf(s, 'chc')
  ok(!!cc && !!chc, `season ${s}: both European finals happened`)
  if (cc && chc) {
    ok(cc.venue != null && cc.venue.name === chc.venue?.name,
      `season ${s}: finals weekend shares one ground (${cc.venue?.name} / ${chc.venue?.name})`)
    ok((cc.venue?.capacity ?? 0) >= 60000, `season ${s}: the European venue seats 60,000+ (${cc.venue?.capacity?.toLocaleString()})`)
    ok(EURO_FINAL_VENUES.some(v => v.name === cc.venue?.name), `season ${s}: the venue comes from the announced pool`)
    // the gate reads the venue, not the nominal host's ground
    const homeCap = g2.clubs[cc.homeId]?.capacity ?? 0
    ok((cc.att ?? 0) > homeCap, `season ${s}: the CC final gate (${cc.att?.toLocaleString()}) outgrows the nominal host's ground (${homeCap.toLocaleString()})`)
    ok((cc.att ?? 0) <= (cc.venue?.capacity ?? 0), `season ${s}: and fits the venue`)
    ok((cc.att ?? 0) >= 55000, `season ${s}: showpiece-sized crowd (${cc.att?.toLocaleString()})`)
  }
  // home finals stay home where that is how the competition works
  const urc = finalOf(s, 'urc')
  if (urc) ok(urc.venue == null, `season ${s}: the URC final stays at the higher seed's ground`)
  const champ = finalOf(s, 'champ')
  if (champ) ok(champ.venue == null, `season ${s}: the Championship final stays home too`)
  // announced, as news, before the final is played
  const ann = announcements.find(a => a.season === s)
  ok(!!ann, `season ${s}: the venue was announced as a news story`)
  if (ann && cc) ok(ann.week < cc.week, `season ${s}: announced (wk ${ann.week}) before the final (wk ${cc.week})`)
}

// never the same city two seasons running
{
  const v0 = finalOf(0, 'cc')?.venue?.name
  const v1 = finalOf(1, 'cc')?.venue?.name
  ok(v0 != null && v1 != null && v0 !== v1, `the European venue rotates: ${v0} then ${v1}`)
}

// THE NEUTRAL GROUND REACHES THE ENGINE. Same fixture, same seeds, squads
// reset between sims: with a venue the nominal home side must win by less in
// aggregate than without one, because hfa is exactly 1 at a neutral ground.
{
  const w: GameState = newGame('northampton', 'Finals HFA', 313)
  const ids = Object.values(w.clubs).filter(c => c.leagueId === 'prem').map(c => c.id)
  const homeId = ids[0], awayId = ids[1]
  const snap = new Map<number, { cond: number; form: number; sharp?: number; rust?: number; bans: number; injury: unknown }>()
  for (const p of Object.values(w.players)) snap.set(p.id, { cond: p.cond, form: p.form, sharp: p.sharp, rust: p.rust, bans: p.bans, injury: p.injury })
  const restore = () => {
    for (const p of Object.values(w.players)) {
      const s0 = snap.get(p.id)!
      p.cond = s0.cond; p.form = s0.form; p.sharp = s0.sharp; p.rust = s0.rust; p.bans = s0.bans
      p.injury = s0.injury as typeof p.injury
    }
  }
  const mkFinal = (venue: boolean): Fixture => ({
    id: 999999, compId: 'prem', round: 99, week: 43, homeId, awayId,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage: 'F',
    ...(venue ? { venue: { name: 'Twickenham', city: 'London', capacity: 82000 } } : {}),
  })
  const N = 800
  let marginVenue = 0, marginNo = 0, differed = 0
  for (let i = 0; i < N; i++) {
    const fa = mkFinal(true)
    restore(); simMatch(w, fa, mulberry32(50_000 + i), false)
    const fb = mkFinal(false)
    restore(); simMatch(w, fb, mulberry32(50_000 + i), false)
    marginVenue += fa.homeScore - fa.awayScore
    marginNo += fb.homeScore - fb.awayScore
    if (fa.homeScore !== fb.homeScore || fa.awayScore !== fb.awayScore) differed++
  }
  restore()
  console.log(`\npaired hfa check over ${N} sims: home margin sum ${marginVenue} at Twickenham vs ${marginNo} at home (${differed} pairs differed)`)
  ok(differed > N / 2, `the venue changes the rugby, not just the caption (${differed}/${N} pairs differ)`)
  ok(marginVenue < marginNo, `the neutral ground takes the home edge away (margin ${marginVenue} < ${marginNo})`)
}

// nothing above smuggled in an em dash
{
  const dashes = g2.news.filter(n => n.season <= 1 && (n.subject + n.body).includes('—'))
  ok(dashes.length === 0, 'no em dashes in the finals coverage')
}

if (fails) { console.error(`\nFINALS PROBE: ${fails} failures`); process.exit(1) }
console.log('\nFINALS PROBE PASSED: the final is a showpiece and the whole game knows it')
