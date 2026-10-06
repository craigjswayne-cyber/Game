// Probe: in the squad tables a loan man's NAME is coloured, every name keeps
// to one line, and the marks beside it stay in view.
//
// Owner, 1.8.9, Team > General Info on Android: "Messy names over two lines.
// If loan make their name a different colour (be mindful of skins
// available)." So the LOAN word after a name is gone, a loaned-in man's name
// is in --loan (a token set for every theme and skin), a short key under the
// table explains it once, the status stays in the text for a screen reader,
// and a long name ellipsises inside its cell rather than wrapping, with the
// fitness ring, (C) and the star still shown.
//
// The seam is the live store: one squad man is made a loan signing and given
// a long name, another a long name and the captaincy, then General Info,
// Stats, Game Time and Contracts are read at 320, 360 and 412px wide, under
// night, day and the three Pro skins.
//
// Run: node scripts/loannameui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4243', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', e => errors.push(String(e.message ?? e)))
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const LOANER = 'Maximilian Featherstonehaugh-Loan'
const CAPTAIN = 'Bartholomew Montgomery-Smythe'

try {
  await page.goto('http://localhost:4243/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Loan Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  await page.evaluate(([LOANER, CAPTAIN]) => {
    const s = window.rugbyStore.getState()
    const g = s.game
    const club = g.clubs[g.userClubId]
    const other = Object.keys(g.clubs).find(id => id !== g.userClubId)
    const ids = club.players.filter(id => !g.players[id].injury && !g.players[id].natSquad)
    const a = g.players[ids[0]], b = g.players[ids[1]]
    a.name = LOANER; a.loanFrom = other
    b.name = CAPTAIN; club.captain = b.id
    s.touch()
    s.go('squad')
  }, [LOANER, CAPTAIN])
  await page.waitForSelector('.tab-bar')

  const read = () => page.evaluate(([LOANER, CAPTAIN]) => {
    const rows = [...document.querySelectorAll('.dtable td.name')]
    const find = (n) => rows.find(td => td.textContent.includes(n))
    const lo = find(LOANER), ca = find(CAPTAIN)
    const other = rows.find(td => td !== lo && td !== ca)
    const nm = (td) => td?.querySelector('.nm')
    const probe = document.createElement('span'); probe.style.color = 'var(--loan)'; document.querySelector('.app').appendChild(probe)
    const loanInk = getComputedStyle(probe).color; probe.remove()
    const oneLine = rows.every(td => { const l = td.querySelector('.nm-line'); return l && l.getBoundingClientRect().height <= 26 })
    const tdIn = (el, td) => { const r = el.getBoundingClientRect(), c = td.getBoundingClientRect(); return r.width > 0 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5 }
    const capMark = ca ? [...ca.querySelectorAll('b')].find(b => b.textContent.includes('(C)')) : null
    return {
      n: rows.length,
      loanInk, loanColor: nm(lo) ? getComputedStyle(nm(lo)).color : null,
      plainColor: nm(other) ? getComputedStyle(nm(other)).color : null,
      loanText: lo?.innerText ?? '',
      srText: lo?.querySelector('.sr-only')?.textContent ?? '',
      loanCut: nm(lo) ? nm(lo).scrollWidth > nm(lo).clientWidth : null,
      oneLine,
      ringIn: lo ? tdIn(lo.querySelector('[role=img]'), lo) : false,
      capIn: capMark && ca ? tdIn(capMark, ca) : false,
      key: document.querySelector('.loan-key')?.textContent ?? '',
      keyVisible: !!document.querySelector('.loan-key .loan-swatch'),
      over: document.scrollingElement.scrollWidth - innerWidth,
    }
  }, [LOANER, CAPTAIN])

  const TABS = ['General Info', 'Stats', 'Game Time', 'Contracts']
  const setApp = (add, remove) => page.evaluate(([a, r]) => { const el = document.querySelector('.app'); r.forEach(x => el.classList.remove(x)); a.forEach(x => el.classList.add(x)) }, [add, remove])
  for (const w of [320, 360, 412]) {
    await page.setViewportSize({ width: w, height: 800 })
    for (const tab of TABS) {
      await page.click(`.tab-bar button:has-text("${tab}")`)
      await page.waitForTimeout(150)
      const r = await read()
      const where = `${w}px ${tab}`
      ok(r.n > 10 && r.oneLine, `${where}: every name on one line (${r.n} rows)`)
      ok(!/\bLOAN\b/.test(r.loanText), `${where}: no LOAN word after the loan man's name ("${r.loanText.slice(0, 40)}")`)
      ok(r.loanColor === r.loanInk && r.loanColor !== r.plainColor, `${where}: his name is in the loan colour (${r.loanColor} against ${r.plainColor})`)
      ok(r.ringIn && r.capIn, `${where}: the fitness ring and (C) stay inside the cell`)
      ok(r.key === 'Highlighted names are on loan' && r.keyVisible, `${where}: the key under the table explains it ("${r.key}")`)
      ok(r.over <= 0, `${where}: no sideways scroll (${r.over})`)
      if (process.env.SHOT && tab === 'General Info') await page.screenshot({ path: `${process.env.SHOT}/loan-${w}.png` })
      if (w === 320 && tab === 'General Info') {
        ok(r.loanCut === true, 'a long name gives way to an ellipsis at 320px rather than a second line')
        ok(r.srText.includes('on loan'), `and a screen reader still hears "${r.srText.trim()}"`)
      }
    }
  }
  // the colour is distinct in every palette the game can wear
  await page.setViewportSize({ width: 393, height: 852 })
  await page.click('.tab-bar button:has-text("General Info")')
  for (const [name, add] of [['day', ['day']], ['midnight', ['skin-midnight']], ['heritage', ['skin-heritage']], ['stealth', ['skin-stealth']], ['midnight day', ['skin-midnight', 'day']], ['heritage day', ['skin-heritage', 'day']], ['stealth day', ['skin-stealth', 'day']]]) {
    await setApp(add, add.includes('day') ? ['night'] : [])
    await page.waitForTimeout(80)
    const r = await read()
    const c = await page.evaluate(() => {
      const probe = document.createElement('span'); document.querySelector('.app').appendChild(probe)
      const get = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color }
      const out = { text: get('--text-primary'), gold: get('--gold'), danger: get('--danger') }
      probe.remove(); return out
    })
    ok(r.loanColor === r.loanInk && ![c.text, c.gold, c.danger].includes(r.loanColor),
      `${name}: the loan colour ${r.loanColor} is not the name ink, the captain's gold or the injury red`)
    await setApp(['night'], [...add])
  }
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
if (errors.length) ok(false, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 200)}`)
await browser.close()
await server.stop?.()
say(fails ? `\nLOAN NAME UI FAILED (${fails})` : '\nLOAN NAME UI PASSED: a loan man is coloured, not tagged, and every name keeps to one line')
done(fails)
