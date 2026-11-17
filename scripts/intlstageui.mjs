// Probe: the international stage (1.9.14). Owner, after the review: the job
// "should be an honour", "more fun to play", and on the walk-out "they should
// stand for the anthems". A Leicester career takes the England job and walks
// one window: the unveiling with the union's terms; the campaign card (steps,
// target, announcement and its reveal, the camp's event); a Test preview with
// the analysts' read, the armband and the game plan; the walk-out with both
// sides standing in a line for the anthems; the full-time card; the era.
// FA_SHOT=<dir> also writes screenshots.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const OUT = process.env.FA_SHOT
const server = await startPreview(0, 2500)
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
const S = (f, a) => page.evaluate(f, a)
const shot = async n => { if (OUT) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/stage_${n}.png` }) } }

// walk the week loop until `until` (a function body string) holds
const walk = until => S(async src => {
  const stop = new Function('g', src)
  for (let guard = 0; guard < 20000; guard++) {
    const st = window.rugbyStore.getState(); const g = st.game
    const screen = st.nav[st.nav.length - 1]?.screen
    if (stop(g) && !st.liveMatch && screen !== 'matchday') return g.week
    const club = g.clubs[g.userClubId]; if (club) club.boardConfidence = 80
    if (g.natConfidence != null) g.natConfidence = Math.max(g.natConfidence, 60)
    for (const o of g.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
    for (const n of g.news) n.read = true
    for (const q of g.press) q.answered = true
    const camp = g.natSquads?.[g.natTeam]
    if (camp && camp.length < 32) {
      const spare = Object.values(g.players).filter(p => p.nat === g.natTeam && p.clubId && !p.injury && !p.natSquad).sort((a, b) => b.ca - a.ca).slice(0, 32 - camp.length)
      for (const p of spare) { camp.push(p.id); p.natSquad = true }
      g.natLineup = null
    }
    window.rugbyStore.setState({ lastAdvanceAt: 0 })
    if (st.liveMatch || screen === 'matchday') st.instantResult()
    else st.continueWeek()
    await new Promise(r => setTimeout(r, 5))
  }
  return -1
}, until)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await S(() => window.rugbyStore.getState().start('leicester', 'Stage'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  // the England job, and the unveiling the appointment shows
  await S(() => { const st = window.rugbyStore.getState(); const g = st.game
    g.natTeam = 'ENG'; g.natConfidence = 60; g.natRecord = { m: 0, w: 0, d: 0, l: 0 }
    g.natUnveil = { nat: 'ENG', season: g.season, week: g.week }; st.touch() })
  await page.waitForSelector('[data-nat-unveil]', { timeout: 4000 })
  ok(await page.locator('[data-nat-unveil] .nu-terms li').count() === 3, 'the unveiling names the union\'s three terms')
  ok(await page.locator('[data-nat-unveil] [data-nat-band="ENG"]').count() === 1, 'under a band in England\'s colours')
  await shot('unveil')
  await page.locator('[data-nu-go]').click()
  ok(await page.locator('[data-nat-unveil]').count() === 0, 'Begin closes it')

  // ---- camp opens ----
  const wk = await walk('return !!g.natWin && g.week >= g.natWin.start && (g.natSquads[g.natTeam] || []).length >= 32')
  ok(wk > 0, `the walk reaches camp (week ${wk})`)
  await S(() => { const st = window.rugbyStore.getState(); st.go('country'); st.touch() }); await page.waitForTimeout(500)
  ok(await page.locator('[data-nat-campaign] [data-step]').count() === 5, 'the campaign card shows the window\'s five steps')
  ok(await page.locator('[data-nc-target]').count() === 1, 'and the union\'s target')
  ok(await page.locator('[data-nat-era]').count() === 1, 'the era card is on Club & Country')
  await shot('campaign')
  await page.locator('[data-nc-announce]').click()
  await page.waitForSelector('[data-nc-reveal]', { timeout: 3000 })
  ok(await page.locator('[data-nc-reveal] .nc-reveal-row').count() === 3, 'the announcement reveals debuts, recalls and who is left out')
  await shot('reveal')
  await page.locator('[data-nc-reveal] .btn.gold').click(); await page.waitForTimeout(300)
  const ev = page.locator('[data-nc-event] [data-nc-answer]')
  ok(await ev.count() >= 2, 'the camp throws up an event with a choice')
  await shot('event')
  await ev.last().click(); await page.waitForTimeout(300)
  ok(await page.locator('[data-nc-answered]').count() === 1, 'and the answer is said')

  // ---- a Test week ----
  const tw = await walk('return g.fixtures.some(f => !f.played && f.week === g.week && (f.homeId === g.natTeam || f.awayId === g.natTeam))')
  ok(tw > 0, `the walk reaches a Test week (${tw})`)
  for (let i = 0; i < 40 && !(await page.locator('text=YOUR TEST XV').count()); i++) {
    await S(() => { const st = window.rugbyStore.getState(); const g = st.game
      for (const n of g.news) n.read = true; for (const q of g.press) q.answered = true
      for (const o of g.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
      window.rugbyStore.setState({ lastAdvanceAt: 0 }); st.continueWeek() })
    await page.waitForTimeout(350)
    for (const b of ['On to the Week', 'Next Story', 'Matchday']) if (await page.locator(`text="${b}"`).count()) { await page.click(`text="${b}"`).catch(() => {}); await page.waitForTimeout(250) }
  }
  ok(await page.locator('text=YOUR TEST XV').count() > 0, 'the Test preview opens')
  ok(await page.locator('[data-nat-band]').count() === 1, 'under the nation\'s band')
  ok(await page.locator('[data-test-analyst] li').count() >= 1, 'the union analysts read the opponent')
  const caps = page.locator('[data-nat-captain] [data-cap]')
  ok(await caps.count() >= 3, 'the armband offers the XV\'s leaders')
  await caps.first().click()
  const cap = await S(() => window.rugbyStore.getState().game.natPlan?.captain)
  ok(cap != null, `a captain is named (${cap})`)
  ok(await page.locator('[data-nat-plan] [data-nat-dial]').count() === 4, 'the game plan has the four dials')
  await page.locator('[data-test-analyst]').scrollIntoViewIfNeeded(); await shot('preview')
  await page.locator('[data-nat-captain]').scrollIntoViewIfNeeded(); await shot('captain')

  // ---- the walk-out ----
  await S(() => { const g = window.rugbyStore.getState().game; g.viewPref = { ...(g.viewPref ?? {}) } })
  await page.locator('button', { hasText: /Kick Off/i }).first().click()
  await page.locator('button:has-text("Take the Field")').click({ timeout: 4000 })
  await page.waitForSelector('[data-walkout="out"]', { timeout: 4000 })
  ok((await page.locator('[data-walkout] .wo-body p').first().textContent()).includes('leads England out'), 'the captain leads England out of the tunnel')
  await shot('walkout')
  await page.locator('[data-wo-next]').click()
  await page.waitForSelector('[data-walkout="anthems"]', { timeout: 3000 })
  ok(await page.locator('[data-walkout="anthems"] .wo-line').count() === 2, 'both sides line up for the anthems')
  ok(await page.locator('[data-walkout="anthems"] .wo-line').first().locator('svg').count() === 15, 'fifteen standing in each line')
  ok((await page.locator('.wo-anthems').textContent()).includes('God Save the King'), 'England\'s anthem is named')
  await shot('anthems')
  for (let i = 0; i < 3 && !(await page.locator('[data-wo-kickoff]').count()); i++) {
    if (await page.locator('[data-walkout="challenge"]').count()) await shot('challenge')
    await page.locator('[data-wo-next]').click(); await page.waitForTimeout(200)
  }
  await page.locator('[data-wo-kickoff]').click()
  await page.waitForTimeout(1200)
  ok(await S(() => !!window.rugbyStore.getState().liveMatch), 'Kick off starts the Test')
  // to half time: the touchline has the national plan's dials
  await S(() => window.rugbyStore.getState().skipToBreak()); await page.waitForTimeout(800)
  ok(await page.locator('[data-nat-plan] [data-nat-dial]').count() === 4, 'at half time the touchline has the national plan\'s four dials')
  await shot('touchline')
  // and on to full time
  for (let i = 0; i < 8; i++) {
    const done = await S(() => { const st = window.rugbyStore.getState(); const lm = st.liveMatch
      if (!lm || lm.done || lm.ctx.seg >= 3) return true
      if (lm.ctx.awaiting) st.startSecondHalf(); else st.skipToBreak(); return false })
    await page.waitForTimeout(500)
    if (done) break
  }
  await page.waitForSelector('[data-test-verdict]', { timeout: 6000 }).catch(() => {})
  ok(await page.locator('[data-test-verdict]').count() >= 1, 'the full time has the Test card')
  ok(await page.locator('[data-tv-rank]').count() >= 1, 'with the ranking move')
  await page.locator('[data-test-verdict]').first().scrollIntoViewIfNeeded(); await shot('verdict')
  await S(() => { const st = window.rugbyStore.getState(); st.go('country'); st.touch() }); await page.waitForTimeout(500)
  await page.locator('[data-nat-era]').scrollIntoViewIfNeeded(); await shot('era')
  // the record itself is booked when the week settles; the era is kept at the whistle
  const era = await S(() => { const g = window.rugbyStore.getState().game; return { L: g.natLastTest, era: g.natEra } })
  ok(!!era.L && era.era?.bestRank > 0, `the era keeps the Test (best no. ${era.era?.bestRank}, ${era.L?.us}-${era.L?.them})`)
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nINTERNATIONAL STAGE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nINTERNATIONAL STAGE PROBE PASSED: the unveiling, the window campaign, the Test day, the walk-out and the era all play')
done(0)
