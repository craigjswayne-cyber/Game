// ---- THE MAN YOU SOLD, ON SCREEN (1.8.5) ----
//
// memoryauditprobe holds that a notable man you let go is named before you
// meet him (the team report among them) and that one who decides it is said
// so at full time; this holds
// that the line REACHES THE SCREEN. A career is opened, its second-best man
// is sold (by hand: moved and written into the memory as executeTransfer
// would) to the side it meets first, and then:
//
//   THE OLD BOYS CARD on the match preview carries his line (data-former):
//     how he left, for how much, and what he has done since, as a sentence.
//   THE MATCH PLAYS to full time with nothing thrown, and if the full-time
//     card names him (data-former-ft) it reads as a sentence too.
//   NO CONSOLE ERRORS along the way.
//
// Run: npm run build && node scripts/formerui.mjs
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const raw = s => /[{}]|\b(mem|oppreport|matchday)\.[a-zA-Z_]+/.test(s)

const server = await startPreview('4196', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.setDefaultTimeout(4000)

try {
  await page.goto('http://localhost:4196/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Former Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })

  // ---- the sale, by hand ----------------------------------------------------
  const sold = await page.evaluate(() => {
    const S = window.rugbyStore.getState(), g = S.game, me = g.clubs[g.userClubId]
    const fx = g.fixtures.filter(f => !f.played && (f.homeId === me.id || f.awayId === me.id) && g.clubs[f.homeId] && g.clubs[f.awayId])
      .sort((a, b) => a.week - b.week)[0]
    const oppId = fx.homeId === me.id ? fx.awayId : fx.homeId
    const opp = g.clubs[oppId]
    const p = me.players.map(id => g.players[id]).filter(x => x && !x.acad && !x.injury).sort((a, b) => b.ca - a.ca)[1]
    me.players = me.players.filter(id => id !== p.id)
    me.tactic.lineup = me.tactic.lineup.map(id => (id === p.id ? null : id))
    if (me.captain === p.id) me.captain = null
    opp.players.push(p.id)
    p.clubId = oppId
    const log = (g.memory ??= { entries: [], next: 1 })
    log.entries.push({
      id: log.next++, season: g.season, week: g.week, kind: 'sold', playerId: p.id, clubId: me.id, sal: 3,
      payload: { name: p.name, from: me.id, to: oppId, buyer: oppId, fee: 1_500_000, caps: p.caps ?? 0, ca: p.ca, a0: p.stats.apps, t0: p.stats.tries, nb: 1 },
    })
    S.touch()
    return { name: p.name, opp: opp.short, week: fx.week }
  })
  say(`  sold ${sold.name} to ${sold.opp}, met in week ${sold.week}`)

  // ---- to the match preview -------------------------------------------------
  await page.click('.bottom-nav button[title="Home"]').catch(() => {})
  await page.waitForSelector('.continue-btn', { timeout: 15000 })
  for (let tap = 0; tap < 40; tap++) {
    if (await page.locator('text=Kick Off').count()) break
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(400)
  }
  ok(await page.locator('text=Kick Off').count() > 0, 'Continue walked to the matchday')
  await page.evaluate(() => window.rugbyStore.getState().go('matchday'))
  await page.waitForTimeout(800)
  // the card is on the preview's briefing tab
  await page.click('text=Briefing').catch(() => {})
  await page.waitForTimeout(500)
  const card = await page.evaluate(() => [...document.querySelectorAll('[data-former]')].map(e => (e.textContent ?? '').trim()))
  for (const c of card) say(`  old boys card: ${c}`)
  if (process.env.DBG) say((await page.evaluate(() => document.body.innerText)).slice(0, 3000))
  const line = card.find(c => c.includes(sold.name))
  ok(!!line, `the Old Boys card names ${sold.name}`)
  ok(!!line && /^You sold .+ for .+ in \d{4}-\d{2}\. /.test(line) && !raw(line), 'as a sentence: how he left, the fee, the season, then since')

  // ---- play it ------------------------------------------------------------------
  await page.locator('text=Kick Off ▸').first().click().catch(() => {})
  await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    .then(() => page.click('.talk-modal .speech-tile >> text=Calm the nerves')).catch(() => {})
  await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    .then(() => page.click('text=▸ Take the Field')).catch(() => {})
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      return {
        ft: !!document.querySelector('.ft-stamp') || body.includes('Continue to Results'),
        call: body.includes('your call from the touchline'),
        interval: /Start Second Half|Play the Final Quarter/.test(body),
      }
    })
    if (s.ft) break
    if (s.call) await page.click('text=Take the Points').catch(() => {})
    else if (s.interval) {
      await page.click('text=▸ Start Second Half')
        .catch(() => page.click('text=▸ Play the Final Quarter').catch(() => {}))
    } else await page.click('.speed-controls [data-ctl=skip]').catch(() => {})
    await page.waitForTimeout(250)
  }
  const ft = await page.evaluate(() => !!document.querySelector('.ft-stamp') || (document.body.textContent ?? '').includes('Continue to Results'))
  ok(ft, 'the match reached full time')
  const ftLine = await page.evaluate(() => (document.querySelector('[data-former-ft]')?.textContent ?? '').trim())
  if (ftLine) say(`  full time: ${ftLine}`)
  ok(!ftLine || (ftLine.includes(sold.name) && !raw(ftLine)), `the full-time line, when there is one, reads as a sentence${ftLine ? '' : ' (none this time)'}`)
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
} catch (e) {
  ok(false, `walk threw: ${e}`)
} finally {
  await browser.close()
  server.stop()
}
say(fails ? `\n${fails} FAILED` : '\nFORMER UI PASSED')
done(fails)
