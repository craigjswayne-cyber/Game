// Probe: the save queue writes less often and never loses the last word.
//
// Reported by a closed-testing tester on 13 Sep 2026: "a noticeable 1-2 second
// delay after tapping buttons or interactive elements throughout the app."
//
// Measured before anything was changed. A career save is 5.02 MB at season 1
// week 1 and 7.37 MB after five seasons, and IndexedDB's put() structured-
// clones it on the main thread before returning: 74 ms at week one, 126 ms
// after five seasons, in a DESKTOP container. Twenty-six call sites paid that
// on every tap.
//
// So persist() now marks the save dirty and one writer flushes on an idle
// timer. That is a straight trade of latency for exposure, and the exposure is
// the thing to test. Speed is easy to prove and does not matter if a career
// comes back missing the last thing the manager did, so the assertions below
// are weighted the other way round: one on coalescing, the rest on the save
// still being right.
//
// THE FAILURE THIS EXISTS TO CATCH is a debounce that drops the trailing call.
// It is the classic way to write this wrong, it looks perfect in use, and it
// loses the last action before every reload - which is exactly the action a
// player remembers taking.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4191
const server = await startPreview(PORT, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 732 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

const stats = () => page.evaluate(() => ({ ...window.rugbySaveStats }))
const shortlist = () => page.evaluate(() => [...(window.rugbyStore.getState().game?.shortlist ?? [])])

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Queue Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(1500)

  // ---- a burst of mutations costs one write --------------------------------
  const before = await stats()
  const ids = await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    return (s.game?.clubs[s.game.userClubId]?.players ?? []).slice(0, 10)
  })
  ok(ids.length === 10, `ten players to star (${ids.length})`)

  await page.evaluate(list => {
    const s = window.rugbyStore.getState()
    for (const id of list) s.toggleShortlist(id)
  }, ids)
  const mid = await stats()
  ok(mid.marks - before.marks >= 10, `ten taps marked the save ten times (${mid.marks - before.marks})`)
  ok(mid.writes - before.writes === 0, `and not one of them wrote while the thumb was moving (${mid.writes - before.writes})`)

  await page.waitForTimeout(1800)
  const after = await stats()
  const wrote = after.writes - before.writes
  ok(wrote >= 1 && wrote <= 2, `the burst settles into ${wrote} write, not ten`)
  ok(after.failures === 0, `and nothing failed on the way (${after.failures})`)

  // ---- the trailing write is not dropped -----------------------------------
  //
  // The whole point. Ten stars went on, the queue coalesced them, and a reload
  // has to come back to ten.
  const want = await shortlist()
  ok(want.length === 10, `ten players are starred before the reload (${want.length})`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  const got = await shortlist()
  ok(got.length === want.length && got.every((id, i) => id === want[i]),
     `THE LAST ACTION SURVIVED THE RELOAD (${got.length} of ${want.length} starred)`)

  // ---- one more mutation, and out through the door the phone uses ----------
  //
  // pagehide is what a home button, a task switch and a locked screen all
  // produce, and it is the realistic way a save is interrupted - far more so
  // than a crash. The queue has to empty on the way out rather than after it.
  const one = await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    const id = (s.game?.clubs[s.game.userClubId]?.players ?? [])[20]
    s.toggleShortlist(id)
    return id
  })
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.waitForTimeout(1200)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  const afterHide = await shortlist()
  ok(afterHide.includes(one), 'a mutation flushed by pagehide is on the disk before the app goes')

  // ---- press answers reach the disk at all now (audit P1-01) ---------------
  //
  // answerPressOption mutated morale, board standing and promises and never
  // persisted. It was not an oversight so much as a cost: a 5 MB write on every
  // press answer was real, and so was losing the answer. A mark is neither.
  // ---- press answers reach the disk at all now (audit P1-01) ---------------
  //
  // answerPressOption mutated morale, board standing, promises and player
  // relationships and never persisted, so a reload before the next autosave
  // lost the manager's answer and the press room asked again. It was not an
  // oversight so much as a cost: a 5 MB write on every press answer was real,
  // and so was losing the answer. A mark is neither.
  //
  // THE QUESTION IS STAGED, deliberately. Walking to a real one means playing
  // out week 1 - the natural walk reaches the match screen and stops there
  // until the match is played, which is why a loop on the continue button sat
  // on week 1 for fourteen taps and found nothing. Staging a state a natural
  // walk cannot reach is exactly what the rugbyStore handle is documented for,
  // and what is under test is the persistence of the answer rather than the
  // press room's own generator, which pressprobe already covers.
  const pressed = await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    const g = s.game
    if (!g) return null
    const id = g.nextId++
    g.press.push({
      id, week: g.week, season: g.season, outlet: 'Probe Gazette',
      question: 'Does an answer survive a reload?',
      options: [{ label: 'It had better', morale: 1, board: 1, reaction: 'Noted.' }],
      answered: false,
    })
    s.answerPressOption(id, 0)
    return id
  })

  ok(pressed != null, 'a press question was answered')
  const answeredBefore = await page.evaluate(id => {
    const q = (window.rugbyStore.getState().game?.press ?? []).find(p => p.id === id)
    return q ? q.answered : null
  }, pressed)
  ok(answeredBefore === true, 'and the answer is recorded in memory')

  await page.waitForTimeout(1600)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  const answeredAfter = await page.evaluate(id => {
    const q = (window.rugbyStore.getState().game?.press ?? []).find(p => p.id === id)
    return q ? q.answered : 'the question is gone'
  }, pressed)
  ok(answeredAfter === true,
     `AND SURVIVES A RELOAD instead of being asked again (${answeredAfter})`)

} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close()
  server.stop()
}

if (errors.length) {
  console.error(`\nuncaught page errors (${errors.length}):`)
  for (const e of [...new Set(errors)]) console.error('  ' + e)
  fails += errors.length
}

if (fails) { console.error(`\nSAVE QUEUE: ${fails} failures`); process.exit(1) }
console.log('\nSAVE QUEUE PASSED: one write for a burst, and the last word always reaches the disk')
done(0)
