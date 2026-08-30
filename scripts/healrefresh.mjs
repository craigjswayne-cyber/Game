/**
 * ---- A PURCHASE THAT LANDS HAS TO LOOK LIKE ONE ----
 *
 * Owner, v1.1.16: "Ive just brought a full fitness pack in the medical centre
 * and it didnt refresh my players."
 *
 * MY FIRST DIAGNOSIS WAS WRONG AND THIS PROBE IS WHAT PROVED IT. The theory
 * was a missing `useStore(s => s.tick)` on Medical.tsx: the store mutates the
 * game object in place and bumps `tick`, so a component selecting only
 * `s.game` gets the identical reference back and never repaints. Medical was
 * indeed the only one of the three screens that host the Full Fitness card
 * without that line. But ui/App.tsx subscribes to tick and re-renders the
 * whole tree, so the screen repaints anyway - this probe passes with the line
 * added and with it removed. The line was reverted rather than shipped as a
 * no-op with a comment claiming a bug that is not there.
 *
 * What was actually wrong is upstream, in playbilling: a consumable was
 * acknowledged and never consumed, so the heal stayed OWNED, came back as a
 * phantom "Apply here", and applying it did nothing because the squad had been
 * mended already and no match had been played since. The card then said
 * "nothing to heal right now, or no match since the last visit" - one sentence
 * naming both reasons, half of it plainly false to a manager looking at four
 * men on the table. Both are fixed: consume goes first for a consumable, and
 * the card names the reason it actually hit.
 *
 * This probe stays because the property is worth holding whatever the cause:
 * a heal bought from the Medical Centre mends the squad AND the table shows it,
 * without navigating away and back.
 *
 * Run: node scripts/healrefresh.mjs
 */
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(4254, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

try {
  await page.goto('http://localhost:4254/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Heal Test')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(500)

  // FOUR MEN IN THE BOOT. Put them there directly - this probe is about what
  // the screen does when they are mended, not about how they got hurt.
  const hurtNames = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const squad = g.clubs[g.userClubId].players.slice(0, 4)
    const names = []
    for (const id of squad) {
      const p = g.players[id]
      p.injury = { desc: 'Hamstring', weeks: 3 }
      p.cond = 60
      names.push(p.name)
    }
    st.touch()
    return names
  })
  ok(hurtNames.length === 4, `four men are in the treatment room (${hurtNames.join(', ')})`)

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Medical Centre')
  await page.waitForSelector('text=Treatment Room')
  const before = await page.locator('main').innerText()
  const listedBefore = hurtNames.filter(n => before.includes(n))
  ok(listedBefore.length === 4, `all four are named on the table (${listedBefore.length}/4)`)

  // Fire the heal exactly as the Full Fitness card fires it - the store action,
  // with the screen left where it is. No navigation, no reload.
  const healed = await page.evaluate(() => window.rugbyStore.getState().healSquad())
  ok(healed === true, 'the heal itself reports that it landed')
  await page.waitForTimeout(400)

  const after = await page.locator('main').innerText()
  const stillListed = hurtNames.filter(n => after.includes(n))
  ok(stillListed.length === 0,
    `and the table repaints where it stands - nobody is still in the boot (${stillListed.join(', ') || 'table clear'})`)

  // and the save really did change, so a passing test cannot be the screen
  // simply having gone blank
  const fit = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    return g.clubs[g.userClubId].players.slice(0, 4).every(id => !g.players[id].injury && g.players[id].cond === 100)
  })
  ok(fit, 'with every one of them actually mended in the save behind it')
} catch (e) {
  console.log(`FAIL  the walk itself broke: ${e}`)
  fails++
}

await browser.close()
server.kill?.()
console.log(fails === 0
  ? '\nHEAL REFRESH PASSED: what you paid for shows on the screen you paid from'
  : `\nHEAL REFRESH FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
