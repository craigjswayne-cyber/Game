/**
 * ---- THE FIRST TEN MINUTES (release audit, Pass 8) ----
 *
 * The pass that decides a refund. Every other browser harness in this suite
 * drives the game with inside knowledge: it knows the club tile is `.tile`, it
 * knows Confirm is in `.action-bar`, and when a screen is confusing it sails
 * straight through because it was told the answer. That makes eleven probes that
 * cannot see a discoverability bug, by construction.
 *
 * So this one is deliberately ignorant. It presses THE MOST OBVIOUS THING on
 * screen and nothing else:
 *
 *   1. the Continue button, if there is one - the game says it is the game
 *   2. else the biggest gold button, which is how this UI marks "forward"
 *   3. else, if the screen offers a list of things to choose from and no way
 *      forward, it picks the first one and RECORDS THAT AS A DECISION POINT
 *
 * It never calls go(). It never uses a selector that names a screen. Every step
 * it takes is logged with what it saw and what it pressed, so the output IS the
 * new-player walkthrough Pass 8 asks for, and a regression shows up as the walk
 * getting longer or stalling somewhere it used to pass.
 *
 * WHAT IT FOUND, first run: all three gated wizard steps disabled the forward
 * button with no title, no label and no message anywhere on the screen. A gate
 * is fine. A silent gate on step 3 of 4 of the first thing a stranger ever does
 * is indistinguishable from a frozen game, and no amount of unit testing sees
 * it, because the code is behaving exactly as written.
 */
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// A stranger has patience, but not infinite patience. If the walk from the title
// screen to a live match takes more than this many taps, something in the middle
// is asking too much of somebody who has not read anything.
const TAP_BUDGET = 30

