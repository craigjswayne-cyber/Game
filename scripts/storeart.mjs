// Store artwork: every image a submission asks for, from the real build.
//
// Screenshots are the listing. They are the only part of it most people read,
// they have to be at exact sizes per store, and they have to exist in every
// language you claim to support - which is the bit that gets skipped, because
// taking them by hand once is tedious and taking them twice is worse.
//
// So: the same walk, driven by STRUCTURE rather than by words (.club-pick,
// .bottom-nav, .tab-bar), run in each language at each store's pixel size.
// Nothing here reads a label, so nothing here breaks when a label is
// translated - which is exactly how a screenshot script rots.
//
//   node scripts/storeart.mjs          both stores, both languages
//   node scripts/storeart.mjs play     just Play
//
// Writes into storeart/, which is gitignored: these are build output, not
// source, and a 1290x2796 PNG per screen per language per store is not
// something to keep in a repository.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'

const only = process.argv[2]
const say = (s) => console.log(s)

/** Store sizes, as the consoles demand them. */
// Play refuses a shot whose long side is more than twice its short side, so
// the old 1080x2340 (2.17:1) phone set could not be uploaded. Play's phone
// shots are 9:16 now. Tablets run with touch on, because tablet mode needs a
// touch screen at least 700px wide (src/ui/tablet.ts): the 7-inch set is a
// real 600dp tablet and so shows the phone layout, the 10-inch set and the
// iPad set show tablet mode.
const TARGETS = [
  { store: 'play', dir: 'play', w: 540, h: 960, dsf: 2 },                       // 1080x1920
  { store: 'play', dir: 'play-tablet7', w: 600, h: 960, dsf: 2, touch: true },   // 1200x1920
  { store: 'play', dir: 'play-tablet10', w: 800, h: 1280, dsf: 2, touch: true }, // 1600x2560
  // Apple's 6.9-inch slot takes 1290x2796 and is the one that cannot be skipped
  { store: 'ios', dir: 'ios', w: 430, h: 932, dsf: 3 },
  // and a build that runs on iPad needs the 13-inch slot: 2048x2732
  { store: 'ios', dir: 'ios-ipad13', w: 1024, h: 1366, dsf: 2, touch: true },
].filter(t => !only || t.store === only || t.dir === only)

const LANGS = ['en', 'fr']

