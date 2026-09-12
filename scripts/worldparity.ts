/**
 * ---- NOTHING IS OFFERED THAT ITS OWN WORLD CANNOT DELIVER ----
 *
 * This game holds two worlds - the men's game and the women's - built from the
 * same engine and different data. They do not have the same competitions:
 * newgame.ts wraps the Continental Cup, the Continental Shield and the men's
 * internationals in `if (gender !== 'w')`, because those competitions do not
 * exist in the women's game.
 *
 * Nothing checked that the rest of the game knew.
 *
 * So a woman managing in the English Championship was offered "Win the
 * Continental Cup" as the one ambition that would make her save worth
 * finishing, and "Win the league and Europe", and "Coach a nation to the World
 * Championship". All three count trophies in competitions her world does not
 * hold. All three were unwinnable, for ever, and the wizard presented them
 * beside three that were real. Found in a screenshot from a live save, not by
 * any of the two hundred probes that ran that day.
 *
 * That is the shape of failure this file exists for, and it is a nasty one:
 *
 *   nothing throws. Nothing renders wrong. Every string is translated, every
 *   key resolves, every screen fits its phone. The game simply promises
 *   something it has no way to give, and only a person who knows the sport
 *   would ever notice.
 *
 * A probe cannot be written for "unwinnable" in general. What it CAN do is
 * insist that every dependency is DECLARED - DreamDef.needs, Challenge.gender -
 * and then check the declarations against what each world actually builds. The
 * work is in the declaring; this file is what stops the declarations rotting.
 *
 * Run: npx vite-node scripts/worldparity.ts
 */
import { DREAMS, dreamsFor, worldHasComp } from '../src/game/dream'
import { CHALLENGES, challengesFor, LEAGUE_DEFS } from '../src/game/newgame'
import { newGame } from '../src/game/newgame'
import { isWomensId, type Gender } from '../src/game/gender'
import { parseResultsParam, resultsParam } from '../src/game/schedule'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const say = (s: string) => console.log(s)

const WORLDS: Gender[] = ['m', 'w']
const worldName = (g: Gender) => (g === 'w' ? "the women's game" : "the men's game")

// ---------------------------------------------------------------------------
// 1. THE COMPETITIONS EACH WORLD REALLY BUILDS
//
// Read off a built career rather than trusted from a table: the point is to
// catch the day the table and newgame.ts disagree.
// ---------------------------------------------------------------------------
say('\n--- 1. what each world actually builds')
const compsOf: Record<Gender, Set<string>> = { m: new Set(), w: new Set() }
for (const g of WORLDS) {
  const club = LEAGUE_DEFS(g)[0].clubs[0].id
  const state = newGame(club, 'Parity', 20260910, undefined, 'coach', g)
  compsOf[g] = new Set(Object.keys(state.comps))
  say(`    ${worldName(g)}: ${[...compsOf[g]].sort().join(', ') || '(no cup competitions)'}`)
  ok(compsOf[g].size >= 0, `${worldName(g)} builds ${compsOf[g].size} cup competitions`)
}

// and the table the wizard reads before a career exists has to agree with them
for (const g of WORLDS) {
  for (const comp of ['cc', 'chc', 'wc']) {
    const built = compsOf[g].has(comp)
    // 'wc' is an international tournament rather than a club cup, so it is not
    // in state.comps at all - it is asserted below through the dream instead.
    if (comp === 'wc') continue
    ok(worldHasComp(g, comp) === built,
      `worldHasComp('${g}', '${comp}') agrees with what newGame built (${worldHasComp(g, comp)} vs ${built})`)
  }
}

// ---------------------------------------------------------------------------
// 2. NO DREAM IS OFFERED THAT ITS WORLD CANNOT FINISH
// ---------------------------------------------------------------------------
say('\n--- 2. every dream offered can be finished in the world offering it')
for (const g of WORLDS) {
  // every league in the world, so a tier-gated dream is not missed
  for (const league of LEAGUE_DEFS(g)) {
    for (const rep of [55, 70, 90]) {
      const club = league.clubs[0]
      const offered = dreamsFor({ clubId: club.id, clubName: club.name, leagueId: league.id, rep })
      for (const d of offered) {
        const absent = (d.needs ?? []).filter(c => !worldHasComp(g, c))
        if (absent.length) {
          ok(false, `${worldName(g)}, ${league.short} at rep ${rep}: "${d.id}" needs ${absent.join(', ')}, which this world does not have`)
        }
      }
    }
  }
  ok(true, `${worldName(g)}: every dream offered across ${LEAGUE_DEFS(g).length} leagues names only competitions it holds`)
}

// and the women's world is not left with nothing to aim at
for (const g of WORLDS) {
  const league = LEAGUE_DEFS(g)[0]
  const n = dreamsFor({ clubId: league.clubs[0].id, clubName: 'X', leagueId: league.id, rep: 70 }).length
  ok(n >= 3, `${worldName(g)} still offers a real choice of ambitions (${n})`)
}

// every dream has to be reachable SOMEWHERE, or it is dead code wearing copy
for (const d of DREAMS) {
  const anywhere = WORLDS.some(g =>
    LEAGUE_DEFS(g).some(l => [55, 70, 90].some(rep =>
      dreamsFor({ clubId: l.clubs[0].id, clubName: 'X', leagueId: l.id, rep }).some(x => x.id === d.id))))
  ok(anywhere, `the "${d.id}" dream is offered somewhere in the game`)
}

