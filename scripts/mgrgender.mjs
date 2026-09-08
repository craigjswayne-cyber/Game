/**
 * HE OR SHE, AND WHERE IT IS ASKED.
 *
 * The pronoun the press use for the manager was asked once, at the end of the
 * new-career wizard, and could never be changed afterwards. From v1.5.3 it is
 * a Settings row (owner: "move he/she section to the settings"), which is a
 * bigger change than it looks: the answer is kept in the SAVE rather than on
 * the device, every line about the manager is a key with a `_w` sibling
 * (i18n.ts), and nothing on screen re-renders unless the store is told.
 *
 * So this walks the road a player walks. Start a career, find the row, tap
 * She, and check the three things that have to be true at once: the game
 * object carries it, i18n is answering with the `_w` sibling, and the device
 * remembers the answer for the next career. Then reload, because a setting
 * that does not survive the app being closed is not a setting.
 */
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'

const PORT = '4231'
let fails = 0
const say = (s) => console.log(s)
const ok = (cond, what) => { say(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 } })
page.setDefaultTimeout(6000)
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const openSettings = async () => {
  await page.locator('.bottom-nav button', { hasText: '▸' }).nth(1).click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(300)
  await page.locator('.submenu-item', { hasText: 'Settings' }).click()
  await page.waitForSelector('.mgr-gender-btn')
}
/** What the save says, what i18n answers, what the device remembers. */
const state = () => page.evaluate(() => ({
  saved: window.rugbyStore.getState().game?.mgrGender ?? null,
  device: localStorage.getItem('rm-mgr-gender'),
}))

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('#root >> text=RUGBY')

  // ---- 1. the wizard does not ask any more ----
  say('\n--- 1. the wizard has one less question')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  ok(await page.locator('text=The Press Call You').count() === 0,
    'the new-career wizard no longer asks how the press should refer to you')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // ---- 2. Settings asks it, and the career opens on the device's answer ----
  say('\n--- 2. Settings asks it instead')
  await openSettings()
  ok(await page.locator('.mgr-gender-btn').count() === 2, 'two answers on the Settings page')
  const before = await state()
  ok(before.saved === 'm', `a career opened on a device that has never been asked is a man (${before.saved})`)
  const lit = () => page.evaluate(() =>
    [...document.querySelectorAll('.mgr-gender-btn')].map(b => b.getAttribute('aria-checked')))
  ok(JSON.stringify(await lit()) === '["true","false"]', 'and the row shows which answer is on')

  // ---- 3. tapping She changes the save, the copy and the device ----
  say('\n--- 3. the answer lands in all three places')
  await page.locator('.mgr-gender-btn').nth(1).click()
  await page.waitForTimeout(300)
  ok(JSON.stringify(await lit()) === '["false","true"]', 'the row moves to She')
  const after = await state()
  ok(after.saved === 'w', `the save carries it (${after.saved})`)
  ok(after.device === 'w', `and the device remembers it for the next career (${after.device})`)

  // ---- 3b. and the copy on screen changes with it ----
  //
  // The point of the whole thing. A terraces story is staged through the store
  // handle rather than waited for, because which of the nine fan voices a
  // career draws is seeded and two of them have nothing gendered to say:
  // "New man, new voice, same old fixture list" is the one that does, and it
  // has to become "New woman" on the screen, not just in the dictionary.
  say('\n--- 3b. the press change their words')
  // Staged fresh before each read, with everything else marked read, so the
  // inbox's one-at-a-time reader always opens on this story rather than on
  // whichever one the last visit left it pointing at.
  const stage = (id) => page.evaluate((newsId) => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const uc = g.clubs[g.userClubId]
    for (const n of g.news) n.read = true
    g.news.push({
      id: newsId, week: g.week, season: g.season, type: 'general', read: false,
      subject: 'staged', body: 'staged',
      k: 'news.terraces',
      v: {
        head_k: 'news.fanHeadMid', open_k: 'news.fanOpenMid',
        one_k: 'news.fanPatient1', two_k: 'news.fanPatient1',
        city: uc.city, short: uc.short, mood_k: 'news.moodBehind',
      },
    })
    st.touch()
  }, id)
  const inbox = async () => {
    // the nav labels are hidden on a phone, so the button is found by its title
    await page.click('.bottom-nav button[title="News"]')
    await page.waitForTimeout(600)
    const seen = await page.evaluate(() => ({
      text: (document.querySelector('.content')?.innerText ?? '').replace(/\s+/g, ' '),
    }))
    return seen.text
  }
  await stage(999001)
  const asHer = await inbox()
  ok(/New woman/.test(asHer), 'the terraces call her the new woman while She is on')
  await openSettings()
  await page.locator('.mgr-gender-btn').nth(0).click()
  await page.waitForTimeout(300)
  await stage(999002)
  const asHim = await inbox()
  ok(/New man/.test(asHim) && !/New woman/.test(asHim),
    'and the new man the moment it goes back to He')
  await openSettings()
  await page.locator('.mgr-gender-btn').nth(1).click()
  await page.waitForTimeout(200)

  // ---- 4. it survives the app being closed ----
  say('\n--- 4. and it survives a reload')
  await page.reload()
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })
  const reloaded = await state()
  ok(reloaded.saved === 'w', `the resumed career is still hers (${reloaded.saved})`)
  ok(reloaded.device === 'w', 'and the device still remembers')
} catch (err) {
  say(`  FAIL  PROBE THREW: ${err.message.split('\n')[0]}`)
  fails++
}

await browser.close()
server.stop()
say(fails === 0
  ? '\nMANAGER GENDER PROBE PASSED: the pronoun is a setting, and it sticks'
  : `\nMANAGER GENDER PROBE FAILED (${fails})`)
done(fails)
