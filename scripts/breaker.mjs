// TRY TO BREAK THE GAME.
//
// Every other browser harness in here plays properly. It starts a career, picks a
// side, kicks off, and checks that what should happen happens. This one does the
// opposite: it goes looking for the crash, the stuck screen and the corrupted
// save, by doing the things a careful test never does.
//
// The instrumentation is the point. Every uncaught exception, every console error
// and every failed promise is captured for the whole session, tagged with what the
// script was doing at the time. A harness that only asserts on what it thought to
// check cannot find a bug nobody predicted; a harness that records every error the
// page raises can.
//
// WHAT IT ATTACKS
//   1. the wizard: empty name, 200 characters, emoji, double-taps, back mid-flow
//   2. the team sheet: every slot emptied, then kick off anyway
//   3. spam: thirty taps on Continue, rapid speed changes, modals opened and shut
//   4. a mid-match reload, which the game does not yet resume - it must still
//      leave a loadable save and a screen you can get out of
//   5. saves: save mid-match, load mid-match, load a slot that is not there
//   6. money: a zero bid, a bid of a billion, letters typed into number boxes
//   7. contracts: a zero-wage offer, a silly-money offer, a bid for your own man
//   8. navigation: every screen in the rail, twice, in both orientations
//
// It is deliberately noisy about what it did. When it finds something, the log
// says which attack found it.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4181
const server = await startPreview(PORT, 3000)

/** What the script is doing, for tagging any error the page throws. */
let phase = 'boot'
const errors = []
const notes = []
let fails = 0
/** how many hostile values actually reached a real input box */
let hostileBoxes = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }
const note = (s) => { notes.push(`[${phase}] ${s}`); console.log(`  ..  ${s}`) }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 412, height: 732 } })
const page = await ctx.newPage()
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

page.on('pageerror', e => errors.push({ phase, kind: 'uncaught', text: String(e).slice(0, 300) }))
page.on('console', m => {
  if (m.type() !== 'error') return
  const t = m.text()
  // a 404 for a favicon is not a game bug
  if (/favicon|manifest|net::ERR/.test(t)) return
  errors.push({ phase, kind: 'console', text: t.slice(0, 300) })
})
page.on('crash', () => errors.push({ phase, kind: 'crash', text: 'the page crashed' }))

/**
 * One attack, isolated.
 *
 * The first version of this file ran the attacks as one long script, and the very
 * first surprise killed the run: the wizard moved on a beat later than expected,
 * a fill timed out, and every attack after it never happened. A harness that dies
 * when the game does something unexpected is a harness that cannot find anything -
 * being surprised is the whole job. So each attack is separate, its own failure is
 * recorded, and the run carries on to the next one.
 */
const step = async (name, fn) => {
  phase = name
  console.log(`\n-- ${name}`)
  try { await fn() } catch (e) {
    console.log(`  ..  the attack itself gave up: ${String(e).split('\n')[0].slice(0, 160)}`)
    notes.push(`[${name}] attack aborted: ${String(e).split('\n')[0].slice(0, 160)}`)
  }
  const up = await alive()
  if (!up) { ok(false, `${name} left the app dead`) }
}

/** fill a box only if it is actually there */
const fillIf = async (sel, v) => {
  if (!(await page.locator(sel).count())) return false
  await page.locator(sel).first().fill(v, { timeout: 3000 }).catch(() => {})
  return true
}

const tap = async (sel, n = 1) => {
  for (let i = 0; i < n; i++) {
    try { await page.locator(sel).first().click({ timeout: 1500, force: true }) } catch { /* the point is that it might not be there */ }
  }
}
const alive = async () => {
  // the app is alive if React still owns the DOM and the error boundary is not up
  const s = await page.evaluate(() => ({
    root: !!document.querySelector('.app'),
    boundary: !!document.querySelector('.err-boundary, .error-boundary'),
    body: (document.body.textContent ?? '').length,
  })).catch(() => null)
  return s && s.root && !s.boundary && s.body > 50
}

const NAME_SEL = 'input[placeholder="e.g. A. Gaffer"]'
let atKick = false

