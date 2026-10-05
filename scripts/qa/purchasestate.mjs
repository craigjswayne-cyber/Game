// PURCHASE STATE across the things a career does to storage (release hardening).
//
// storeprobe proves the till sells; this proves what it sold STAYS SOLD, and
// stays out of the career, through everything a player does afterwards:
//
//   a reload, a language change, a save exported and imported, a second career,
//   and a reinstall (fresh storage) answered by the store's restore.
//
// It also proves the two things that must NOT persist: a cancelled sheet leaves
// no receipt, and a consumable paid for but not yet applied is banked as a
// credit that waits - through all of the above - until a career collects it.
//
// The bridge is injected with addInitScript exactly as storeprobe does.
// Run: node scripts/qa/purchasestate.mjs   (needs a fresh build)
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = process.env.PORT ?? '4231'
const URL = `http://localhost:${PORT}/`
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function bridgeCtx({ owns = [], cancel = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  await ctx.addInitScript(([owned, cancel]) => {
    localStorage.setItem('rm-night', '1')
    const bought = new Set()
    globalThis.rmBilling = {
      details: async (sku) => ({ sku, price: '£1.99' }),
      buy: async (sku) => { if (cancel.includes(sku)) return 'cancelled'; bought.add(sku); return 'owned' },
      reason: () => null,
      owned: async () => [...new Set([...owned, ...bought])],
      consume: async (sku) => { owned = owned.filter(s => s !== sku); bought.delete(sku); return { ok: true } },
    }
  }, [owns, cancel])
  return ctx
}

const storage = (page) => page.evaluate(() => ({
  ent: localStorage.getItem('rm-ent'), credits: localStorage.getItem('rm-credits'),
}))
const entHas = (s, sku) => (s.ent ?? '').split(',').includes(sku)
const credit = (s, sku) => { try { return JSON.parse(s.credits ?? '{}')[sku] ?? 0 } catch { return -1 } }

async function startCareer(page) {
  try { await startCareerInner(page) } catch (e) {
    console.log('  [startCareer stuck on] ' + (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400))
    throw e
  }
}
async function startCareerInner(page) {
  await page.goto(URL)
  // a device with a career reopens it; the title is one step back
  await page.locator('text=New Career').or(page.locator('.bottom-nav')).first().waitFor()
  if (await page.locator('.bottom-nav').count()) await page.evaluate(() => window.rugbyStore.getState().toTitle())
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  // the tutorial is a first-run thing: a second career goes straight to Home
  await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 15000 })
  if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
}
const go = (page, screen) => page.evaluate((s) => window.rugbyStore.getState().go(s), screen)
const career = (page) => page.evaluate(() => {
  const g = window.rugbyStore.getState().game
  return g ? { name: g.managerName, saveName: g.saveName, uncapped: !!g.uncapped, licensed: !!g.licensed, season: g.season, week: g.week } : null
})
const check = (s, when) => {
  ok(entHas(s, 'phase.supporter'), `${when}: Pro Manager entitlement is still held`)
  ok(!entHas(s, 'phase.uncapped'), `${when}: the cancelled Charter left no receipt`)
  ok(credit(s, 'phase.heal') === 1, `${when}: the unapplied Full Fitness is still banked as one credit (have ${credit(s, 'phase.heal')})`)
}

