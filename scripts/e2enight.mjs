// Night-mode visual QA: the theme the user actually plays in.
// Forces rm-night=1 before the app boots, then screenshots the key screens.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = await startPreview('4175', 2500)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

/** The dressing room opens when Kick Off is pressed (feedback 9-1), so this
 *  should never fire on a plain screen walk - but it stays as a guard, and the
 *  button text is now the one the modal actually has. The old version looked for
 *  'Say nothing for now', which the modal has never said, and the click was
 *  wrapped in .catch() so it failed silently for three rounds. */
const clearTalk = async () => {
  const veil = page.locator('.talk-modal')
  if (await veil.count()) {
    await page.click('.talk-modal >> text=Say nothing').catch(() => {})
    await page.waitForTimeout(200)
  }
}

const shot = (name) => page.screenshot({ path: `${SHOTS}/night-${name}.png` })

try {
  await page.goto('http://localhost:4175/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('01-title')

  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await shot('02-wizard-league')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await shot('03-wizard-club')
  // No club tint on a club tile's fill or frame. The user reported a "weird red"
  // around some clubs twice: first it was the border, 55% of the club's primary
  // colour, then it was still a 14% wash in the fill. Five of the ten Premiership
  // clubs have red in their first two colours and no amount of red over a
  // near-black paper looks deliberate, so the colour lives only in the top strip
  // now. Every unselected tile must therefore paint EXACTLY the same background
  // and border as every other one.
  const tiles = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.club-tile:not(.sel)')]
    const seen = new Map()
    for (const el of els) {
      const s = getComputedStyle(el)
      const k = `${s.backgroundColor}|${s.backgroundImage}|${s.borderTopColor}`
      seen.set(k, (seen.get(k) ?? 0) + 1)
    }
    return { count: els.length, variants: [...seen.keys()] }
  })
  console.log(`club tiles: ${tiles.count}, distinct paint jobs ${tiles.variants.length}`)
  if (tiles.variants.length !== 1) {
    throw new Error(`club tiles paint ${tiles.variants.length} different ways, so a club colour is back in the fill or the border:\n  ${tiles.variants.join('\n  ')}`)
  }
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await shot('04-wizard-detail')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Night Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await shot('05-home')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable')
  await page.click('.tab-bar >> text=General Info')
  await page.waitForTimeout(300)
  await shot('06-squad')

  // The filter row has to be ONE line. It was two: six chips plus a search box
  // wrapped, and the search box got a whole row of its own, which on a 390px-tall
  // phone costs a row of players. U23 came off, then the search box and the two
  // availability words, so five short controls now fit with room to spare.
  const filterRow = await page.evaluate(() => {
    const row = document.querySelector('.filter-row')
    const tops = [...row.children].map(c => c.getBoundingClientRect().top)
    // a tolerance, not an equality: the text input sits a pixel lower than the
    // chips because of its border, and an exact compare read that as a wrap
    return { spread: Math.max(...tops) - Math.min(...tops), kids: row.children.length }
  })
  console.log(`squad filter row: ${filterRow.kids} controls, top spread ${filterRow.spread.toFixed(1)}px`)
  if (filterRow.spread > 8) throw new Error(`squad filter row wrapped (${filterRow.spread.toFixed(0)}px of vertical spread)`)
  if (await page.locator('.filter-row >> text=U23').count()) throw new Error('U23 chip is back')
  // and no clipped summary line riding the tab bar
  if (await page.locator('.tab-bar .filter-note').count()) throw new Error('the clipped squad summary line is back')

  // squad filters: availability is two icons now, not two words plus a search box
  if (await page.locator('.filter-row input').count()) throw new Error('the squad search box is back')
  await page.locator('.preset-chip >> text=🚑').click()
  await page.waitForTimeout(250)
  await shot('06a2-squad-filtered')
  await page.locator('.preset-chip >> text=Everyone').click()

  // player profile
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('.tab-bar')
  await page.click('.tab-bar >> text=Attributes')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('06b-player')
  await page.click('.back-btn')

  // transfers (lives under the Club submenu)
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForTimeout(600)
  await shot('06c-transfers')
  await page.locator('.preset-chip >> text=🏷️ Listed').click()
  await page.waitForTimeout(300)
  await shot('06c2-transfers-filtered')
  // commissioned scouting lives on the Shortlist tab
  await page.click('.tab-bar >> text=Shortlist')
  await page.waitForSelector('text=Commissioned Search')
  await shot('06c3-commission')

  // tables
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForSelector('.dtable')
  await shot('06d-tables')

  // press room
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Press Room')
  await page.waitForTimeout(400)
  await shot('06e-press')

  // training: the facilities boardroom flow
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Training & Staff')
  await page.waitForSelector('.tab-bar')
  await shot('06f-training')
  await page.click('.tab-bar >> text=Staff')
  await page.waitForSelector('text=Backroom Staff')
  await shot('06f2-staff')
  await page.locator('.btn.ghost >> text=Market').first().click()
  await page.waitForTimeout(300)
  await shot('06f3-staff-market')
  await page.click('.tab-bar >> text=Club')
  await page.waitForSelector('text=Mentoring')
  await shot('06g-mentoring')

  // the team sheet: forwards left, backs right in landscape
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"').catch(() => {})
  try {
    await page.waitForSelector('.xv-split', { timeout: 4000 })
    await shot('06g2-team-sheet')
    // Starting XV, its hint and both auto-picks on ONE line (user asked for it).
    // The row used to be three lines tall because the hint wrapped inside its own
    // span, which flex cannot prevent without a nowrap rule.
    const head = await page.evaluate(() => {
      const t = document.querySelector('.section-title')
      const kids = [...t.children].map(c => c.getBoundingClientRect())
      return {
        h: t.getBoundingClientRect().height,
        spread: Math.max(...kids.map(r => r.top)) - Math.min(...kids.map(r => r.top)),
        parts: t.children.length,
      }
    })
    console.log(`selection heading: ${head.parts} parts, ${head.h.toFixed(0)}px tall, ${head.spread.toFixed(1)}px spread`)
    if (head.spread > 8) throw new Error(`selection heading wrapped (${head.spread.toFixed(0)}px spread)`)
    if (head.h > 34) throw new Error(`selection heading is ${head.h.toFixed(0)}px tall, so it is more than one line`)
  } catch (e) {
    if (String(e).includes('selection heading')) throw e
    /* no lineup yet */
  }

  // the analyst's read lives on the Match Prep page
  try {
    await page.waitForSelector('.tab-bar', { timeout: 4000 })
    await page.click('.tab-bar >> text=Prep')
    await page.waitForSelector('text=The Analyst')
    await shot('06h-analyst')
  } catch { /* no fixture this week */ }

  // the academy section: squad, A League table, fixtures (feedback 10G)
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Academy')
  await page.waitForSelector('text=The Scholars')
  await shot('06h2-academy-squad')
  {
    const rows = await page.locator('.dtable tbody tr').count()
    console.log(`academy squad rows: ${rows} (should be 27 scholars)`)
    if (rows < 27) throw new Error(`academy squad shows ${rows} rows, expected 27`)
  }
  await page.click('.preset-chip >> text=A League Table')
  await page.waitForSelector('text=A League')
  await shot('06h3-academy-table')
  {
    const rows = await page.locator('.dtable tbody tr').count()
    console.log(`A League table rows: ${rows}`)
    if (rows < 4) throw new Error(`A League table shows ${rows} rows`)
  }
  await page.click('.preset-chip >> text=Fixtures & Results')
  await page.waitForSelector('text=A League Fixtures')
  await shot('06h4-academy-fixtures')
  {
    const rows = await page.locator('.dtable tbody tr').count()
    console.log(`A League fixtures for the user: ${rows}`)
    if (rows < 4) throw new Error(`A League fixture list shows ${rows} rows`)
  }
  // nothing on this screen may push the page sideways on a phone
  {
    const wide = await page.evaluate(() => document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth)
    if (wide) throw new Error('academy screen scrolls horizontally')
  }

  // club infrastructure: the estate on one page
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Club Infrastructure')
  await page.waitForSelector('text=Facilities')
  await shot('06i-infrastructure')
  await page.locator('text=🏛 Ask board').first().click()
  await page.waitForTimeout(300)
  await shot('06j-infra-ask')

  // the handbook: every system explained, with a search box
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click(".submenu-item >> text=The Manager's Handbook")
  await page.waitForSelector('text=the eighty minutes and the hour before it')
  await page.locator('.news-item').first().click()
  await page.waitForTimeout(200)
  await shot('06k-handbook')
  await page.fill('input[placeholder="Search the handbook…"]', 'catchment')
  await page.waitForTimeout(300)
  await shot('06k2-handbook-search')

  // live match: kick off and play a half in the dark. Continue walks the week a
  // day at a time now, so the button reads Continue until the day the game falls
  // on - tap through the bulletins (in the dark, which is the point of this run)
  // until Matchday takes over.
  for (let tap = 0; tap < 8; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
    const day = await page.evaluate(() => document.querySelector('.day-head .dh-day')?.textContent ?? null)
    if (day) await shot(`06z-day-${day.toLowerCase()}`)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 15000 })
  await shot('07-matchday')
  await page.locator('text=Kick Off ▸').first().click()
  // Kick Off opens the dressing room first now, and the speech is what carries
  // on down the tunnel
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await shot('07b-dressing-room')
    await page.click('.talk-modal .speech-tile >> nth=0')
  } catch { /* no dressing room */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* straight to the tunnel */ }
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.waitForTimeout(1500)
  await shot('08-live-match')

  console.log('NIGHT QA COMPLETE')
} catch (e) {
  await shot('99-failure')
  console.error('NIGHT QA FAILED:', e.message)
} finally {
  console.log('console errors:', errors.length ? errors.slice(0, 10) : 'none')
  await browser.close()
  server.stop()
  process.exit(0)
}
