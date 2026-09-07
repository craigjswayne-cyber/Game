/**
 * ---- DOES THE WOMEN'S GAME CALL ITS PLAYERS "HE"? ----
 *
 * Owner, 7 Sep: "check all the latest updates across multiple languages. This
 * needs to run as close to ready to go so double check language, cultural
 * insensitive, gender insensitive, check hard rules so nothing is crossed
 * accidently."
 *
 * This is the answer to the gender half, and it is not a comfortable one. The
 * game has no gender-aware text handling of any kind - no pronoun layer, no
 * per-world strings - so every line written for the men's game is served
 * unchanged to a women's career. 12% of the English corpus uses "he", "him",
 * "his", "man" or "men".
 *
 * A corpus count is the wrong measure, though: most of those strings are rare,
 * and a manager only ever sees what her own career produces. So this plays real
 * women's careers and reads what actually reaches the screen, which is the only
 * number worth acting on.
 *
 * IT IS A REPORTER, NOT A GATE. Putting a failing threshold on it today would
 * mean either a red suite for weeks or a threshold set so high it proves
 * nothing. It prints the count and the worst offenders so the work can be
 * planned and measured as it comes down. The number it prints is the honest
 * size of the problem.
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { newsBody, newsSubject } from '../src/game/model'
import { setLang } from '../src/game/i18n'

const MASC = /\b(he|him|his|himself|man|men|lad|lads|boy|boys|father|son|sons|brother|mr)\b/gi

setLang('en')
const wClubs = LEAGUE_DEFS('w').flatMap(d => d.clubs).slice(0, 4).map(c => c.id)
const seen = new Map<string, number>()
const examples = new Map<string, string>()
let lines = 0

for (let i = 0; i < wClubs.length; i++) {
  const g = newGame(wClubs[i], 'Test', 500 + i * 7, undefined, 'coach', 'normal', 'w')
  for (let w = 0; w < 48 * 3; w++) processWeekAndAdvance(g)
  for (const n of g.news) {
    for (const text of [newsSubject(n), newsBody(n)]) {
      if (!text) continue
      lines++
      const hits = text.match(MASC)
      if (!hits) continue
      const key = n.k ?? '(no key)'
      seen.set(key, (seen.get(key) ?? 0) + hits.length)
      if (!examples.has(key)) {
        const m = MASC.exec(text)
        MASC.lastIndex = 0
        examples.set(key, text.slice(Math.max(0, (m?.index ?? 0) - 50), (m?.index ?? 0) + 60).replace(/\n/g, ' '))
      }
    }
  }
}

const total = [...seen.values()].reduce((a, b) => a + b, 0)
const worst = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)

console.log(`--- a women's career, three seasons, four clubs ---`)
console.log(`${lines} lines of news read; ${seen.size} distinct stories call a woman "he", "him", "his" or "man"`)
console.log(`${total} masculine words reached the screen\n`)
console.log('the ones worth fixing first:')
for (const [k, n] of worst) {
  console.log(`  ${String(n).padStart(4)}x  ${k}`)
  console.log(`        ...${examples.get(k)}...`)
}
console.log(`\nWOMEN'S VOICE REPORT: ${total} masculine words across ${seen.size} stories.`)
console.log('This probe reports and never fails - see its header for why.')
