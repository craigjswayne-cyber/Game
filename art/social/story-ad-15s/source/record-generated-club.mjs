import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { tapPast } from './lib/sheet.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const [OUT, TILE] = process.argv.slice(2)
const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const cdp = await page.context().newCDPSession(page)
let cur = null, n = 0, log = []
cdp.on('Page.screencastFrame', async f => {
  if (cur) { const name = `${cur}/${String(n++).padStart(5,'0')}.jpg`; writeFileSync(`${OUT}/${name}`, Buffer.from(f.data, 'base64')); log.push([name, f.metadata.timestamp]) }
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(()=>{})
})
const rec = async name => { cur = name; n = 0; mkdirSync(`${OUT}/${name}`, { recursive: true }); await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 }) }
const stop = async () => { await cdp.send('Page.stopScreencast'); cur = null }
const tick = () => page.evaluate(() => { if (!window.__tk) { const d = document.createElement('div'); d.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;z-index:99999;pointer-events:none'; document.body.appendChild(d); let i=0; window.__tk=setInterval(()=>{d.style.background=(i++%2)?'#000':'#010101'},33) } })
async function skipTo(label) {
  const until = Date.now() + 60000
  while (Date.now() < until) {
    if (await page.locator(`text=${label}`).first().isVisible().catch(() => false)) return
    if (await page.locator('.sheet-col').first().isVisible().catch(() => false)) {
      await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click({ timeout: 3000 }).catch(() => {})
      await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])').first().click({ timeout: 3000 }).catch(() => {})
      await page.locator('.btn', { hasText: /Back to the Match|Done|Close/ }).first().click({ timeout: 3000 }).catch(() => {})
    } else if (await page.locator('.btn', { hasText: 'Take the Points' }).first().isVisible().catch(() => false)) {
      await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(() => {})
    } else await page.click('.speed-controls [data-ctl=skip]', { timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
}
const sb = async () => (await page.locator('.scoreboard').innerText().catch(()=>'')).split('\n').slice(0,5).join(' ')
const result = { tile: TILE, matches: [] }
try {
  await page.goto(`${server.origin}/`); await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English National One'); await page.waitForSelector('.club-tile')
  await page.locator('.club-tile', { hasText: TILE }).first().click(); await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm'); await page.fill('input[placeholder="e.g. A. Gaffer"]', 'A. Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"'); await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await tick()
  await page.click('.bottom-nav button[title="Hub"]'); await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('text=Starting XV'); await page.waitForTimeout(500)
  await rec('team'); await page.waitForTimeout(400)
  await page.click('text=Best XV'); await page.waitForTimeout(800)
  const rows = page.locator('.dtable tbody tr, .sel-row, [data-slot]')
  for (const [a,b] of [[10,12],[3,5]]) { await rows.nth(a).click().catch(()=>{}); await page.waitForTimeout(450); await rows.nth(b).click().catch(()=>{}); await page.waitForTimeout(800) }
  await stop()
  result.team = await page.$$eval('.dtable tbody tr', rs => rs.slice(0, 15).map(r => r.innerText.split('\n').join(' ')))
  await page.click('.bottom-nav button[title="Home"]')
  for (let tap = 0; tap < 12; tap++) {
    if (await page.locator('text="Kick Off"').count()) break
    await page.click('.continue-btn', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400)
    if (await page.locator('text=Get On With The Week').count()) await page.click('text=Get On With The Week').catch(()=>{})
  }
  const opp = await page.evaluate(() => { const g = window.rugbyStore.getState().game, me = g.userClubId
    const f = g.fixtures.filter(f => !f.played && (f.homeId === me || f.awayId === me)).sort((a, b) => a.week - b.week)[0]
    const lm = window.rugbyStore.getState().liveMatch
    return { me, week: g.week, fx: f && [f.week, f.homeId, f.awayId], clubs: Object.keys(g.clubs).length } })
  await page.locator('text="Kick Off"').first().click()
  try { await page.locator('.talk-modal').waitFor({ timeout: 3000 }); await page.click('.talk-modal .speech-tile >> nth=0') } catch {}
  try { await page.locator('text="Take the Field"').waitFor({ timeout: 2500 }); await page.click('text="Take the Field"') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.locator('.btn', { hasText: 'Got it' }).first().click({ timeout: 2000 }).catch(()=>{})
  const squads = await page.evaluate(() => { const s = window.rugbyStore.getState(), g = s.game, lm = s.liveMatch
    const ids = lm ? [lm.homeId ?? lm.home?.id, lm.awayId ?? lm.away?.id] : []
    const found = ids.filter(Boolean)
    const pick = found.length ? found : Object.keys(g.clubs).filter(k => k === g.userClubId)
    return { lmKeys: lm ? Object.keys(lm) : [], ids: pick, names: pick.map(id => ({ id, name: g.clubs[id]?.name, league: g.clubs[id]?.leagueId, players: (g.clubs[id]?.players || []).map(p => p.name) })) } })
  result.opp = opp; result.squads = squads
  result.realCheck = await page.evaluate(() => { const g = window.rugbyStore.getState().game
    const names = [...document.querySelectorAll('.scoreboard')].map(e => e.innerText).join(' ')
    return Object.values(g.clubs).filter(c => names.includes(c.short ?? '###') || names.includes(c.name) || (c.name && names.includes(c.name.replace(/ RFC$/, ''))))
      .map(c => ({ id: c.id, name: c.name, league: c.leagueId, players: c.players.length, real: c.players.filter(p => p.real).map(p => p.name) })) })
  console.log(TILE, 'REALCHECK', JSON.stringify(result.realCheck.map(c => [c.name, c.players, c.real.length])))
  const m = { start: await sb() }
  await skipTo('Start Second Half'); await tapPast(page, 'text="Start Second Half"'); await page.waitForTimeout(300)
  await skipTo('Play the Final Quarter'); m.q4 = await sb()
  await tapPast(page, 'text="Play the Final Quarter"'); await page.waitForTimeout(200)
  await rec('match0'); m.clip = 'match0'
  const scores = [], end = Date.now() + 24000
  while (Date.now() < end) {
    if (await page.locator('.btn', { hasText: 'Take the Points' }).first().isVisible().catch(() => false)) await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(()=>{})
    if (await page.locator('.sheet-col').first().isVisible().catch(() => false)) { await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click({ timeout: 2000 }).catch(() => {}); await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])').first().click({ timeout: 2000 }).catch(() => {}); await page.locator('.btn', { hasText: /Back to the Match|Done|Close/ }).first().click({ timeout: 2000 }).catch(() => {}) }
    scores.push([Date.now()/1000, await sb()])
    if (await page.locator('text=Continue to Results').first().isVisible().catch(()=>false)) break
    await page.waitForTimeout(250)
  }
  await stop(); m.scores = scores
  await skipTo('Continue to Results'); m.final = await sb()
  result.matches.push(m); console.log(TILE, 'q4', m.q4, 'final', m.final, 'clubs', squads.names.map(x => x.name + '/' + x.league).join(' v '))
} catch (e) { console.error('ERR', TILE, e.message); await page.screenshot({ path: `${OUT}/err.png` }) }
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log)); writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 1))
await browser.close(); process.exit(0)
