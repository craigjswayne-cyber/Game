// Probe: the support has a voice, and it costs something.
//
// Owner, v1.1.12: "i think the impact of fans on clubs mood/social media
// messages etc should impact the game more. campaigns to get coaches out, press
// campaigns. it needs more depth." Plus the two moments he named:
//
//   "selling players - if you sell a big player, fans should complain"
//   "celebrate big signings more... fans on the streets, stupid updates of
//    people naming their babies after the coach... bad signings dent morale"
//   "other players in the squad should be affected by arrivals - positive but
//    nervous if in same position."
//
// state.fanMood already MATTERED - it moves the gate, the club shop, the home
// advantage and the pre-match atmosphere - but almost nothing moved IT except
// results, and nothing about it was ever addressed to the manager. A number
// only results can change is a readout, not a system. Four claims:
//
//   1. Selling a man the terraces loved costs mood, and costs more when nobody
//      asked you to sell him.
//   2. Signing one buys mood - and the squad reads it two ways, with the men in
//      that shirt taking it worst.
//   3. A support that has turned escalates through three stages, each announced
//      once, and recovery is announced too.
//   4. A running campaign presses board confidence every week - which is the
//      only thing that makes any of it more than a mood bar.
import { newGame } from '../src/game/newgame'
import { executeTransfer } from '../src/game/ai'
import { campaignStage, terraceStanding, terraceWeek } from '../src/game/terraces'
import type { Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

console.log('--- 1. sell one of their own, and the phone-ins start\n')
{
  const g = newGame('northampton', 'Terraces', 5150)
  const club = g.clubs[g.userClubId]
  const star = club.players.map(id => g.players[id]).filter((p): p is Player => !!p)
    .sort((a, b) => b.ca - a.ca)[0]
  const buyer = Object.values(g.clubs).find(c => c.id !== club.id && c.rep >= club.rep)!
  ok(terraceStanding(g, star, club.id) >= 0.42,
    `${star.name} (${star.ca}) is somebody the terraces would miss (${terraceStanding(g, star, club.id).toFixed(2)})`)
  const before = g.fanMood ?? 60
  const roomBefore = club.players.reduce((s, id) => s + (g.players[id]?.morale ?? 0), 0)
  executeTransfer(g, star, buyer.id, 4_000_000)
  const after = g.fanMood ?? 60
  ok(after < before, `selling him costs mood (${before.toFixed(1)} -> ${after.toFixed(1)})`)
  ok(g.news.some(n => n.k === 'news.fanSoldStar' || n.k === 'news.fanSoldIcon'),
    'and the support says so, in the news, by name')
  const roomAfter = club.players.reduce((s, id) => s + (g.players[id]?.morale ?? 0), 0)
  ok(roomAfter < roomBefore, `the dressing room reads it too (${roomBefore.toFixed(1)} -> ${roomAfter.toFixed(1)})`)

  // LISTED IS THE CLUB SAYING OUT LOUD THAT HE WAS FOR SALE, and it halves the
  // anger: the terraces were warned.
  const h = newGame('northampton', 'Terraces', 5150)
  const hclub = h.clubs[h.userClubId]
  const hstar = h.players[star.id]
  hstar.transferListed = true
  const hBefore = h.fanMood ?? 60
  executeTransfer(h, hstar, buyer.id, 4_000_000)
  const listedDrop = hBefore - (h.fanMood ?? 60)
  const unwantedDrop = before - after
  ok(listedDrop < unwantedDrop,
    `a listed man hurts less than one nobody asked you to sell (${listedDrop.toFixed(1)} vs ${unwantedDrop.toFixed(1)})`)
  void hclub
}

console.log('\n--- 2. sign one, and the town loses its head\n')
{
  const g = newGame('northampton', 'Terraces', 5151)
  const club = g.clubs[g.userClubId]
  // somebody genuinely better than what is already there
  const target = Object.values(g.players)
    .filter(p => p.clubId && p.clubId !== club.id && p.ca >= 84)
    .sort((a, b) => b.ca - a.ca)[0]
  const rivals = club.players.map(id => g.players[id])
    .filter((p): p is Player => !!p && p.pos === target.pos)
  const others = club.players.map(id => g.players[id])
    .filter((p): p is Player => !!p && p.pos !== target.pos && !(p.alt ?? []).includes(target.pos))
  const rivalBefore = rivals.reduce((s, p) => s + p.morale, 0) / (rivals.length || 1)
  const otherBefore = others.reduce((s, p) => s + p.morale, 0) / (others.length || 1)
  const moodBefore = g.fanMood ?? 60
  executeTransfer(g, target, club.id, 6_000_000)
  const moodAfter = g.fanMood ?? 60
  ok(moodAfter > moodBefore, `signing ${target.name} (${target.ca}) lifts the mood (${moodBefore.toFixed(1)} -> ${moodAfter.toFixed(1)})`)
  ok(g.news.some(n => n.k === 'news.fanSignedStar' || n.k === 'news.fanSignedIcon'),
    'and the town is heard about it')
  const rivalAfter = rivals.reduce((s, p) => s + (g.players[p.id]?.morale ?? 0), 0) / (rivals.length || 1)
  const otherAfter = others.reduce((s, p) => s + (g.players[p.id]?.morale ?? 0), 0) / (others.length || 1)
  ok(rivals.length > 0, `there are men in that shirt already (${rivals.length} ${target.pos})`)
  ok(rivalAfter < rivalBefore,
    `the men who play there are nervous, not delighted (${rivalBefore.toFixed(2)} -> ${rivalAfter.toFixed(2)})`)
  ok(otherAfter > otherBefore,
    `and everybody else takes it as ambition (${otherBefore.toFixed(2)} -> ${otherAfter.toFixed(2)})`)
}

console.log('\n--- 3. a campaign builds in stages, each announced once\n')
{
  const g = newGame('northampton', 'Terraces', 5152)
  const club = g.clubs[g.userClubId]
  ok(campaignStage(g) === 0, 'a new manager has no campaign against him')
  // A BAD RUN IS BOTH TERMS. A grumpy support behind a winning side is a moan
  // and a bad run with the terraces onside is a project, so the stage reads the
  // mood AND the board.
  g.fanMood = 35
  club.boardConfidence = 70
  terraceWeek(g)
  ok(campaignStage(g) === 0, 'a grumpy support behind a backed manager is not a campaign')
  club.boardConfidence = 55
  terraceWeek(g)
  ok(campaignStage(g) === 1, `the phone-ins start when both have gone (stage ${campaignStage(g)})`)
  ok(g.news.some(n => n.k === 'news.fanRumble'), 'and it is announced')
  const rumbles = () => g.news.filter(n => n.k === 'news.fanRumble').length
  terraceWeek(g); terraceWeek(g); terraceWeek(g)
  ok(rumbles() === 1, `a bad autumn is one story, not fifteen (${rumbles()})`)

  g.fanMood = 25; club.boardConfidence = 40
  terraceWeek(g)
  ok(g.news.some(n => n.k === 'news.fanBanners'), 'it escalates to banners and a hashtag')
  g.fanMood = 14; club.boardConfidence = 25
  terraceWeek(g)
  ok(g.news.some(n => n.k === 'news.fanPlane'), 'and then to a plane over the ground')
  ok(campaignStage(g) === 3, `which is as loud as it gets (stage ${campaignStage(g)})`)

  g.fanMood = 70; club.boardConfidence = 70
  terraceWeek(g)
  ok(g.news.some(n => n.k === 'news.fanForgiven'), 'and when the mood turns, the game says so')
  ok(g.fanCampaign === 0, 'with the campaign closed rather than left standing')
}

console.log('\n--- 4. and the board reads the same phone-ins\n')
{
  const g = newGame('northampton', 'Terraces', 5153)
  const club = g.clubs[g.userClubId]
  g.fanMood = 14
  club.boardConfidence = 60
  const before = club.boardConfidence
  for (let i = 0; i < 6; i++) terraceWeek(g)
  ok(club.boardConfidence < before,
    `six weeks of a plane costs real confidence (${before} -> ${club.boardConfidence.toFixed(1)})`)
  // AND IT STOPS. The first draft drained the board without a floor and
  // difficultyprobe caught what that meant: a sleepwalking minnow bottomed at
  // 34 where it used to bottom at 50, because forty weeks of a grumble is
  // sixteen points whatever happens on the pitch. An angry support makes
  // directors doubt you; results are what end it.
  for (let i = 0; i < 200; i++) terraceWeek(g)
  ok(club.boardConfidence >= 40,
    `but a whole season of it never takes the board below the floor (${club.boardConfidence.toFixed(1)})`)
  const low = newGame('northampton', 'Terraces', 5155)
  low.fanMood = 14
  low.clubs[low.userClubId].boardConfidence = 22
  for (let i = 0; i < 20; i++) terraceWeek(low)
  ok(low.clubs[low.userClubId].boardConfidence === 22,
    `and a board already below it is left entirely to the results (${low.clubs[low.userClubId].boardConfidence})`)

  const h = newGame('northampton', 'Terraces', 5154)
  const hclub = h.clubs[h.userClubId]
  h.fanMood = 85
  hclub.boardConfidence = 60
  const hBefore = hclub.boardConfidence
  for (let i = 0; i < 6; i++) terraceWeek(h)
  ok(hclub.boardConfidence > hBefore,
    `and a support that has fallen for you buys time upstairs (${hBefore} -> ${hclub.boardConfidence.toFixed(1)})`)
}

console.log(fails ? `\nTERRACE PROBE FAILED (${fails})` : '\nTERRACE PROBE PASSED: the support has a voice, and it costs something')
process.exit(fails ? 1 : 0)
