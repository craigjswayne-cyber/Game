// Probe: the English did not get worse.
//
// Every other probe in here asks whether the French exists. This one asks the
// opposite question, because the way a translation actually damages a game is
// not the French being missing - it is the English being quietly flattened to
// make the French easy. Two of those slipped through by hand earlier in this
// work: an ordinal suffix dropped so "4th" became "4", and the word "major"
// dropped out of "{n} major trophies". Both were caught by reading, which is
// not a method.
//
// WHAT IT CHECKS
//
// 1. A COUNT NEXT TO A COUNTABLE NOUN has a plural form. "1 matches" and
//    "2 match" are the most visible way a sentence built from a number goes
//    wrong, and the dictionary supports { one, other } entries precisely so
//    that it cannot happen. An entry that hard-codes the plural is a sentence
//    that is wrong one time in however many.
//
//    THE BUDGET started at 71 and is now ZERO, and it got there the slow way:
//    every entry read at its call site and then either given a plural or
//    written into CANNOT_BE_ONE with the thing that bounds its number. Most
//    could not be one - a stadium is never extended by one seat, a career
//    milestone is never the first match - and rewriting those would have been
//    churn rather than care.
//
//    A wrong entry in CANNOT_BE_ONE is worse than no probe: it is a claim that
//    outlives whoever made it. If a gate changes, move the entry out and give
//    the sentence its plural.
//
// 2. NO ENGLISH ENTRY IS EMPTY. A blank string is what a hurried conversion
//    leaves behind when a fragment turns out to be awkward, and it renders as
//    a hole in a sentence. `common.nothing` is the one sanctioned blank.
//
// 3. THE TWO LANGUAGES AGREE ON PLURALS. An entry that is { one, other } in
//    English and a flat string in French is a French sentence that says
//    "1 semaines", and vice versa.
//
// Run: npx vite-node scripts/englishprobe.ts
import { readFileSync } from 'node:fs'

/** English entries that hard-code a plural next to a count. ONLY EVER DECREASE. */
const BUDGET = 0

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

type Dict = { [k: string]: unknown }
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Dict
const EN = load('src/locales/en.json')
const FR = load('src/locales/fr.json')

/** A `{ one, other }` entry is the dictionary handling its own plural. */
const isPlural = (o: unknown): boolean =>
  !!o && typeof o === 'object' && 'other' in (o as object)

const walk = (d: Dict, path: string, f: (path: string, v: unknown) => void) => {
  for (const [k, v] of Object.entries(d)) {
    const p = path ? `${path}.${k}` : k
    if (v && typeof v === 'object' && !isPlural(v)) walk(v as Dict, p, f)
    else f(p, v)
  }
}

// ---- 1. a count next to a countable noun ---------------------------------
say('--- 1. a count next to a countable noun has a plural form')
// The names the engine uses for counts, and the nouns that change shape after
// one of them. Deliberately a list rather than a rule: English plurals are not
// a rule, and a probe that guesses produces noise nobody reads.
const COUNTS = /\{(n|m|w|l|d|tn|cups|seats|weeks|months|apps|caps|intl|good|games|tries)\}\s+([A-Za-z][a-z]+)/g
const PLURALS = new Set([
  'matches', 'weeks', 'seasons', 'trophies', 'games', 'points', 'tries', 'caps',
  'appearances', 'years', 'players', 'men', 'names', 'graduates', 'titles',
  'places', 'seats', 'months', 'days', 'times', 'sides', 'clubs', 'wins', 'defeats',
])
/** Entries whose singular is a sibling the naming does not give away. The
 *  caller picks between the two, so the plural is handled - it just is not
 *  handled by a name this probe can derive. Each one was read at its call site.
 *  KEY -> the sibling that covers the singular. */
const PAIRED: Record<string, string> = {
  'inbox.shelfDaysLeft': 'inbox.shelfOneDay',
  'week.annualNTrophies': 'week.annualOneTrophy',
  'club.titlesWon': 'club.titleWon',
  'legacy.hzSeasonsDone': 'legacy.hzSeasonDone',
  'finances.seasons': 'finances.oneSeason',
  'world.jbRepBuilt': 'world.jbRepBuiltOne',
}

