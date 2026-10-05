// Probe: a Ruck story wears its byline in the news reader (owner, 1.8.7: Ruck
// is the named source for the news about the rest of the league, in the
// game's own type; "RUCK.CO.UK" since 1.8.9, the owner's company name). On a
// 393px phone the reader's date line reads "RUCK.CO.UK · <date>", the headline
// is the story's own, Ruck's wordmark sits at the foot of the story (white on
// the night theme, black on the day one, about 20px tall, and nothing at all
// if the file will not load), a story about the manager's club carries
// neither, and nothing scrolls sideways.
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
  // 'RUCK' until 1.8.9; the owner changed it to the company name
  ok(r.by === 'RUCK.CO.UK', `its date line carries the byline (${JSON.stringify(r.when)})`)
  ok(/^\S*\s*RUCK\.CO\.UK · /.test(r.when.trim()), 'as "RUCK.CO.UK · <date>"')
  ok(r.byFont === 'uppercase', 'set in the game\'s own uppercase type')
  ok(r.scrollW <= r.vw, `no sideways scroll at ${r.vw}px (${r.scrollW})`)

  // THE WORDMARK (1.8.9). Read back through a canvas with the image's own
  // computed filter, so "white on night, black on day" is the pixels and not
  // just a class name.
  const mark = async () => {
    await page.waitForFunction(() => { const i = document.querySelector('.reader .ruck-mark'); return !i || i.complete }, null, { timeout: 5000 }).catch(() => {})
    return page.evaluate(() => {
      const img = document.querySelector('.reader .ruck-mark')
      if (!img) return null
      const body = [...document.querySelectorAll('.reader .news-body, .reader p')].at(-1)
      const r = img.getBoundingClientRect()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const x = c.getContext('2d'); x.filter = getComputedStyle(img).filter || 'none'; x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      let sum = 0, n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++ }
      return {
        alt: img.alt, nw: img.naturalWidth, h: r.height, w: r.width, right: r.right,
        below: !body || r.top >= body.getBoundingClientRect().bottom - 1,
        ink: n ? Math.round(sum / n) : -1, inked: n,
      }
    })
  }
  const night = await mark()
  ok(!!night && night.nw > 0, `the Ruck wordmark loads at the foot of the story (${JSON.stringify(night)})`)
  if (night) {
    ok(night.alt === 'ruck.co.uk', 'with alt text "ruck.co.uk"')
    ok(night.h >= 17 && night.h <= 21 && night.right <= r.vw, `small: ${Math.round(night.h)}px tall, ${Math.round(night.w)}px wide, inside the screen`)
    ok(night.below, 'under the story body')
    ok(night.inked > 50 && night.ink > 230, `white on the night theme (mean ink ${night.ink} over ${night.inked} px)`)
  }

  // one newer is the story in the neutral voice: no byline on it
  await page.click('.reader-bar > .btn >> nth=1')
  await page.waitForTimeout(400)
  const m = await read()
  ok(m.h2 === MINE, `one story newer is the neutral one ("${m.h2}")`)
  ok(m.by === null, 'and it carries no byline')
  ok(await page.evaluate(() => !document.querySelector('.reader .ruck-mark')), 'and no wordmark')

  // back to the Ruck story under the day theme: the wordmark turns black
  await page.click('.reader-bar > .btn >> nth=0')
  await page.waitForTimeout(400)
  await page.evaluate(() => { const a = document.querySelector('.app'); a.classList.remove('night'); a.classList.add('day') })
  await page.waitForTimeout(200)
  const day = await mark()
  ok(!!day && day.inked > 50 && day.ink < 25, `black on the day theme (mean ink ${day?.ink} over ${day?.inked} px)`)
  await page.evaluate(() => { const a = document.querySelector('.app'); a.classList.remove('day'); a.classList.add('night') })

  // a missing file draws nothing at all, never a broken image
  await page.route('**/ruck-logo.webp', route => route.abort())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bottom-nav', { timeout: 40000 })
  await page.click('.bottom-nav >> text=News')
  await page.waitForTimeout(800)
  for (let k = 0; k < 4 && (await page.evaluate(() => document.querySelector('.reader h2')?.textContent)) !== SUBJ; k++) {
    await page.click('.reader-bar > .btn >> nth=0'); await page.waitForTimeout(300)
  }
  await page.waitForTimeout(600)
  const gone = await page.evaluate(() => ({ h2: document.querySelector('.reader h2')?.textContent, img: !!document.querySelector('.reader .ruck-mark'), foot: !!document.querySelector('.reader .ruck-foot') }))
  ok(gone.h2 === SUBJ && !gone.img && !gone.foot, `with the file missing the Ruck story shows no image and no gap (${JSON.stringify(gone)})`)
  await page.unroute('**/ruck-logo.webp')
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
if (errors.length) { ok(false, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 200)}`) }
await browser.close()
await server.stop?.()
say(fails ? `RUCK UI PROBE FAILED (${fails})` : 'RUCK UI PROBE PASSED: the RUCK.CO.UK byline and wordmark in the reader, neither on the club\'s own news, no sideways scroll')
done(fails)
