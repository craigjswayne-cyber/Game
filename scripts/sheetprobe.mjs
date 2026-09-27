// Probe: the Finances screen reads as a balance sheet, and the commercial
// negotiating table works in a real browser (1.8.0).
//
// Owner: "Can we make the financial page more clear and like a balance sheet.
// Balance in big at top, transfer money, wage bill with a + or negative if over
// spending in red. Needs to be more a list. Attendance isn't needed in this."
// And for the deals: "Deals should be negotiation with a challenge for the
// manager." Neither claim is visible to a node probe, so this one opens the
// game at phone sizes and asks the page:
//
//   1. Is the cash in the bank the one big figure, first on the tab?
//   2. Is the rest a list: labels left, amounts right on one edge, in tabular
//      figures?
//   3. Does the wage headroom carry a sign, and turn red with a minus when the
//      club overspends its wage budget?
//   4. Is attendance gone, and is there not one emoji on the money or deals tab?
//   5. Does the season's sheet end on the same cash figure as the top, after a
//      few real weeks have moved money through it?
//   6. Do the old actions (the treasury slider) sit BELOW the sheet?
//   7. Nothing wider than the screen at 412 and 360.
//   8. The negotiating table: a sponsor can be sat down with, the mood is words
//      and never a number, a bold structure shows four bonus lines, and a
//      handshake signs the deal.
//   9. The board confidence meter is no longer on Finances (it moved to Club
//      Information).
//
// Screenshots go to $SHOTS (default: /tmp/sheetprobe) to be looked at.
//
// Run: npm run build && node scripts/sheetprobe.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4271
const SHOTS = process.env.SHOTS ?? '/tmp/sheetprobe'
mkdirSync(SHOTS, { recursive: true })
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const EMOJI = /\p{Extended_Pictographic}/u

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function openGame(width, height, night) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.setDefaultTimeout(8000)
  await page.addInitScript(n => { localStorage.setItem('rm-night', n ? '1' : '0'); localStorage.setItem('rm-lang', 'en') }, night)
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('northampton', 'Sheet Probe'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  return page
}

async function goTab(page, i) {
  await page.evaluate(() => window.rugbyStore.getState().go('finances'))
  await page.waitForTimeout(250)
  await page.locator('.tab-bar button').nth(i).click()
  await page.waitForTimeout(250)
}

/** play n weeks through the store, the way the annual probe drives a season */
async function playWeeks(page, n) {
  await page.evaluate(async n => {
    const s = window.rugbyStore
    const start = s.getState().game.week
    for (let guard = 0; guard < 400 && s.getState().game.week < start + n; guard++) {
      const st = s.getState()
      for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
      for (const q of st.game.press) q.answered = true
      s.setState({ lastAdvanceAt: 0 })
      const screen = st.nav[st.nav.length - 1]?.screen
      if (st.liveMatch || screen === 'matchday') st.instantResult()
      else st.continueWeek()
      await new Promise(r => setTimeout(r, 5))
    }
  }, n)
  await page.waitForTimeout(400)
}

/** The app scrolls inside its own container, so a fullPage screenshot is one
 *  viewport. Walk the container a screen at a time instead, to look at. */
async function shots(page, name, max = 6) {
  for (let i = 0; i < max; i++) {
    const more = await page.evaluate(i => {
      const el = [...document.querySelectorAll('*')].find(e => {
        const cs = getComputedStyle(e)
        return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.querySelector('.card')
      }) ?? document.scrollingElement
      const step = Math.round(el.clientHeight * 0.8)
      el.scrollTop = i * step
      return el.scrollTop + el.clientHeight < el.scrollHeight - 2
    }, i)
    await page.waitForTimeout(120)
    await page.screenshot({ path: `${SHOTS}/${name}-${i + 1}.png` })
    if (!more) break
  }
  await page.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0 })
}