/** Counts that cannot be one, with the reason. This is how the budget reaches
 *  zero honestly: not by rewriting sentences that were never wrong, but by
 *  someone reading the call site and writing down what they found. A wrong
 *  entry here is a lie that outlives the person who told it, so the reason has
 *  to name the thing that bounds the number. */
const CANNOT_BE_ONE: Record<string, string> = {
  'matchday.oldBoyOurs': 'the old-boy beat needs 10+ appearances at the old club',
  'matchday.oldBoyTheirs': 'same gate: 10+ appearances',
  'comm.oldBoy': 'same gate: returneeApps >= 10',
  'news.oldBoyWeLost': 'same gate',
  'transfers.months': 'a brief is three, six or nine months - never one',
  'news.scoutReport': 'the {months} of a brief, as above',
  'dec.scoutBrief': 'SEARCH_WEEKS for a brief, all above one',
  'news.briefSent': 'SEARCH_WEEKS, as above',
  'reply.scoutOnTheRoad': 'SEARCH_WEEKS, as above',
  'finances.marqueeSub': 'MARQUEE_SLOTS is a constant greater than one',
  'stakes.beatenRun': 'only fires on a streak of three or more',
  'world.infSeats': 'a stand is thousands of seats',
  'world.infSeatsCost': 'as above',
  'news.expApprovedSubj': 'as above',
  'dec.expandApproved': 'as above',
  'news.drawFinal': 'a final venue capacity',
  'news.finalsWeekend': 'as above',
  'news.careerWin': 'WIN_MARKS starts at 50',
  'news.careerGames': 'GAME_MARKS starts at 100',
  'legacy.hzMatches': 'GAME_MARKS, as above',
  'legacy.hzSeasonsInCharge': 'the next decade mark: 10, 20, 30',
  'news.recPoints': 'a season points record',
  'news.recTries': 'a season try record',
  'news.hofMan': 'a Hall of Fame career',
  'news.shirtUp': 'a shirt is only retired after a long service',
  'news.testimonial': 'a testimonial is earned over years',
  'news.testimonialSubj': 'as above',
  'news.lastDance': 'a farewell season follows a career',
  'news.clubLegend': 'legend status takes several seasons',
  'news.suspendedSubj': 'a red card carries two matches or three, and the story is filed before any appeal',
  'news.adminMine': 'the administration deduction is a fixed penalty',
  'news.adminOther': 'as above',
  'news.insolvencyWarning': 'as above',
  'legacy.cvSeasonsOne': 'the matches in a season, not the seasons',
  'legacy.srRecordLine': 'a season of fixtures',
  'news.srRecord': 'as above',
  'finances.lgMen': 'a senior squad, not a man',
  'club.duoLine': 'a partnership needs games behind it to register at all',
  'news.brokePlans': 'a promise falls due six or eight weeks after it is made',
  'news.boardMemo': 'the memo names its own six-week window',
  'news.tenureSubj': 'tenure milestones are 5, 10, 15, 20, 25 years',
  'news.tenure': 'the wins and defeats of an era five seasons long',
  'news.aTitleMine': 'winning an A League takes more than one win',
  'dream.europeWonTimes': 'the caller picks this only when n is above one',
}

const hasSingularSibling = (path: string): boolean => {
  if (PAIRED[path] && lookupIn(EN, PAIRED[path]) !== undefined) return true
  if (CANNOT_BE_ONE[path]) return true
  const cut = path.lastIndexOf('.')
  const leaf = path.slice(cut + 1)
  const parent = (cut === -1 ? EN : lookupIn(EN, path.slice(0, cut))) as Dict | undefined
  if (!parent || typeof parent !== 'object') return false
  // titlesWon -> titleWon, courseResits -> courseResitsOne, and the same with
  // the -ies plural: every way the codebase has spelled "the singular one".
  const stems = new Set([leaf, leaf.replace(/s$/, ''), leaf.replace(/ies$/, 'y'),
    leaf.replace(/s([A-Z])/, '$1'), leaf.replace(/ies([A-Z])/, 'y$1')])
  for (const st of stems) {
    if (st !== leaf && st in parent) return true
    if (`${st}One` in parent) return true
  }
  return false
}
const lookupIn = (d: Dict, key: string): unknown =>
  key.split('.').reduce<unknown>((o, part) => (o && typeof o === 'object' ? (o as Dict)[part] : undefined), d)

