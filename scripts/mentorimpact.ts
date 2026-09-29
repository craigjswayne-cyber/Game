// Probe: what a mentoring pairing actually does, measured (1.8.0).
//
// Owner: "We need to rethink how we select these and the impact this has."
//
// Before 1.8.0 a paired kid rolled 4.5% a week (times the character fit) for +1
// on a RANDOM attribute - goal kicking for a prop as likely as scrummaging -
// printed on top of his rating for the summer's level pull to take back, and
// nothing recorded it. Now (mentoring.mentorWeek):
//
//   the mentor coaches what he has: points go only into attributes where he is
//     clearly better AND the kid's position uses them, paid for like all
//     training (ageing.trainPoint), so the kid's level does not inflate;
//   the lasting gain is rating points below potential, about one a season for
//     an average pairing, scaled by fit, position link, experience and load;
//   the screen's forecast is the rate the week actually rolls;
//   and every point lands on the pair's ledger, which the Team Report shows.
//
// This measures each of those, and prints the old effect beside the new.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  COACHED_PER_WEEK, GROWTH_PER_WEEK, POS_RATE, bondPace, canBeMentored, canMentor, mentorBoost, mentorFit,
  mentorForecast, mentorRamp, mentorRate, mentorStage, mentorTeaches, mentorWeek, pairBlock, pairChem, posLink, startMentoring,
} from '../src/game/mentoring'
import { absWeek } from '../src/game/model'
import { attrWeight } from '../src/game/attributes'
import { attrLevel } from '../src/game/ageing'
import { mulberry32 } from '../src/game/rng'
import type { GameState, Player } from '../src/game/model'

/** a `since` that makes the pairing forty weeks old this week */
const SETTLED = (h: GameState) => absWeek(h.season, h.week) - 39

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const f2 = (n: number) => n.toFixed(2)

const g: GameState = newGame('leicester', 'Mentor', 616)
const sq = g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p)
const seniors = sq.filter(canMentor)
const kids = sq.filter(p => canBeMentored(p) && p.ca < p.pa)

console.log('--- the position link')
{
  const mk = (pos: Player['pos'], alt: Player['pos'][] = []) => ({ pos, alt }) as Pick<Player, 'pos' | 'alt'>
  ok(posLink(mk('LP'), mk('LP')) === 'same', 'a loosehead teaching a loosehead is the same position')
  ok(posLink(mk('TP', ['LP']), mk('LP')) === 'same', 'a tighthead who covers loosehead counts as the same')
  ok(posLink(mk('HK'), mk('LP')) === 'related', 'a hooker teaching a prop is the same unit')
  ok(posLink(mk('FH'), mk('LP')) === 'other', 'a fly-half teaching a prop is not')
  ok(POS_RATE.same > POS_RATE.related && POS_RATE.related > POS_RATE.other, `and the rate follows it (${POS_RATE.same} / ${POS_RATE.related} / ${POS_RATE.other})`)
}

console.log('--- what he teaches')
{
  let pairs = 0, clean = 0
  for (const s of seniors) for (const k of kids) {
    const tk = mentorTeaches(s, k)
    pairs++
    if (tk.every(a => s.a[a] - k.a[a] >= 2 && attrWeight(k.pos, a) >= 0.5 && a !== 'lea')) clean++
  }
  ok(pairs > 50 && clean === pairs, `in all ${pairs} possible pairings, every coached attribute is one he is better at and the kid's position uses`)
  const prop = kids.find(k => ['LP', 'TP', 'HK'].includes(k.pos))
  if (prop) {
    const all = new Set(seniors.flatMap(s => mentorTeaches(s, prop)))
    ok(!all.has('goa') && !all.has('kic'), `nobody coaches a front-rower (${prop.name}) in kicking (${[...all].join(', ')})`)
  }
}

