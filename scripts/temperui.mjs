// Browser probe: the player page names a man's nerve and his minutes, and the
// pre-match report says when the opposition respects you (1.8.0, E7, E8, E9).
//
// temperprobe.ts and respectprobe.ts hold the rules; this holds the screens:
// the staff's read and the no-minutes note on your own young player, the
// scouts' hedged and plain reads on another club's man and nothing on an
// unscouted one, and the "They respect you now" line on the opposite number
// card. Screenshots at 412x915 and 360x800, looked at by eye.
//
// Run: npm run build && node scripts/temperui.mjs [outdir]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4287
const OUT = process.argv[2] ?? 'shots/temper'
mkdirSync(OUT, { recursive: true })
const server = await startPreview(PORT, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const errors = []

async function career(page) {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Temper Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(600)
}

/** Open a player's page on the profile tab, and return the read card's text. */
async function openPlayer(page, id) {
  await page.evaluate(pid => { const s = window.rugbyStore.getState(); s.go('player', pid) }, id)
  await page.waitForTimeout(700)
  return page.evaluate(() => document.querySelector('.temper-card')?.innerText ?? null)
}

for (const [w, h] of [[412, 915], [360, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  try {
    await career(page)
    // ---- your own young player: known to the staff, short of starts ----
    const own = await page.evaluate(() => {
      const s = window.rugbyStore.getState(); const g = s.game
      const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && q.age <= 22)
      g.week = 20
      p.stats.starts = 1; p.stats.apps = 11; p.pers = 'Professional'; p.a.wor = 16
      s.touch()
      return p.id
    })
    const ownText = await openPlayer(page, own)
    await page.screenshot({ path: `${OUT}/own-${w}.png` })
    ok(!!ownText && /the staff's read/i.test(ownText) && /Starts this season: 1/.test(ownText) && /professionalism/.test(ownText),
      `${w}px: your own man shows the staff's read and the professional's no-minutes note`)

    // ---- a new signing: too early ----
    const fresh = await page.evaluate(() => {
      const s = window.rugbyStore.getState(); const g = s.game
      const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && q.age >= 25)
      p.stats.apps = 2; p.career = p.career.filter(r => r.clubId !== g.userClubId)
      // and no analyst's homework to stand in for the matches
      g.staff.assistant = 0; g.clubs[g.userClubId].facilities.briefing = 0
      s.touch(); return p.id
    })
    const freshText = await openPlayer(page, fresh)
    await page.screenshot({ path: `${OUT}/pending-${w}.png` })
    ok(!!freshText && /Too early to judge/.test(freshText), `${w}px: two matches in, "too early to judge"`)

    // ---- another club's man at three levels of scouting ----
    const other = await page.evaluate(() => {
      const g = window.rugbyStore.getState().game
      return Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && !q.acad && q.age >= 24).id
    })
    const setSc = (v) => page.evaluate(([pid, sc]) => { const s = window.rugbyStore.getState(); s.game.players[pid].sc = sc; s.touch() }, [other, v])
    await setSc(20)
    const none = await openPlayer(page, other)
    ok(none === null, `${w}px: an unscouted man shows nothing`)
    await setSc(60)
    await page.evaluate(() => window.rugbyStore.getState().touch())
    await page.waitForTimeout(300)
    const vague = await page.evaluate(() => document.querySelector('.temper-card')?.innerText ?? null)
    await page.screenshot({ path: `${OUT}/scouted-vague-${w}.png` })
    ok(!!vague && /the scouts' read/i.test(vague), `${w}px: a detailed report shows the scouts' hedged read`)
    await setSc(95)
    await page.waitForTimeout(300)
    const full = await page.evaluate(() => document.querySelector('.temper-card')?.innerText ?? null)
    await page.screenshot({ path: `${OUT}/scouted-full-${w}.png` })
    ok(!!full && full !== vague, `${w}px: the full file shows the plain words`)
    console.log(`      [${w}] own: ${ownText?.replace(/\n/g, ' | ')}\n      [${w}] vague: ${vague?.replace(/\n/g, ' | ')}\n      [${w}] full: ${full?.replace(/\n/g, ' | ')}`)

    // ---- the pre-match report: they respect you now ----
    const opp = await page.evaluate(() => {
      const s = window.rugbyStore.getState(); const g = s.game
      g.week = 1
      const fx = g.fixtures.filter(f => !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId)).sort((a, b) => a.week - b.week)[0]
      g.week = fx.week
      const oppId = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
      const c = g.clubs[oppId]
      if (c && c.philosophy) {
        c.vsUser = { ph: c.philosophy, r: 0.8, unit: 'lineout', base: { style: c.tactic.style, tempo: c.tactic.tempo, kicking: c.tactic.kicking, aggression: c.tactic.aggression } }
      }
      s.touch()
      return c ? c.short : null
    })
    await page.evaluate(() => window.rugbyStore.getState().go('matchday'))
    await page.waitForTimeout(900)
    await page.click('.tab-bar button:has-text("Briefing")')
    await page.waitForTimeout(500)
    const line = page.locator('.respect-line')
    if (await line.count()) {
      await line.first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/respect-${w}.png` })
    }
    const lineText = (await line.count()) ? await line.first().innerText() : null
    ok(!!lineText && /They respect you now/.test(lineText) && /lineout/.test(lineText), `${w}px: the opposite number card against ${opp}: "${lineText}"`)
  } catch (e) {
    ok(false, `${w}px walk broke: ${String(e).slice(0, 200)}`)
  }
  await page.close()
}
ok(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' / ')})`)
await browser.close()
server.stop()
console.log(fails ? `\n${fails} FAILURES` : '\nTEMPER UI PASSED: his nerve, his minutes and their respect, on screen')
done(fails)
