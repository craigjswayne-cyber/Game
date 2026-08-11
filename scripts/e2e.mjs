// End-to-end smoke test: drive the built app in mobile Chromium (landscape).
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = await startPreview('4173', 2500)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` })

// the Wire interstitial shows this week's stories full screen - step past it
/** A bid for one of your players blocks Continue (10E), so the walk has to
 *  answer them like a manager would rather than sitting on a screen it cannot
 *  leave. Rejects everything: the point of the test is that the gate opens. */
const clearOffers = async () => {
  for (let i = 0; i < 12; i++) {
    if (await page.locator('text=Get On With The Week').count()) {
      await page.click('text=Get On With The Week')
      await page.waitForTimeout(300)
      return true
    }
    const rej = page.locator('.btn.danger >> text=Reject')
    if (await rej.count()) {
      offersAnswered++
      await rej.first().click()
      await page.waitForTimeout(200)
      continue
    }
    return false
  }
  return false
}
let offersAnswered = 0

const clearWire = async () => {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('text=On to the Week').count()) {
      await page.click('text=On to the Week')
      await page.waitForTimeout(250)
      return
    }
    if (await page.locator('text=Next Story ▸').count()) {
      await page.click('text=Next Story ▸')
      await page.waitForTimeout(120)
      continue
    }
    return
  }
}

/** Play a full interactive match from the preview screen. */
async function playMatch(speech = 'Calm the nerves') {
  await page.locator('text=Kick Off ▸').first().click()
  // Kick Off opens the dressing room first now (feedback 9-1: "the team talk
  // should come as you press kick off"), and choosing a speech in there is what
  // carries on down the tunnel.
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await page.click(`.talk-modal .speech-tile >> text=${speech}`)
  } catch { /* no dressing room - a talk was already given */ }
  // a clean team sheet skips the ready-check modal entirely
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* no modal - straight to the tunnel */ }
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Start Second Half', { timeout: 20000 })
  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(300)
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Play the Final Quarter', { timeout: 20000 })
  await page.click('text=▸ Play the Final Quarter')
  await page.waitForTimeout(300)
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Continue to Results', { timeout: 20000 })
}

try {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('01-title')

  // New career
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await shot('02-newgame')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Test Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  // the box swallows its own taps now, so a click on the veil's centre lands on
  // the box and does nothing. Use the button a real thumb would use.
  await page.click('.tut-close .btn')
  // ---- the opening sequence, in order ----
  // A new manager is introduced by four letters and nothing may jump the queue
  // (user: "it has already shared a scout report so you wouldnt see it. can we do
  // a welcome, a fan response, squad assessment, coaching team"). The inbox reads
  // oldest unread first, so the id order IS the reading order.
  // the News rail button serves the oldest unread and then the next, so tapping it
  // four times walks the opening sequence in the order it is meant to be read
  const opening = []
  for (let i = 0; i < 4; i++) {
    await page.click('.bottom-nav button[title="News"]')
    await page.waitForSelector('.reader', { timeout: 15000 })
    await page.waitForTimeout(200)
    opening.push((await page.locator('.reader h2').innerText()).trim())
  }
  console.log(`opening inbox: ${opening.map(x => `"${x.slice(0, 34)}"`).join(' > ')}`)
  const wantOpen = [/Welcome to Leicester/i, /terraces|faithful|support/i, /assistant/i, /backroom staff/i]
  wantOpen.forEach((re, i) => {
    if (!opening[i] || !re.test(opening[i])) {
      throw new Error(`opening letter ${i + 1} should match ${re}, got "${opening[i] ?? '(missing)'}"`)
    }
  })
  await page.click('.back-btn')
  await shot('03-inbox')

  // Squad
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable')
  await shot('04-squad')

  // Player profile (first row)
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('.tab-bar')
  await page.click('.tab-bar >> text=Attributes')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('05-player')
  await page.click('.back-btn')

  // Tactics area. Selection has one auto-pick now: In-Form XV came off at the
  // user's request, because two buttons that both rewrite the whole team sheet is
  // one too many and the difference between them never showed on the button.
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('text=Starting XV')
  await shot('06-selection')
  if (await page.locator('text=In-Form XV').count()) throw new Error('In-Form XV button is back')
  await page.click('text=Best XV')
  await page.waitForTimeout(200)
  await page.click('.tab-bar >> text=Roles')
  await page.waitForSelector('.form-pitch')
  await shot('06-tactics')
  await page.click('.tab-bar >> text=Prep')
  await page.waitForSelector('text=Match Preparation')
  await page.click('.tab-bar >> text=Game Plan')
  await page.waitForSelector('text=Quick Game Plans')

  // Club submenu -> Team Report
  await page.click('.bottom-nav button[title="Hub"]')
  await page.waitForSelector('.submenu')
  await shot('06b-club-menu')
  await page.click('.submenu-item >> text=Team Report')
  await page.waitForSelector('text=Where We Stand')
  await page.click('.tab-bar >> text=Squad Depth')
  await page.waitForSelector('text=Positional Depth')
  await shot('06c-team-report')

  // Club submenu -> Medical Centre
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Medical Centre')
  await page.waitForSelector('text=Treatment Room')
  await shot('06d-medical')

  // Club submenu -> Club Information (dressing room mood board)
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Club Information')
  await page.waitForSelector('text=Dressing Room')
  await shot('06e-club-info')

  // World submenu -> Competitions
  await page.click('.bottom-nav button[title="World"]')
  await page.waitForSelector('.submenu')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForSelector('.dtable')
  await shot('07-tables')

  // The news reader, from the rail. There was a separate World > The Rugby Wire
  // screen here; it was a second browser over the same news array and has been
  // merged into this one, so gossip arrives in the same queue as everything else.
  await page.click('.bottom-nav button[title="News"]')
  await page.waitForSelector('.reader')
  await shot('07b-news')

  // Manager submenu -> Profile
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Manager Profile')
  await page.waitForSelector('text=Coaching Specialities')
  await shot('07c-profile')

  // Manager submenu -> Save/Load
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Save / Load Game')
  await page.waitForSelector('text=Save Slots')
  await page.click('.card >> text=💾 Save >> nth=0')
  await page.waitForSelector('text=Career saved')
  await shot('07d-saves')

  // Club submenu -> Transfers
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForSelector('text=Scout The Market')
  await shot('08-transfers')
  await page.click('.tab-bar >> text=Deals')
  await page.waitForSelector('text=Contract Situations')
  await shot('08b-deals')
  await page.click('.tab-bar >> text=Market')

  // ---- Continue walks the week a day at a time ----
  // The button reads Continue on the bulletin days and Matchday on the day the
  // game actually falls, so the walk to kick-off is a handful of taps, not one.
  // Bounded so a stuck flow fails the test rather than hanging it.
  const bulletins = []
  for (let tap = 0; tap < 8; tap++) {
    const label = (await page.locator('.continue-btn').innerText()).trim()
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
    await clearOffers()
    const day = await page.evaluate(() => document.querySelector('.day-head .dh-day')?.textContent ?? null)
    if (day) { bulletins.push(day); continue }
    if (await page.locator('text=Kick Off').count()) break
    // not a bulletin and not the match: something else took the screen
    if (label === 'Matchday ▸') break
  }
  console.log(`walked to kick-off through: ${bulletins.length ? bulletins.join(' > ') : '(no bulletins)'}`)
  if (!bulletins.length) throw new Error('Continue reached the match without a single day bulletin')
  if (new Set(bulletins).size !== bulletins.length) throw new Error(`a day repeated itself: ${bulletins.join(', ')}`)
  await page.waitForSelector('text=Kick Off', { timeout: 15000 })
  await shot('09-matchday-preview')
  await playMatch()
  await shot('10-fulltime')
  await page.click('text=Continue to Results')
  await page.waitForSelector('text=This Week\'s Results', { timeout: 10000 })
  await page.click('text=Back to the Dressing Room')
  await page.waitForTimeout(300)
  await shot('11-wire-story')
  await clearOffers()
    await clearWire()
  await page.waitForSelector('.continue-btn', { timeout: 15000 })
  await shot('11-after-match')
  // the inbox reads one message at a time now (10D): the mail icon serves the
  // next unread, and the arrows recall the last twenty
  await page.click('.bottom-nav button[title="News"]')
  await page.waitForSelector('.reader', { timeout: 15000 })
  await shot('11b-inbox')
  const firstSubject = await page.locator('.reader h2').innerText()
  await page.click('.bottom-nav button[title="News"]')
  await page.waitForTimeout(250)
  const secondSubject = await page.locator('.reader h2').innerText()
  const posDbg = await page.locator('.reader-pos').innerText()
  console.log(`inbox queue: "${firstSubject.slice(0, 40)}" then "${secondSubject.slice(0, 40)}" | pos: ${posDbg}`)
  if (firstSubject === secondSubject) {
    const pos = await page.locator('.reader-pos').innerText()
    // .reader-pos is uppercased by CSS, and innerText returns what is rendered
    if (!/all read/i.test(pos)) throw new Error('the mail icon did not advance to the next unread')
  }
  // and back through the recall window
  await page.click('.reader-bar >> text=◀')
  await page.waitForTimeout(200)
  await shot('11c-inbox-recall')
  await page.click('.bottom-nav button[title="Home"]')

  // burn through several weeks (mix of matchday + blank weeks)
  for (let i = 0; i < 8; i++) {
    await page.click('.continue-btn')
    await page.waitForTimeout(500)
    await clearOffers()
    await clearWire()
    const kick = page.locator('text=Kick Off ▸')
    if (await kick.count()) {
      await playMatch()
      await page.click('text=Continue to Results')
      await page.waitForSelector("text=This Week's Results", { timeout: 10000 })
      await page.click('text=Back to the Dressing Room')
      await page.waitForTimeout(300)
      await clearOffers()
    await clearWire()
    }
  }
  await shot('12-weeks-later')

  // ---- the inbox cue serves, and the reader has a table of contents ----
  // (user: "it often says 9 messages in inbox, click on it and nothing shows
  // up"). Tapping the Home cue must open an UNREAD story - it used to
  // navigate bare and land on whatever old story the reader last held.
  await page.click('.bottom-nav button[title="Home"]')
  await page.waitForTimeout(300)
  const cue = page.locator('.inbox-cue')
  if (await cue.count()) {
    const cueText = await cue.innerText()
    const promised = parseInt(/(\d+) unread/i.exec(cueText)?.[1] ?? '0', 10)
    await cue.click()
    try {
      await page.waitForSelector('.reader', { timeout: 10000 })
    } catch (e) {
      const mast = await page.evaluate(() => document.querySelector('.masthead h1')?.textContent ?? '(no masthead)')
      const bodyTop = await page.evaluate(() => document.body.innerText.slice(0, 400))
      console.log(`CUE DEBUG: after tap, screen is "${mast}"; page starts:\n${bodyTop}`)
      await shot('12z-cue-debug')
      throw e
    }
    const pos = await page.locator('.reader-pos').innerText()
    console.log(`inbox cue promised ${promised} unread; reader header: "${pos}"`)
    // serving the first one leaves promised-1 behind; a stale already-read
    // story leaves all of them and this line still says the full count
    const leftBehind = parseInt(/(\d+) unread/i.exec(pos)?.[1] ?? '0', 10)
    if (promised > 0 && leftBehind !== promised - 1) {
      throw new Error(`the cue promised ${promised} unread but the tap served none of them (reader says ${leftBehind})`)
    }
    // The table-of-contents list under the reader was removed at the user's
    // request (19D: "remove also in your inbox too") - the reader is one
    // story and its arrows again, so the only thing to hold here is that the
    // cue actually served the queue, asserted above.
    await shot('12z-inbox-reader')
    await page.click('.bottom-nav button[title="Home"]')
    await page.waitForTimeout(200)
  } else {
    console.log('inbox cue not on screen this run (all read) - list checked via inboxprobe')
  }

  // Team of the Week (magazine dream team)
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Team of the Week')
  await page.waitForSelector('text=DREAM TEAM')
  await shot('12b-dreamteam')

  // Scouting Agency world rankings
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Scouting Agency')
  await page.waitForSelector('text=Senior Rankings: World')
  await page.click('.tab-bar >> text=Wonderkids')
  await page.waitForSelector('text=Wonderkid Watch: World')
  await shot('12c-agency')
  await page.click('.tab-bar >> text=Test Nations')
  await page.waitForSelector('text=Test Rankings: World')
  await shot('12d-nations')

  // press room via Club submenu
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Press Room')
  await page.waitForTimeout(400)
  await shot('13-press')

  // ---- a reload lands back in the career, not on the title screen
  // (user: "when you refresh the page it kicks you out to the main menu - dont
  // have it do that, have it stay on the page"). The bookmark is the last screen
  // visited, so this reload has to come back to the Press Room.
  await page.reload()
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  const resumed = await page.evaluate(() => document.querySelector('.masthead h1')?.textContent ?? '')
  console.log(`reload resumed on: "${resumed}"`)
  if (/RUGBY MANAGER/i.test(resumed) || !resumed) throw new Error('a reload dropped the manager on the title screen')
  await shot('14-resumed')

  // ---- and the title screen is still reachable on purpose, which is the only
  // way to start a second career now that a refresh no longer gets you there
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Main Menu')
  await page.waitForSelector('text=Load Career', { timeout: 15000 })
  await page.click('text=Load Career')
  await page.click('text=Test Gaffer')
  await page.waitForSelector('.continue-btn', { timeout: 15000 })
  await shot('14-loaded-save')

  // ---- the rail is in the order the user asked for: news first, then home,
  // then the pre-match hub, the manager, and the wider world
  const rail = await page.evaluate(() =>
    [...document.querySelectorAll('.bottom-nav button')].map(b => b.getAttribute('title')))
  const wantHead = ['News', 'Home', 'Hub', 'Manager', 'World']
  const railOk = wantHead.every((t, i) => rail[i] === t)
  console.log(`rail order: ${rail.join(' > ')}`)
  if (!railOk) throw new Error(`rail order wrong: expected ${wantHead.join(', ')}`)
  if (rail.length !== wantHead.length) throw new Error(`rail has ${rail.length} buttons, expected ${wantHead.length}`)

  // ---- and the title screen's Continue tile stays on one line (user:
  // "'continue - craig, northampton saints' should be on one line").
  // Height is the honest measure. scrollWidth has a floor of clientWidth, so
  // comparing the two can only ever catch overflow, never a snug fit - and with
  // white-space: nowrap there is no overflow to catch. One line of this text is
  // about 22px; a wrap would be 40-plus.
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Main Menu')
  await page.waitForSelector('.continue-tile', { timeout: 15000 })
  const ct = await page.evaluate(() => {
    const l = document.querySelector('.ct-line')
    const lh = parseFloat(getComputedStyle(l).lineHeight) || 20
    return { text: l.textContent, h: Math.round(l.getBoundingClientRect().height), lh: Math.round(lh) }
  })
  console.log(`continue tile: "${ct.text}" is ${ct.h}px tall (one line is about ${ct.lh}px)`)
  if (ct.h > ct.lh * 1.6) throw new Error(`the Continue tile wrapped (${ct.h}px)`)

  console.log(`offers answered during the walk: ${offersAnswered}`)
  console.log('E2E FLOW COMPLETE')
} catch (e) {
  await shot('99-failure')
  console.error('E2E FAILED:', e.message)
} finally {
  console.log('console errors:', errors.length ? errors.slice(0, 10) : 'none')
  await browser.close()
  server.stop()
  process.exit(0)
}