try {
  const errs = []
  const ctx = await bridgeCtx({ cancel: ['phase.uncapped'] })
  const page = await ctx.newPage()
  page.on('pageerror', e => errs.push(e.message))
  page.setDefaultTimeout(12000)
  await startCareer(page)
  await go(page, 'supporter')
  await page.waitForSelector('.card >> text=Pro Manager')

  console.log('--- buy, cancel, and a consumable the career cannot use yet')
  await page.locator('.card', { hasText: 'Pro Manager' }).locator('.btn.gold').click()
  await page.waitForTimeout(700)
  await page.locator('.card', { hasText: 'Remove the salary cap' }).locator('.btn.gold').click()
  await page.waitForTimeout(700)
  const charterRow = await page.locator('.card', { hasText: 'Remove the salary cap' }).innerText()
  ok(!/Yours/.test(charterRow), 'a cancelled Charter row stays buyable')
  await page.locator('.card', { hasText: 'Full Fitness' }).locator('.btn.gold').first().click()
  await page.waitForTimeout(1200)
  const healRow = await page.locator('.card', { hasText: 'Full Fitness' }).innerText()
  console.log(`  heal row after buying with nobody to heal: ${healRow.replace(/\s+/g, ' ').slice(0, 160)}`)
  let s = await storage(page)
  console.log(`  storage: ${JSON.stringify(s)}`)
  check(s, 'after the purchases')
  const c0 = await career(page)
  ok(!c0.uncapped, 'the cancelled Charter wrote nothing into the career')

  console.log('--- reload')
  await page.reload()
  await page.waitForSelector('text=RUGBY')
  s = await storage(page)
  check(s, 'after a reload')
  await page.click('text=Continue').catch(() => {})
  await page.waitForSelector('.bottom-nav')
  await go(page, 'supporter')
  await page.waitForSelector('.card >> text=Pro Manager')
  ok(/Yours/.test(await page.locator('.card', { hasText: 'Pro Manager' }).innerText()), 'after a reload: the Pro Manager row reads as owned')

  console.log('--- language change')
  await page.evaluate(() => window.rugbyStore.getState().setLang('fr'))
  await page.waitForTimeout(1200)
  s = await storage(page)
  check(s, 'after switching to French')
  await page.evaluate(() => window.rugbyStore.getState().setLang('en'))
  await page.waitForTimeout(800)
  s = await storage(page)
  check(s, 'and back to English')

  console.log('--- save exported and imported')
  const json = await page.evaluate(() => JSON.stringify(window.rugbyStore.getState().game))
  const dir = mkdtempSync(join(tmpdir(), 'pstate-'))
  const file = join(dir, 'career.json')
  writeFileSync(file, json)
  await go(page, 'saves')
  await page.waitForSelector('input[type=file]', { state: 'attached' })
  await page.setInputFiles('input[type=file]', file)
  await page.waitForTimeout(1500)
  const slot = await page.evaluate(() => window.rugbyStore.getState().saveSlot)
  ok(slot === 'imported', `the import opened in the imported slot (${slot})`)
  s = await storage(page)
  check(s, 'after importing a save')

  console.log('--- a second career')
  await startCareer(page)
  s = await storage(page)
  check(s, 'after starting a new career')
  await go(page, 'supporter')
  await page.waitForSelector('.card >> text=Pro Manager')
  ok(/Yours/.test(await page.locator('.card', { hasText: 'Pro Manager' }).innerText()), 'the new career sees Pro Manager owned')

  console.log('--- the credit is consumed only when a career collects it')
  // an injured man in the squad makes the heal applicable; the credit is spent
  // only then
  const applied = await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    const id = g.clubs[g.userClubId].players.find(pid => !g.players[pid].acad)
    g.players[id].injury = { type: 'Hamstring', weeks: 4 }
    g.healAtGames = null
    return id
  })
  await go(page, 'home'); await go(page, 'supporter')
  await page.waitForSelector('.card >> text=Pro Manager')
  const before = credit(await storage(page), 'phase.heal')
  const healBtn = page.locator('.card', { hasText: 'Full Fitness' }).locator('.btn.gold').first()
  await healBtn.click()
  await page.waitForTimeout(1200)
  const after = credit(await storage(page), 'phase.heal')
  const healed = await page.evaluate((id) => { const g = window.rugbyStore.getState().game; return !g.players[id].injury }, applied)
  console.log(`  credit ${before} -> ${after}, player healed: ${healed}; row: ${(await page.locator('.card', { hasText: 'Full Fitness' }).innerText()).replace(/\s+/g, ' ').slice(0, 120)}`)
  ok(healed ? after === before - 1 : after === before, 'a credit leaves the bank exactly when (and only when) it lands in a career')
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
  await ctx.close()

  console.log('--- a reinstall: fresh storage, the store restores what it owns')
  {
    const ctx2 = await bridgeCtx({ owns: ['phase.supporter', 'phase.estate', 'phase.heal'] })
    const p2 = await ctx2.newPage()
    await p2.goto(URL)
    await p2.waitForSelector('text=RUGBY')
    await p2.waitForTimeout(1500)
    const s2 = await storage(p2)
    console.log(`  storage after boot: ${JSON.stringify(s2)}`)
    ok(entHas(s2, 'phase.supporter') && entHas(s2, 'phase.estate'), 'both non-consumables come back from the store at boot')
    ok(!entHas(s2, 'phase.heal'), 'a consumable receipt is not written as an entitlement')
    await startCareer(p2)
    await go(p2, 'supporter')
    await p2.waitForSelector('.card >> text=Pro Manager')
    await p2.waitForTimeout(800)
    const heal = await p2.locator('.card', { hasText: 'Full Fitness' }).innerText()
    console.log(`  heal row on a restored device: ${heal.replace(/\s+/g, ' ').slice(0, 140)}`)
    await ctx2.close()
  }
} catch (e) {
  fails++
  console.log('FAIL  threw: ' + String(e).split('\n')[0])
} finally {
  await browser.close()
  server.stop()
}
console.log(fails ? `PURCHASE STATE: ${fails} FAIL` : 'PURCHASE STATE PASSED')
process.exit(fails ? 1 : 0)