const server = await startPreview(4256, 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/**
 * A BRAND NEW PHONE, every time.
 *
 * This probe walks the new-player path three times, and the first version reused
 * one page and navigated back to the title screen between walks. It then sat for
 * thirty seconds waiting for a "New Career" button that was never coming - once
 * a career exists the title screen leads with Continue, which is exactly the
 * behaviour Round FF added on purpose. A stranger's second look at this game is
 * not a stranger's first look, so each walk gets its own context with its own
 * empty IndexedDB.
 *
 * 412x740 is the usable height of the phone this is played on once browser
 * chrome is on the screen. Night mode, because that is how it is played.
 */
let page
const freshPhone = async () => {
  if (page) await page.context().close()
  const ctx = await browser.newContext({ viewport: { width: 412, height: 740 } })
  await ctx.addInitScript(() => localStorage.setItem('rm-night', '1'))
  page = await ctx.newPage()
  await page.goto('http://localhost:4256/')
  await page.waitForTimeout(1200)
}

/** What is on screen, and what a newcomer would take to be the way forward. */
const survey = () => page.evaluate(() => {
  const vis = e => {
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && Number(cs.opacity) > 0.05
  }
  const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim()
  const area = e => { const r = e.getBoundingClientRect(); return r.width * r.height }
  const desc = e => `${txt(e).slice(0, 30)}`

  // Anything a thumb could press, split by whether it is disabled - because a
  // greyed control is the thing this probe is most interested in.
  const all = [...document.querySelectorAll('button, [role=button]')].filter(vis)
  const live = all.filter(e => !e.disabled)
  const dead = all.filter(e => e.disabled)

  // A DISABLED CONTROL MUST EXPLAIN ITSELF. Either it carries a title/aria, or
  // the bar it sits in says what is missing. Anything else is a silent gate.
  const silent = dead.filter(e => {
    if (e.title || e.getAttribute('aria-label')) return false
    const bar = e.closest('.action-bar, .btn-row, .tut-close')
    const barText = bar ? txt(bar) : ''
    const buttons = bar ? [...bar.querySelectorAll('button')].map(txt).join(' ') : ''
    // the bar says more than just its own button labels -> it is explaining
    return barText.replace(buttons, '').trim().length < 4
  }).map(desc)

  const gold = live.filter(e => e.classList.contains('gold')).sort((a, b) => area(b) - area(a))
  const cont = live.filter(e => e.classList.contains('continue-btn'))
  // a modal is a modal: if a veil is up, only what is inside it counts
  const veil = document.querySelector('.tut-veil, .talk-modal, .modal-veil')

  return {
    screen: window.rugbyStore?.getState().nav.at(-1)?.screen ?? '(pre-store)',
    head: txt(document.querySelector('.content h2, .content h3, .masthead') || document.body).slice(0, 44),
    live: live.length, dead: dead.length, silent,
    hasContinue: cont.length > 0,
    goldest: gold[0] ? desc(gold[0]) : null,
    modal: !!veil,
    scoreboard: !!document.querySelector('.scoreboard'),
    choices: live.filter(e => /tile|club-pick|speech-tile|challenge-card/.test(
      typeof e.className === 'string' ? e.className : '')).map(desc).slice(0, 3),
  }
})

/**
 * Press the most obvious thing, and say what that was.
 *
 * A short click timeout on purpose. The first version used the default 30s and
 * crashed the whole probe when a veil intercepted a click - which threw away
 * every finding it had already made and told me nothing about what was on
 * screen. A probe whose job is to report where a stranger gets stuck must
 * survive getting stuck.
 */
const tap = async (sel, what) => {
  const l = page.locator(sel).first()
  if (!(await l.count())) return null
  try { await l.click({ timeout: 4000 }); return what } catch { return null }
}

const pressObvious = async s => {
  // A MODAL BLOCKS EVERYTHING, so the stranger's whole world is inside it. The
  // first version looked for the modal's buttons by three hand-picked selectors,
  // missed the one the team talk actually uses, and then went and clicked
  // Continue underneath the veil - where it sat for thirty seconds being told
  // "modal-veil intercepts pointer events".
  if (s.modal) {
    for (const [sel, what] of [
      ['.tut-close .btn', 'the tutorial closed'],
      ['.modal-veil .speech-tile, .talk-modal .speech-tile, .tut-veil .speech-tile', 'a line from the modal'],
      ['.modal-veil .btn.gold, .talk-modal .btn.gold, .tut-veil .btn.gold', 'the modal on'],
      ['.modal-veil .btn, .talk-modal .btn, .tut-veil .btn', 'the modal away'],
    ]) {
      const did = await tap(sel, what)
      if (did) return did
    }
    return null
  }
  if (s.hasContinue) {
    const did = await tap('.continue-btn', 'Continue')
    if (did) return did
  }
  if (s.goldest) {
    const did = await tap('button.gold:visible', `the gold button ("${s.goldest}")`)
    if (did) return did
  }
  // no way forward offered: this screen wants a decision
  if (s.choices.length) {
    const did = await tap('.tile:visible, .club-pick:visible, .speech-tile:visible',
      `a choice ("${s.choices[0]}") - THE SCREEN ASKED`)
    if (did) return did
  }
  return null
}

const decisions = []
let taps = 0
let reached = false
try {
  await freshPhone()
  say('\n=== THE WALK: title screen to kick-off, pressing only the obvious\n')

  for (; taps < TAP_BUDGET; taps++) {
    const s = await survey()
    if (s.scoreboard) { reached = true; break }
    // the name field is the one thing a stranger has to TYPE rather than press,
    // and the wizard cannot go on without it - so typing counts as a step and is
    // reported as one.
    const nameBox = page.locator('input[placeholder="e.g. A. Gaffer"]:visible')
    if (await nameBox.count() && !(await nameBox.inputValue())) {
      say(`  ${String(taps + 1).padStart(2)}. ${s.screen.padEnd(9)} "${s.head}" -> typed a name into the one field on screen`)
      if (s.silent.length) decisions.push({ at: s.screen, head: s.head, silent: s.silent })
      await nameBox.fill('Stranger')
      await page.waitForTimeout(350)
      continue
    }
    const did = await pressObvious(s)
    if (!did) {
      say(`  ${String(taps + 1).padStart(2)}. ${s.screen.padEnd(9)} "${s.head}" -> STALLED: ${s.live} live controls, none of them reads as forward`)
      break
    }
    say(`  ${String(taps + 1).padStart(2)}. ${s.screen.padEnd(9)} "${s.head}" -> pressed ${did}`)
    if (s.silent.length) decisions.push({ at: s.screen, head: s.head, silent: s.silent })
    await page.waitForTimeout(500)
  }

  say('')
  ok(reached, `a stranger reaches a live match in ${taps} taps, pressing only the obvious control (budget ${TAP_BUDGET})`)

  // ---- THE SILENT GATES -------------------------------------------------
  if (decisions.length) {
    say('\n  greyed controls that never said what they wanted:')
    for (const d of decisions) say(`    ${d.at}: ${d.silent.join(', ')}   on "${d.head}"`)
  }
  ok(decisions.length === 0, 'no screen on the new-player path offers a greyed control without saying why')

  // ---- THE WIZARD GATES, EACH ONE ON ITS OWN ---------------------------
  // Walked forwards a second time, this time deliberately NOT satisfying each
  // gate, because the greedy walk above satisfies them by accident.
  say('\n=== THE GATES: reach each one and refuse to feed it\n')
  await freshPhone()
  await page.click('text=New Career')
  await page.waitForTimeout(500)
  const gateSays = () => page.evaluate(() => {
    const bar = document.querySelector('.action-bar')
    const fwd = bar ? [...bar.querySelectorAll('button')].at(-1) : null
    const need = bar?.querySelector('.wiz-need')
    return {
      blocked: !!fwd?.disabled,
      title: fwd?.title || '',
      line: need ? (need.textContent || '').trim() : '',
    }
  })
  const gates = [
    ['step 1, no competition chosen', async () => {}],
    ['step 2, no club chosen', async () => { await page.click('text=English Premier Division'); await page.waitForTimeout(400) }],
    ['step 3, no name typed', async () => {
      await page.click('.tile >> text=Northampton'); await page.waitForTimeout(300)
      await page.locator('.action-bar button').last().click(); await page.waitForTimeout(400)
    }],
  ]
  for (const [label, walk] of gates) {
    await walk()
    const g = await gateSays()
    const explained = g.line.length > 3 || g.title.length > 3
    ok(g.blocked && explained,
      `${label}: forward is held${g.blocked ? '' : ' (NOT HELD)'} and says "${g.line || g.title || '(nothing)'}"`)
  }

  // ---- IS THE FIRST MATCH COMPREHENSIBLE? -------------------------------
  say('\n=== THE FIRST MATCH: can a newcomer read it?\n')
  await freshPhone()
  for (let i = 0; i < TAP_BUDGET; i++) {
    const s = await survey()
    if (s.scoreboard) break
    const nb = page.locator('input[placeholder="e.g. A. Gaffer"]:visible')
    if (await nb.count() && !(await nb.inputValue())) { await nb.fill('Stranger'); await page.waitForTimeout(300); continue }
    if (!(await pressObvious(s))) break
    await page.waitForTimeout(500)
  }
  // LET THE BALL BE KICKED FIRST. The walk above stops the moment a scoreboard
  // exists, and at that instant the board reads "AWAITING KICK-OFF" with an
  // empty ticker - so the first version of this check reported "nothing on the
  // page is describing what is happening" and it was measuring a match that had
  // not started. Play on until the clock moves, which is what a newcomer would
  // sit and watch happen.
  for (let i = 0; i < 25; i++) {
    const min = await page.evaluate(() => {
      const t = (document.querySelector('.scoreboard')?.textContent || '')
      const m = t.match(/(\d+)'/)
      return m ? Number(m[1]) : 0
    })
    if (min > 0) break
    await page.waitForTimeout(700)
  }
  const m = await page.evaluate(() => {
    const t = e => (e?.textContent || '').replace(/\s+/g, ' ').trim()
    const sb = document.querySelector('.scoreboard')
    return {
      board: t(sb),
      // two sides named, a score, and a clock: the three things a scoreboard is for
      names: (t(sb).match(/[A-Z][a-z]+/g) || []).length,
      digits: (t(sb).match(/\d+/g) || []).length,
      // ANY PROSE ON THE LIVE SCREEN, found the way the rest of this probe works
      // things out: by looking, not by knowing a class name. The first version
      // asked for `.ticker.panel-area` and got an empty string, because that box
      // only holds the stoppage panels - the running commentary lives elsewhere,
      // and a stranger neither knows nor cares which. So: the longest sentence in
      // a leaf element anywhere on the page.
      commentary: [...document.querySelectorAll('*')]
        .filter(e => e.children.length === 0)
        .map(e => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(s => s.length > 25 && s.length < 200 && / [a-z]/.test(s))
        .sort((a, b) => b.length - a.length)[0] ?? '',
      advance: [...document.querySelectorAll('button:not([disabled])')]
        .filter(b => { const r = b.getBoundingClientRect(); return r.width > 2 && r.height > 2 })
        .map(b => t(b)).filter(s => s.length && s.length < 20).slice(0, 8),
    }
  })
  say(`  scoreboard: ${m.board.slice(0, 80)}`)
  say(`  commentary: ${m.commentary}`)
  say(`  controls:   ${m.advance.join(' | ')}`)
  ok(m.names >= 2, `the scoreboard names both sides (${m.names} words found)`)
  ok(m.digits >= 2, `and shows numbers for the score and the clock (${m.digits} found)`)
  ok(m.commentary.length > 20, 'something on the page is describing what is happening')
  ok(m.advance.length > 0, `and there is a visible control to move the game on (${m.advance.length})`)
} finally {
  await browser.close()
  server.stop()
}

say(fails ? `\n${fails} FAILURES` : '\nSTRANGER PATH PASSED: the first ten minutes explain themselves')
done(fails)
