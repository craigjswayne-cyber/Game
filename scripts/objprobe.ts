// Probe: a season objective is not ticked before it has been earned.
//
// Reported live, from a new Bedford save: "one of the season objectives had been
// completed without a game being played." It had. The board's brief was "balance
// the books: finish the season in the black", Bedford opens with £240k in the
// bank, met() is `balance >= 0`, so the screen put a green tick against it in
// week 1 of pre-season.
//
// The bug is a category error rather than a wrong number. Three of the four
// objectives are ACHIEVEMENTS - six starts given, a derby won, the knockouts
// reached - and once true they can never become false, so a tick is honest the
// instant it appears. The fourth is a STANDING CONDITION that happens to be true
// today and says nothing whatever about May. ObjectiveDef.banked is the
// distinction; this holds it.
//
// Two things are checked, and the second is the one that would catch a future
// objective added carelessly:
//
//   nothing is ticked in week 1 of a fresh career, at any club
//   every objective marked banked really is monotonic - simulate a season and it
//     must never go from met back to unmet
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { OBJECTIVE_DEFS } from '../src/game/objectives'
import { newsBody, newsSubject, type GameState, type NewsItem } from '../src/game/model'
import { ensureLang, setLang, type Lang } from '../src/game/i18n'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// A spread of clubs on purpose: Bedford is the reported one, and a Championship
// club with a small balance is a different case from a rich Premiership one.
const CLUBS = ['bedford', 'northampton', 'bath', 'newcastle', 'ealing']

console.log('week 1 of a fresh career - nothing has been earned yet:\n')
for (const clubId of CLUBS) {
  const g: GameState = newGame(clubId, 'Objective Probe', 909)
  const mine = (g.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
  if (!mine.length) { bad(`${clubId}: no objectives were set at all`); continue }
  const played = g.fixtures.filter(f => f.played).length
  const shown = mine.map(o => `${o!.met(g) && o!.banked ? 'TICKED' : o!.met(g) ? 'on course' : 'not yet'} ${o!.id}`)
  console.log(`  ${clubId.padEnd(12)} balance £${Math.round(g.clubs[clubId].balance / 1000)}k · ${played} matches played · ${shown.join(' | ')}`)
  // the actual assertion: nothing may read as DONE before a ball is kicked
  for (const o of mine) {
    if (o!.met(g) && o!.banked) {
      bad(`${clubId}: "${o!.text(g)}" reads as complete in week 1, with ${played} matches played`)
    }
  }
}

console.log('\nand an objective that claims to be banked must never un-happen:\n')
{
  // Northampton, because it picks up the cup objective and plays a full calendar
  const g: GameState = newGame('northampton', 'Objective Probe', 4242)
  const watch = OBJECTIVE_DEFS.filter(o => o.banked)
  const everMet = new Set<string>()
  const flips: string[] = []
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 60) {
    processWeekAndAdvance(g)
    // STOP AT THE ROLLOVER. Monotonic means monotonic WITHIN a season: the new
    // campaign clears stats and rebuilds the fixture list, so of course six
    // starts and a won derby are no longer on the books. The first run of this
    // check walked one week past the boundary and reported the reset as the
    // game losing an objective it had already banked.
    if (g.season !== start) break
    for (const o of watch) {
      if (!o.applies(g)) continue
      const now = o.met(g)
      if (now) everMet.add(o.id)
      else if (everMet.has(o.id)) flips.push(`${o.id} at week ${g.week}`)
    }
  }
  console.log(`  objectives that came true over the season: ${[...everMet].join(', ') || 'none'}`)
  ok(flips.length === 0, `no banked objective went back to unmet${flips.length ? ` (${flips.join(', ')})` : ''}`)
  // and the unbanked one must be exactly the one we think it is, so that adding
  // a new standing condition without marking it forces a decision here
  const unbanked = OBJECTIVE_DEFS.filter(o => !o.banked).map(o => o.id)
  console.log(`  objectives that only settle at the final whistle: ${unbanked.join(', ') || 'none'}`)
  ok(unbanked.length > 0, 'at least one objective is honestly marked as unsettled until May')
}