const server = await startPreview('4210', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0

/** One career, five screens, no words read. */
async function walk(page, dir) {
  const shot = (n) => page.screenshot({ path: `${dir}/${n}.png` })

  await page.goto('http://localhost:4210/')
  await page.waitForSelector('.title-screen', { timeout: 20000 })
  await page.waitForTimeout(400)
  await shot('1-title')

  // the wizard, by structure: competition, club, confirm, name, confirm, start
  await page.locator('.menu-btns .btn').first().click()
  await page.waitForSelector('.club-pick')
  await page.locator('.club-pick').first().click()
  await page.waitForSelector('.club-tile')
  await page.locator('.club-tile').nth(4).click()
  await page.waitForSelector('.action-bar .btn.gold')
  await page.locator('.action-bar .btn.gold').click()
  await page.waitForSelector('input.inline-input')
  await page.fill('input.inline-input', 'A. Gaffer')
  await page.locator('.action-bar .btn.gold').click()
  await page.waitForTimeout(300)
  await page.locator('.action-bar .btn.gold').click()
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.locator('.tut-close .btn').click()
  await page.waitForSelector('.bottom-nav')
  await page.waitForTimeout(400)
  await shot('2-home')

  // Team, off the Hub menu. It opens on the team sheet, so the squad TABLE is
  // the second tab - taking them in this order stops the two shots being the
  // same picture, which is what happened when both read "the first tab".
  await page.locator('.bottom-nav button[data-group]').first().click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(500)
  await page.locator('.submenu-item').first().click()
  await page.waitForSelector('.dtable')
  await page.waitForTimeout(400)
  await shot('3-teamsheet')
  // General Info, second since Depth moved to the Team Report (round 4)
  await page.locator('.tab-bar button').nth(1).click()
  await page.waitForTimeout(500)
  await shot('4-squad')

  // and match day: Continue until the tunnel, then kick off and watch a while
  for (let i = 0; i < 40 && !(await page.locator('.mday-head').count()); i++) {
    if (await page.locator('.wire-body').count()) await page.locator('.btn-row .btn.gold').last().click().catch(() => {})
    else if (await page.locator('.continue-btn').count()) await page.locator('.continue-btn').click().catch(() => {})
    else break
    await page.waitForTimeout(250)
  }
  if (await page.locator('.mday-head').count()) {
    await page.waitForTimeout(400)
    await shot('5-preview')
    await page.locator('.continue-btn').click()
    await page.waitForTimeout(600)
    // the dressing room, then whatever the ready check says
    if (await page.locator('.talk-modal').count()) {
      await page.locator('.talk-modal .speech-tile').first().click()
      await page.waitForTimeout(700)
    }
    if (await page.locator('.modal .btn.gold').count() && !(await page.locator('.live-wrap').count())) {
      await page.locator('.modal .btn.gold').click()
      await page.waitForTimeout(700)
    }
    await page.waitForSelector('.live-wrap', { timeout: 15000 })
    // put the team-talk reactions away, as a player does: on a phone the card
    // sits over the commentary, which is the thing the shot is selling
    await page.locator('.talk-react .tr-head .btn').first().click({ timeout: 3000 }).catch(() => {})
    // a match worth showing: the half-hour or the first points, whichever
    // comes first (a 7th-minute 0-0 with empty stats was the old shot),
    // and never more than thirty seconds of waiting
    for (let i = 0; i < 60; i++) {
      const board = (await page.locator('.scoreboard').textContent().catch(() => '')) ?? ''
      const min = Number(board.match(/(\d+)['’]/)?.[1] ?? 0)
      const scored = /[1-9]\d*\s*[-–]\s*\d+|\d+\s*[-–]\s*[1-9]/.test(board)
      if (min >= 30 || (scored && min >= 12)) break
      await page.waitForTimeout(500)
    }
    await page.waitForTimeout(600)
    await shot('6-match')
    // to full time, for the verdict
    for (let i = 0; i < 30 && !(await page.locator('.ft-stamp').count()); i++) {
      const skip = page.locator('.speed-controls .btn').nth(1)
      if (await skip.count()) await skip.click().catch(() => {})
      else if (await page.locator('.panel-area .btn.gold').count()) {
        await page.locator('.panel-area .btn.gold').first().click().catch(() => {})
      }
      await page.waitForTimeout(700)
    }
    if (await page.locator('.ft-stamp').count()) {
      // the VICTORY stamp is a 2.8s animation across the whole screen: shoot
      // through it and the verdict underneath is unreadable, which is the one
      // screen where the words are the selling point
      await page.waitForTimeout(3200)
      await shot('7-fulltime')
    } else {
      say('  note: no full-time screen captured this run')
    }
  } else {
    say('  note: match day was not reached this run')
    fails++
  }
}

try {
  for (const target of TARGETS) {
    for (const lang of LANGS) {
      const dir = `storeart/${target.dir}/${lang}`
      mkdirSync(dir, { recursive: true })
      const page = await browser.newPage({
        viewport: { width: target.w, height: target.h },
        deviceScaleFactor: target.dsf,
        locale: lang === 'fr' ? 'fr-FR' : 'en-GB',
        hasTouch: !!target.touch, isMobile: !!target.touch,
      })
      page.setDefaultTimeout(12000)
      await page.addInitScript(([l]) => {
        localStorage.setItem('rm-night', '1')
        localStorage.setItem('rm-lang', l)
      }, [lang])
      say(`${target.dir}/${lang}: ${target.w * target.dsf}x${target.h * target.dsf}`)
      await walk(page, dir)
      await page.close()
    }
  }

  // ---- the feature graphic: 1024x500, exactly, or Play refuses it ----------
  {
    mkdirSync('storeart/play', { recursive: true })
    const svg = readFileSync('public/icon.svg', 'utf8')
    const page = await browser.newPage({ viewport: { width: 1024, height: 500 } })
    await page.setContent(`<body style="margin:0">
      <div style="width:1024px;height:500px;background:
        radial-gradient(120% 140% at 20% 0%, #232a26 0%, #1a201e 60%, #141917 100%);
        display:flex;align-items:center;gap:44px;padding:0 72px;box-sizing:border-box;
        font-family:Georgia,'Times New Roman',serif;color:#e8e6e1">
        <div style="width:190px;height:190px;flex:0 0 190px">${svg.replace('<svg ', '<svg width="190" height="190" ')}</div>
        <div>
          <div style="font-family:Arial Narrow,Helvetica,sans-serif;letter-spacing:6px;
                      font-size:22px;color:#c8a24a;text-transform:uppercase">Rugby Manager</div>
          <div style="font-size:74px;font-weight:700;letter-spacing:2px;line-height:1.05;margin-top:6px">PHASE</div>
          <div style="font-size:22px;color:#9aa39c;margin-top:14px;max-width:520px;line-height:1.4">
            Your club. Your legacy. Your time.<br/>Build something worth remembering.
          </div>
        </div>
      </div></body>`)
    await page.waitForTimeout(300)
    writeFileSync('storeart/play/feature-graphic.png', await page.screenshot())
    await page.close()
    say('play/feature-graphic.png: 1024x500')
  }

  // ---- the App Store icon: 1024x1024, and no alpha channel ----------------
  //
  // Apple rejects a transparent icon. The PWA icon is drawn on nothing, so this
  // one is drawn on the night ground the splash screen uses.
  {
    mkdirSync('storeart/ios', { recursive: true })
    const svg = readFileSync('public/icon.svg', 'utf8')
    const tokens = readFileSync('src/ui/tokens.css', 'utf8')
    const canvas = tokens.match(/--canvas:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? '#1a201e'
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
    await page.setContent(`<body style="margin:0;background:${canvas}">
      <div style="width:1024px;height:1024px;background:${canvas};display:flex;align-items:center;justify-content:center">
        <div style="width:820px;height:820px">${svg.replace('<svg ', '<svg width="820" height="820" ')}</div>
      </div></body>`)
    await page.waitForTimeout(200)
    writeFileSync('storeart/ios/icon-1024.png', await page.screenshot({ omitBackground: false }))
    await page.close()
    say('ios/icon-1024.png: 1024x1024, opaque')
  }
} catch (e) {
  say('STORE ART THREW: ' + (e?.message ?? e))
  fails++
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nSTORE ART INCOMPLETE (${fails})` : '\nSTORE ART WRITTEN: storeart/ has every image both consoles ask for')
done(fails)
