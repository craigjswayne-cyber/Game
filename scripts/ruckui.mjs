// Probe: a Ruck story wears its byline in the news reader (owner, 1.8.7: Ruck
// is the named source for the news about the rest of the league, text only,
// "RUCK", in the game's own type). On a 393px phone the reader's date line
// reads "RUCK · <date>", the headline is the story's own, a story about the
// manager's club carries no byline, and nothing scrolls sideways.
//
// The seam is the save itself: a career is started, two stories are written
// into its IndexedDB record (one Ruck law story, then one in the neutral voice),
// every other story is marked read so the reader serves ours, and the page is
// reloaded, which lands on Home with that save loaded.
//
// Run: node scripts/ruckui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4297', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', e => errors.push(String(e.message ?? e)))

const SUBJ = "LAW WATCH: captain's challenge proposed for league matches"
const MINE = 'Ruck probe: a story in the neutral voice'

try {
  await page.goto('http://localhost:4297/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Ruck Test')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(1500)

  // two stories into the saved career, the Ruck one first: the reader serves
  // the oldest unread
  const wrote = await page.evaluate(({ SUBJ, MINE }) => new Promise((resolve) => {
    const req = indexedDB.open('rugby-manager', 1)
    req.onerror = () => resolve(0)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('saves', 'readwrite')
      const st = tx.objectStore('saves')
      let n = 0
      const keys = st.getAllKeys()
      keys.onsuccess = () => {
        for (const key of keys.result) {
          if (String(key).includes('::')) continue
          const get = st.get(key)
          get.onsuccess = () => {
            const rec = get.result
            const s = rec?.state
            if (!s?.news) return
            for (const x of s.news) x.read = true
            const base = { week: s.week, season: s.season, type: 'gossip', read: false }
            s.news.push({ ...base, id: s.nextId++, subject: SUBJ, body: 'x', k: 'news.lawTalk2', v: {}, src: 'ruck' })
            s.news.push({ ...base, id: s.nextId++, subject: MINE, body: 'Neutral voice.' })
            st.put(rec, key)
            n++
          }
        }
      }
      tx.oncomplete = () => { db.close(); resolve(n) }
    }
  }), { SUBJ, MINE })
  ok(wrote > 0, `the stories were written into the save (${wrote} slot(s))`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bottom-nav', { timeout: 40000 })
  await page.waitForTimeout(1500)
  await page.click('.bottom-nav >> text=News')
  await page.waitForTimeout(800)

  const read = async () => page.evaluate(() => ({
    h2: document.querySelector('.reader h2')?.textContent ?? '',
    when: document.querySelector('.reader .when')?.textContent ?? '',
    by: document.querySelector('.reader .when .byline')?.textContent ?? null,
    byFont: (() => { const b = document.querySelector('.reader .when .byline'); return b ? getComputedStyle(b).textTransform : '' })(),
    scrollW: document.documentElement.scrollWidth,
    vw: innerWidth,
  }))
  const r = await read()
  ok(r.h2 === SUBJ, `the reader opens the Ruck story ("${r.h2}")`)
  ok(r.by === 'RUCK', `its date line carries the byline (${JSON.stringify(r.when)})`)
  ok(/^\S*\s*RUCK · /.test(r.when.trim()), 'as "RUCK · <date>"')
  ok(r.byFont === 'uppercase', 'set in the game\'s own uppercase type')
  ok(r.scrollW <= r.vw, `no sideways scroll at ${r.vw}px (${r.scrollW})`)

  // one newer is the story in the neutral voice: no byline on it
  await page.click('.reader-bar > .btn >> nth=1')
  await page.waitForTimeout(400)
  const m = await read()
  ok(m.h2 === MINE, `one story newer is the neutral one ("${m.h2}")`)
  ok(m.by === null, 'and it carries no byline')
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
if (errors.length) { ok(false, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 200)}`) }
await browser.close()
await server.stop?.()
say(fails ? `RUCK UI PROBE FAILED (${fails})` : 'RUCK UI PROBE PASSED: the RUCK byline in the reader, none on the club\'s own news, no sideways scroll')
done(fails)
