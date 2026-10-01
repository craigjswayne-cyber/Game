// Probe: a mentoring pairing is a gamble for its first month (owner, round 4).
//
// Owner: "You shouldn't know how a mentorship is going to work for at least
// one month. You shouldn't be able to see things like 'inseparable' until
// that month. So it's a gamble whether it works."
//
// Across seeds and clubs, a pairing is made on the Team Report's own path
// (startMentoring) and the season is played forward week by week. Asserted:
//
//   - for the first REVEAL_WEEKS weeks the Mentoring panel, rendered as the
//     player sees it, carries no fit word, no fit reason and no stage beyond
//     early days, and says it is too early to tell;
//   - in that month no news or inbox item says how the pair are getting on
//     (no growing, thriving or failing report, no fit word anywhere);
//   - after the month the panel says how it is going in plain words;
//   - a pairing ended inside the month leaves nothing but its start behind;
//   - the picker is not ranked by the hidden fit.
//
// No mechanics are touched, so this reads only: fingerprint holds the stream.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  REVEAL_WEEKS, STAGE_KEY, canBeMentored, canMentor, fitKey, fitReason, mentorFit, pairRevealed, startMentoring,
} from '../src/game/mentoring'
import { absWeek, type GameState, type Player } from '../src/game/model'
import { t, tIn } from '../src/game/i18n'
import { useStore } from '../src/store'
import MentoringPanel from '../src/ui/screens/MentoringPanel'
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const FIT_KEYS = ['training.fitInseparable', 'training.fitWorkingWell', 'training.fitComingAlong',
  'training.fitPolite', 'training.fitNotTaking', 'training.fitWaste']
const FIT_WORDS = FIT_KEYS.map(k => tIn('en', k))
const LATE_STAGES = (['growing', 'flourishing', 'settled', 'stalled'] as const).map(s => tIn('en', STAGE_KEY[s]))
const OUTCOME_NEWS = new Set(['news.mentGrowing', 'news.mentThriving', 'news.mentFailing'])
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

function panel(g: GameState): string {
  useStore.setState({ game: g } as never)
  // server rendering reads the store's initial snapshot (zustand's
  // getInitialState), so the game goes there too
  ;(useStore.getInitialState() as unknown as { game: GameState }).game = g
  return renderToStaticMarkup(createElement(MentoringPanel))
}
/** the HTML of one pairing's card */
function card(html: string, kid: number): string {
  const i = html.indexOf(`data-pair="${kid}"`)
  if (i < 0) return ''
  const j = html.indexOf('data-pair="', i + 10)
  const k = html.indexOf('data-kid="', i)
  const end = Math.min(...[j, k, html.length].filter(x => x > 0))
  return html.slice(i, end)
}
const keep = (g: GameState) => { const c = g.clubs[g.userClubId]; c.boardConfidence = Math.max(60, c.boardConfidence) }

const CLUBS = ['leicester', 'northampton', 'saracens', 'bath', 'exeter', 'harlequins']
const SEEDS = [3, 17, 41, 77, 101, 222]