// WHAT A BRIEF EARNS IS A MESSAGE, NOT A LINE ON THE CARD (owner, round 5).
// The objectives card on Home and on The Board no longer says "+£15k & board
// favour if met"; the inbox says it once, when the brief is met: the week a
// banked one comes true (news.objPaid), or at the season's end for one that
// only settles then (news.objPaidMay). Held here: every brief the board's
// verdict counts as met has exactly one such message that season, a missed
// one has none, the amount is the one the verdict pays, each reads in all six
// languages with nothing left in braces, and two runs file the same messages.
console.log('\nevery brief met is one short message, and it says what it earned:\n')
{
  const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
  for (const l of LANGS) await ensureLang(l)
  const season = (clubId: string, seed: number) => {
    const g: GameState = newGame(clubId, 'Objective Probe', seed)
    const start = g.season
    let guard = 0
    // gathered week by week: the inbox keeps only its newest stories, so a
    // brief met in October may have left it by May
    const seen = new Map<number, NewsItem>()
    const gather = () => { for (const n of g.news) if (n.season === start && (n.k === 'news.objPaid' || n.k === 'news.objPaidMay')) seen.set(n.id, n) }
    while (g.season === start && guard++ < 70) { processWeekAndAdvance(g); gather() }
    return { g, start, paid: [...seen.values()].sort((a, b) => a.id - b.id) }
  }
  for (const [clubId, seed] of [['northampton', 4242], ['bedford', 909], ['bath', 77]] as const) {
    const { g, paid } = season(clubId, seed)
    const verdict = [...g.news].reverse().find(n => n.k === 'news.boardHappy' || n.k === 'news.boardUnhappy')
    const rows = verdict ? (JSON.parse(String(verdict.v?.rows_ll ?? '[]')) as { k: string; text_k: string; amount: string }[]) : []
    const met = rows.filter(r => r.k === 'news.sideMet')
    console.log(`  ${clubId.padEnd(12)} ${met.length} of ${rows.length} briefs met · ${paid.map(n => `${n.k!.slice(5)} ${n.v?.head_k}`).join(' | ') || 'no messages'}`)
    ok(!!verdict, `${clubId}: the board gave its verdict at the season's end`)
    ok(paid.length === met.length, `${clubId}: one message for each brief met (${paid.length} for ${met.length})`)
    for (const r of met) {
      const mine = paid.filter(n => n.v?.head_k === `${r.text_k}Head`)
      ok(mine.length === 1, `${clubId}: ${r.text_k} met, and said once (${mine.length})`)
      if (mine[0]) ok(mine[0].v?.amount === r.amount, `${clubId}: ${r.text_k} names the sum the verdict pays (${mine[0].v?.amount} = ${r.amount})`)
    }
    for (const n of paid) {
      for (const l of LANGS) {
        setLang(l)
        const subj = newsSubject(n), body = newsBody(n)
        ok(!/\{[^{}\s]*\}/.test(subj + body) && !/—/.test(subj + body), `${clubId} ${l} ${n.k}: "${subj}" / "${body}"`)
        if (l === 'fr') ok(!/[^ ]:/.test(subj + body), `${clubId} fr ${n.k}: a non-breaking space before each colon`)
        ok(body.length <= 140, `${clubId} ${l} ${n.k}: short (${body.length} characters)`)
      }
      setLang('en')
    }
    const again = season(clubId, seed).paid
    ok(JSON.stringify(again) === JSON.stringify(paid), `${clubId}: a second run files the same messages`)
  }
}

// THE ACADEMY BRIEF COUNTS ACADEMY PLAYERS, NOT AN AGE (owner, round 6):
// "give 6+ starts to Academy players". A bought 20-year-old's starts no longer
// tick it; a graduate of this club's academy does, at any age; a graduate of
// somebody else's does not; an old save's graduate with no gradClub is ours.
console.log('\nthe academy brief counts the club\'s own academy players:\n')
{
  const youth = OBJECTIVE_DEFS.find(o => o.id === 'youth')!
  const { isClubAcademyPlayer, academyStarts } = await import('../src/game/objectives')
  const g: GameState = newGame('bath', 'Objective Probe', 1313)
  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]!).filter(Boolean)
  for (const p of squad) p.stats.starts = 0
  const bought = squad.find(p => !p.acad && !p.homegrown && p.age <= 21) ?? squad.find(p => !p.acad && !p.homegrown)!
  bought.age = Math.min(bought.age, 20)
  bought.stats.starts = 8
  ok(!isClubAcademyPlayer(g, bought) && !youth.met(g), `a bought ${bought.age}-year-old's eight starts do not meet it (${academyStarts(g)})`)
  bought.stats.starts = 0
  const grad = squad.find(p => !p.acad && p !== bought)!
  grad.homegrown = true; grad.gradClub = g.userClubId; grad.age = 26; grad.stats.starts = 6
  ok(isClubAcademyPlayer(g, grad) && youth.met(g), `a 26-year-old graduate of this academy does (${academyStarts(g)})`)
  grad.gradClub = 'leicester'
  ok(!isClubAcademyPlayer(g, grad) && !youth.met(g), 'a graduate of another club\'s academy does not')
  grad.gradClub = undefined
  ok(isClubAcademyPlayer(g, grad), 'an old save\'s graduate with no academy stamped is taken as ours')
  const scholar = squad.find(p => p.acad)
  if (scholar) {
    ok(isClubAcademyPlayer(g, scholar), 'a scholar still in the academy is an academy player')
    scholar.demoted = true
    ok(!isClubAcademyPlayer(g, scholar), 'a senior sent down by hand is not')
  }
  for (const l of ['en', 'fr', 'es', 'it', 'af', 'ja'] as Lang[]) {
    await ensureLang(l); setLang(l)
    const { t } = await import('../src/game/i18n')
    const s = t('objectives.youth')
    ok(!/21/.test(s) && !/\{/.test(s), `${l}: "${s}"`)
  }
  setLang('en')
}

if (fails) { console.error(`\nOBJECTIVE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nOBJECTIVE PROBE PASSED: nothing is ticked before it is earned')