console.log('--- the forecast is the rate the week rolls')
{
  // measure mentorWeek over many weeks on a copy, putting the kid back each week
  // so the ceiling and the position cap never stop it
  // A SETTLED PAIR (1.8.2): forty weeks in, so the relationship's ramp is
  // what the screen quotes for it; the ramp itself is measured below
  const measure = (s: Player, k: Player, weeks = 6000) => {
    const h = structuredClone(g)
    h.mentors = [{ senior: s.id, kid: k.id, taught: {}, grew: 0, since: SETTLED(h) }]
    const kid = h.players[k.id]!
    const a0 = { ...kid.a }, ca0 = kid.ca, pers0 = kid.pers
    const rng = mulberry32(k.id * 31 + s.id)
    const pair = h.mentors[0]
    let coached = 0, grew = 0
    for (let w = 0; w < weeks; w++) {
      Object.assign(kid.a, a0); kid.ca = ca0; kid.tdebt = 0; kid.pers = pers0
      pair.taught = {}; pair.grew = 0
      mentorWeek(h, kid, rng)
      coached += Object.values(pair.taught).reduce((x, v) => x + (v ?? 0), 0)
      grew += pair.grew ?? 0
    }
    return { coached: coached / weeks, grew: grew / weeks }
  }
  const scored = seniors.flatMap(s => kids.map(k => ({ s, k, r: mentorRate(g, s, k), t: mentorTeaches(g.players[s.id]!, k).length })))
    .filter(x => x.t > 0).sort((a, b) => b.r - a.r)
  const best = scored[0], worst = scored[scored.length - 1], mid = scored[Math.floor(scored.length / 2)]
  for (const [label, x] of [['best', best], ['middle', mid], ['worst', worst]] as const) {
    const m = measure(x.s, x.k)
    const fc = mentorForecast(g, x.s, x.k)
    const rr = x.r * mentorRamp(x.s, x.k, 40)
    const expG = GROWTH_PER_WEEK * rr, expC = COACHED_PER_WEEK * rr
    console.log(`  ${label}: ${x.s.name} (${x.s.pos}, ${x.s.pers}) with ${x.k.name} (${x.k.pos}, ${x.k.pers}): fit ${mentorFit(x.s, x.k)}, ${posLink(x.s, x.k)}, rate ${f2(x.r)}`)
    console.log(`    a week: rating ${m.grew.toFixed(4)} (expected ${expG.toFixed(4)}), coached ${m.coached.toFixed(4)} (expected ${expC.toFixed(4)}); a season, as the screen quotes it: ${f2(fc.rating)} rating, ${f2(fc.coached)} coached`)
    ok(Math.abs(m.grew - expG) < expG * 0.25 + 0.002, `${label}: the rating roll lands at the rate the screen quotes`)
    ok(Math.abs(m.coached - expC) < expC * 0.25 + 0.003, `${label}: so does the coached roll`)
  }
  ok(best.r > worst.r * 2.5, `choosing well matters: best ${f2(best.r)}x against worst ${f2(worst.r)}x`)
  // an average pairing, established: its second season of the ramp
  let ramp2 = 0
  for (let w = 53; w <= 96; w++) ramp2 += mentorRamp(mid.s, mid.k, w)
  const avgRating = GROWTH_PER_WEEK * ramp2
  ok(avgRating > 0.7 && avgRating < 1.2, `an average established pairing is worth about one rating point a season (${f2(avgRating)} at rate 1.0)`)

  // OLD vs NEW, the same average pairing
  const oldPrinted = 0.045 * 44
  console.log(`  OLD: ${f2(oldPrinted)} random attribute points a season at an average fit, printed above the rating, no rating gain, nothing recorded`)
  console.log(`  NEW: ${f2(COACHED_PER_WEEK * 44)} coached points into what he is taught (paid for, level-neutral) + ${f2(avgRating)} rating points below potential, all on the ledger`)
}

