// Scroll audit (user: "reduce scrolling across the whole game - more pages,
// fit stuff into one clean screen"). Walks every screen at the phone's
// landscape size and measures how many screenfuls each one is.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4177', 2500)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const rows = []

const measure = async (name) => {
  await page.waitForTimeout(350)
  const m = await page.evaluate(() => {
    const el = document.querySelector('main.content') ?? document.scrollingElement
    return { h: el.scrollHeight, v: el.clientHeight }
  })
  rows.push({ name, screens: m.h / m.v, h: m.h, v: m.v })
}

try {
  await page.goto('http://localhost:4177/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('[data-league="prem"]')
  await page.click('[data-league="prem"]')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await measure('wizard: club pick')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Audit Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await measure('wizard: manager')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  // The club is "Leicester RFC" since the IP rename; matching on the
  // prefix rather than the full name so the next rename does not kill
  // three harnesses in one go.
  await page.waitForSelector('text=Welcome to Leicester', { timeout: 15000 })
  await measure('home')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.xv-split')
  await measure('team: selection')
  await page.click('.tab-bar >> text=General Info')
  await page.waitForTimeout(300)
  await measure('squad')
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Attributes')
  await measure('player: profile')
  await page.click('.tab-bar >> text=Attributes')
  await page.waitForSelector('text=Set Piece & Contact')
  await measure('player: attributes')
  await page.click('.back-btn')

  // A MAN AT ANOTHER CLUB (1.8.2): the scout report card sits on his profile
  // with the fee talks under it, so his page is the one the report can deepen.
  // Fully scouted, so every row of the report is filled in.
  await page.evaluate(() => {
    const S = window.rugbyStore.getState(); const g = S.game
    const p = Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && !q.acad && q.age <= 22 && q.ca >= 65)
    p.sc = 95
    if (!g.shortlist.includes(p.id)) g.shortlist.push(p.id)
    S.touch(); S.go('player', p.id)
  })
  await page.waitForSelector('.scout-report')
  await measure('player: scouted, another club')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Tactics')
  await page.waitForSelector('.tab-bar')
  await measure('tactics: roles')
  for (const [tab, label] of [['Bench', 'bench'], ['Prep', 'match prep'], ['Game Plan', 'game plan']]) {
    await page.click(`.tab-bar >> text=${tab}`)
    await measure(`tactics: ${label}`)
  }
  // THE SET PIECE TAB was never measured here, and grew to 6.8 screenfuls in
  // landscape (4.5 portrait) once the attacking moves joined it in 1.8.1
  // before anyone counted. 1.8.2 split it into three views behind a segmented
  // control ([data-sp-sub] in screens/Tactics.tsx); each view is a fixed page
  // and is held to the same limit as every other, in landscape here and on a
  // portrait phone as well, since the tab is laid out differently in each.
  // The portrait rows are added at the end of the walk (setPieceViews below)
  // so the landscape session is not resized under the screens after it.
  await page.click('.tab-bar >> text=Set Piece')
  await page.waitForSelector('[data-sp-sub]')
  const spViews = await page.$$eval('[data-sp-sub]', bs => bs.map(b => b.dataset.spSub))
  if (spViews.length !== 3) console.error(`SCROLL AUDIT: expected three set piece views, found ${spViews.length}`)
  for (const v of spViews) {
    await page.click(`[data-sp-sub="${v}"]`)
    await measure(`tactics: set piece ${v}`)
  }
  await page.click(`[data-sp-sub="${spViews[0]}"]`)

  const clubItems = [
    ['Team Report', 'team report'],
    ['Medical Centre', 'medical centre'],
    ['Fixtures & Results', 'fixtures'],
    ['Finances', 'finances'],
    ['Transfer Centre', 'transfers'],
    ['Training & Staff', 'training'],
    ['Club Infrastructure', 'infrastructure'],
    ['Club Information', 'club information'],
  ]
  for (const [item, label] of clubItems) {
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
    // Training carries the development list (see LISTS below), so the page as
    // a whole is a list; what it shows BEFORE the list is fixed and is still
    // policed, measured to the top of the card that holds the rows
    if (label === 'training') {
      const m = await page.evaluate(() => {
        const el = document.querySelector('main.content') ?? document.scrollingElement
        const card = document.querySelector('[data-dev-row]')?.parentElement
        if (!card) return null
        return { h: card.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop, v: el.clientHeight }
      })
      if (m) rows.push({ name: 'training: above the list', screens: m.h / m.v, h: m.h, v: m.v })
      else console.error('SCROLL AUDIT: the development list was not found on the training page')
    }
  }

  await page.click('.bottom-nav button[title="Manager"]')
  await page.click(".submenu-item >> text=The Manager's Handbook")
  await page.waitForSelector('text=the eighty minutes and the hour before it')
  await measure('handbook')

  // the press room and the job centre belong to the manager, not to the team
  // sheet: he is the one in front of the cameras and the one being courted
  for (const [item, label] of [['Press Room', 'press room'], ['Job Centre', 'job centre']]) {
    await page.click('.bottom-nav button[title="Manager"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }

  // 'The Rugby Wire' was here: merged into the News screen, which the rail
  // reaches directly, so the World group no longer carries a news item.
  const worldItems = [
    ['Team of the Week', 'team of the week'],
    ['Scouting Agency', 'scouting agency'],
    ['Competitions', 'competitions'],
    ['International Rugby', 'international rugby'],
    ['Roll of Honour', 'roll of honour'],
  ]
  for (const [item, label] of worldItems) {
    await page.click('.bottom-nav button[title="World"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }

  // the set piece views again, on a portrait phone (portraitqa's 412x915)
  await page.setViewportSize({ width: 412, height: 915 })
  await page.evaluate(() => window.rugbyStore.getState().go('tactics'))
  await page.waitForSelector('.tab-bar')
  await page.click('.tab-bar >> text=Set Piece')
  await page.waitForSelector('[data-sp-sub]')
  for (const v of await page.$$eval('[data-sp-sub]', bs => bs.map(b => b.dataset.spSub))) {
    await page.click(`[data-sp-sub="${v}"]`)
    await measure(`tactics: set piece ${v} (portrait)`)
  }
} catch (e) {
  console.error('SCROLL AUDIT stopped early:', e.message)
} finally {
  // Long lists are meant to scroll: a 42-man squad, a whole season of
  // fixtures, every club in the world. The screens worth policing are the ones
  // that present a fixed amount of information and should fit in a glance or
  // two.
  //
  // This used to add "they all keep a sticky column header, so the scroll costs
  // nothing", which was an assumption and a wrong one: .tblwrap's overflow-x
  // made the wrapper the table's scrollport, so the header had nothing to stick
  // to and scrolled away with the rows. scripts/stickyaudit.mjs now measures it
  // rather than asserting it in a comment.
  // 'home' belongs here for the same reason: it is the inbox. Everything above
  // the feed - the fixture, the hub widgets, the dashboard panels - measures
  // 1.4 screenfuls, and the rest is however many headlines the week produced.
  // Policing the total would only ever mean showing fewer of them.
  // 'handbook' joins them: it is a searchable index of 49 topics, and the only
  // way to shorten it is to write about less of the game.
  //
  // 'tactics: selection' joins them too, and this one was argued out with the
  // measurements rather than waved through. It is 816px on a 390px screen:
  // tab bar 42, heading 34, the starting XV 309 (fifteen men, already two-up at
  // 38px a row), the bench 182 (eight men, also two-up) and the Leadership card
  // 225. That is 23 named players plus the armband on one page, and the obvious
  // compression was tried and reverted: putting the bench beside Leadership
  // saved 154px but gave four columns of team-sheet data across a 756px content
  // area, 191px each, and the tables painted over each other (see the .sel-split
  // note in theme.css). A bench you cannot read is worse than one more swipe.
  // The only remaining fat is ~50px of static help text, and shaving that to
  // land at 1.97 would be gaming the threshold, not improving the screen.
  //
  // 'training' joins them in 1.8.0, on the owner's word rather than as a
  // shortcut: the development focus list used to be ten names, and he asked
  // for "more so I can select any player who reaches the criteria"
  // (DevelopmentPanel.tsx), so it now lists every qualifying man with a
  // search and a forwards/backs filter, 52px a row. With 53 who qualify at
  // Leicester that is 2,759px of the page's 3,345 (10.2 screenfuls at 844x390,
  // 6.3 at 412x740). Folding it back to ten would undo what was asked for.
  // Everything above the list - the tab bar, the weekly focus, the list's own
  // tabs, the rule card and the filters - is measured on its own as
  // 'training: above the list' and held to the same limits as any fixed page.
  const LISTS = new Set(['squad', 'fixtures', 'transfers', 'scouting agency', 'international rugby', 'home', 'handbook', 'tactics: selection', 'training'])
  rows.sort((a, b) => b.screens - a.screens)
  console.log('\nscreenfuls  screen')
  for (const r of rows) {
    const list = LISTS.has(r.name)
    const flag = list ? ' (list)' : r.screens >= 3 ? ' ‼' : r.screens >= 2 ? ' !' : ''
    console.log(`${r.screens.toFixed(2).padStart(8)}    ${r.name}${flag}`)
  }
  const over = rows.filter(r => !LISTS.has(r.name) && r.screens >= 2)
  console.log(`\n${rows.length} screens measured, ${over.length} page${over.length === 1 ? '' : 's'} over two screenfuls`)
  // QA-GATE-01 (1.6.5): this was a WARN followed by exit(0), so a page could
  // grow without limit and the suite stayed green. Finances (3.30) and the
  // game plan (3.04) are the two known deep pages, carried as design debt;
  // any OTHER fixed page reaching three screenfuls, or either of those
  // reaching four, fails the audit.
  // Finances (3.30) and the game plan (3.04) were the two known deep pages
  // until 1.6.5 moved the board ask and the opposition reading to their own
  // tabs and folded the ledger and the earners: 2.2 and 2.6 now. No fixed
  // page is allowed three screenfuls.
  // 1.7.1: the campus map (5.09) and the game plan (3.41) both went over on
  // the same day and were both landscape faults rather than content faults -
  // a portrait 768x1024 plate sized off the page WIDTH, and six dials stacked
  // in one column across an 844px screen. .campus-frame caps the map against
  // the viewport height and .dial-grid pairs the dials up; portrait renders
  // exactly as before in both cases. 2.90 and 2.56 now. The estate page is
  // the closest to the line of anything here, so read that number before
  // adding a row to it.
  const deep = over.filter(r => r.screens >= 3)
  for (const r of deep) console.log(`FAIL: ${r.name} is ${r.screens.toFixed(2)} screenfuls deep`)
  // and the set piece views must actually have been measured, both ways up:
  // a renamed tab or view would otherwise pass by measuring nothing
  const spRows = ['calls', 'moves', 'kicking'].flatMap(v => [`tactics: set piece ${v}`, `tactics: set piece ${v} (portrait)`])
  const missing = spRows.filter(n => !rows.some(r => r.name === n))
  for (const n of missing) console.log(`FAIL: ${n} was not measured`)
  await browser.close()
  server.stop()
  process.exit(deep.length || missing.length ? 1 : 0)
}
