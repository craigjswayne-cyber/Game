/**
 * ---- HOW LONG A STORY MAY BE ----
 *
 * Owner: "assess all news, text in game and tighten up - dont over complicate
 * things."
 *
 * Reading all 1,386 of them, the game is not uniformly over-written: the median
 * story is 48 characters. What it has is a long tail, and the tail turned out
 * to be two completely different kinds of writing that deserve two different
 * rules.
 *
 *   A STORY THAT ASKS YOU TO DO SOMETHING must say what to do and get out of
 *   the way. The insolvency warning ran to 517 characters across three
 *   paragraphs to deliver one instruction: sell somebody or fill the ground.
 *   That is not richness, it is an instruction the reader has to go looking
 *   for, and it is the whole of what the owner was complaining about.
 *
 *   A COLOUR STORY IS ITS OWN LENGTH. The Rugby Wire's oddities - the flock of
 *   sheep that abandoned a sixth-tier fixture, the spaniel named in the team of
 *   the week at openside, the forklift through the hospitality suite - are
 *   three hundred characters of joke, and the joke needs its run-up. Cutting
 *   those would not tighten the game, it would flatten it. The owner asked for
 *   humour in these by name.
 *
 * So there are two ceilings, and the split is by key prefix, because that IS
 * how the game is organised: gr* is the Wire's greatest hits, chTale* the
 * clubhouse tales, tone* the dressing-room colour, up* the non-rugby year.
 *
 * THE BUDGETS ONLY EVER GO DOWN. Each is set to what the game actually achieves
 * today, and the probe fails if the real maximum drops well under its budget
 * without somebody lowering it - the same ratchet proseprobe uses, so a tidy-up
 * bankes its ground instead of leaving room to creep back.
 *
 * Run: npx vite-node scripts/newslength.ts
 */
import EN from '../src/locales/en.json'
import FR from '../src/locales/fr.json'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

/** Keys whose job is a joke, an anecdote or a bit of weather. */
const COLOUR = /^(gr|chTale|tone|up)/

const BUDGET = {
  en: { instruction: 330, colour: 370 },
  fr: { instruction: 385, colour: 435 },
}
/** How far under budget the longest story may sit before the budget is stale. */
const SLACK = 20

const flatten = (node: Record<string, unknown>, prefix = ''): [string, string][] => {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') out.push([`${prefix}${k}`, v])
    else if (v && typeof v === 'object') out.push(...flatten(v as Record<string, unknown>, `${prefix}${k}.`))
  }
  return out
}

for (const [lang, dict] of [['en', EN], ['fr', FR]] as const) {
  const news = flatten((dict as Record<string, unknown>).news as Record<string, unknown>)
  ok(news.length > 1000, `${lang}: ${news.length} stories read`)
  for (const kind of ['instruction', 'colour'] as const) {
    const rows = news.filter(([k]) => (kind === 'colour') === COLOUR.test(k))
    const cap = BUDGET[lang][kind]
    const over = rows.filter(([, v]) => v.length > cap).sort((a, b) => b[1].length - a[1].length)
    const longest = Math.max(...rows.map(([, v]) => v.length))
    if (over.length) {
      for (const [k, v] of over.slice(0, 8)) console.log(`        ${lang} news.${k} (${v.length}): ${v.slice(0, 70)}...`)
      if (over.length > 8) console.log(`        ...and ${over.length - 8} more`)
    }
    ok(over.length === 0,
       `${lang} ${kind}: ${rows.length} stories, none over ${cap} (longest ${longest}, ${over.length} over)`)
    ok(longest > cap - SLACK,
       `${lang} ${kind}: THE BUDGET IS ${cap} AND THE LONGEST IS ${longest}. Lower the budget to bank the ground`)
  }
}

// AND THE ONE THAT MATTERS MOST: an instruction must never be the longest thing
// in the game. If a story that asks the manager to act outgrows the ones that
// only entertain him, the tail has come back.
{
  for (const [lang, dict] of [['en', EN], ['fr', FR]] as const) {
    const news = flatten((dict as Record<string, unknown>).news as Record<string, unknown>)
    const longestInstruction = Math.max(...news.filter(([k]) => !COLOUR.test(k)).map(([, v]) => v.length))
    const longestColour = Math.max(...news.filter(([k]) => COLOUR.test(k)).map(([, v]) => v.length))
    ok(longestInstruction < longestColour,
       `${lang}: the longest story that asks you to act (${longestInstruction}) is shorter than the longest that just entertains (${longestColour})`)
  }
}

console.log(fails === 0
  ? '\nNEWS LENGTH PASSED: an instruction gets to the point, a joke gets its run-up'
  : `\nNEWS LENGTH FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
