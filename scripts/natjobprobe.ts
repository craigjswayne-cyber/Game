/**
 * ---- A PAID JOB THAT EXISTS ----
 *
 * "Become an International Coach" is a paid product. In a women's career the
 * game runs a six-nation Northern Championship and a four-nation Southern
 * series - ten unions - while the product's list of countries is the men's
 * sixteen. Six of them therefore had no women's Test programme at all, and a
 * buyer could pay, be appointed head coach of South Africa, and never be given
 * a match, because no fixture in that world names his country.
 *
 * That is the worst class of store defect: real money for nothing. This holds
 * the fix in both worlds.
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { applyPinnacle } from '../src/game/grants'
import { pickableNations, testNationsIn, NAT_TIERS } from '../src/game/nations'
import { processWeekAndAdvance } from '../src/game/season'
import type { GameState } from '../src/game/model'
import { sackManager } from '../src/game/jobs'
import { natCallUp, natDrop, natSquadHold, natWindow, NAT_SQUAD_FLOOR, NAT_SQUAD_SIZE } from '../src/game/country'
import { federationList, federationPick, natQualifies, sharesClubComp } from '../src/game/nations'
import { knowledge } from '../src/game/scout'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { interestPremium, transferInterest } from '../src/game/interest'
import { askingPrice, personalTermsDemand, sellerWillingness } from '../src/game/ai'
import { t } from '../src/game/i18n'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const worlds: [string, GameState][] = [
  ['men', newGame('bath', 'Test', 4242)],
  ['women', newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Test', 4242, undefined, 'coach', 'w')],
]

for (const [label, g] of worlds) {
  const live = new Set(testNationsIn(g))
  const offered = pickableNations(g).map(([n]) => n)
  const orphans = offered.filter(n => !live.has(n))
  console.log(`\n--- the ${label}'s game: ${live.size} Test nations, ${offered.length} offered`)
  ok(orphans.length === 0,
    `every country the product offers plays Test rugby in this world${orphans.length ? ` - orphans: ${orphans.join(', ')}` : ''}`)
  ok(offered.length > 0, 'and the picker is never empty')
  ok(!offered.includes('LIO'), 'the touring invitational is not offered as a national job')
}

// the women's world must have lost exactly the six with no programme
const wOffered = pickableNations(worlds[1][1]).map(([n]) => n)
const dropped = NAT_TIERS.map(([n]) => n).filter(n => !wOffered.includes(n))
console.log(`\nnot offered in a women's career: ${dropped.join(', ') || 'none'}`)
ok(dropped.length > 0, 'the women\'s list really is shorter than the men\'s')
// SOUTH AFRICA USED TO BE THE EXAMPLE HERE, and the assertion was that it must
// NOT be offered, because a women's world with only the Northern Championship
// and the Southern Four had no fixture for it - the job would have been a desk
// and no matches. 1.5.8 gave the women's year an autumn and a summer window, so
// the Springboks and Japan play five Tests apiece and the job is real.
//
// The specific name was always standing in for the rule, so the rule is what is
// checked now: nobody is offered a country whose calendar is empty. That cannot
// go stale the way a hard-coded 'RSA' just did.
const thinnest = wOffered
  .map(n => ({ n, tests: worlds[1][1].fixtures.filter(f =>
    worlds[1][1].comps[f.compId]?.isNational && (f.homeId === n || f.awayId === n)).length }))
  .sort((a, b) => a.tests - b.tests)[0]
ok(thinnest.tests >= 3,
  `every women's job offered has a real programme behind it - the thinnest is ${thinnest.n} with ${thinnest.tests} Tests`)

// ---- and the job you DO buy comes with matches ----
for (const [label, g] of worlds) {
  const took = applyPinnacle(g)
  ok(took, `${label}: the product appoints a coach`)
  const nat = g.natTeam
  ok(!!nat, `${label}: and a country with it (${nat})`)
  const fx = g.fixtures.filter(f => f.homeId === nat || f.awayId === nat)
  ok(fx.length > 0, `${label}: with ${fx.length} Test${fx.length === 1 ? '' : 's'} on the fixture list`)
  for (let i = 0; i < 44; i++) processWeekAndAdvance(g)
  const played = g.fixtures.filter(f => (f.homeId === nat || f.awayId === nat) && f.played)
  ok(played.length > 0, `${label}: and ${played.length} of them actually played inside a season`)
}

// ---- AND A COACH BETWEEN CLUB JOBS STILL COACHES HIS COUNTRY (1.8.1) ----
//
// A sacking does not end a national tenure, and the Profile offers "clear the
// desk and go all-in on country". The camp still opened empty for him, but
// the hold and the Test-week top-up both skipped an unemployed manager, so
// nobody named the squad: ENG lost 40-0, 5-69 and 3-74 with no players named.
{
  const g = newGame('bath', 'Test', 4242)
  applyPinnacle(g, 'ENG')
  const nat = g.natTeam!
  sackManager(g, 'news.sacked')
  ok(g.unemployed && g.natTeam === nat, `out of a club job and still ${nat} coach`)
  let tests = 0, short = 0, held = false
  for (let i = 0; i < 44; i++) {
    if (natWindow(g) && (g.natSquads[nat] ?? []).length < NAT_SQUAD_FLOOR && natSquadHold(g)) held = true
    const testNow = g.fixtures.some(f => !f.played && f.week === g.week && (f.homeId === nat || f.awayId === nat))
    processWeekAndAdvance(g)
    if (testNow) {
      tests++
      if ((g.natSquads[nat] ?? []).length < NAT_SQUAD_FLOOR) short++
    }
  }
  ok(held, 'the empty camp holds Continue for him, as it does for a coach in work')
  ok(tests > 0 && short === 0, `every one of his ${tests} Test weeks had a squad of ${NAT_SQUAD_FLOOR} or more (${short} short)`)
}

// ---- ONE MAN, TWO JOBS, NO FAVOURS (tester note 9.10, owner decision) ----
//
// A manager holding a Test job and a club job must get nothing for his club
// out of the national one. Each closed path is proved here.
{
  console.log('\n--- two jobs, no favours (9.10)')
  const openWindow = (g: GameState) => {
    for (let i = 0; i < 52 && !natWindow(g); i++) processWeekAndAdvance(g)
    return natWindow(g)
  }
  const g = newGame('bath', 'Test', 4242)
  applyPinnacle(g, 'ENG')
  const w = openWindow(g)
  ok(!!w, `an England window opens (week ${g.week})`)
  const nat = 'ENG', size = w!.size
  const squad = () => g.natSquads[nat] ?? []
  // the federation's list as it named it when the window opened
  const fed = federationList(g, nat, size)
  const mine = g.userClubId
  const ownFed = fed.filter(p => p.clubId === mine)
  // 1. his own club's picks are released as they would be to an AI federation
  ok(ownFed.length > 0 && ownFed.every(p => squad().includes(p.id)),
    `the federation would take ${ownFed.length} Bath men, and all ${ownFed.length} are in camp as the window opens`)
  // 2. and he cannot add an own-club fringe man the federation would not pick
  const fringe = Object.values(g.players).find(p => p.clubId === mine && natQualifies(p, nat) &&
    !p.injury && !p.natSquad && !fed.some(q => q.id === p.id))
  const fringeNo = fringe ? natCallUp(g, fringe.id) : null
  ok(!!fringe && fringeNo === t('reply.ownClubQuota', { player: fringe.name, club: g.clubs[mine].short, n: ownFed.length }),
    `capping his own fringe man to lift his value is refused: "${fringeNo}"`)
  // 3. a league rival loses no more men than the federation would take
  const rivals = [...new Set(fed.map(p => p.clubId!))].filter(c => c !== mine && sharesClubComp(g, mine, c))
  let rivalOk = rivals.length > 0, tried = 0, quotaNo = 0
  for (const c of rivals) {
    const quota = fed.filter(p => p.clubId === c).length
    // the raid: his whole English contingent, worst first, so the fringe men go before the stars
    const theirs = Object.values(g.players).filter(p => p.clubId === c && natQualifies(p, nat) && !p.injury && !p.natSquad)
      .sort((a, b) => a.ca - b.ca)
    for (const p of theirs) {
      tried++
      if (natCallUp(g, p.id) === t('reply.rivalQuota', { player: p.name, club: g.clubs[c].short, n: quota })) quotaNo++
    }
    const inCamp = squad().filter(id => g.players[id]?.clubId === c).length
    if (inCamp > quota) rivalOk = false
  }
  ok(rivalOk && quotaNo > 0, `${rivals.length} league rivals raided (${tried} call-ups tried, ${quotaNo} refused by the quota): none lost more men than the federation would take`)
  // 4. his own due men cannot be sent home
  const kept = ownFed[0]
  const keptNo = natDrop(g, kept.id)
  ok(keptNo === t('reply.ownClubKept', { player: kept.name, club: g.clubs[mine].short }) && squad().includes(kept.id),
    `sending his own club's pick home is refused: "${keptNo}"`)
  // 5. call-and-drop is not a morale lever on another club's player
  const target = squad().map(id => g.players[id]).find(p => p && p.clubId !== mine)!
  while (squad().length <= NAT_SQUAD_FLOOR) {
    const next = Object.values(g.players).find(p => natQualifies(p, nat) && !p.injury && !p.natSquad && !!p.clubId && !sharesClubComp(g, mine, p.clubId))
    if (!next || natCallUp(g, next.id)) break
  }
  natDrop(g, target.id)
  const afterOne = target.morale
  for (let i = 0; i < 10; i++) { natCallUp(g, target.id); natDrop(g, target.id) }
  ok(Math.abs(target.morale - afterOne) < 1e-9,
    `ten more call-and-drop cycles leave ${target.name}'s morale where one left it (${afterOne.toFixed(2)} -> ${target.morale.toFixed(2)})`)
  natCallUp(g, target.id)
  // 6. the camp teaches the CLUB's scouts nothing: knowledge is untouched by
  // being in his camp and by playing a Test under him
  const camp = squad().map(id => g.players[id]).filter(p => p && p.clubId !== mine)
  const before = camp.map(p => knowledge(g, p))
  const testFx = g.fixtures.find(f => !f.played && (f.homeId === nat || f.awayId === nat))
  if (testFx) simMatch(g, testFx, mulberry32(77), false)
  const after = camp.map(p => knowledge(g, p))
  ok(!!testFx && camp.length > 0 && before.every((k, i) => k === after[i]),
    `${camp.length} men from other clubs in his camp and a Test played: club scouting knowledge unchanged`)
  // 7. national standing and a camp place change nothing at the negotiating table
  const rivalMan = camp.find(p => p.clubId && sharesClubComp(g, mine, p.clubId))!
  const ctl = structuredClone(g)
  ctl.natTeam = null
  ctl.players[rivalMan.id].natSquad = false
  const cp = ctl.players[rivalMan.id]
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  ok(same(transferInterest(g, rivalMan), transferInterest(ctl, cp)) &&
    same(interestPremium(g, rivalMan), interestPremium(ctl, cp)) &&
    same(askingPrice(g, rivalMan), askingPrice(ctl, cp)) &&
    same(sellerWillingness(g, rivalMan), sellerWillingness(ctl, cp)) &&
    same(personalTermsDemand(g, rivalMan), personalTermsDemand(ctl, cp)) &&
    same(knowledge(g, rivalMan), knowledge(ctl, cp)),
    `${rivalMan.name} (${g.clubs[rivalMan.clubId!].short}, in his camp): interest, premium, price, willingness, terms and scouting read the same as for a manager with no Test job`)
  // 8. the Test-week top-up does not do the raiding for him either
  const g2 = newGame('bath', 'Test', 4242)
  applyPinnacle(g2, 'ENG')
  openWindow(g2)
  for (let i = 0; i < 12; i++) {
    const testNow = g2.fixtures.some(f => !f.played && f.week === g2.week && (f.homeId === nat || f.awayId === nat))
    if (testNow) break
    processWeekAndAdvance(g2)
  }
  // top-up runs inside the Test week's processing; read the camp as it stands after
  const f2 = federationList(g2, nat, NAT_SQUAD_SIZE)
  processWeekAndAdvance(g2)
  const s2 = [...(g2.natSquads[nat] ?? [])]
  const over = [...new Set(s2.map(id => g2.players[id]?.clubId).filter(Boolean) as string[])]
    .filter(c => sharesClubComp(g2, g2.userClubId, c) && s2.filter(id => g2.players[id]?.clubId === c).length > f2.filter(p => p.clubId === c).length)
  ok(s2.length >= NAT_SQUAD_FLOOR && over.length === 0,
    `an unnamed squad is topped up to ${s2.length} with no club he meets over its federation quota${over.length ? ` (over: ${over.join(', ')})` : ''}`)
  // 9. the rule exists only where the conflict does: out of a club job, he picks freely
  const g3 = newGame('bath', 'Test', 4242)
  applyPinnacle(g3, 'ENG')
  openWindow(g3)
  sackManager(g3, 'news.sacked')
  const fed3 = federationPick(g3, nat, size)
  const big = [...new Set(fed3.map(p => p.clubId!))][0]
  const q3 = fed3.filter(p => p.clubId === big).length
  const theirs3 = Object.values(g3.players).filter(p => p.clubId === big && natQualifies(p, nat) && !p.injury && !p.natSquad)
  for (const p of theirs3) natCallUp(g3, p.id)
  const took3 = (g3.natSquads[nat] ?? []).filter(id => g3.players[id]?.clubId === big).length
  ok(took3 > q3, `with no club job he may take ${took3} from ${g3.clubs[big].short} (the federation would take ${q3}): the national job itself is unchanged`)
}

console.log('')
if (fails === 0) console.log('NAT JOB PROBE PASSED: the paid job exists in both worlds, and it comes with matches')
else console.log(`NAT JOB PROBE FAILED (${fails})`)
process.exit(fails)