const hard: string[] = []
walk(EN, '', (path, v) => {
  if (typeof v !== 'string') return
  if (hasSingularSibling(path)) return
  for (const m of v.matchAll(COUNTS)) {
    if (PLURALS.has(m[2].toLowerCase())) { hard.push(`${path} ("${m[0]}")`); return }
  }
})
say(`  ${hard.length} entr${hard.length === 1 ? 'y' : 'ies'} hard-code a plural after a count (budget ${BUDGET})`)
if (hard.length) say('  ' + hard.slice(0, 10).join('\n  ') + (hard.length > 10 ? `\n  ...and ${hard.length - 10} more` : ''))
ok(hard.length <= BUDGET, `no more than ${BUDGET} entries hard-code a plural after a count`)
if (hard.length < BUDGET) {
  ok(false, `THE BUDGET IS STALE: ${hard.length} left but it still says ${BUDGET}. Lower it`)
}

// ---- 2. nothing renders as a hole ----------------------------------------
say('\n--- 2. no entry is silently empty')
const blank: string[] = []
walk(EN, '', (path, v) => {
  if (path === 'common.nothing') return
  if (typeof v === 'string' && v.trim() === '') blank.push(path)
  if (isPlural(v)) {
    for (const [form, text] of Object.entries(v as Dict)) {
      if (typeof text === 'string' && text.trim() === '') blank.push(`${path}.${form}`)
    }
  }
})
ok(blank.length === 0,
  `every English entry says something${blank.length ? ` - blank: ${blank.slice(0, 8).join(', ')}` : ''}`)

// ---- 3. the two languages agree about plurals -----------------------------
say('\n--- 3. a plural in one language is a plural in the other')
const mismatched: string[] = []
walk(EN, '', (path, v) => {
  const other = lookupIn(FR, path)
  if (other === undefined) return
  if (isPlural(v) !== isPlural(other)) {
    mismatched.push(`${path} (en ${isPlural(v) ? 'plural' : 'flat'}, fr ${isPlural(other) ? 'plural' : 'flat'})`)
  }
})
ok(mismatched.length === 0,
  `every plural entry is a plural entry in both${mismatched.length ? ` - ${mismatched.length}: ${mismatched.slice(0, 6).join('; ')}` : ''}`)

// ---- 4. the sentences that were flattened once ---------------------------
//
// Two of these actually happened during the conversion, both caught by reading
// rather than by anything automatic, and both are the same mistake: the
// English was made simpler because the simpler version was easier to
// translate. Pinned here so the third time is a failing build.
//
//   The ordinal. "League: 4th" became "League: 4" when the suffix turned out
//   to need per-language rules. The rules exist now (_meta.ordByDigit) and the
//   suffix is the reader's business, not the sentence's - so any entry naming
//   a league position must use an _o variable, never a bare number.
//
//   The adjective. "{n} major trophies" became "{n} trophies", which is not
//   the same claim: a cup run and a league title are not the same thing and
//   the CV said so on purpose.
say('\n--- 4. the sentences that were flattened once')
const PINNED: [string, RegExp, string][] = [
  ['legacy.cvTrophies', /\bmajor troph/, 'still says MAJOR trophies - a cup run and a title are not the same claim'],
  ['legacy.cvTrophyOne', /\bmajor troph/, 'still says MAJOR trophy'],
  ['news.htPos', /\{pos_o\}/, 'names the league position as an ordinal, not a bare number'],
  ['news.htPosPred', /\{pos_o\}.*\{pred_o\}/, 'names both positions as ordinals'],
]
for (const [key, want, what] of PINNED) {
  const v = lookupIn(EN, key)
  ok(typeof v === 'string' && want.test(v), `en.${key} ${what}`)
}

say(fails ? `\nENGLISH PROBE FAILED (${fails})` : '\nENGLISH PROBE PASSED: the English is not paying for the French')
process.exitCode = fails ? 1 : 0