console.log('--- coached points do not inflate the kid')
{
  const k = kids[0], s = seniors.sort((a, b) => mentorRate(g, b, k) - mentorRate(g, a, k))[0]
  // TEN SEASONS OF THE SAME PAIRING, NOT ONE (28 Sep 2026). A season is 44
  // rolls at 0.045 x the pairing's rate, about two coached points, so one
  // season came up empty often enough to fail "the season coached him" on
  // one of four shifted seed lists (0 points: {} ). The claim is that the
  // pairing coaches and does not print, so ten independent seasons are run
  // from the same start: coaching must land across them, and no single
  // season may move his level.
  let taughtAll = 0, worstMove = 0, kidName = '', lv0 = 0, lastTaught = ''
  for (let r = 0; r < 10; r++) {
    const h = structuredClone(g)
    h.mentors = [{ senior: s.id, kid: k.id, taught: {}, grew: 0, since: SETTLED(h) }]
    const kid = h.players[k.id]!
    // attrLevel reads the attributes only, so a rating point the pairing adds
    // does not move it: any change here is the coaching's
    lv0 = attrLevel(kid)
    const rng = mulberry32(5 + r * 7919)
    for (let w = 0; w < 44; w++) mentorWeek(h, kid, rng)
    taughtAll += Object.values(h.mentors[0].taught ?? {}).reduce((x, v) => x + (v ?? 0), 0)
    worstMove = Math.max(worstMove, Math.abs(attrLevel(kid) - lv0))
    kidName = kid.name; lastTaught = JSON.stringify(h.mentors[0].taught)
  }
  console.log(`  ${kidName} with ${s.name}: ${taughtAll} coached points over ten seasons (the last ${lastTaught}), level ${f2(lv0)}, moved at most ${f2(worstMove)} in any one`)
  ok(taughtAll > 0, `the seasons coached him (${f2(taughtAll / 10)} points a season)`)
  ok(worstMove < 1.5, 'and his level barely moved in any of them: coaching directs, it does not print')
  const rng = mulberry32(5)
  // at his ceiling there is no rating to gain
  const h2 = structuredClone(g)
  h2.mentors = [{ senior: s.id, kid: k.id, taught: {}, grew: 0 }]
  const capped = h2.players[k.id]!
  capped.pa = capped.ca
  for (let w = 0; w < 44; w++) mentorWeek(h2, capped, rng)
  ok((h2.mentors[0].grew ?? 0) === 0 && capped.ca === k.ca, 'and a kid at his ceiling gains no rating from it')
}