console.log(`--- the first ${REVEAL_WEEKS} weeks say nothing about how it is going`)
{
  let pairsMade = 0, hiddenCards = 0, leakedCard = 0, leakedNews = 0, revealedCards = 0, plainWords = 0
  let earlyNotes = 0, outcomesLater = 0, monthIsAMonth = 0
  const leaks: string[] = []
  for (let n = 0; n < SEEDS.length; n++) {
    const g = newGame(CLUBS[n % CLUBS.length], 'Gambler', SEEDS[n])
    // start a few weeks in, so pairings straddle a report week (every eighth)
    for (let w = 0; w < 1 + (n % 4); w++) { keep(g); processWeekAndAdvance(g) }
    const sq = g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p)
    const seniors = sq.filter(canMentor)
    const kids = sq.filter(p => canBeMentored(p) && p.ca < p.pa)
    // as many pairings as the club allows, the best and worst fits included
    const made: { s: Player; k: Player }[] = []
    for (const k of kids) {
      const s = seniors.filter(x => !made.some(m => m.s.id === x.id))
        .sort((a, b) => (made.length % 2 ? 1 : -1) * (mentorFit(a, k) - mentorFit(b, k)))[0]
      if (!s) break
      if (startMentoring(g, s.id, k.id)) break
      made.push({ s, k })
    }
    pairsMade += made.length
    const start = absWeek(g.season, g.week)
    const firstId = g.news.reduce((m, x) => Math.max(m, x.id), 0)
    for (let w = 0; w <= REVEAL_WEEKS + 20; w++) {
      const weeks = absWeek(g.season, g.week) - start
      const html = panel(g)
      for (const { s, k } of made) {
        const mp = (g.mentors ?? []).find(x => x.kid === k.id && x.senior === s.id)
        if (!mp) continue
        const c = card(html, k.id)
        const open = pairRevealed(g, mp)
        if (weeks < REVEAL_WEEKS) {
          if (open) leaks.push(`seed ${SEEDS[n]}: revealed at week ${weeks}`)
          hiddenCards++
          const bad = [...FIT_WORDS, ...LATE_STAGES, fitReason(s, k)].find(x => c.includes(esc(x)))
            || (c.includes(esc(t('training.tooEarly'))) ? null : 'no too-early line')
          if (bad) { leakedCard++; leaks.push(`seed ${SEEDS[n]} week ${weeks}: card shows "${bad}"`) }
        } else {
          if (weeks === REVEAL_WEEKS && open) monthIsAMonth++
          if (!open) { leakedCard++; leaks.push(`seed ${SEEDS[n]}: still hidden at week ${weeks}`) }
          revealedCards++
          if (c.includes(esc(tIn('en', fitKey(mentorFit(s, k))))) && !c.includes(esc(t('training.tooEarly')))) plainWords++
        }
      }
      keep(g)
      processWeekAndAdvance(g)
    }
    // every news item filed since, subject and body, English and in the
    // player's language, against the month
    const ours = (id?: number) => made.some(m => m.k.id === id || m.s.id === id)
    for (const item of g.news.filter(x => x.id >= firstId && ours(x.playerId))) {
      const filed = absWeek(item.season, item.week) - start
      const text = `${item.subject} ${item.body} ${item.k ? t(item.k, item.v ?? {}) : ''}`
      const outcome = (!!item.k && OUTCOME_NEWS.has(item.k)) || FIT_WORDS.some(x => text.includes(x))
      if (filed < REVEAL_WEEKS && outcome) { leakedNews++; leaks.push(`seed ${SEEDS[n]} week ${filed}: news "${item.subject}"`) }
      if (filed < REVEAL_WEEKS && item.k === 'news.mentEarly') earlyNotes++
      if (filed >= REVEAL_WEEKS && outcome) outcomesLater++
    }
  }
  for (const l of leaks.slice(0, 12)) console.log(`        ${l}`)
  ok(pairsMade >= SEEDS.length * 3, `pairings made across ${SEEDS.length} seeds (${pairsMade})`)
  ok(hiddenCards > 0 && leakedCard === 0, `no card shows a fit word, reason or late stage in the first month (${hiddenCards} card-weeks checked)`)
  ok(leakedNews === 0, 'no news or inbox item says how a pair is getting on inside the month')
  console.log(`        (the early-days note, which says only that it is early, was filed ${earlyNotes} times in the month)`)
  ok(monthIsAMonth > 0, `at ${REVEAL_WEEKS} weeks the pairing opens up (${monthIsAMonth} pairings)`)
  ok(revealedCards > 0 && plainWords === revealedCards, `after the month every card says how it is going in plain words (${plainWords} of ${revealedCards})`)
  ok(outcomesLater > 0, `and the reports follow once the month is up (${outcomesLater} items)`)
}

console.log('--- a pairing ended inside the month')
{
  const g = newGame('bath', 'Quitter', 9)
  const sq = g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p)
  const s = sq.find(canMentor)!, k = sq.find(p => canBeMentored(p) && p.ca < p.pa)!
  const from = g.news.reduce((m, x) => Math.max(m, x.id), 0)
  ok(startMentoring(g, s.id, k.id) === null, 'a pairing is made')
  for (let w = 0; w < 2; w++) { keep(g); processWeekAndAdvance(g) }
  g.mentors = (g.mentors ?? []).filter(x => x.kid !== k.id)
  for (let w = 0; w < 10; w++) { keep(g); processWeekAndAdvance(g) }
  const about = g.news.filter(x => x.id > from && x.k?.startsWith('news.ment') && (x.playerId === k.id || x.playerId === s.id))
  ok(about.every(x => x.k === 'news.mentorStart' || x.k === 'news.mentEarly'),
    `nothing after it but its start (${about.map(x => x.k).join(', ') || 'none'})`)
  ok(!card(panel(g), k.id), 'and the card is gone')
}

console.log('--- the picker')
{
  const src = readFileSync(new URL('../src/ui/screens/MentoringPanel.tsx', import.meta.url), 'utf8')
  const picker = src.slice(src.indexOf("t('training.newPairing')"))
  ok(!/fitWord|fitReason|mentorFit|mentorForecast|\.rate\b/.test(picker), 'the picker shows no fit, reason or forecast')
  const rank = src.slice(src.indexOf('const seniors ='), src.indexOf('const attrList'))
  ok(!/mentorFit|mentorForecast|rate|fit/.test(rank), 'and is not ranked by them')
  ok(!/mentorShort|mentorRule|mentorEffect|kidAge/.test(src), 'the age explainer has gone from the page (the handbook has it)')
  const hb = tIn('en', 'handbook.a29')
  ok(hb.includes('20 or under') && hb.includes('28 or more') && /first month/.test(hb), 'the handbook carries the ages and the month')
}

console.log(fails ? `\nMENTOR REVEAL FAILED (${fails})` : '\nMENTOR REVEAL PASSED: a pairing is a gamble for a month, then the page says how it is going')
process.exit(fails ? 1 : 0)
