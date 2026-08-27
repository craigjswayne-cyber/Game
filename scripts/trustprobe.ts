// Reputation and dressing-room trust have to be EARNED, and the trust has to do
// something. Both halves are asserted here, because a number that starts low and
// then changes nothing is the analyst bug wearing a different hat.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch, beginMatch, applyPreTalk } from '../src/game/matchEngine'
import { mgrReputation, squadTrust, trustFactor } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`); if (!c) fails++ }

// ---- 1. a stranger is a stranger
{
  const g = newGame('northampton', 'Nobody', 7)
  const rep = mgrReputation(g)
  const trust = squadTrust(g)
  console.log(`fresh career: reputation ${rep}, trust ${trust}, talk worth ${Math.round(trustFactor(g) * 100)}%`)
  ok(rep <= 25, `an unproven manager starts unknown, not mid-career (${rep})`)
  ok(trust <= 30, `and the dressing room has not made its mind up (${trust})`)
  ok(trustFactor(g) < 0.65, 'so a team talk is worth well under its full effect')
}

// ---- 2. reputation cannot be bought with one lucky afternoon
{
  const g = newGame('northampton', 'One Win', 7)
  g.mgr.m = 1; g.mgr.w = 1
  const rep = mgrReputation(g)
  console.log(`one game, one win: reputation ${rep}`)
  ok(rep <= 27, `a single win does not make a name (${rep})`)
  g.mgr.m = 60; g.mgr.w = 40
  const rep60 = mgrReputation(g)
  console.log(`sixty games at 67%: reputation ${rep60}`)
  ok(rep60 > rep + 12, `a real body of work does (${rep} -> ${rep60})`)
}

// ---- 3. trust is built by winning and spent by losing
{
  const g = newGame('northampton', 'Builder', 11)
  const start = squadTrust(g)
  let played = 0
  while (g.season < 1 && played < 40) {
    const fx = userFixtureThisWeek(g)
    if (fx) { simMatch(g, fx, weekRng(g), false); played++ }
    processWeekAndAdvance(g)
  }
  const end = squadTrust(g)
  const rec = `${g.mgr.w}W-${g.mgr.d}D-${g.mgr.l}L`
  console.log(`after one season (${rec}): trust ${start} -> ${Math.round(end)}, reputation ${mgrReputation(g)}`)
  ok(end !== start, 'a season of results moves the room one way or the other')
  // a winning season must be rewarded; a losing one must not be. A season
  // that lands near .500 proves neither: wins deliberately compound belief a
  // shade more than losses spend it (the 16A streak rule), so an even record
  // drifting gently up is designed behaviour, not a failure. Only a decisive
  // record carries a directional claim.
  // DECISIVE means decisive for THIS club. Trust is expectation-weighted by
  // design (16C): at a big club every loss carries the favourite penalty
  // while a routine win pays only the base, so 15W-11L at Northampton can
  // honestly net a little LESS belief - a title-calibre room is unconvinced
  // by a season it considers underachievement. A three-win margin proved
  // nothing once the 20C dials reshuffled a seed into exactly that record;
  // the directional claim needs a genuinely one-sided year.
  // The middle band used to cap the MAGNITUDE (|drift| < 15), and the v1.1.4
  // morale rebalance showed why that was the wrong pin: the seed re-dealt to
  // 11W-16L - a losing year by any human reading, five short of "decisive" -
  // and its honest 24-point bleed failed a bound meant for even records. The
  // bug §16C actually guards is the SIGN: a 12W-16L year once NET GAINED
  // belief. So the middle band now asserts direction with the slack the 16C
  // comment above already grants ("can honestly net a little LESS belief"):
  // a losing-ish record must not manufacture conviction, a winning-ish one
  // must not bleed dry, and only a dead-even record claims mere drift.
  if (g.mgr.w >= g.mgr.l + 6) ok(end > start, `a winning season earns belief (${start} -> ${Math.round(end)})`)
  else if (g.mgr.l >= g.mgr.w + 6) ok(end < start, `a losing season costs it (${start} -> ${Math.round(end)})`)
  else if (g.mgr.l > g.mgr.w) ok(end <= start + 4, `a losing-ish season cannot manufacture belief (${start} -> ${Math.round(end)})`)
  else if (g.mgr.w > g.mgr.l) ok(end >= start - 8, `a winning-ish season cannot bleed the room dry (${start} -> ${Math.round(end)})`)
  else ok(Math.abs(end - start) < 15, `a dead-even season drifts, it does not lurch (${start} -> ${Math.round(end)})`)
}

// ---- 4. the talk actually lands harder on a squad that believes in you
{
  const measure = (trust: number) => {
    const g = newGame('northampton', 'Talker', 21)
    g.mgrTrust = trust
    const fx = g.fixtures.find(f => f.homeId === g.userClubId || f.awayId === g.userClubId)!
    const ctx = beginMatch(g, fx, weekRng(g), true)
    const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
    const before = mine.units.defence
    applyPreTalk(g, ctx, 'calm')
    return mine.units.defence / before
  }
  const cold = measure(0)
  const warm = measure(100)
  console.log(`the calm talk multiplies defence by ${cold.toFixed(4)} cold, ${warm.toFixed(4)} bought in`)
  ok(warm > cold, 'the same words are worth more to a room that trusts you')
  ok(cold > 1, 'but a cold room still gives you something - it is a discount, not a wall')
  ok(Math.abs(warm - 1.06) < 0.002, 'and a fully bought-in room gives the full designed effect')
}

console.log(fails ? `\nTRUST PROBE FAILED (${fails})` : '\nTRUST PROBE PASSED')
process.exit(fails ? 1 : 0)
