// ---- A NEW CAREER NEVER LANDS ON AN OLD ONE (1.8.0) ----
//
// Found by reading the code for the technical manual: start() wrote a brand-new
// career to whichever slot was last loaded or saved, with no warning, so a
// manager who went back to the menu and started afresh lost the career they had
// been playing. The wizard now takes the active slot only if it is empty, then
// the first empty one, and when all four are full it asks which to replace.
//
// Two phones, walked the way a player walks them:
//   1. one career on the device, in the active slot: the new one goes next to
//      it, and the old one is untouched;
//   2. all four slots full: Start Career is held until a slot is chosen, and
//      only the chosen slot changes hands.
//
// Run: npm run build && node scripts/slotprobe.mjs
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4261
let fails = 0
const ok = (c, m) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${m}`); if (!c) fails++ }

const preview = await startPreview(PORT)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** Put saves on the device the way saveGame() does: {meta, state} keyed by slot. */
const seed = (page, slots) => page.evaluate(slots => new Promise((resolve, reject) => {
  const req = indexedDB.open('rugby-manager', 1)
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves') }
  req.onsuccess = () => {
    const db = req.result
    const tx = db.transaction('saves', 'readwrite')
    for (const s of slots) {
      tx.objectStore('saves').put({
        meta: { slot: s, club: `Old Club ${s}`, season: 2, week: 10, savedAt: Date.now(), managerName: `Old Manager ${s}` },
        state: { placeholder: true },
      }, s)
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  }
  req.onerror = () => reject(req.error)
}), slots)

/** Who is in each slot now, read straight off the device. */
const owners = page => page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('rugby-manager', 1)
  req.onsuccess = () => {
    const db = req.result
    const all = db.transaction('saves', 'readonly').objectStore('saves').getAll()
    all.onsuccess = () => {
      db.close()
      const out = {}
      for (const r of all.result ?? []) if (r?.meta?.slot) out[r.meta.slot] = r.meta.managerName
      resolve(out)
    }
    all.onerror = () => reject(all.error)
  }
  req.onerror = () => reject(req.error)
}))

const phoneWith = async slots => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 740 } })
  await ctx.addInitScript(() => localStorage.setItem('rm-night', '1'))
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=New Career', { timeout: 20000 })
  await seed(page, slots)
  await page.reload()
  await page.waitForSelector('text=New Career', { timeout: 20000 })
  return { ctx, page }
}

/** The wizard as e2e.mjs walks it, stopping on the last step. */
const toLastStep = async (page, name) => {
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', name)
  await page.click('.action-bar >> text=Confirm')
  await page.waitForSelector('text=Start Career')
  await page.waitForTimeout(400)
}

const startBtn = page => page.locator('.action-bar button.gold')
const waitForSave = async (page, name) => {
  for (let i = 0; i < 40; i++) {
    const o = await owners(page)
    if (Object.values(o).includes(name)) return o
    await page.waitForTimeout(250)
  }
  return owners(page)
}

try {
  console.log('\n--- 1. one career on the device: the new one goes beside it\n')
  {
    const { ctx, page } = await phoneWith(['slot1'])
    await toLastStep(page, 'New Neighbour')
    const line = await page.locator('text=/will be saved to/').first().textContent().catch(() => '')
    ok(/Slot B/.test(line ?? ''), `the last step says where it will go (${(line ?? '').trim() || 'nothing said'})`)
    ok(await startBtn(page).isEnabled(), 'and Start Career is live')
    await startBtn(page).click()
    const o = await waitForSave(page, 'New Neighbour')
    ok(o.slot1 === 'Old Manager slot1', `the old career is still in Slot A (${o.slot1})`)
    ok(o.slot2 === 'New Neighbour', `and the new one is in Slot B (${o.slot2 ?? 'nowhere'})`)
    await ctx.close()
  }

  console.log('\n--- 2. all four slots full: the player chooses, and only that slot changes\n')
  {
    const { ctx, page } = await phoneWith(['slot1', 'slot2', 'slot3', 'slot4'])
    await toLastStep(page, 'Replacement')
    ok(await page.locator('text=All four save slots are in use').count() > 0, 'the last step says every slot is in use')
    ok(!(await startBtn(page).isEnabled()), 'Start Career is held until a slot is chosen')
    const need = await page.locator('.wiz-need').textContent().catch(() => '')
    ok(/save slot/i.test(need ?? ''), `and says why (${(need ?? '').trim() || 'silent'})`)
    await page.click('.speech-tile >> text=Slot C')
    ok(await startBtn(page).isEnabled(), 'choosing Slot C frees it')
    await startBtn(page).click()
    const o = await waitForSave(page, 'Replacement')
    ok(o.slot3 === 'Replacement', `the new career took Slot C (${o.slot3})`)
    ok(o.slot1 === 'Old Manager slot1' && o.slot2 === 'Old Manager slot2' && o.slot4 === 'Old Manager slot4',
      'and the other three careers are untouched')
    await ctx.close()
  }
} catch (e) {
  fails++
  console.log(`FAIL  PROBE THREW: ${e?.message ?? e}`)
} finally {
  await browser.close()
  preview.stop()
  console.log(fails === 0
    ? '\nSLOT PROBE PASSED: a new career never lands on an old one'
    : `\nSLOT PROBE FAILED (${fails})`)
  done(fails)
}
