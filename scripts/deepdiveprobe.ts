// Probe: the ceiling is found, not given (1.8.2).
//
// Owner: "It shouldn't be easy to see the best youngsters and free agents;
// you should have to research and do deep dives."
//
// Proves, on real worlds:
//   1. nothing the manager sees for an unscouted man reads his true ceiling:
//      rewrite the hidden potential of every unscouted player and every list
//      and reading (ones to watch, the market's sort keys and price, the loan
//      window, the Wonderkid chip, the ceiling band) comes out the same
//   2. ones to watch names only men the scouts have read; the rest are leads
//      with no name, never free agents. The scouts' circular names its men
//      (owner, round 6) but gives away nothing the scouts have not read
//   3. the agency ranks only teenagers it could have seen play
//   4. scouting reveals: a shortlisted kid's band narrows week by week to the
//      number, and once read he is named
//   5. reading is a pure lens: none of it touches the save
//
// Run: npx vite-node scripts/deepdiveprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  WATCH_KNOW, knowledge, onesToWatch, paRange, scoutPa, searchKey, seenValue, wonderkidKnown, leadRow, youthPaMargin,
} from '../src/game/scout'
import { loanTargets } from '../src/game/loans'
import { agencyCanSee, agencyKids } from '../src/game/agency'
import { mulberry32 } from '../src/game/rng'
import { tIn } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const unread = (g: GameState, p: Player) => p.clubId !== g.userClubId && knowledge(g, p) < WATCH_KNOW
const noReading = (g: GameState, p: Player) => p.clubId !== g.userClubId && paRange(g, p) === null

/** Everything a screen reads, as one string, for the players it concerns. */
function view(g: GameState, ids: number[], leagueId: string) {
  const o = onesToWatch(g, leagueId)
  return JSON.stringify({
    named: o.named.map(p => p.id),
    loans: loanTargets(g).map(p => p.id),
    per: ids.map(id => {
      const p = g.players[id]!
      return [scoutPa(g, p), seenValue(g, p), searchKey(g, p, 'ca'), searchKey(g, p, 'value'), wonderkidKnown(g, p), paRange(g, p)]
    }),
  })
}

console.log('--- 1. the true ceiling of an unscouted man moves nothing the manager sees')
for (const [club, seed] of [['leicester', 11], ['bath', 22], ['pirates', 33]] as const) {
  const g = newGame(club, 'Deep Dive', seed)
  const league = g.clubs[g.userClubId].leagueId
  // the men with no reading at all: a name on a team sheet
  const blind = Object.values(g.players).filter(p => noReading(g, p) && p.age <= 23).map(p => p.id)
  const before = view(g, blind, league)
  const h = structuredClone(g)
  const r = mulberry32(seed)
  for (const id of blind) {
    const p = h.players[id]!
    p.pa = Math.max(p.ca, Math.min(99, p.ca + Math.floor(r() * 40)))
  }
  ok(view(h, blind, league) === before,
    `${club}: rewriting the ceiling of ${blind.length} unread men leaves every list, price and chip unchanged`)
  // the kids with a band but not a proper report: the band moves with the truth
  // (it is a reading of it), but the lists that NAME or FLAG a man must not
  const banded = Object.values(g.players).filter(p => unread(g, p) && !noReading(g, p) && p.age <= 21)
  const h2 = structuredClone(g)
  for (const p of banded) h2.players[p.id]!.pa = 99
  const o1 = onesToWatch(g, league).named.map(p => p.id).join(), o2 = onesToWatch(h2, league).named.map(p => p.id).join()
  ok(o1 === o2 && banded.every(p => !wonderkidKnown(h2, h2.players[p.id]!)),
    `${club}: ${banded.length} half-read kids made generational: none named or chipped until the scouts file a proper report`)
}

