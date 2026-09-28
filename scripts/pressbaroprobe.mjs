// ---- THE PRESS BAROMETER ON THE PHONE ----
//
// Owner: "Press room should be a sentiment based barometer at the top - are
// the press warm to you." The maths is held by pressmoodprobe.ts; this holds
// the screen:
//
//   1. The dial is the first thing on the Press screen, it names the mood in a
//      word, and the line under it is the reason read off real results.
//   2. It says Hostile after a slump, Stirring after a long winning run and
//      Warm after a good few weeks - and it reads the save it is given, so an
//      old save with no stored mood still gets a dial.
//   3. Answering a question puts what the answer did, in words, on the
//      coverage card (squad, supporters, press).
//   4. Nothing runs off the side of a 412 or a 360 phone, night or day, and the text inside
//      the card fits its box.
//
// Screenshots land in $SHOTS (default: /tmp/pressbaro) for a person to look at.
//
// Run: npm run build && node scripts/pressbaroprobe.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const PORT = 4371
const SHOTS = process.env.SHOTS ?? '/tmp/pressbaro'
mkdirSync(SHOTS, { recursive: true })

/** Script a run of results onto the user's next league fixtures, forget any
 *  stored mood (the screen must read an old save), and open the Press screen
 *  with one barometer question on the desk. */
const stage = (page, { results, qk, qv, options }) => page.evaluate(({ results, qk, qv, options }) => {
  const st = window.rugbyStore.getState()
  const g = st.game
  const me = g.userClubId
  const mine = g.fixtures.filter(f => f.compId !== 'fr' && (f.homeId === me || f.awayId === me)).sort((a, b) => a.week - b.week)
  for (const f of mine) f.played = false
  results.split('').forEach((r, i) => {
    const f = mine[i]
    const [us, them] = r === 'W' ? [27, 13] : r === 'L' ? [10, 24] : [16, 16]
    f.played = true
    f.homeScore = f.homeId === me ? us : them
    f.awayScore = f.homeId === me ? them : us
  })
  g.week = (mine[results.length - 1]?.week ?? 1) + 1
  delete g.pressMood
  g.press = [{
    id: g.nextId++, week: g.week, season: g.season, outlet: 'The Rugby Chronicle',
    question: '', qk, qv, playerId: undefined, answered: false, options,
  }]
  st.go('press')
  st.touch()
}, { results, qk, qv, options })

const HOSTILE = [
  { lk: 'press.baroDefend', rk: 'press.baroDefendR', label: '', reaction: '', morale: 0, board: -0.1, squad: 0.4, press: -3, fans: 0.1 },
  { lk: 'press.baroOnMe', rk: 'press.baroOnMeR', label: '', reaction: '', morale: 0, board: 0.2, squad: 0.2, press: 5, fans: 0.2 },
  { lk: 'press.baroNextGame', rk: 'press.baroNextGameR', label: '', reaction: '', morale: 0, board: 0, press: 2 },
  { lk: 'press.baroWroteOff', rk: 'press.baroWroteOffR', label: '', reaction: '', morale: 0, board: -0.2, squad: 0.2, press: -8, fans: 0.5 },
  { lk: 'press.baroBlame', rk: 'press.baroBlameR', label: '', reaction: '', morale: 0, board: 0.1, squad: -0.5, press: 4, fans: -0.1 },
]
const STIR = [
  { lk: 'press.baroSmugHungry', rk: 'press.baroSmugHungryR', label: '', reaction: '', morale: 0, board: 0, squad: 0.3, press: -1, fans: 0.1 },
  { lk: 'press.baroSmugNothing', rk: 'press.baroSmugNothingR', label: '', reaction: '', morale: 0, board: 0.2, squad: -0.1, press: 2 },
  { lk: 'press.baroAllTheWay', rk: 'press.baroAllTheWayR', label: '', reaction: '', morale: 0, board: -0.1, squad: 0.2, press: 3, fans: 0.4, hype: 1 },
  { lk: 'press.baroSmugMay', rk: 'press.baroSmugMayR', label: '', reaction: '', morale: 0, board: 0, press: 1, fans: 0.1 },
]
const WARM = [
  { lk: 'press.baroWarmPlayers', rk: 'press.baroWarmPlayersR', label: '', reaction: '', morale: 0, board: 0, squad: 0.3, press: 2 },
  { lk: 'press.baroAllTheWay', rk: 'press.baroAllTheWayR', label: '', reaction: '', morale: 0, board: -0.1, squad: 0.2, press: 3, fans: 0.4, hype: 1 },
  { lk: 'press.baroWarmFans', rk: 'press.baroWarmFansR', label: '', reaction: '', morale: 0, board: 0, squad: 0.1, press: 1, fans: 0.5 },
  { lk: 'press.baroWarmFeet', rk: 'press.baroWarmFeetR', label: '', reaction: '', morale: 0, board: 0.2, squad: 0.1, press: -1 },
]

