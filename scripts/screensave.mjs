// Probe: the 1.8.1 screens and saves pass (technical manual, tester notes for
// sections 1 and 10, and the UI sweep).
//
// One assertion per fix, each written against the thing a tester saw:
//
//   a screen that changes the career through touch() marks it for saving, so
//     the change is on the disk without waiting for the next Continue
//   a story read in the inbox stays read after a reload
//   nothing is written to the career slot while a match is half played
//   the Matchday game plan cannot be applied twice by leaving and coming back
//   another club's page wears that club's name, not "Club"
//   the World rankings movement column is not a stripe of lone dots
//   Continue says Offers when a bid is what it will open
//   the Country badge counts what the hold counts, and the squad label has
//     one arrow, not two
//   the Store route with no till lands on Home, not on an empty page
//   a till with no advert bridge locks no skin behind a product it never sells
//   a file that is shaped like a save but has nothing to play is refused on
//     import, the same as on load
//   the title screen's Load Career list asks before it deletes a career
//
// Run: npm run build && node scripts/screensave.mjs
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4193
const server = await startPreview(PORT, 3000)
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const say = s => console.log(s)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function career(page, club = 'Leicester') {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click(`.tile >> text=${club}`)
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Save Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  await page.waitForTimeout(1200)
}
const stats = page => page.evaluate(() => ({ ...window.rugbySaveStats }))
/** What is actually on the disk for the open slot, read straight from IndexedDB. */
const onDisk = (page, pick) => page.evaluate(async (pick) => {
  const slot = window.rugbyStore.getState().saveSlot
  const db = await new Promise((res, rej) => { const r = indexedDB.open('rugby-manager'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const rec = await new Promise((res, rej) => { const q = db.transaction('saves').objectStore('saves').get(slot); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
  db.close()
  // eslint-disable-next-line no-new-func
  return rec ? new Function('s', `return (${pick})(s)`)(rec.state) : null
}, pick.toString())
const go = (page, screen, param) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [screen, param])

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  await career(page)

  say('\n--- touch() marks the save')
  await go(page, 'training')
  await page.waitForTimeout(300)
  const was = await page.evaluate(() => window.rugbyStore.getState().game.training)
  const before = await stats(page)
  const pick = page.locator('.club-pick:not(.sel)').first()
  const picked = (await pick.locator('.cname').textContent()).trim()
  await pick.click()
  const now = await page.evaluate(() => window.rugbyStore.getState().game.training)
  ok(now !== was, `the training focus changed on screen (${was} to ${now}, "${picked}")`)
  const mid = await stats(page)
  ok(mid.marks > before.marks, `and the tap marked the save (${mid.marks - before.marks} mark)`)
  await page.waitForTimeout(1500)
  ok((await stats(page)).writes > before.writes, 'and the queue wrote it')
  ok(await onDisk(page, s => s.training) === now, 'the new focus is on the disk without a Continue')
  // the phone's way out: change it again and leave at once
  const second = page.locator('.club-pick:not(.sel)').first()
  await second.click()
  const now2 = await page.evaluate(() => window.rugbyStore.getState().game.training)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.waitForTimeout(1200)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  ok(await page.evaluate(() => window.rugbyStore.getState().game?.training) === now2,
    'a change made just before pagehide survives the reload')

  say('\n--- a story read stays read')
  const story = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const n = st.game.news.find(x => !x.read && !x.cleared)
    if (!n) return null
    st.openInbox()
    return st.game.news.find(x => x.id === window.rugbyStore.getState().inboxId)?.id ?? null
  })
  ok(story != null, `the inbox opened an unread story (${story})`)
  await page.waitForTimeout(1500)
  ok(await onDisk(page, `s => s.news.find(n => n.id === ${story})?.read`) === true, 'and it is marked read on the disk')

  say('\n--- another club wears its own name')
  const other = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const c = Object.values(st.game.clubs).find(c => c.id !== st.game.userClubId && c.leagueId === st.game.clubs[st.game.userClubId].leagueId)
    return { id: c.id, name: c.name }
  })
  await go(page, 'club', other.id)
  await page.waitForTimeout(300)
  const h1 = (await page.locator('.masthead h1').textContent()).trim()
  ok(h1 === other.name, `the masthead reads "${h1}" (${other.name})`)
  await go(page, 'club')
  await page.waitForTimeout(200)
  ok((await page.locator('.masthead h1').textContent()).trim() === 'Club', 'your own club keeps its title')

  say('\n--- the World rankings movement column')
  // the snapshot the arrows compare against, as season.ts republishes it:
  // stage one with a few players moved so both the still and the moving show
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const now = Object.values(g.players).filter(p => p.clubId).sort((a, b) => b.value - a.value).slice(0, 60).map(p => p.id)
    const prev = [...now]
    ;[prev[2], prev[7]] = [prev[7], prev[2]]
    g.agency = { ...(g.agency ?? {}), seniors: prev, kids: g.agency?.kids ?? [], at: { season: g.season, week: g.week } }
    st.go('agency')
  })
  await page.waitForTimeout(400)
  const cells = await page.locator('.dtable.ranks tbody tr td:nth-child(2)').allTextContents()
  const dots = cells.filter(c => c.trim() === '·').length
  const shaped = cells.every(c => /^([▲▼]\d+|★)?$/.test(c.trim()))
  ok(cells.length > 10 && dots === 0, `no lone dots down the column (${dots} of ${cells.length})`)
  ok(shaped, `each mark says how far, or is blank (${JSON.stringify(cells.slice(0, 10))})`)

  say('\n--- Continue names the offer it is holding for')
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const pid = g.clubs[g.userClubId].players[3]
    const from = Object.keys(g.clubs).find(id => id !== g.userClubId)
    g.offers.push({ id: g.nextId++, playerId: pid, fromClubId: from, toClubId: g.userClubId, fee: 250000, week: g.week, forUser: true, status: 'pending' })
    st.touch()
    st.go('home')
  })
  await page.waitForTimeout(300)
  const label = (await page.locator('.continue-btn').textContent()).trim()
  ok(/^Offers/.test(label), `the button reads "${label}"`)
  await page.click('.continue-btn')
  await page.waitForTimeout(400)
  ok(await page.evaluate(() => { const n = window.rugbyStore.getState().nav; return n[n.length - 1].screen }) === 'offers',
    'and a tap opens Offers, as it says')
  await page.evaluate(() => { const g = window.rugbyStore.getState().game; for (const o of g.offers) o.status = 'rejected'; window.rugbyStore.getState().home() })

  say('\n--- the Store route with no till')
  await go(page, 'supporter')
  await page.waitForTimeout(300)
  const store = await page.evaluate(() => ({ text: document.querySelector('.content')?.innerText.trim().length ?? 0, h1: document.querySelector('.masthead h1')?.textContent }))
  ok(store.text > 80 && store.h1 !== 'Support the game', `lands on Home, not a titled empty page (${store.text} chars, "${store.h1}")`)
  await page.evaluate(() => window.rugbyStore.getState().home())

  say('\n--- the game plan, applied once')
  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  const onMd = await page.locator('text=Kick Off ▸').count() > 0
  ok(onMd, 'Continue walks to the match day')
  const brief = page.locator('.tab-bar button', { hasText: 'Brief' })
  if (await brief.count()) await brief.first().click()
  await page.waitForTimeout(300)
  const apply = page.locator('button', { hasText: 'Apply the plan' })
  if (await apply.count()) {
    const dials = () => page.evaluate(() => { const g = window.rugbyStore.getState().game; const t = g.clubs[g.userClubId].tactic; return [t.style, t.tempo, t.kicking, t.aggression].join(',') })
    await apply.first().click()
    await page.waitForTimeout(200)
    const once = await dials()
    await page.evaluate(() => window.rugbyStore.getState().go('squad'))
    await page.waitForTimeout(200)
    await page.evaluate(() => window.rugbyStore.getState().back())
    await page.waitForTimeout(300)
    if (await brief.count()) await brief.first().click()
    await page.waitForTimeout(200)
    const again = page.locator('button', { hasText: 'Plan applied' })
    ok(await again.count() > 0 && await again.first().isDisabled(), 'back on Matchday the plan still reads applied, and the button is shut')
    ok(await dials() === once, `the dials did not move a second time (${once})`)
  } else {
    ok(true, 'no game plan this week to apply (nothing to stack)')
  }

  say('\n--- nothing written mid-match')
  await page.click('text=Kick Off ▸')
  await page.locator('.talk-modal').waitFor({ timeout: 5000 })
  await page.click('.talk-modal .speech-tile >> nth=0')
  try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch { /* clean sheet */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  await page.waitForTimeout(3000)
  const inMatch = await stats(page)
  await page.evaluate(() => window.rugbyStore.getState().touch())
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.waitForTimeout(1500)
  const after = await stats(page)
  ok(after.writes === inMatch.writes, `a touch and a pagehide mid-match wrote nothing to the career slot (${after.writes - inMatch.writes})`)
  ok(await onDisk(page, s => !!s) === true, 'and the slot still holds a career')

  say('\n--- the title screen asks before deleting')
  await page.evaluate(() => window.rugbyStore.getState().toTitle())
  await page.waitForSelector('text=Load Career', { timeout: 10000 })
  await page.click('text=Load Career')
  await page.waitForTimeout(300)
  const cross = page.locator('.title-screen .btn.danger').first()
  const count0 = await page.locator('.title-screen .btn.danger').count()
  await cross.click()
  await page.waitForTimeout(400)
  const still = await page.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('rugby-manager'); q.onsuccess = () => r(q.result) })
    const keys = await new Promise(r => { const q = db.transaction('saves').objectStore('saves').getAllKeys(); q.onsuccess = () => r(q.result) })
    db.close()
    return keys.filter(k => !String(k).includes('::')).length
  })
  ok(count0 > 0 && still >= 1, `one tap on the cross deleted nothing (${still} saved)`)
  ok(/Sure/.test(await cross.textContent()), 'and it now asks "Sure?"')

  ok(errors.length === 0, `no page errors (${errors.join(' | ')})`)
  await page.close()

  say('\n--- a save shaped file with nothing to play is refused on import')
  {
    const p2 = await browser.newPage({ viewport: { width: 412, height: 915 } })
    await career(p2, 'Bath')
    await p2.evaluate(() => window.rugbyStore.getState().go('saves'))
    await p2.waitForTimeout(400)
    const junk = JSON.stringify({ clubs: { X: { id: 'X' } }, players: { 1: { id: 1 } }, userClubId: 'ZZZ', week: 3, comps: {} })
    await p2.setInputFiles('input[type=file]', { name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from(junk) })
    await p2.waitForTimeout(800)
    const txt = await p2.locator('.content').innerText()
    ok(/not a PHASE: Rugby Manager save/.test(txt), 'the import says it is not a save')
    const slots = await p2.evaluate(async () => {
      const db = await new Promise(r => { const q = indexedDB.open('rugby-manager'); q.onsuccess = () => r(q.result) })
      const keys = await new Promise(r => { const q = db.transaction('saves').objectStore('saves').getAllKeys(); q.onsuccess = () => r(q.result) })
      db.close()
      return keys
    })
    ok(!slots.includes('imported'), `and nothing was written to a slot (${JSON.stringify(slots)})`)
    ok(await p2.evaluate(() => window.rugbyStore.getState().game.userClubId) !== 'ZZZ', 'and the career on screen is still the real one')

    say('\n--- the Country badge and the hold agree')
    const staged = await p2.evaluate(() => {
      const st = window.rugbyStore.getState()
      const g = st.game
      g.natTeam = 'SCO'
      const intl = g.fixtures.filter(f => ['aut', 'sn'].includes(f.compId))
      if (!intl.length) return null
      g.week = Math.min(...intl.map(f => f.week))
      const scots = Object.values(g.players).filter(p => p.nat === 'SCO' && p.clubId && !p.injury && !p.onLoan).sort((a, b) => b.ca - a.ca).slice(0, 20)
      g.natSquads.SCO = scots.map(p => p.id)
      for (const p of scots) p.natSquad = true
      st.go('home')
      st.touch()
      return scots.length
    })
    await p2.waitForTimeout(400)
    if (staged == null) ok(true, 'no Test window this season to stage (skipped)')
    else {
      const badge = (await p2.locator('.bottom-nav button[title="Country"] .dot').textContent().catch(() => '')).trim()
      const cont = (await p2.locator('.continue-btn').textContent()).trim()
      const owed = /Name (\d+) more/.exec(cont)?.[1]
      ok(owed != null && badge === owed, `the badge says ${badge}, the button asks for ${owed} more ("${cont}")`)
      ok((cont.match(/▸/g) ?? []).length === 1, `the squad label carries one arrow, not two ("${cont}")`)
    }
    await p2.close()
  }

  say('\n--- a till with no advert bridge locks no skin')
  {
    const p3 = await browser.newPage({ viewport: { width: 412, height: 915 } })
    await p3.addInitScript(() => {
      globalThis.rmBilling = {
        details: async (sku) => ({ sku }), buy: async () => 'cancelled', owned: async () => [], consume: async () => {},
      }
    })
    await career(p3, 'Sale')
    await p3.evaluate(() => window.rugbyStore.getState().go('settings'))
    await p3.waitForTimeout(400)
    const txt = await p3.locator('.content').innerText()
    ok(!/\bPRO\b/.test(txt) && !/Get the other three/i.test(txt), 'no PRO marks and no door to a Store that cannot sell them')
    await p3.evaluate(() => window.rugbyStore.getState().go('supporter'))
    await p3.waitForTimeout(400)
    ok((await p3.locator('.masthead h1').textContent()).trim() === 'Support the game' && /Support the game/.test(await p3.locator('.content').innerText()),
      'and with a till the Store itself still opens')
    await p3.close()
  }
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close()
server.stop()
console.log(fails ? `\nSCREENSAVE FAILED (${fails})` : '\nSCREENSAVE PASSED: what the screens change is saved, and they say what they hold')
done(fails)
