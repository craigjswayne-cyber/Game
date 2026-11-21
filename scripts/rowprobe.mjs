// 1.9.16: no list row is taller than its neighbours because a name is long.
// Owner: "a lot of the name lists, like rankings etc, are bigger when names are longer.
// They should all be like game time where if a name is long it goes..."
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/usr/bin/google-chrome' })
for (const width of [360, 384, 412]) {
  const page = await browser.newPage({ viewport: { width, height: 832 }, deviceScaleFactor: 1 })
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Row Probe')
  await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn'); await page.waitForTimeout(400)
  // the longest names the game can make, put where every list will meet them
  await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    const mine = g.clubs[g.userClubId].players.map(id => g.players[id])
    mine[0].name = 'Bartholomew Featherstonehaugh-Cholmondeley'
    mine[5].name = 'Maximilian Ollerton-Netherwood-Fairhurst'
    const others = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId)
    others[0].name = 'Sebastian Adlington-Whitfield-Brampton'; others[0].sc = 100; others[0].transferListed = true
    const fa = Object.values(g.players).filter(p => !p.clubId)
    fa[0].name = 'Christopher Lindsey-Netherwood-Thackeray'
    st.touch()
  })
  const screens = ['squad', 'transfers', 'tables', 'nations', 'medical', 'report', 'academy', 'history', 'club', 'fixtures', 'training', 'tactics', 'finances']
  for (const sc of screens) {
    await page.evaluate(sc => window.rugbyStore.getState().go(sc), sc)
    await page.waitForTimeout(450)
    if (sc === 'transfers') { await page.click('[data-fa-chip]').catch(() => {}); await page.waitForTimeout(300) }
    const bad = await page.evaluate(() => {
      const out = []
      for (const tb of document.querySelectorAll('table tbody')) {
        const rows = [...tb.querySelectorAll(':scope > tr')].filter(r => r.getBoundingClientRect().height > 0 && r.querySelector('td.name, td.nm'))
        if (rows.length < 3) continue
        const hs = rows.map(r => Math.round(r.getBoundingClientRect().height)).sort((a, b) => a - b)
        const med = hs[Math.floor(hs.length / 2)]
        for (const r of rows) {
          const h = Math.round(r.getBoundingClientRect().height)
          if (h > med * 1.25) out.push(`${(r.querySelector('td.name, td.nm')?.textContent ?? '').slice(0, 30)} ${h}px against ${med}px`)
        }
      }
      const wide = document.documentElement.scrollWidth > innerWidth + 1
      return { out, wide }
    })
    ok(bad.out.length === 0, `${width}px ${sc}: every named row is the height of its neighbours${bad.out.length ? ' (' + bad.out.slice(0, 3).join('; ') + ')' : ''}`)
    ok(!bad.wide, `${width}px ${sc}: the page does not scroll sideways`)
  }
  await page.close()
}
await browser.close(); await server.close?.()
console.log(fails ? `ROW PROBE FAILED (${fails})` : 'ROW PROBE PASSED')
process.exit(fails ? 1 : 0)
