/**
 * ---- RUCK: THE BYLINE ON EVERYBODY ELSE'S NEWS ----
 *
 * The owner agreed with Ruck, the UK rugby site, that it is the named source
 * for the news about the rest of the league: other clubs' business, the rumour
 * mill, signings around the league and the law-change talk. His decisions, and
 * what this probe holds each of them to:
 *
 *   1. the byline appears, on Wire stories AND on league signings
 *   2. it never sits on a story about the manager's OWN club - those keep the
 *      neutral voice - and never on a SOCIAL clip, which stays SOCIAL
 *   3. law stories reach the feed at least once every season
 *   4. LAW CHANGES ARE NEWS ONLY: filing one touches nothing but the news list
 *      and its own stamp, and the plausible ones draw no rng at all
 *   5. a save from 1.8.6, which has never heard of `src`, loads and plays on,
 *      and a byline that is not Ruck's is dropped at the gate
 *   6. the copy keeps the house rules: no em dash, no shorter red card (a red
 *      is permanent in this game), nothing gendered, every language present
 *
 * Run: npx vite-node scripts/ruckprobe.ts
 */
import { readFileSync } from 'node:fs'
import { LEAGUE_DEFS, newGame } from '../src/game/newgame'
import { lawTalk, lawWatch } from '../src/game/gossip'
import { processWeekAndAdvance } from '../src/game/season'
import { migrate } from '../src/game/save'
import { setWorld } from '../src/game/i18n'
import { newsByline, SEASON_WEEKS, type GameState, type NewsItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const isLaw = (n: NewsItem) => !!n.k && /^news\.law(Watch|Talk)\d/.test(n.k)
// the power rankings are the whole table's column, so they name every club in
// the top five - the manager's among them - without being about any of them
const LEAGUE_WIDE = new Set(['news.wPowerRankings'])

// ---- 1-3: play seasons and read every story the week it is filed ----------
const RUNS: { club: string; seed: number; w?: boolean }[] = [
  { club: 'bath', seed: 31337 },
  { club: 'leicester', seed: 4242 },
  { club: 'saracens', seed: 777 },
  { club: LEAGUE_DEFS('w')[0].clubs[0].id, seed: 101, w: true },
]
const SEASONS = 2

let ruck = 0
let ruckTransfers = 0
let ruckWire = 0
let aboutUs = 0
let ownUnbylined = 0
let ownBylined = 0
let socialBylined = 0
let seasonsWithoutLaw = 0
let lawTalks = 0
const kinds = new Set<string>()
const slips: string[] = []

for (const run of RUNS) {
  setWorld(run.w ? 'w' : 'm')
  const g = run.w
    ? newGame(run.club, 'Test', run.seed, undefined, 'coach', 'w')
    : newGame(run.club, 'Test', run.seed)
  let seen = g.nextId
  for (let s = 0; s < SEASONS; s++) {
    let law = 0
    for (let i = 0; i < SEASON_WEEKS; i++) {
      processWeekAndAdvance(g)
      const fresh = g.news.filter(n => n.id >= seen)
      seen = g.nextId
      const club = g.clubs[g.userClubId]
      const ours = new Set([club.id, club.short, club.name])
      const squad = new Set(club.players)
      for (const n of fresh) {
        if (isLaw(n)) law++
        if (n.k?.startsWith('news.lawTalk')) lawTalks++
        if (n.k?.startsWith('news.gr') && !n.k.startsWith('news.grounds') && n.src) socialBylined++
        const vals = Object.values(n.v ?? {}).map(String)
        const namesUs = vals.some(x => ours.has(x))
        if (n.src !== 'ruck') {
          if (namesUs) ownUnbylined++
          continue
        }
        ruck++
        kinds.add(n.k ?? n.subject)
        if (n.type === 'transfer') ruckTransfers++
        if (n.type === 'gossip') ruckWire++
        if (newsByline(n) !== 'RUCK') slips.push(`byline missing on ${n.k}`)
        if (g.unemployed) continue // no club of his own to keep out of it
        const touchesSquad = [n.playerId, ...(n.playerIds ?? [])].some(id => id != null && squad.has(id))
        if ((namesUs && !LEAGUE_WIDE.has(n.k ?? '')) || touchesSquad) {
          aboutUs++
          ownBylined++
          if (slips.length < 6) slips.push(`${run.club} s${g.season} w${n.week}: ${n.k} "${n.subject}"`)
        }
      }
    }
    if (law === 0) seasonsWithoutLaw++
  }
}
setWorld('m')

console.log(`\n${RUNS.length} careers x ${SEASONS} seasons: ${ruck} Ruck stories (${ruckWire} on the Wire, ${ruckTransfers} signings), ${kinds.size} kinds`)
for (const s of slips) console.log(`        ${s}`)
ok(ruck > 0, 'Ruck-bylined stories reach the feed')
ok(ruckWire > 0 && ruckTransfers > 0, 'on the Wire and on the signings around the league alike')
ok(kinds.size >= 8, `across the range of the brief, not one story repeated (${kinds.size} kinds)`)
ok(aboutUs === 0, `never a story about the manager's own club or squad${aboutUs ? ` (${aboutUs} slips)` : ''}`)
ok(ownUnbylined > 0 && ownBylined === 0, `his own club's stories keep the neutral voice (${ownUnbylined} without a byline)`)
ok(socialBylined === 0, `the SOCIAL clips stay SOCIAL${socialBylined ? ` (${socialBylined} bylined)` : ''}`)
ok(seasonsWithoutLaw === 0, `a law story in every season played${seasonsWithoutLaw ? ` (${seasonsWithoutLaw} seasons without)` : ''}`)
ok(lawTalks >= RUNS.length * SEASONS, `the plausible proposals land on the calendar (${lawTalks} in ${RUNS.length * SEASONS} seasons)`)

// ---- 4: law changes are news only ------------------------------------------
// Run both law beats on a live world, week by week, and show that the only
// things they touched were the feed, the id counter (filing a story spends an
// id) and their own stamp. Everything else - money, morale, fitness, tables,
// squads, the laws the engine plays by - comes back byte for byte.
//
// lawTalk takes no Rng, so the compiler already holds it off the world stream.
// lawWatch is handed a stub that always fires, so the stub is the only stream
// it can draw on, and the shared one is never touched.
{
  const w = newGame('bath', 'Test', 5150)
  for (let i = 0; i < 12; i++) processWeekAndAdvance(w)
  const everythingElse = (s: GameState) => {
    const { news, lawTalkAt, lawWatchAt, nextId, ...rest } = s
    void news; void lawTalkAt; void lawWatchAt; void nextId
    return JSON.stringify(rest)
  }
  let filed = 0
  let untouched = true
  let onlyLaw = true
  for (const [beat, run] of [
    ['lawTalk', (s: GameState) => lawTalk(s)],
    ['lawWatch', (s: GameState) => lawWatch(s, () => 0)],
  ] as const) {
    for (let wk = 1; wk <= SEASON_WEEKS; wk++) {
      w.week = wk
      w.lawTalkAt = undefined
      w.lawWatchAt = undefined
      const before = everythingElse(w)
      const n0 = w.news.length
      run(w)
      const added = w.news.slice(n0)
      filed += added.length
      if (added.some(n => !isLaw(n) || n.src !== 'ruck')) onlyLaw = false
      if (everythingElse(w) !== before) { untouched = false; console.log(`        ${beat} moved the world in week ${wk}`) }
    }
  }
  ok(filed > 0, `both law beats filed on a live world (${filed} stories)`)
  ok(onlyLaw, 'and everything they filed is a Ruck law story')
  ok(untouched, 'and they changed nothing but the feed: no money, no morale, no table, no law the engine plays by')
}

// ---- 5: a 1.8.6 save, which has never heard of `src` ------------------------
{
  const g = newGame('leicester', 'Test', 2468)
  for (let i = 0; i < 10; i++) processWeekAndAdvance(g)
  const old = JSON.parse(JSON.stringify(g)) as GameState & { lawTalkAt?: number }
  for (const n of old.news) delete (n as { src?: string }).src
  delete old.lawTalkAt
  // and one story a bad copy left a stranger's byline on
  if (old.news[0]) (old.news[0] as unknown as Record<string, unknown>).src = 'someone-else'
  let threw = ''
  let loaded: GameState | null = null
  try {
    loaded = migrate(old)
    for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(loaded)
  } catch (e) { threw = String(e) }
  ok(!threw && !!loaded, `a save without the field loads and plays a season on${threw ? ` (${threw})` : ''}`)
  if (loaded) {
    ok(loaded.news.every(n => n.src == null || n.src === 'ruck'), 'a byline that is not Ruck\'s is dropped at the gate')
    ok(loaded.news.some(n => n.src === 'ruck'), 'and Ruck picks up where the old save left off')
  }
}

// ---- 6: the copy ------------------------------------------------------------
{
  type Dict = { [k: string]: unknown }
  const flat = (d: Dict, path = '', out: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries(d)) {
      const p = path ? `${path}.${k}` : k
      if (typeof v === 'string') out[p] = v
      else if (v && typeof v === 'object') flat(v as Dict, p, out)
    }
    return out
  }
  const LANGS = ['en', 'fr', 'es', 'it', 'af', 'ja']
  let missing = 0
  let dashes = 0
  let shortRed = 0
  for (const lang of LANGS) {
    const d = flat(JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8')) as Dict)
    for (let i = 1; i <= 6; i++) {
      for (const k of [`news.lawTalk${i}`, `news.lawTalk${i}Subj`]) {
        const v = d[k]
        if (!v) { missing++; continue }
        if (/[—–]/.test(v)) dashes++
        if (/20[- ]?min|twenty[- ]minute/i.test(v)) shortRed++
      }
    }
    for (const k of ['about.newsPartnerLabel', 'about.newsPartnerBody']) if (!d[k]) missing++
  }
  ok(missing === 0, `every new line is in all six languages${missing ? ` (${missing} missing)` : ''}`)
  ok(dashes === 0, `no em or en dash in any of them${dashes ? ` (${dashes})` : ''}`)
  ok(shortRed === 0, 'and no proposal for a shorter red card: a red is permanent here')
  const en = flat(JSON.parse(readFileSync('src/locales/en.json', 'utf8')) as Dict)
  const gendered = Object.entries(en)
    .filter(([k, v]) => /^news\.lawTalk\d/.test(k) && /\b(he|him|his|she|her|men|man|women|woman)\b/i.test(v))
  ok(gendered.length === 0, `the law stories are gender-neutral, for both games${gendered.length ? ` (${gendered.map(x => x[0]).join(', ')})` : ''}`)
}

console.log('')
if (fails === 0) console.log('RUCK PROBE PASSED: the rest of the league under Ruck\'s byline, and his own club in its own voice')
else console.log(`RUCK PROBE FAILED (${fails})`)
process.exit(fails)
