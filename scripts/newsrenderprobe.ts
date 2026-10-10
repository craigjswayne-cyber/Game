/**
 * ---- EVERY STORY, READ IN EVERY LANGUAGE ----
 *
 * Release QA after 1.8.16 read a season's inbox the way a player does and
 * found two things no key-by-key check could: "has agreed terms of £6k/week
 * until 2,029" (a contract year through the thousands separator, because only
 * {year} was exempt and the transfer stories call it {until}) and "Fastest
 * knockout try on record: ..., 1 minutes". Both only appear once a season has
 * actually been played and the story rendered.
 *
 * So this plays a season and renders every keyed story in all six languages,
 * and holds each one to: no {placeholder} left unfilled, no undefined / NaN /
 * [object, nothing empty, no year with a separator in it, no "1 minutes".
 * It also renders the two cases directly, so they are held even in a season
 * that happens not to produce them.
 *
 * Run: npx vite-node scripts/newsrenderprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS, newsBody, newsSubject } from '../src/game/model'
import { ensureLang, setLang, tIn, type Lang } from '../src/game/i18n'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
// 2,029 / 2.029 / 2 029 (NBSP or narrow NBSP in French)
const SPLIT_YEAR = /\b20[,.   ]?\d{2}\b/
const splitYear = (s: string) => /\b2[,.   ]0\d\d\b/.test(s)

async function main() {
  for (const l of LANGS) await ensureLang(l)

  console.log('--- the two found cases, rendered directly')
  for (const l of LANGS) {
    const s = tIn(l, 'news.transferDone', { to: 'Bath', player: 'A Player', from: 'Sale', fee: '£1m', age: 24, wage: '£5k', until: 2029 })
    ok(s.includes('2029') && !splitYear(s), `${l}: a contract year reads 2029 (${s.slice(-40)})`)
  }
  const one = tIn('en', 'news.koFastest1Subj', { player: 'A Player', min: 1 })
  ok(/1 minute$/.test(one), `the one-minute record says "1 minute" (${one})`)

  console.log('--- a season of stories, in six languages')
  const g = newGame('bath', 'Render Probe', 4242)
  for (let i = 0; i < SEASON_WEEKS + 6; i++) processWeekAndAdvance(g)
  const keyed = g.news.filter(n => n.k)
  ok(keyed.length > 150, `the season filed enough keyed stories to judge (${keyed.length})`)
  const bad: string[] = []
  for (const l of LANGS) {
    setLang(l)
    for (const n of keyed) {
      const s = newsSubject(n), b = newsBody(n), txt = `${s} || ${b}`
      const why: string[] = []
      if (/\{[a-zA-Z_]+\}/.test(txt)) why.push('unfilled placeholder')
      if (/undefined|NaN|\[object/.test(txt)) why.push('undefined')
      if (!s.trim() || !b.trim()) why.push('empty')
      if (splitYear(txt)) why.push('year with a separator')
      if (/\b1 minutes\b/.test(txt)) why.push('"1 minutes"')
      if (why.length) bad.push(`[${l}] ${n.k}: ${why.join(', ')} - ${txt.slice(0, 120)}`)
    }
  }
  setLang('en')
  ok(bad.length === 0, `every story renders clean in every language (${bad.length} flagged)`)
  for (const b of bad.slice(0, 15)) console.log('        ' + b)
  console.log(fails ? `\nNEWS RENDER PROBE FAILED: ${fails}` : '\nNEWS RENDER PROBE PASSED: a season of stories reads clean in six languages')
  process.exit(fails ? 1 : 0)
}
main()