const measure = (page, w) => page.evaluate((w) => {
  const baro = document.querySelector('.baro')
  const text = document.querySelector('.baro-text')
  const main = baro?.closest('main, .screen, .content') ?? document.body
  const firstCard = [...main.querySelectorAll('.baro, .press-outlet, .muted')].find(e => e.getBoundingClientRect().height > 0)
  return {
    page: document.documentElement.scrollWidth,
    has: !!baro,
    first: firstCard === baro,
    word: document.querySelector('.baro-word')?.textContent ?? '',
    why: document.querySelector('.baro-why')?.textContent ?? '',
    expect: document.querySelector('.baro-expect')?.textContent ?? '',
    fits: !!text && text.scrollWidth <= text.clientWidth + 1,
    inside: !!baro && baro.getBoundingClientRect().right <= w + 0.5 && baro.getBoundingClientRect().left >= -0.5,
    dial: !!document.querySelector('.baro-dial .seg.on') && !!document.querySelector('.baro-dial .needle'),
  }
}, w)

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
try {
  for (const [w, h, night] of [[412, 915, '1'], [360, 740, '1'], [412, 915, '0']]) {
    const tag = night === '1' ? `${w}` : `${w}-day`
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    page.setDefaultTimeout(8000)
    await page.addInitScript(n => localStorage.setItem('rm-night', n), night)
    await page.goto(`http://localhost:${PORT}/`)
    await page.waitForSelector('text=RUGBY', { timeout: 20000 })
    await page.click('text=New Career'); await page.click('text=English Premier Division'); await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Northampton'); await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Barometer'); await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career'); await page.waitForSelector('.tut-box', { timeout: 20000 }); await page.click('.tut-close .btn')
    await page.waitForSelector('.continue-btn', { timeout: 20000 })

    // ---- a slump ----
    await stage(page, { results: 'LLLLLL', qk: 'press.baroHostileQ2', options: HOSTILE })
    await page.waitForSelector('.baro')
    let m = await measure(page, w)
    ok(m.has && m.first, `${w}px: the barometer is the first thing on the Press screen`)
    ok(m.dial, `${w}px: the dial draws its bands and a needle`)
    ok(m.word === 'Hostile', `${w}px: six straight defeats read Hostile ("${m.word}")`)
    ok(/6 defeats in a row/.test(m.why), `${w}px: and the reason comes from the results ("${m.why}")`)
    ok(/job/.test(m.expect), `${w}px: and says what is coming ("${m.expect}")`)
    ok(m.page <= w && m.inside && m.fits, `${w}px: nothing runs off the side (page ${m.page}px, card inside ${m.inside}, text fits ${m.fits})`)
    await page.screenshot({ path: `${SHOTS}/hostile-${tag}.png` })

    // answer it: bite back
    await page.click('.btn.ghost >> nth=3')
    await page.waitForSelector('.press-fx .fx')
    const fx = await page.$$eval('.press-fx .fx', els => els.map(e => e.textContent))
    ok(fx.includes('Supporters approved') && fx.includes('The press took against it'),
      `${w}px: biting back says what it did in words (${fx.join(' / ')})`)
    m = await measure(page, w)
    ok(m.page <= w, `${w}px: the answered card still fits (page ${m.page}px)`)
    await page.evaluate(() => document.querySelector('.press-fx')?.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: `${SHOTS}/answered-${tag}.png` })

    // ---- a long winning run ----
    await stage(page, { results: 'WWWWWW', qk: 'press.baroSmugQ1', qv: { n: 6 }, options: STIR })
    await page.waitForSelector('.baro.stir')
    m = await measure(page, w)
    ok(m.word === 'Stirring', `${w}px: six straight wins and the press are stirring ("${m.word}")`)
    ok(/6 wins in a row/.test(m.why) && /cracks/.test(m.why), `${w}px: with the reason ("${m.why}")`)
    ok(m.page <= w && m.inside && m.fits, `${w}px: nothing runs off the side (page ${m.page}px, text fits ${m.fits})`)
    await page.screenshot({ path: `${SHOTS}/stirring-${tag}.png` })

    // ---- a good few weeks ----
    await stage(page, { results: 'WWWW', qk: 'press.baroWarmQ2', options: WARM })
    await page.waitForSelector('.baro.warm')
    m = await measure(page, w)
    ok(m.word === 'Warm', `${w}px: four straight wins read Warm ("${m.word}")`)
    await page.screenshot({ path: `${SHOTS}/warm-${tag}.png` })

    // ---- the same dial in French, at the narrowest width ----
    if (w === 360 && night === '1') {
      await page.evaluate(() => { window.rugbyStore.getState().setLang('fr') })
      await stage(page, { results: 'LLL', qk: 'press.baroScepticQ1', options: HOSTILE.slice(0, 4) })
      await page.waitForTimeout(300)
      m = await measure(page, w)
      ok(m.word === 'Sceptique', `360px French: three defeats read "${m.word}"`)
      ok(m.page <= w && m.fits, `360px French: nothing runs off the side (page ${m.page}px, text fits ${m.fits})`)
      await page.screenshot({ path: `${SHOTS}/sceptical-fr-${tag}.png` })
    }
    await page.close()
  }
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}
say(fails ? `\nPRESS BAROMETER SCREEN FAILED (${fails})` : '\nPRESS BAROMETER SCREEN PASSED: the dial leads the room, says why, and the answers say what they did')
done(fails)