try {
  // ---- 1. the wizard, abused --------------------------------------------
  await step('wizard', async () => {
    await page.goto(`http://localhost:${PORT}/`)
    await page.waitForSelector('text=RUGBY', { timeout: 20000 })
    await tap('text=New Career', 3)                      // triple tap
    await page.waitForSelector('text=Gallagher Premiership', { timeout: 8000 })
    await tap('text=Gallagher Premiership', 2)
    await page.waitForSelector('.club-tile', { timeout: 8000 })
    await tap('.tile >> text=Northampton', 2)
    await page.waitForSelector('text=Star Player', { timeout: 8000 })
    await tap('.action-bar >> text=Confirm', 3)          // spam confirm

    await page.waitForSelector(NAME_SEL, { timeout: 8000 })
    // empty, then 200 characters, then emoji and a script tag, then something sane
    await fillIf(NAME_SEL, '')
    await tap('.action-bar >> text=Confirm')
    await page.waitForTimeout(400)
    const stillAsking = await page.locator(NAME_SEL).count() > 0
    note(`an empty manager name was ${stillAsking ? 'refused' : 'ACCEPTED'}`)
    if (!stillAsking) ok(false, 'the wizard accepted an empty manager name')
    if (await fillIf(NAME_SEL, 'Z'.repeat(200))) {
      await tap('.action-bar >> text=Confirm')
      await page.waitForTimeout(300)
    }
    if (await fillIf(NAME_SEL, '🏉 <script>alert(1)</script> & <b>x</b>')) {
      await tap('.action-bar >> text=Confirm')
      await page.waitForTimeout(300)
    }
    await fillIf(NAME_SEL, 'The Breaker')
    await tap('.speech-tile >> text=Forward Dominance', 2)
    await tap('.action-bar >> text=Confirm', 2)
    await tap('text=▸ Start Career', 3)
    await page.waitForSelector('.tut-box', { timeout: 25000 })
    // the injected markup must be text, not markup: one script tag is Vite's
    const injected = await page.evaluate(() =>
      [...document.querySelectorAll('script')].filter(s => /alert\(1\)/.test(s.textContent ?? '')).length)
    note(`script tags containing the injected alert: ${injected}`)
    ok(injected === 0, 'a manager name containing a script tag was not executed as markup')
    await tap('.tut-close .btn', 2)
    await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  })

  // ---- 2. an empty team sheet, then kick off ------------------------------
  await step('empty sheet', async () => {
  await tap('.bottom-nav button[title="Hub"]')
  await tap('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('.tab-bar', { timeout: 8000 })
  // tap a slot twice to open the picker, then Clear Slot, for every XV row
  let cleared = 0
  for (let i = 0; i < 15; i++) {
    const row = page.locator('.xv-split .dtable tbody tr').nth(i)
    if (!(await row.count())) continue
    await row.click({ timeout: 1200 }).catch(() => {})
    await row.click({ timeout: 1200 }).catch(() => {})
    const clear = page.locator('.modal .btn >> text=Clear Slot')
    if (await clear.count()) { await clear.first().click().catch(() => {}); cleared++ }
    else await page.keyboard.press('Escape').catch(() => {})
  }
  note(`cleared ${cleared} of 15 shirts`)
  ok(await alive(), 'the app survived an emptied team sheet')
  })

  // ---- 3. spam ------------------------------------------------------------
  await step('spam', async () => {
  await tap('.bottom-nav button[title="Home"]')
  for (let i = 0; i < 30; i++) await tap('.continue-btn')
  ok(await alive(), 'the app survived thirty taps on Continue')
  atKick = await page.locator('text=Kick Off ▸').count() > 0
  note(`reached kick-off: ${atKick}`)
  })

  // ---- 4. into a match, then reload it out from under itself --------------
  await step('mid-match reload', async () => {
  if (atKick) {
    await tap('text=Kick Off ▸')
    await page.locator('.talk-modal').waitFor({ timeout: 6000 }).catch(() => {})
    await tap('.talk-modal .speech-tile >> nth=0')
    await tap('text=▸ Take the Field')
    await page.waitForSelector('.scoreboard', { timeout: 20000 }).catch(() => {})
    // let a few minutes run, then reload
    await tap('.speed-controls .btn >> nth=0')
    await page.waitForTimeout(2500)
    const before = await page.evaluate(() => document.querySelector('.scoreboard')?.textContent ?? '')
    note(`scoreboard before reload: ${before.replace(/\s+/g, ' ').slice(0, 60)}`)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)
    const after = await page.evaluate(() => ({
      alive: !!document.querySelector('.app'),
      onMatch: !!document.querySelector('.scoreboard'),
      onTitle: (document.body.textContent ?? '').includes('New Career'),
      hasContinue: !!document.querySelector('.continue-btn'),
      text: (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 120),
    }))
    note(`after reload: match ${after.onMatch}, title ${after.onTitle}, continue ${after.hasContinue}`)
    ok(after.alive, 'the app came back after a mid-match reload')
    // whatever it lands on, there must be a way onward: a match, a Continue
    // button, or the title screen with a career to resume
    ok(after.onMatch || after.hasContinue || after.onTitle,
      'after a mid-match reload there is a way back into the game')
  } else {
    note('never reached kick-off, so the reload attack was skipped')
  }
  })

  // ---- 5. saves --------------------------------------------------------
  await step('saves', async () => {
  await tap('.bottom-nav button[title="Manager"]')
  await tap('.submenu-item >> text=Save / Load Game')
  await page.waitForTimeout(900)
  const slots = await page.locator('.card button, .btn').count()
  note(`save screen offers ${slots} buttons`)
  // save, then immediately save again over the top, then load it twice
  for (const label of ['Save', 'Overwrite', 'Load']) {
    const b = page.locator('.btn', { hasText: label })
    if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(700) }
  }
  ok(await alive(), 'the app survived saving and loading on top of itself')
  })

  // ---- 6 and 7. money and contracts, with hostile numbers ----------------
  await step('money', async () => {
  await tap('.bottom-nav button[title="Hub"]')
  await tap('.submenu-item >> text=Transfer Centre')
  await page.waitForTimeout(900)
  // The Transfers screen's own tab is deals and expiring contracts, not a market
  // of buyable men: the first .dtable row there led nowhere, which is why the
  // first version of this attack fed nonsense to nothing. The market is behind
  // the Search tab, and a row-item is what opens a player.
  for (const t of ['Search', 'Market', 'Shortlist']) {
    const tab = page.locator('.tab-bar button', { hasText: t })
    if (await tab.count()) { await tab.first().click().catch(() => {}); await page.waitForTimeout(700); break }
  }
  const row = page.locator('.row-item, .dtable tbody tr').first()
  if (await row.count()) {
    await row.click().catch(() => {})
    await page.waitForTimeout(900)
    // A NUMBER BOX HAS TO BE OPEN BEFORE IT CAN BE ABUSED. The first run of this
    // attack reported "fed nonsense to 0 number boxes" and passed, which is a
    // harness congratulating itself for doing nothing: on a rival's player page
    // the fee and wage boxes only exist once a bid is under way, and on your own
    // man only once contract talks are open. So open them first.
    for (const label of ['Offer asking price', 'Open Contract Talks', 'Make an Offer', 'Bid']) {
      const b = page.locator('.btn', { hasText: label })
      if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(600) }
    }
    // every number box on the page gets nonsense
    const boxes = await page.locator('input.inline-input').count()
    for (let i = 0; i < boxes; i++) {
      const b = page.locator('input.inline-input').nth(i)
      for (const v of ['', '0', '-500', '999999999999', 'abc', '1e9', '  12  ']) {
        await b.fill(v).catch(() => {})
        await page.waitForTimeout(60)
      }
    }
    note(`fed nonsense to ${boxes} number boxes`)
    // then press every button on the page twice
    const btns = await page.locator('.btn').count()
    for (let i = 0; i < Math.min(btns, 12); i++) {
      await page.locator('.btn').nth(i).click({ timeout: 1200, force: true }).catch(() => {})
      await page.waitForTimeout(120)
    }
    hostileBoxes += boxes
    ok(await alive(), 'the app survived nonsense numbers and every button on a player page')
  } else {
    note('no transfer rows to attack')
  }

  // and the same treatment on one of your OWN men, where the wage box lives
  await tap('.bottom-nav button[title="Hub"]')
  await tap('.submenu-item >> text=Squad')
  await page.waitForTimeout(700)
  const mine = page.locator('.dtable tbody tr').first()
  if (await mine.count()) {
    await mine.click().catch(() => {})
    await page.waitForTimeout(600)
    const talks = page.locator('.btn', { hasText: 'Open Contract Talks' })
    if (await talks.count()) {
      await talks.first().click().catch(() => {})
      await page.waitForTimeout(500)
      const wage = page.locator('input.inline-input').first()
      let offered = 0
      for (const v of ['0', '', '-1', '999999999', 'abc', '1e12']) {
        if (!(await wage.count())) break
        await wage.fill(v).catch(() => {})
        const offer = page.locator('.btn.gold', { hasText: 'Offer' })
        if (await offer.count()) { await offer.first().click({ timeout: 1500 }).catch(() => {}); offered++ }
        await page.waitForTimeout(350)
        // if the talks concluded, reopen them for the next hostile number
        const reopen = page.locator('.btn', { hasText: 'Keep talking' })
        if (await reopen.count()) await reopen.first().click().catch(() => {})
      }
      hostileBoxes += offered
      note(`offered ${offered} nonsense wages in contract talks`)
      ok(offered > 0, 'contract talks accepted at least one hostile offer without dying')
    } else {
      note('no contract talks button on the first squad man')
    }
  }
  ok(await alive(), 'the app survived hostile wage offers')
  })

  // ---- 8. every screen, twice, both orientations -------------------------
  await step('navigation', async () => {
  const MENUS = [
    ['Hub', ['Selection & Tactics', 'Team', 'Team Report', 'Training & Staff', 'Medical Centre',
      'Fixtures & Results', 'Finances', 'Transfer Centre', 'Academy',
      'Club Infrastructure', 'Club Information']],
    ['Manager', ['Manager Profile', 'Press Room', 'Job Centre', 'Manager Legacy',
      "The Manager's Handbook", 'Save / Load Game']],
  ]
  for (const size of [{ width: 412, height: 732 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size)
    for (const [menu, items] of MENUS) {
      for (const item of items) {
        await tap(`.bottom-nav button[title="${menu}"]`)
        await tap(`.submenu-item >> text=${item}`)
        await page.waitForTimeout(260)
        if (!(await alive())) { ok(false, `${item} at ${size.width}x${size.height} broke the app`); break }
        // and every tab on whatever screen this is
        const tabs = await page.locator('.tab-bar button').count()
        for (let i = 0; i < Math.min(tabs, 8); i++) {
          await page.locator('.tab-bar button').nth(i).click({ timeout: 1200 }).catch(() => {})
          await page.waitForTimeout(140)
        }
      }
    }
    ok(await alive(), `every screen survived at ${size.width}x${size.height}`)
  }
  })

  // ---- and finally: is the save still loadable? --------------------------
  await step('final reload', async () => {
  await page.setViewportSize({ width: 412, height: 732 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  const final = await page.evaluate(() => ({
    alive: !!document.querySelector('.app'),
    text: (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 100),
  }))
  ok(final.alive, 'the game still loads after everything above')
  // A HARNESS THAT REACHED NO INPUT BOX TESTED NO INPUT BOX. The first run of
  // the money attack reported "fed nonsense to 0 number boxes" and passed itself.
  ok(hostileBoxes > 0, `hostile values reached a real input box (${hostileBoxes})`)
  note(`final screen: ${final.text}`)
  })
} catch (e) {
  ok(false, `the harness itself threw during "${phase}": ${String(e).slice(0, 200)}`)
} finally {
  await browser.close()
  server.stop()
}

console.log(`\n---- what it did ----`)
for (const n of notes) console.log(`  ${n}`)

console.log(`\n---- errors the page raised (${errors.length}) ----`)
const seen = new Map()
for (const e of errors) {
  const k = `${e.kind}:${e.text}`
  seen.set(k, (seen.get(k) ?? 0) + 1)
}
for (const [k, n] of seen) console.log(`  x${n} ${k}`)
if (errors.length) {
  console.log('\nfirst occurrence of each, with the attack that caused it:')
  const done = new Set()
  for (const e of errors) {
    const k = `${e.kind}:${e.text}`
    if (done.has(k)) continue
    done.add(k)
    console.log(`  [${e.phase}] ${e.kind}: ${e.text}`)
  }
}

// An uncaught exception is a bug whether or not the screen recovered.
if (errors.some(e => e.kind === 'uncaught' || e.kind === 'crash')) {
  fails += errors.filter(e => e.kind === 'uncaught' || e.kind === 'crash').length
  console.error('\nUNCAUGHT EXCEPTIONS ARE FAILURES')
}

if (fails) { console.error(`\nBREAKER: ${fails} failures`); process.exit(1) }
console.log('\nBREAKER PASSED: it would not break')
done(0)
