// Probe: the rewarded favours pay a fee's worth and not a penny more.
//
// docs/monetisation-spec.md §2-3.1: four watched-spot favours, each a
// mechanic the game already has with the FEE replaced, each behind a per-save
// ledger stamped in game-weeks so an instant-result marathon cannot farm it.
// The bridge's per-real-day cap lives in the wrapper; this holds OUR half:
//
//   the physio's favour cuts what the tin says, once per injury, twice a week
//   the agency's file is three a week and once per player a season
//   the analyst's all-nighter arms one match and expires with the week
//   the town's collection is small, bounded, weekly, thrice a season, and
//     stops dead the moment the club is no longer little or no longer broke
//   the whole ledger dies at rollover
//
// Run: npx tsx scripts/rewardedprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  agencyFile, analystArmed, armAnalyst, canAgencyFile, canPhysioFavour,
  canTownCollection, physioFavour, townCollection,
} from '../src/game/rewarded'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const hurt = (g: GameState, p: Player, weeks: number) => {
  p.injury = { desc: 'probe strain', dk: 'injury.hamstring', until: g.week + weeks }
  p.specialist = false
}

console.log('--- 1. the physio\'s favour\n')
{
  const g = newGame('northampton', 'Rewarded Probe', 8101)
  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]!).filter(p => !p.acad)
  const [a, b, c] = squad
  hurt(g, a, 10)
  ok(canPhysioFavour(g, a.id), 'a long lay-off qualifies')
  const before = a.injury!.until
  const said = physioFavour(g, a.id)
  ok(said != null, 'the favour goes through')
  ok(before - a.injury!.until === 2, `a fifth of ten weeks, capped at two, is two (${before - a.injury!.until})`)
  ok(a.specialist === true && !canPhysioFavour(g, a.id), 'one opinion per injury - favour and fee share the flag')
  ok(g.news[g.news.length - 1].k === 'news.physioFavour', 'and the story is filed, keyed')
  hurt(g, b, 4)
  const before2 = b.injury!.until
  physioFavour(g, b.id)
  ok(before2 - b.injury!.until === 1, 'a fifth of four weeks floors at one')
  hurt(g, c, 8)
  ok(!canPhysioFavour(g, c.id), 'the third favour in a game-week is refused')
  g.week += 1
  ok(canPhysioFavour(g, c.id), 'and the next week allows it again')
  hurt(g, squad[3], 2)
  ok(!canPhysioFavour(g, squad[3].id), 'a short knock never qualified in the first place')
}

console.log('\n--- 2. the agency\'s file\n')
{
  const g = newGame('northampton', 'Rewarded Probe', 8102)
  const mine = g.clubs[g.userClubId].players[0]
  ok(!canAgencyFile(g, mine), 'your own player has no agency file to buy - you already employ him')
  const others = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId).slice(0, 5)
  const sc0 = others[0].sc ?? 20
  ok(agencyFile(g, others[0].id), 'a target\'s file is shared')
  ok((others[0].sc ?? 0) >= sc0 + 30 || (others[0].sc ?? 0) === 100, 'and the knowledge lands exactly as paid scouting would')
  ok(!canAgencyFile(g, others[0].id), 'the same player is once a season')
  agencyFile(g, others[1].id)
  agencyFile(g, others[2].id)
  ok(!canAgencyFile(g, others[3].id), 'three files a game-week and the agency\'s phone goes to voicemail')
  g.week += 1
  ok(canAgencyFile(g, others[3].id), 'until next week')
}

console.log('\n--- 3. the analyst\'s all-nighter\n')
{
  const g = newGame('northampton', 'Rewarded Probe', 8103)
  ok(!analystArmed(g), 'no all-nighter is armed by itself')
  armAnalyst(g)
  ok(analystArmed(g), 'armed for this match')
  g.week += 1
  ok(!analystArmed(g), 'and gone with the week - the read was for THAT opponent')
}

console.log('\n--- 4. the town\'s collection\n')
{
  const g = newGame('bedford', 'Rewarded Probe', 8104)
  const club = g.clubs[g.userClubId]
  ok(club.rep < 60, `Bedford is the club this exists for (rep ${club.rep})`)
  club.balance = 10_000 // broke
  ok(canTownCollection(g), 'a little club in real trouble qualifies')
  const bal0 = club.balance, bud0 = club.budget
  const amt = townCollection(g)
  ok(amt != null && amt >= 25_000 && amt <= 75_000, `the bucket is bounded (${amt?.toLocaleString('en-GB')})`)
  ok(club.balance === bal0 + amt! && club.budget === bud0, 'it lands in the bank and buys nobody')
  ok(g.news[g.news.length - 1].k === 'news.townCollection', 'the town\'s story is filed, keyed')
  ok(!canTownCollection(g), 'once a game-week')
  g.week += 1; club.balance = 10_000
  townCollection(g)
  g.week += 1; club.balance = 10_000
  townCollection(g)
  g.week += 1; club.balance = 10_000
  ok((g.rewarded?.townSeason ?? 0) === 3 && !canTownCollection(g), 'three a season, then the town has given enough')
  const g2 = newGame('bedford', 'Rewarded Probe', 8105)
  g2.clubs[g2.userClubId].balance = 10_000
  g2.clubs[g2.userClubId].rep = 60
  ok(!canTownCollection(g2), 'and it stops dead at rep 60 - a big club never sees a bucket')
  const g3 = newGame('bedford', 'Rewarded Probe', 8106)
  // a fresh Bedford opens with under eight weeks of runway - which is exactly
  // who the lifeline exists for - so solvency has to be granted to test it
  g3.clubs[g3.userClubId].balance = 50_000_000
  ok(!canTownCollection(g3), 'a solvent club is not in trouble, whatever its size')
}

console.log('\n--- 5. the ledger dies with the season\n')
{
  const g = newGame('northampton', 'Rewarded Probe', 8107)
  armAnalyst(g)
  const others = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId)
  agencyFile(g, others[0].id)
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 60) {
    g.clubs[g.userClubId].boardConfidence = Math.max(70, g.clubs[g.userClubId].boardConfidence)
    processWeekAndAdvance(g)
  }
  ok(g.season === start + 1, `the season rolled (${guard} weeks)`)
  ok(g.rewarded === undefined, 'and the whole rewarded ledger went with it')
}

if (fails) { console.error(`\nREWARDED PROBE FAILED (${fails})`); process.exit(1) }
console.log('\nREWARDED PROBE PASSED: every favour is a fee replaced, on a leash')
