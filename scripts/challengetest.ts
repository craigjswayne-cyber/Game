// Scripted careers audit: every challenge runs two passive seasons without
// crashing, and completion only ever fires when its condition truly holds.
import { newGame, CHALLENGES } from '../src/game/newgame'
import { W, genderOfId } from '../src/game/gender'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { challengeCheck } from '../src/game/rollover'
import { simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'

let fails = 0
const bad = (msg: string) => { fails++; console.error(`CHALLENGE FAIL: ${msg}`) }

// ---- STOP THE CIRCUS, DRIVEN THROUGH THE REAL GATE ----
//
// A two-season passive audit never wins a league, so the branch below would
// have shipped untested. This forges the end-of-season state the check reads
// and calls challengeCheck itself: the title on its own, the title with each
// shape of record against Gloucester, and the record with no title.
{
  const uid = W + 'saracens'
  const title = [{ season: 0, compId: W + 'pwr', champion: uid }]
  const cases: [string, unknown[], Record<string, { w: number; d: number; l: number }>, boolean][] = [
    ['title + a winning record over Gloucester', title, { [W + 'glosharty']: { w: 3, d: 0, l: 1 } }, true],
    ['title + level with them', title, { [W + 'glosharty']: { w: 2, d: 1, l: 2 } }, false],
    ['title + beaten by them more often', title, { [W + 'glosharty']: { w: 1, d: 0, l: 3 } }, false],
    ['title + never met them', title, {}, true],
    ['a winning record but no title', [], { [W + 'glosharty']: { w: 5, d: 0, l: 0 } }, false],
  ]
  for (const [label, history, vsBook, want] of cases) {
    const g = newGame(uid, 'Audit Gaffer', 4242, 'threepeat', 'coach', 'w')
    g.season = 1
    g.history = history as typeof g.history
    g.vsBook = vsBook
    g.challengesDone = []
    challengeCheck(g)
    const got = (g.challengesDone ?? []).includes('threepeat')
    if (got !== want) bad(`stop the circus - ${label}: expected ${want}, got ${got}`)
    else console.log(`  ok  stop the circus - ${label}: ${got}`)
    // and the badge announces itself with its own line, not Penzance's
    if (got && !g.news.some(n => n.v?.line_k === 'news.chalCircus')) {
      bad('stop the circus completed with the wrong completion line')
    }
  }
}

for (const ch of CHALLENGES) {
  // the women's four are pinned to women's clubs, which only exist in the
  // women's world - newGame built with the default 'm' has no such club and
  // dies inside seedKnowledge with an undefined club rather than a message
  const g = newGame(ch.clubId, 'Audit Gaffer', 20260804, ch.id, 'coach', ch.gender ?? genderOfId(ch.clubId))
  if (g.challenge !== ch.id) bad(`${ch.id} not stamped at boot`)
  for (let season = 0; season < 2; season++) {
    const target = g.season + 1
    let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), false)
      // the audit measures the world, not the sack race
      g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
      processWeekAndAdvance(g)
    }
  }
  const done = (g.challengesDone ?? []).includes(ch.id)
  if (done) {
    // completion must be backed by the real condition, not a stray flag
    const uid = g.userClubId
    const legit =
      ch.id === 'sapiac' ? uid === 'montauban' && g.clubs[uid].leagueId === 'top14'
      : ch.id === 'redbull' ? g.history.some(h => h.champion === 'newcastle' && h.compId === 'prem')
      : ch.id === 'dynasty' ? g.history.some(h => h.champion === 'munster' && h.compId === 'urc') && g.history.some(h => h.champion === 'munster' && h.compId === 'cc')
      : ch.id === 'pirates' ? g.clubs['pirates'].leagueId === 'prem'
      // ---- the women's four, which this audit used to answer `false` for ----
      // So any women's completion read as illegitimate and the probe would have
      // reported a bug that was not there - or, worse, been quietly trusted.
      : ch.id === 'threepeat' ? uid === W + 'saracens'
        && g.history.some(h => h.champion === uid && h.compId === W + 'pwr')
        // STOP THE CIRCUS asks for the second half too (1.5.8): a winning
        // record over Gloucester across the tenure, or no meetings at all.
        && (() => { const r = g.vsBook?.[W + 'glosharty']; return r ? r.w > r.l : true })()
      : ch.id === 'ealing' ? uid === W + 'trailfinders'
        && g.history.filter(h => h.champion === uid && h.compId === W + 'pwr').length >= 2
      : ch.id === 'licence' ? uid === W + 'sale'
        && (g.annals ?? []).some(a => a.clubName === g.clubs[uid]?.name && a.league.pos <= 4)
      : ch.id === 'grudge' ? uid === W + 'lichfield'
        && g.history.some(h => h.champion === uid && h.compId === W + 'champ')
      : false
    if (!legit) bad(`${ch.id} completed without its condition holding`)
    if (g.challenge) bad(`${ch.id} done but still live`)
    if (!g.news.some(n => n.subject.includes('CHALLENGE COMPLETE'))) bad(`${ch.id} completed silently`)
  } else if (g.challenge !== ch.id) {
    bad(`${ch.id} neither live nor done after two seasons`)
  }
  console.log(`${ch.id}: ${done ? 'COMPLETED' : 'still live'} · club now in ${g.clubs[ch.clubId].leagueId} · season ${g.season}`)
}

if (fails === 0) console.log(`CHALLENGE AUDIT PASSED (${CHALLENGES.length} careers, 2 seasons each)`)
else { console.error(`CHALLENGE AUDIT: ${fails} failures`); process.exit(1) }