console.log('--- 2. ones to watch names only the men the scouts have read; the circular names, and reveals nothing')
for (const [club, seed] of [['leicester', 11], ['northampton', 5], ['exeter', 7]] as const) {
  const g = newGame(club, 'Deep Dive', seed)
  const league = g.clubs[g.userClubId].leagueId
  const o = onesToWatch(g, league)
  ok(o.named.every(p => !unread(g, p)), `${club}: ${o.named.length} named, every one read (knowledge ${WATCH_KNOW}+) or our own`)
  ok(o.named.every(p => p.clubId != null), `${club}: no free agent on the Ones to Watch list, scouted or not`)
  ok(o.leads.length <= 3 && o.leads.every(p => p.clubId != null && unread(g, p)),
    `${club}: ${o.leads.length} leads, none a free agent and none already read`)
  ok(o.leads.every(p => !tIn('en', 'news.watchLead', leadRow(g, p)).includes(p.name.split(' ').slice(-1)[0])),
    `${club}: a lead carries no name`)
  const topTrue = Object.values(g.players).filter(p => p.age <= 21 && (p.clubId == null || g.clubs[p.clubId]?.leagueId === league))
    .sort((a, b) => b.pa - a.pa).slice(0, 8)
  const leaked = topTrue.filter(p => unread(g, p) && o.named.includes(p))
  ok(leaked.length === 0, `${club}: of the league's eight true best ceilings, ${topTrue.filter(p => o.named.includes(p)).length} named, and all of those read`)
  const fa = Object.values(g.players).filter(p => !p.clubId && p.age <= 21 && p.pa >= 86)
  ok(fa.every(p => !o.named.includes(p) || !unread(g, p)) && fa.every(p => !wonderkidKnown(g, p) || !unread(g, p)),
    `${club}: ${fa.length} high-ceiling free agents, none flagged before they are scouted`)
  // THE CIRCULAR NAMES THEM; THE PAGE STILL HAS TO BE EARNED (owner, round
  // 6). Every man in it is a name, an age, a position and a club, tappable,
  // and nothing more: no rating, no ceiling, no chip, and filing it moves no
  // man's knowledge, so his page reads what the scouts know of him.
  const circ = g.news.find(n => n.k === 'news.watchList')
  ok(!!circ, `${club}: the scouts' circular is filed`)
  if (circ) {
    const named = (circ.playerIds ?? []).map(id => g.players[id]!).filter(Boolean)
    const rows = JSON.parse(String(circ.v?.list_ll ?? '[]')) as Record<string, unknown>[]
    ok(named.length > 0 && named.every(p => circ.body.includes(p.name)), `${club}: the circular names every man it links (${named.length})`)
    ok(rows.every(r => r.k === 'news.watchNamed' && Object.keys(r).sort().join() === 'age,club,k,name,pos'),
      `${club}: each row is a name, an age, a position and a club, nothing more`)
    const fresh = newGame(club, 'Deep Dive', seed)
    ok(named.every(p => p.sc === fresh.players[p.id]!.sc), `${club}: naming them read nobody: knowledge as seeded`)
    const blindNamed = named.filter(p => unread(g, p))
    ok(blindNamed.every(p => !wonderkidKnown(g, p) && (paRange(g, p) === null || paRange(g, p)![1] - paRange(g, p)![0] >= 14)),
      `${club}: ${blindNamed.length} of them unread, and their pages show no chip and no close ceiling`)
    for (const lang of ['en', 'fr', 'ja'] as const) {
      const txt = tIn(lang, 'news.watchList', circ.v)
      ok(!/\{[a-z_]+\}/.test(txt) && named.every(p => txt.includes(p.name)), `${club}: the circular reads cleanly in ${lang}`)
    }
  }
}

console.log('--- 3. the agency ranks only the teenagers it could have seen')
{
  const g = newGame('bath', 'Deep Dive', 44)
  const kids = agencyKids(g)
  ok(kids.every(agencyCanSee), `all ${kids.length} on the day-one wonderkid list have played senior rugby`)
  const hiddenTop = Object.values(g.players).filter(p => p.clubId && p.age <= 21 && !agencyCanSee(p)).sort((a, b) => b.pa - a.pa).slice(0, 10)
  ok(hiddenTop.every(p => !kids.includes(p)), 'and the world\'s best unseen academy ceilings are not on it')
}

console.log('--- 4. scouting reveals the ceiling over time')
{
  const g = newGame('leicester', 'Deep Dive', 55)
  const league = g.clubs[g.userClubId].leagueId
  const kid = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && p.age <= 20 && knowledge(g, p) < 35 && p.pa >= 80)
    .sort((a, b) => a.id - b.id)[0]!
  ok(!!kid && paRange(g, kid) === null, `${kid.name} (${kid.age}) starts unread: no band at all`)
  g.shortlist.push(kid.id)
  const widths: string[] = []
  let named = false
  for (let w = 0; w < 8; w++) {
    processWeekAndAdvance(g)
    const p = g.players[kid.id]!
    const r = paRange(g, p)
    widths.push(r ? `${r[1] - r[0]}` : '?')
    if (onesToWatch(g, g.clubs[p.clubId!]?.leagueId ?? league).named.includes(p) || knowledge(g, p) >= WATCH_KNOW) named = true
  }
  const p = g.players[kid.id]!
  const r = paRange(g, p)
  console.log(`  band width week by week on the shortlist: ${widths.join(' > ')}; knowledge ${Math.round(knowledge(g, p))}`)
  ok(r != null && r[0] <= p.pa && p.pa <= r[1], 'the band he ends on holds his true ceiling')
  ok(named && wonderkidKnown(g, p) === (p.age <= 21 && scoutPa(g, p) >= 86), 'once read he can be named and chipped on the reading')
  p.sc = 100
  // RE-REFERENCED in 1.8.2 (devproject.ts, "potential that moves"): a young
  // man's ceiling now drifts with his seasons until his early twenties, so a
  // full file on a teenager is a narrow band that holds the truth, not the
  // number (scout.ts youthPaMargin). From 24 a full file reads it exactly.
  const fr = paRange(g, p)
  ok(!!fr && fr[0] <= p.pa && p.pa <= fr[1] && fr[1] - fr[0] <= 2 * youthPaMargin(g, p),
    `a full file on a ${p.age}-year-old is a narrow band that holds the truth (${fr?.[0]}-${fr?.[1]})`)
  const grown = { ...p, age: 24 }
  const gr = paRange(g, grown)
  ok(!!gr && gr[0] === grown.pa && gr[1] === grown.pa, 'and on a 24-year-old it reads the number itself')
}

console.log('--- 5. a pure lens')
{
  const g = newGame('bath', 'Deep Dive', 66)
  const before = JSON.stringify(g)
  onesToWatch(g, g.clubs[g.userClubId].leagueId); loanTargets(g); agencyKids(g)
  for (const p of Object.values(g.players).slice(0, 500)) { scoutPa(g, p); seenValue(g, p); paRange(g, p); wonderkidKnown(g, p) }
  ok(JSON.stringify(g) === before, 'reading the fog leaves the save byte-identical')
}

console.log(fails ? `\nDEEP DIVE PROBE FAILED (${fails})` : '\nDEEP DIVE PROBE PASSED: no unscouted ceiling leaks, and scouting is the way in')
if (fails) process.exit(1)
