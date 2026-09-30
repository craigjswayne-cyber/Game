// The office's hard calls on a real screen (1.8.2, src/game/room.ts).
//
// roomprobe.ts holds the engine. This holds the half a player sees: a split in
// the dressing room and a renewal question reach the Press screen's office
// section in words (no raw keys, no numbers but the quoted wage), the answer
// buttons do what they say through the store, the reaction lands in the
// coverage below, and the same questions read in French.
//
// Run: node scripts/roomui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const PORT = 4944
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
page.setDefaultTimeout(8000)
const errors = []
page.on('pageerror', e => errors.push(String(e)))

const bodyText = () => page.evaluate(() => document.body.innerText)

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Room Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.masthead', { timeout: 20000 })

  // ---- a split, put on the desk the way room.ts builds it ----
  const who = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    for (const q of g.press) q.answered = true
    const club = g.clubs[g.userClubId]
    const cap = g.players[club.captain]
    const vice = g.players[club.vice]
    const opt = (room, lk, lv) => ({ room, lk, lv, label: lk, reaction: '', morale: 0, board: 0 })
    g.press.push({
      id: g.nextId - 1 + 0.6, week: g.week, season: g.season, outlet: "The Manager's Office",
      question: 'x', qk: 'room.splitCapQ',
      qv: { player: cap.name, deputy: vice.name, dep_k: 'room.depBacksVice', rid: -1, did: vice.id, db: 1, camp: '' },
      playerId: cap.id, answered: false,
      options: [opt('stand', 'room.stand', { player: cap.name }), opt('reverse', 'room.reverse', { player: cap.name })],
    })
    st.touch()
    st.go('press')
    return { cap: cap.name, vice: vice.name, trust: g.mgrTrust ?? 30 }
  })
  await page.waitForSelector('text=split over it', { timeout: 8000 })
  let text = await bodyText()
  ok(text.includes(`You left your captain, ${who.cap}, out of the side`), 'the split reads in words, naming the captain')
  ok(text.includes(`${who.vice}, the vice-captain, has told them it was your call to make.`), 'and the vice-captain\'s stance')
  ok(!/\broom\.[a-z]/i.test(text), 'no raw key reaches the screen')
  ok(await page.locator('button:has-text("Stand by it")').count() === 1 && await page.locator(`button:has-text("Reverse it: ${who.cap} starts the next match")`).count() === 1,
    'both answers are buttons')
  await page.click('button:has-text("Stand by it")')
  await page.waitForSelector('text=You held the line', { timeout: 8000 })
  const after = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    return { c: g.room?.c ?? 0, trust: g.mgrTrust ?? 30, dec: g.decisions?.[0]?.k ?? '' }
  })
  ok(after.c > 0, 'standing by it leans the culture towards the manager (hidden)')
  ok(after.trust > who.trust, 'and firms up the room\'s trust')
  ok(after.dec === 'room.decStand', 'the decision log has it')
  text = await bodyText()
  ok(text.includes(`${who.vice} stood beside you`), 'the reaction names what it cost the vice-captain')

  // ---- a renewal question, in French ----
  const fr = await page.evaluate(async () => {
    const st = window.rugbyStore.getState()
    st.setLang('fr')
    await new Promise(r => setTimeout(r, 800))
    const g = st.game
    const club = g.clubs[g.userClubId]
    const p = club.players.map(id => g.players[id]).filter(x => x && !x.acad && x.id !== club.captain).sort((a, b) => b.ca - a.ca)[0]
    p.contractEnds = g.season
    const opt = (room, lk, lv, extra) => ({ room, lk, lv, label: lk, reaction: '', morale: 0, board: 0, ...extra })
    g.press.push({
      id: g.nextId - 1 + 0.7, week: g.week, season: g.season, outlet: "The Manager's Office",
      question: 'x', qk: 'room.renewQ', qv: { player: p.name, pos: p.pos, age: p.age },
      playerId: p.id, answered: false,
      options: [opt('renew', 'room.renewNow', { wage: '£9k' }, { roomWage: 9000 }), opt('wait', 'room.renewWait', {})],
    })
    st.touch()
    st.go('home')
    await new Promise(r => setTimeout(r, 200))
    st.go('press')
    return { name: p.name }
  })
  await page.waitForSelector(`text=L'agent de ${fr.name}`, { timeout: 8000 })
  text = await bodyText()
  ok(text.includes('Prolonger maintenant coûte plus que le salaire demandé'), 'the renewal question reads in French, with both costs')
  ok(/Attendre : garder l'argent/.test(await page.evaluate(() => document.body.textContent)), 'and its French colon cannot wrap away')
  await page.click('button:has-text("Attendre")')
  await page.waitForSelector('text=la porte reste ouverte', { timeout: 8000 })
  const w = await page.evaluate(() => window.rugbyStore.getState().game.room?.w?.length ?? 0)
  ok(w === 1, 'waiting puts him on the list of men the manager waited on')
  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`)
} catch (e) {
  ok(false, `the walk completed (${String(e).split('\n')[0]})`)
} finally {
  await browser.close()
  server.stop()
}
say(fails ? `ROOM UI FAILED: ${fails}` : 'ROOM UI PASSED: the office asks in words, in two languages, and the answers do what they say')
done(fails)