async function sheetChecks(page, label) {
  const m = await page.evaluate(() => {
    const cash = document.querySelector('.bs-cash-amt')
    const cards = [...document.querySelectorAll('.card')].filter(c => c.offsetParent)
    const amts = [...document.querySelectorAll('.bs .lg-amt')].filter(e => e.offsetParent)
    const rights = amts.map(e => Math.round(e.getBoundingClientRect().right))
    const tab = amts.every(e => getComputedStyle(e).fontVariantNumeric.includes('tabular-nums'))
    const close = document.querySelector('.bs-close .lg-amt')
    const range = document.querySelector('input[type=range]')
    const lastSheet = [...document.querySelectorAll('.bs')].pop()
    return {
      cash: cash?.textContent ?? null,
      cashSize: cash ? parseFloat(getComputedStyle(cash).fontSize) : 0,
      firstIsCash: cards[0]?.classList.contains('bs-cash') ?? false,
      rightsSpread: rights.length ? Math.max(...rights) - Math.min(...rights) : 99,
      rows: amts.length,
      tab,
      close: close?.textContent ?? null,
      rangeBelow: range && lastSheet ? range.getBoundingClientRect().top > document.querySelector('.bs-close')?.getBoundingClientRect().bottom : null,
      overflow: document.scrollingElement.scrollWidth - window.innerWidth,
      text: document.body.innerText,
    }
  })
  ok(!!m.cash && m.cashSize >= 30 && m.firstIsCash, `${label}: the cash in the bank is the first card and the big figure (${m.cash}, ${m.cashSize}px)`)
  ok(m.rows >= 10 && m.rightsSpread <= 1, `${label}: ${m.rows} amounts on the sheet, right-aligned on one edge (spread ${m.rightsSpread}px)`)
  ok(m.tab, `${label}: every amount is set in tabular figures`)
  ok(!/attendance|est\. gate/i.test(m.text), `${label}: attendance is gone from the page`)
  ok(!EMOJI.test(m.text), `${label}: no emoji on the money tab`)
  ok(m.close === m.cash, `${label}: the sheet closes on the cash in the bank (${m.close} = ${m.cash})`)
  ok(m.rangeBelow !== false, `${label}: the treasury slider sits below the sheet`)
  ok(m.overflow <= 0, `${label}: nothing wider than the screen (${m.overflow}px over)`)
  ok(!/Board Confidence/i.test(m.text), `${label}: the board confidence meter is not on Finances`)
}