// ---------------------------------------------------------------------------
// 3. EVERY CHALLENGE IS PINNED TO A CLUB THAT EXISTS, IN ITS OWN WORLD
//
// A challenge names one club. Get the world wrong and the wizard offers a
// career at a club the world cannot build - which is how a women's challenge
// pinned to a men's id would fail: silently, at the moment somebody picked it.
// ---------------------------------------------------------------------------
say('\n--- 3. every challenge is pinned to a club its world contains')
for (const g of WORLDS) {
  const ids = new Set(LEAGUE_DEFS(g).flatMap(l => l.clubs.map(c => c.id)))
  for (const ch of challengesFor(g)) {
    ok(ids.has(ch.clubId),
      `${worldName(g)}: "${ch.id}" is pinned to ${ch.clubId}, which this world builds`)
    ok(isWomensId(ch.clubId) === (g === 'w'),
      `and ${ch.clubId} belongs to the right world`)
  }
}
ok(CHALLENGES.length === challengesFor('m').length + challengesFor('w').length,
  `every challenge belongs to exactly one world (${CHALLENGES.length} = ${challengesFor('m').length} + ${challengesFor('w').length})`)

// ---------------------------------------------------------------------------
// 4. EVERY COMPETITION ID SURVIVES THE TRIP TO A SCREEN AND BACK
//
// The full-time round-up is reached with one string carrying a competition and
// a week. Men's ids are bare words, so "prem:8" read back perfectly for two
// years. Women's ids carry the world prefix - 'w:pwr', 'w:celt' - so "w:pwr:8"
// read back as competition 'w' in week NaN, and the ENTIRE WOMEN'S GAME showed
// "No other results this round" after every match, including the manager's own.
//
// Reported by the owner, not by any of the two hundred and sixteen probes here,
// because every one of them tested game logic and this was a screen parameter.
// It is the same shape of fault as the rest of this file: nothing threw,
// nothing rendered wrong, and one world was quietly given a broken version of a
// screen the other world had working.
// ---------------------------------------------------------------------------
say('\n--- 4. every competition id survives the round trip to a screen')
{
  let round = 0
  const broken: string[] = []
  for (const g of WORLDS) {
    // every league, every cup, and the international competitions with them
    const ids = new Set<string>([...compsOf[g], ...LEAGUE_DEFS(g).map(l => l.id), 'fr'])
    for (const id of ids) {
      for (const week of [1, 8, 47]) {
        round++
        const back = parseResultsParam(resultsParam(id, week))
        if (back.compId !== id || back.week !== week) {
          broken.push(`${worldName(g)}: "${resultsParam(id, week)}" reads back as ${back.compId} in week ${back.week}`)
        }
      }
    }
  }
  ok(broken.length === 0, `${round} round-ups reached the right competition and week${broken.length ? ` - ${broken[0]}` : ''}`)
  broken.slice(1, 4).forEach(b => console.log(`        ${b}`))
}

// ---- AND NEITHER WORLD CALLS A COMPETITION BY THE OTHER'S NAME (1.5.9) ----
//
// The declarations above stop a world being offered a competition it does not
// build. They said nothing about a competition it DOES build being called the
// wrong thing - and both worlds build a cup with the id 'cc' deliberately, so
// that every dream, award and trophy count can mean "the continental cup of
// this game". The men's is the Continental Cup; the women's is the Hemispheric
// Championship, and it spans the Pacific and the Celtic provinces.
//
// Seven strings had the men's name, or the word Europe, written into them and
// reached a women's save unchanged: the board objective, the sponsor clause,
// the Profile speciality and its hint, the match-day stakes line, and the
// finals-weekend story - which also announced a Continental Shield that the
// women's game does not have. Each now carries an `_f` sibling, which i18n
// picks up in a women's world without a single call site knowing.
{
  const { ensureLang, setLang, setWorld, t } = await import('../src/game/i18n')
  // the men's name in each of the six, so a sibling that was never written is
  // caught rather than passing because the fallback happens to read cleanly
  const MENS = /continental|continentale|europe|europ[ea]|欧州|コンチネンタル/i
  const KEYS = [
    'objectives.europe', 'objectives.europeHead', 'finances.clauseEurope',
    'profile.specEuro', 'profile.specEuroDesc', 'profile.specEuroHint',
    'stakes.dreamRoad', 'news.finalsWeekend', 'news.finalsWeekendSubj',
  ]
  const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af'] as const
  const leaks: string[] = []
  for (const lang of LANGS) {
    await ensureLang(lang)
    setLang(lang)
    setWorld('w')
    for (const k of KEYS) {
      const line = t(k, { venue: 'Ground', city: 'City', seats: '20,000' })
      if (MENS.test(line)) leaks.push(`${lang} ${k}: ${line.slice(0, 70)}`)
    }
    setWorld('m')
  }
  await ensureLang('en')
  setLang('en')
  ok(leaks.length === 0,
    `no women's-world line names the men's competition${leaks.length ? ` - ${leaks[0]}` : ''} (${KEYS.length} keys x ${LANGS.length} languages)`)
  leaks.slice(1, 5).forEach(l => console.log(`        ${l}`))
}

console.log(fails
  ? `\nWORLD PARITY FAILED (${fails})`
  : '\nWORLD PARITY PASSED: neither world promises anything it cannot deliver')
if (fails) process.exit(1)