console.log('--- a pairing grows: it is not switched on (1.8.2)')
{
  // Owner: "Mentoring should grow or flourish over time, not be an instant
  // success." Every possible pairing at six clubs, read on the ramp.
  const rows: { s: Player; k: Player; r: number; c: number }[] = []
  for (const [club, seed] of [['leicester', 1], ['northampton', 2], ['bath', 3], ['saracens', 4], ['exeter', 5], ['gloucester', 6]] as const) {
    const w = newGame(club, 'Ramp', seed)
    const wsq = w.clubs[w.userClubId].players.map(id => w.players[id]).filter((p): p is Player => !!p)
    for (const s of wsq.filter(canMentor)) for (const k of wsq.filter(canBeMentored)) rows.push({ s, k, r: mentorRate(w, s, k), c: pairChem(s, k) })
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const span = (x: { s: Player; k: Player }, a: number, b: number) => { let t = 0; for (let w = a; w <= b; w++) t += mentorRamp(x.s, x.k, w); return t }
  const byChem = [...rows].sort((a, b) => b.c - a.c)
  const best = byChem[0], avg = byChem[Math.floor(byChem.length / 2)], worst = byChem[byChem.length - 1]
  const WEEKS = [1, 2, 4, 8, 12, 16, 24, 32, 44, 80]
  for (const [lab, x] of [['best', best], ['average', avg], ['worst', worst]] as const) {
    console.log(`  ${lab} (chemistry ${f2(x.c)}, pace ${bondPace(x.c).toFixed(1)} weeks): ` + WEEKS.map(w => `w${w} ${f2(mentorRamp(x.s, x.k, w))}`).join(', '))
  }
  ok(mentorRamp(avg.s, avg.k, 1) < 0.15, `week one of an average pairing is small (${f2(mentorRamp(avg.s, avg.k, 1))} of the old flat rate)`)
  ok(WEEKS.every((w, i) => i === 0 || mentorRamp(avg.s, avg.k, w) > mentorRamp(avg.s, avg.k, WEEKS[i - 1])), 'and it grows week on week')
  ok(mentorRamp(best.s, best.k, 24) > 1.1 && mentorStage(best.s, best.k, 24) === 'flourishing',
    `a good pair flourishes: ${f2(mentorRamp(best.s, best.k, 24))} by week 24, stage ${mentorStage(best.s, best.k, 24)}`)
  ok(mentorRamp(worst.s, worst.k, 80) < 0.65 && mentorStage(worst.s, worst.k, 24) === 'stalled',
    `a poor pair stalls: ${f2(mentorRamp(worst.s, worst.k, 80))} even at week 80, stage ${mentorStage(worst.s, worst.k, 24)}`)
  ok(mentorStage(best.s, best.k, 2) === 'early' && mentorStage(worst.s, worst.k, 2) === 'early', 'every pairing is early days at first')
  ok(mentorStage(avg.s, avg.k, 8) === 'growing', `an average pair is growing at week 8 (${mentorStage(avg.s, avg.k, 8)})`)
  // the effect a week actually takes (rate x ramp) for the three, at week 1 and settled
  const eff = (x: typeof best, w: number) => x.r * mentorRamp(x.s, x.k, w)
  ok(eff(best, 44) > eff(worst, 44) * 4,
    `choosing well matters: once settled the best pair runs at ${f2(eff(best, 44))}x the old average and the worst at ${f2(eff(worst, 44))}x`)
  // SEASON TOTALS, the balance
  const old = mean(rows.map(x => GROWTH_PER_WEEK * x.r * 44))
  const first = mean(rows.map(x => GROWTH_PER_WEEK * x.r * span(x, 1, 44)))
  const second = mean(rows.map(x => GROWTH_PER_WEEK * x.r * span(x, 53, 96)))
  console.log(`  season rating points, mean over ${rows.length} real pairings: OLD flat ${f2(old)}, NEW first season ${f2(first)}, NEW established (second) season ${f2(second)}`)
  ok(Math.abs(second - old) / old < 0.1, `an established pairing is worth what a pairing was (${f2(second)} against ${f2(old)})`)
  ok(first < old * 0.9 && first > old * 0.6, `a first season is worth less: the front-loaded weeks are gone (${f2(first)})`)
  const st: Record<string, number> = {}
  for (const x of rows) { const k = mentorStage(x.s, x.k, 30); st[k] = (st[k] ?? 0) + 1 }
  console.log(`  stage at week 30 across them: ${JSON.stringify(st)}`)
  ok((st.flourishing ?? 0) > 0 && (st.stalled ?? 0) > 0 && (st.settled ?? 0) > (st.stalled ?? 0), 'some flourish, some stall, most settle')
  // the screen quotes the ramp: a new pairing is quoted less than the same one settled
  const w0 = newGame('leicester', 'Ramp', 1)
  const wsq0 = w0.clubs[w0.userClubId].players.map(id => w0.players[id]).filter((p): p is Player => !!p)
  const k0 = wsq0.filter(p => canBeMentored(p) && p.ca < p.pa - 6)[0], s0 = wsq0.filter(canMentor).sort((a, b) => mentorRate(w0, b, k0) - mentorRate(w0, a, k0))[0]
  const fNew = mentorForecast(w0, s0, k0)
  w0.mentors = [{ senior: s0.id, kid: k0.id, taught: {}, grew: 0, since: SETTLED(w0) }]
  const fOld = mentorForecast(w0, s0, k0)
  ok(fNew.rating < fOld.rating && fNew.stage === 'early', `the screen quotes a new pairing ${f2(fNew.rating)} for its first season and the same pair settled ${f2(fOld.rating)} (${fOld.stage})`)
}

console.log('--- the ledger, over real weeks')
{
  const h = newGame('northampton', 'Ledger', 5)
  // THE BOARD IS NOT UNDER TEST HERE. Sixty weeks of an unpicked Northampton is
  // a sacking since the honeymoon at a big club got short (season.ts,
  // honeymoonEnd), and an unemployed manager has no squad to mentor: the old
  // pairing below then waited twenty weeks for a training session that never
  // came. Keep the board content so the ledger is what is measured.
  const week = () => { h.clubs[h.userClubId].boardConfidence = Math.max(60, h.clubs[h.userClubId].boardConfidence); processWeekAndAdvance(h) }
  const hsq = h.clubs[h.userClubId].players.map(id => h.players[id]).filter((p): p is Player => !!p)
  // the pairing a manager reading the screen would make: the best-rated
  // mentor who has something to teach a kid with room to grow
  const best = hsq.filter(p => canBeMentored(p) && p.ca < p.pa - 4)
    .flatMap(k => hsq.filter(canMentor).filter(s => mentorTeaches(s, k).length).map(s => ({ s, k, r: mentorRate(h, s, k) })))
    .sort((a, b) => b.r - a.r)[0]
  const { s, k } = best
  const fc = mentorForecast(h, s, k)
  console.log(`  ${s.name} (${s.pos}) with ${k.name} (${k.pos}, ${k.age}, rated ${k.ca}, room ${k.pa - k.ca}): rate ${f2(fc.rate)}, teaches ${fc.teaches.join(', ') || 'nothing'}`)
  ok(startMentoring(h, s.id, k.id) === null, `a pairing can be started (${s.name} with ${k.name})`)
  const pair = h.mentors![0]
  ok(pair.since != null && pair.ca0 === k.ca && pair.grew === 0, 'and its ledger opens with the week and his rating')
  ok(pairBlock(h, s, k) === 'taken', 'the same kid cannot be paired twice')
  // fill the other places the same way, so the ledger check reads four
  // pairings rather than one run of dice
  for (const x of hsq.filter(p => canBeMentored(p) && p.ca < p.pa - 4)
    .flatMap(k2 => hsq.filter(canMentor).filter(s2 => mentorTeaches(s2, k2).length).map(s2 => ({ s2, k2, r: mentorRate(h, s2, k2) })))
    .sort((a, b) => b.r - a.r)) startMentoring(h, x.s2.id, x.k2.id)
  const started = h.mentors!.length
  // a good pairing can graduate early (he takes on his mentor's character),
  // so each pair's ledger is read as it stood on its last week
  const last = new Map(h.mentors!.map(mp => [mp.kid, { mp: structuredClone(mp), weeks: 0, ca: h.players[mp.kid]!.ca }]))
  for (let i = 0; i < 40; i++) {
    week()
    for (const mp of h.mentors ?? []) {
      const l = last.get(mp.kid)
      if (l) { l.mp = structuredClone(mp); l.weeks++; l.ca = h.players[mp.kid]!.ca }
    }
  }
  let coachedAll = 0, grewAll = 0, honest = true
  for (const [kid, l] of last) {
    const c = Object.values(l.mp.taught ?? {}).reduce((x, v) => x + (v ?? 0), 0)
    coachedAll += c; grewAll += l.mp.grew ?? 0
    if (l.ca - (l.mp.ca0 ?? 0) < (l.mp.grew ?? 0)) honest = false
    console.log(`  ${h.players[kid]!.name}: ${l.weeks} weeks, rating ${l.mp.ca0} -> ${l.ca} (${l.mp.grew} from the pairing), coached ${JSON.stringify(l.mp.taught)}`)
  }
  ok(started >= 3, `${started} pairings started`)
  ok(coachedAll + grewAll > 0, `the pairings put ${coachedAll} coached points and ${grewAll} rating points on their ledgers`)
  ok(honest, 'no ledger claims more rating than its kid actually gained')

  // a pairing from an older save has no ledger; its first week opens one
  // picked from the squad as it stands NOW, forty weeks on: the opening
  // squad's men may have left, aged out or reached their ceiling since, and
  // any of those dissolves a pairing before its first week can open a ledger
  const nowSq = h.clubs[h.userClubId].players.map(id => h.players[id]).filter((p): p is Player => !!p)
  const paired = new Set((h.mentors ?? []).flatMap(mp => [mp.kid, mp.senior]))
  // and young enough to still qualify after the summer birthday: forty weeks
  // in is the close season, the ledger opens in the first training week, and a
  // kid who ages out at the rollover graduates before it
  const k2 = nowSq.filter(p => canBeMentored(p) && canBeMentored({ ...p, age: p.age + 1 }) && !paired.has(p.id) && p.ca < p.pa - 1)[0]
  const s2 = nowSq.filter(p => canMentor(p) && !paired.has(p.id))[0]
  ok(!!k2 && !!s2, 'there is a free kid and a free senior to pair the old way')
  if (k2 && s2) {
    h.mentors = [...(h.mentors ?? []), { senior: s2.id, kid: k2.id }]
    // the ledger opens in the week's training (season.ts, mentorWeek), and
    // forty weeks in is the close season, when nobody trains: so it opens on
    // the first training week, whenever that falls
    let waited = 0
    const opened = () => h.mentors!.find(mp => mp.kid === k2.id)?.since != null
    while (!opened() && waited++ < 20) week()
    ok(!h.unemployed, 'and the manager is still in the job to see it')
    const old = h.mentors!.find(mp => mp.kid === k2.id)
    ok(!!old && old.since != null && old.ca0 != null, `a pairing from an older save opens its ledger on its first training week (${waited} week(s))`)
  }
}

console.log('--- the fit is still mean-neutral (mentorprobe holds the world figure)')
{
  const bs = seniors.flatMap(s => kids.map(k => mentorBoost(s, k)))
  const mean = bs.reduce((a, b) => a + b, 0) / bs.length
  ok(Math.abs(mean - 1) < 0.3, `this squad's average fit multiplier is ${f2(mean)}`)
}

console.log(fails ? `\nMENTOR IMPACT PROBE FAILED (${fails})` : '\nMENTOR IMPACT PROBE PASSED: a pairing teaches what the mentor has, and the screen tells the truth about it')
process.exit(fails ? 1 : 0)
