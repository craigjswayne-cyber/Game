// Probe: no screen in the game ever shows a dictionary key to a human.
//
// The owner scrolled to Without the Ball on the Tactics screen and found
// "tactics.sliderDefLineLo" where a label should be (25 Aug, live). The cause
// was ordinary: DEF_SLIDER_INFO's strings became KEYS during the translation
// sweep, and one of the two render sites was never wrapped in t(). Its sibling
// three lines above was correct, which is exactly why nobody saw it.
//
// Two probes already existed and neither could catch it:
//   i18nprobe reads the CODE and the dictionary. Both were perfectly fine -
//     the key existed, the table was right. Nothing to report.
//   keyprobe walks the JSX for KEY-RETURNING CALLS (.textKey(, posNounKey()
//     used without t(). This was a plain property read, info.lo, so it was
//     invisible to a check written around function calls.
//
// The lesson is that the mechanism is unguessable and the SYMPTOM is not: a
// key reached a person's eyes. So this probe does not read code at all. It
// opens the game, walks every screen and every tab in both languages, and
// asks one question of the rendered text: is any of this a key?
//
// Two ways to answer yes, and the first is unarguable:
//   the text IS a key that exists in en.json (tactics.sliderDefLineLo)
//   the text LOOKS like one - namespace.someIdentifier, no spaces - and its
//     namespace is a real one, which catches a key that was mistyped as well
//     as one that was merely unwrapped.
//
// Run: node scripts/keyscreen.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
const keys = []
const walk = (o, pre) => {
  for (const [k, v] of Object.entries(o)) {
    if (k === '//') continue
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, pre + k + '.')
    else keys.push(pre + k)
  }
}
walk(en, '')
const KEYS = new Set(keys)
const NAMESPACES = Object.keys(en).filter(k => k !== '_meta')

// Every screen the rail and the menu can reach. The bug hid on a screen that
// WAS in every layout sweep - those measure boxes, not words - and below a
// fold, so each screen is also asked for its tab bar and every tab is opened.
const SCREENS = [
  'home', 'inbox', 'squad', 'tactics', 'selection', 'fixtures', 'tables',
  'transfers', 'training', 'finances', 'club', 'press', 'nations', 'history',
  'legacy', 'medical', 'report', 'profile', 'saves', 'agency', 'wire', 'infra',
  'academy', 'jobs', 'handbook', 'about', 'dreamteam', 'offers',
]

const server = await startPreview(4231, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** Every run of visible text on the page, as its own trimmed string. */
const texts = page => page.evaluate(() => {
  const out = []
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const s = (n.textContent ?? '').trim()
    if (!s) continue
    const el = n.parentElement
    if (!el || el.closest('script, style')) continue
    out.push(s)
  }
  return [...new Set(out)]
})

try {
  for (const lang of ['en', 'fr']) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
    page.setDefaultTimeout(8000)
    await page.addInitScript(l => {
      localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', l)
    }, lang)
    await page.goto('http://localhost:4231/')
    await page.waitForSelector('text=RUGBY', { timeout: 20000 })
    await page.evaluate(() => window.rugbyStore.getState().start('northampton', 'Key Screen'))
    await page.waitForTimeout(700)
    await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})

    const caught = []
    let seenScreens = 0, seenTabs = 0, strings = 0
    for (const screen of SCREENS) {
      const went = await page.evaluate(s => {
        try { window.rugbyStore.getState().go(s); return true } catch { return false }
      }, screen)
      if (!went) continue
      await page.waitForTimeout(220)
      seenScreens++
      // open every tab this screen offers, so nothing below a fold or behind
      // a tab escapes the sweep
      const tabs = await page.locator('.tab-bar button').count().catch(() => 0)
      for (let i = 0; i < Math.max(1, tabs); i++) {
        if (tabs) {
          await page.locator('.tab-bar button').nth(i).click({ timeout: 2500 }).catch(() => {})
          await page.waitForTimeout(200)
          seenTabs++
        }
        for (const s of await texts(page)) {
          strings++
          const isKey = KEYS.has(s)
          const looksKey = /^[a-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(s)
            && NAMESPACES.includes(s.split('.')[0])
          if (isKey || looksKey) {
            caught.push(`${screen}${tabs ? ` tab ${i}` : ''}: "${s}"${isKey ? '' : ' (looks like a key, not in the dictionary)'}`)
          }
        }
      }
    }
    say(`  ${lang}: ${seenScreens} screens, ${seenTabs} tabs, ${strings} strings read`)
    ok(caught.length === 0, `${lang}: no screen shows a dictionary key`
      + (caught.length ? `\n        ${[...new Set(caught)].slice(0, 10).join('\n        ')}` : ''))
    await page.close()
  }
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nKEY SCREEN FAILED (${fails})` : '\nKEY SCREEN PASSED: every label on every screen is words, not keys')
done(fails)