try {
  // ---- 412 wide, night, after a few weeks of real money --------------------
  {
    const page = await openGame(412, 915, true)
    await playWeeks(page, 6)
    await goTab(page, 0)
    await sheetChecks(page, '412 night')
    const lines = await page.evaluate(() => [...document.querySelectorAll('.bs .ledger-row .lg-what')].map(e => e.textContent))
    ok(lines.includes('Player wages') && lines.includes('Sponsorship deals') && lines.includes('Total income') && lines.includes('Net for the season'),
      `the season's books list real lines after six weeks (${lines.length} rows)`)
    await shots(page, 'money-412-night')

    // overspend: the headroom turns into a red minus
    await page.evaluate(() => {
      const s = window.rugbyStore.getState()
      const c = s.game.clubs[s.game.userClubId]
      c.wageBudget = Math.round(c.players.reduce((a, id) => a + (s.game.players[id]?.wage ?? 0), 0) * 0.8)
      s.touch()
    })
    await page.waitForTimeout(250)
    const head = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.bs .ledger-row')].find(r => r.textContent.startsWith('Wage headroom'))
      const amt = row?.querySelector('.lg-amt')
      const probe = document.createElement('span'); probe.style.color = 'var(--text-negative)'; document.body.appendChild(probe)
      const neg = getComputedStyle(probe).color; probe.remove()
      return { text: amt?.textContent ?? '', colour: amt ? getComputedStyle(amt).color : '', neg }
    })
    ok(head.text.startsWith('−') && head.colour === head.neg, `over the wage budget the headroom is a red minus (${head.text}, ${head.colour})`)
    await page.screenshot({ path: `${SHOTS}/money-412-overspend.png` })

    // the negotiating table
    await page.evaluate(() => {
      const s = window.rugbyStore.getState()
      s.game.deals.sleeve.until = s.game.season - 1
      s.touch()
    })
    await goTab(page, 1)
    const deals = await page.evaluate(() => document.body.innerText)
    ok(/Shirt Sleeve/i.test(deals), 'the sleeve slot is on the commercial tab')
    ok(!EMOJI.test(deals), 'no emoji on the commercial tab')
    const neg = page.locator('button', { hasText: 'Negotiate' }).first()
    ok(await neg.count() > 0, 'an open slot offers sponsors to negotiate with')
    await neg.click()
    await page.waitForTimeout(250)
    const talk = await page.evaluate(() => {
      const t = document.querySelector('.talk')
      return {
        open: !!t,
        mood: t?.querySelector('.talk-mood')?.textContent ?? '',
        acts: t ? [...t.querySelectorAll('.talk-acts button')].map(b => b.textContent) : [],
        structs: t ? t.querySelectorAll('.talk-struct button').length : 0,
      }
    })
    ok(talk.open && talk.acts.length === 4 && talk.structs === 3, `the table opens with four moves and three structures (${talk.acts.join(' | ')})`)
    ok(/^Mood: (Keen|Interested|Wary|Losing patience)$/.test(talk.mood) && !/\d/.test(talk.mood), `the sponsor's mood is words, never odds ("${talk.mood}")`)
    await page.locator('.talk-struct button', { hasText: 'Low fee, big bonuses' }).click()
    await page.waitForTimeout(250)
    const bonusRows = await page.evaluate(() => [...document.querySelectorAll('.talk .ledger-row')].map(r => r.textContent))
    ok(bonusRows.length === 6 && bonusRows.some(r => r.startsWith('Top of the league')) && bonusRows.some(r => r.startsWith('Reach a final')),
      `a bold structure shows the guarantee, four bonus lines and their total (${bonusRows.length} rows)`)
    await page.locator('.talk').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/deals-412-talk.png` })
    await page.locator('.talk-acts').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/deals-412-talk-acts.png` })
    await shots(page, 'deals-412')
    const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth)
    ok(over <= 0, `the commercial tab fits the screen (${over}px over)`)
    await page.locator('.talk-acts button', { hasText: 'Accept' }).click()
    await page.waitForTimeout(250)
    const after = await page.evaluate(() => {
      const s = window.rugbyStore.getState()
      return { perf: !!s.game.deals.sleeve?.perf, talk: !!document.querySelector('.talk'), text: document.body.innerText }
    })
    ok(after.perf && !after.talk && /Signed\./.test(after.text), 'a handshake signs a performance deal and closes the table')
    await page.screenshot({ path: `${SHOTS}/deals-412-signed.png` })
    await goTab(page, 3)
    await shots(page, 'board-412', 3)
    const board = await page.evaluate(() => document.body.innerText)
    ok(!/Board Confidence/i.test(board), 'the board tab no longer carries the confidence meter')
    ok(!EMOJI.test(board), 'no emoji on the board tab (the objectives are marked with icons)')
    await page.close()
  }
  // ---- 360 wide, day ------------------------------------------------------
  {
    const page = await openGame(360, 800, false)
    await playWeeks(page, 3)
    await goTab(page, 0)
    await sheetChecks(page, '360 day')
    await shots(page, 'money-360-day')
    await page.evaluate(() => {
      const s = window.rugbyStore.getState()
      s.game.deals.kit.until = s.game.season - 1
      s.touch()
    })
    await goTab(page, 1)
    await page.locator('button', { hasText: 'Negotiate' }).first().click()
    await page.waitForTimeout(250)
    await page.locator('.talk-struct button', { hasText: 'Fee plus bonuses' }).click()
    await page.waitForTimeout(250)
    const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth)
    ok(over <= 0, `360: the negotiating table fits the screen (${over}px over)`)
    await page.locator('.talk-acts').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/deals-360-talk.png` })
    await page.close()
  }
  // ---- a landscape phone: the sheet and the week side by side ------------
  {
    const page = await openGame(844, 390, true)
    await playWeeks(page, 2)
    await goTab(page, 0)
    const cols = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.fin-col')].map(e => e.getBoundingClientRect())
      return { n: c.length, side: c.length === 2 && c[1].left > c[0].right - 1, over: document.scrollingElement.scrollWidth - window.innerWidth }
    })
    ok(cols.side && cols.over <= 0, `landscape: the sheet and the week sit in two columns (${cols.n} columns, ${cols.over}px over)`)
    await shots(page, 'money-844-landscape', 3)
    await page.close()
  }
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nSHEET PROBE FAILED (${fails})` : '\nSHEET PROBE PASSED: a balance sheet, and a table to negotiate at')
done(fails)
