// UI QA PROBE (1.8.0). The owner: "Check alignment of all menus" and
// "Identify any areas which feel unfinished".
//
// scripts/uiqa.mjs photographs every screen for a person to look at; this is
// the tripwire for the faults those photographs found and that were fixed, so
// none of them comes back unseen. Each check measures the thing the eye caught:
//
//   the league table's rank 10+ ran into the crest
//   the team sheet's star column wandered between the forwards and the backs
//   the moods in the room before the talk ran off the card, cut mid-word
//   the Academy had a blank masthead
//   the Roll of Honour drew a table header over no rows
//   the handbook's search box had no gutter
//   the Team of the Week stacked headings over empty boards, and its Ones to
//     Watch led with a bare age that read as a rank
//   a season year printed as "2,029"
//   the Mor heading on the squad table was cut off
//   the staff cards ran edge to edge of the glass
//   the new-career challenge cards stopped short of the list above them
//   a link dressed as a button was underlined
//   in daylight, white controls on white cards (Save, Export, depth names) and
//     forwards' position badges had no edge at all
//
// Run: npm run build && node scripts/uiqaprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const PORT = 4394
const server = await startPreview(String(PORT), 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => {
  let a = 20260927
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  try { localStorage.setItem('rm-lang', 'en') } catch {}
})
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const go = async (screen, param) => {
  await page.evaluate(([s, p]) => { const S = window.rugbyStore; S.setState({ nav: [{ screen: 'home' }] }); if (s !== 'home') S.getState().go(s, p) }, [screen, param])
  await page.waitForTimeout(400)
}
const tab = async (i) => { await page.locator('.content .tab-bar button').nth(i).click(); await page.waitForTimeout(300) }

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=New Career', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  // ---- the challenge cards line up with the league list above them
  const edges = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.content *')].find(e => e.textContent?.trim().startsWith('English Premier Division') && e.closest('button'))?.closest('button')
    const card = document.querySelector('.challenge-card')
    return { list: row ? Math.round(row.getBoundingClientRect().right) : -1, card: card ? Math.round(card.getBoundingClientRect().right) : -1 }
  })
  ok(edges.card > 0 && Math.abs(edges.card - edges.list) <= 2, `challenge cards end where the league list ends (${edges.card} vs ${edges.list})`)
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Probe'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
  // a few weeks, so the tables have a tenth place and the squads have form
  await page.evaluate(async () => {
    const S = window.rugbyStore; const start = S.getState().game.week
    for (let g = 0; g < 3000; g++) {
      const st = S.getState()
      if (st.game.week - start >= 8 && !st.liveMatch) break
      for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
      for (const n of st.game.news) n.read = true
      for (const q of st.game.press) q.answered = true
      S.setState({ lastAdvanceAt: 0, wireQueue: [] })
      const screen = st.nav[st.nav.length - 1]?.screen
      if (st.liveMatch || screen === 'matchday') st.instantResult(); else st.continueWeek()
      await new Promise(r => setTimeout(r, 5))
    }
  })

  // ---- league table: the rank never reaches the crest
  await go('tables')
  const rank = await page.evaluate(() => [...document.querySelectorAll('.ltable tbody tr')].map(tr => {
    const r = tr.children[0].getBoundingClientRect(), txt = tr.children[0]
    const range = document.createRange(); range.selectNodeContents(txt)
    const crest = tr.children[1].firstElementChild?.getBoundingClientRect()
    return { n: txt.textContent, textRight: range.getBoundingClientRect().right, cellRight: r.right, crestLeft: crest?.left ?? 9999 }
  }))
  const hit = rank.filter(x => x.textRight > x.crestLeft - 2)
  ok(rank.length >= 10 && hit.length === 0, `league table: every rank clears its crest (${rank.length} rows${hit.length ? `; ${hit.map(h => h.n).join(',')} touch` : ''})`)

  // ---- the team sheet: one star column for all four tables
  await go('matchday')
  const mdTabs = await page.locator('.content .tab-bar button').allTextContents()
  const teamIdx = mdTabs.findIndex(x => /team/i.test(x))
  if (teamIdx >= 0) await tab(teamIdx)
  const starX = await page.evaluate(() => [...new Set([...document.querySelectorAll('.xvsheet tr')].map(tr => Math.round(tr.children[3]?.getBoundingClientRect().left ?? -1)))])
  ok(starX.length === 1 && starX[0] > 0, `team sheet: the star column starts at one x in every table (${starX.join(', ')})`)
  // ---- the room before the talk: every mood inside the card
  const talkIdx = mdTabs.findIndex(x => /talk/i.test(x))
  if (talkIdx >= 0) {
    await tab(talkIdx)
    // the longest mood in the dictionary, forced into one row, is the case that broke
    const moods = await page.evaluate(() => {
      const chip = document.querySelector('.mood-table .mood-chip')
      if (chip) chip.textContent = 'Happy to be in the matchday squad'
      const wrap = document.querySelector('.mood-wrap')?.getBoundingClientRect()
      return [...document.querySelectorAll('.mood-table .mood-chip')].map(c => ({ right: c.getBoundingClientRect().right, wrap: wrap?.right ?? 0 }))
    })
    const out = moods.filter(m => m.right > m.wrap + 1)
    ok(moods.length > 0 && out.length === 0, `team talk: every mood chip sits inside the card (${moods.length} chips, ${out.length} past the edge)`)
  } else ok(false, 'team talk: the Talk tab was found')

  // ---- the Academy has a masthead title
  await go('academy')
  const acTitle = await page.evaluate(() => document.querySelector('.masthead h1')?.textContent?.trim() ?? '')
  ok(acTitle.length > 0, `the Academy's masthead has a title ("${acTitle}")`)

  // ---- the Roll of Honour: no header over no rows
  await go('history')
  const roll = await page.evaluate(() => ({ rows: document.querySelectorAll('.content tbody tr').length, heads: document.querySelectorAll('.content thead').length }))
  ok(roll.rows > 0 || roll.heads === 0, `Roll of Honour: no column header without a row under it (${roll.rows} rows, ${roll.heads} headers)`)

  // ---- the handbook's search box keeps the gutter
  await go('handbook')
  const hb = await page.evaluate(() => { const r = document.querySelector('.hb-search input')?.getBoundingClientRect(); return r ? { l: r.left, r: window.innerWidth - r.right } : null })
  ok(!!hb && hb.l >= 12 && hb.r >= 12, `handbook search box sits inside the page gutter (${hb ? `${Math.round(hb.l)}px / ${Math.round(hb.r)}px` : 'missing'})`)
  const mh = await page.evaluate(() => { const b = document.querySelector('.masthead .back-btn')?.getBoundingClientRect(); const h = document.querySelector('.masthead h1')?.getBoundingClientRect(); return b && h ? Math.abs((b.top + b.bottom) / 2 - (h.top + h.bottom) / 2) : 99 })
  ok(mh < 12, `a long masthead title stays on the back arrow's row (${Math.round(mh)}px apart)`)

  // ---- Team of the Week: no heading over an empty board, no bare age column
  await go('dreamteam')
  const dtTabs = await page.locator('.content .tab-bar button').count()
  let emptyHeads = 0, bareAge = 0
  for (let i = 0; i < dtTabs; i++) {
    await tab(i)
    const r = await page.evaluate(() => {
      const titles = [...document.querySelectorAll('.content .section-title')]
      let empty = 0
      for (const h of titles) {
        const next = h.nextElementSibling
        if (next?.classList.contains('tblwrap') && !next.querySelector('tbody tr')) empty++
        if (!next || next.classList.contains('section-title')) empty++
      }
      const bare = [...document.querySelectorAll('.content .dtable tbody tr')].filter(tr => tr.children.length === 3 && /^\d{2}$/.test(tr.children[0].textContent?.trim() ?? '') && Number(tr.children[0].textContent) <= 21 && tr.children[2].textContent?.trim().length === 3 && /^[A-Z]{3}$/.test(tr.children[2].textContent.trim())).length
      return { empty, bare }
    })
    emptyHeads += r.empty; bareAge += r.bare
  }
  ok(dtTabs > 0 && emptyHeads === 0, `Team of the Week: no section heading over an empty board, across ${dtTabs} leagues (${emptyHeads})`)
  ok(bareAge === 0, `Team of the Week: Ones to Watch carries the age with the position, not as a bare first column (${bareAge} rows)`)

  // ---- a year is never written as a quantity
  await go('finances')
  const finTabs = await page.locator('.content .tab-bar button').allTextContents()
  const capIdx = finTabs.findIndex(x => /cap/i.test(x))
  if (capIdx >= 0) await tab(capIdx)
  const years = await page.evaluate(() => (document.querySelector('.content')?.textContent ?? '').match(/\b2,0\d\d\b/g) ?? [])
  ok(years.length === 0, `no season year printed with a thousands comma${years.length ? ` (${years.join(', ')})` : ''}`)

  // ---- the squad table's headings are whole
  await go('squad')
  const sqTabs = await page.locator('.content .tab-bar button').allTextContents()
  const genIdx = sqTabs.findIndex(x => /general/i.test(x))
  if (genIdx >= 0) await tab(genIdx)
  const heads = await page.evaluate(() => [...document.querySelectorAll('.content table.fit thead th')].filter(th => th.scrollWidth > th.clientWidth + 1).map(th => th.textContent))
  ok(heads.length === 0, `squad General Info: no column heading cut off${heads.length ? ` (${heads.join(', ')})` : ''}`)
  const over = await page.evaluate(() => [...document.querySelectorAll('.content table.fit tbody td')].filter(td => td.getBoundingClientRect().right > window.innerWidth + 1).length)
  ok(over === 0, `squad General Info: nothing past the right edge (${over} cells)`)

  // ---- the staff cards keep the page gutter
  await go('training')
  const trTabs = await page.locator('.content .tab-bar button').allTextContents()
  const stIdx = trTabs.findIndex(x => /staff/i.test(x))
  if (stIdx >= 0) await tab(stIdx)
  const staff = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.content .card')].map(c => c.getBoundingClientRect())
    return { minL: Math.min(...cards.map(r => r.left)), maxR: Math.max(...cards.map(r => r.right)), n: cards.length }
  })
  ok(staff.n > 3 && staff.minL >= 10 && 412 - staff.maxR >= 10, `staff cards keep the gutter (${Math.round(staff.minL)}px left, ${Math.round(412 - staff.maxR)}px right)`)

  // ---- a link dressed as a button is not underlined
  await go('bug')
  const under = await page.evaluate(() => [...document.querySelectorAll('a.btn')].map(a => getComputedStyle(a).textDecorationLine))
  ok(under.length > 0 && under.every(d => d === 'none'), `links styled as buttons are not underlined (${under.join(', ')})`)

  // ---- daylight: controls on white cards have an edge
  await page.evaluate(() => { const S = window.rugbyStore; if (S.getState().night) S.getState().toggleNight() })
  await go('saves')
  const edge = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.content .card .btn')].find(x => !x.className.match(/gold|ghost|danger/))
    if (!b) return null
    const cs = getComputedStyle(b), card = getComputedStyle(b.closest('.card'))
    return { same: cs.backgroundColor === card.backgroundColor, shadow: cs.boxShadow }
  })
  ok(!!edge && (!edge.same || edge.shadow.includes('0px 0px 0px 1px')), `day theme: a plain button on a white card has an edge (${edge ? edge.shadow.slice(0, 40) : 'none found'})`)
  await go('squad')
  const badge = await page.evaluate(() => {
    const fwd = [...document.querySelectorAll('.content .pos-badge:not(.back)')][0]
    if (!fwd) return null
    const row = fwd.closest('tr') ?? fwd.parentElement
    let bg = 'rgba(0, 0, 0, 0)'
    for (let e = row; e && bg === 'rgba(0, 0, 0, 0)'; e = e.parentElement) bg = getComputedStyle(e).backgroundColor
    return { badge: getComputedStyle(fwd).backgroundColor, under: bg }
  })
  ok(!!badge && badge.badge !== badge.under, `day theme: a forward's position badge is not the colour of the row under it (${badge ? `${badge.badge} on ${badge.under}` : 'none'})`)
  await page.evaluate(() => { const S = window.rugbyStore; if (!S.getState().night) S.getState().toggleNight() })
} catch (e) {
  console.log(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close(); server.stop()
console.log(fails ? `\nUI QA PROBE FAILED (${fails})` : '\nUI QA PROBE PASSED: the faults the sweep fixed stay fixed')
process.exit(fails ? 1 : 0)
