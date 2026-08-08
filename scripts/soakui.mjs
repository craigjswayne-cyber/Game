// ---- THE HOSTILE PLAYTHROUGH ----
//
// Every other harness in this repo tests one thing: e2e walks the screens once,
// the soak tests drive the ENGINE for twenty seasons with no browser attached,
// and the layout audits measure a screen that was navigated to directly. None of
// them plays the game.
//
// This one does. Five full seasons on the phone viewport the game is actually
// played on, pressing the button a real thumb presses and dealing with whatever
// appears, and after every single interaction it asks the questions a tester asks:
//
//   did anything reach the console
//   did the error boundary catch a render
//   is there a NaN, an undefined, an [object Object] or an Infinity on screen
//   is the screen blank
//   is the button still doing something, or has the game stopped moving
//   does a mid-season reload come back to the same career
//   do the numbers still add up after 200 weeks
//
// It is deliberately not a script of steps. It is a loop that looks at what is in
// front of it, and the only thing it insists on is that the week keeps advancing.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const SEASONS = Number(process.env.SOAK_SEASONS ?? 5)
const SHOTS = process.env.SHOTS_DIR || 'shots-soak'
mkdirSync(SHOTS, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', '4191', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
// the phone he plays on, in the orientation he plays in
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
// night mode, because that is what he plays in. Nothing else is preset: portrait
// needs no permission any more, and the clean-profile check below is what keeps
// it that way.
await page.addInitScript(() => {
  localStorage.setItem('rm-night', '1')
})

/** Every problem found, with enough context to fix it. */
const findings = []
const seen = new Set()
function flaw(kind, detail, where) {
  const key = `${kind}|${detail}`.slice(0, 160)
  if (seen.has(key)) return
  seen.add(key)
  findings.push({ kind, detail, where })
  console.log(`  !! ${kind}: ${detail}${where ? `  [${where}]` : ''}`)
}

const consoleErrors = []
page.on('console', m => {
  if (m.type() !== 'error') return
  const t = m.text()
  // a 404 for a favicon is not a game bug
  if (/favicon|manifest\.json|sw\.js/.test(t)) return
  consoleErrors.push(t)
})
page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))

const shot = async n => { await page.screenshot({ path: `${SHOTS}/${n}.png` }) }

/** Read the whole visible state in one round trip: cheap, and it is the only
 *  thing this loop does thousands of times. */
async function look() {
  return page.evaluate(() => {
    const txt = el => (el?.innerText ?? '').trim()
    const q = s => document.querySelector(s)
    return {
      crash: !!q('.crash'),
      crashMsg: txt(q('.crash-err')),
      saveWarn: !!q('.save-warn'),
      tut: !!q('.tut-box'),
      celebrate: !!q('.celebrate-veil'),
      talk: !!q('.talk-modal'),
      modal: !!q('.modal-veil'),
      rotate: !!q('.rotate-veil'),
      title: txt(q('.masthead h1')),
      date: txt(q('.masthead .date')),
      cont: txt(q('.continue-btn')),
      day: txt(q('.day-head .dh-day')),
      contentLen: (q('.content')?.innerText ?? '').trim().length,
      body: (q('.app')?.innerText ?? ''),
      // when the shell is missing there is no title to name the screen by, so
      // carry enough of a fingerprint to identify it from the log alone
      shell: !!q('.masthead'),
      live: !!q('.live-wrap'),
      root: (q('.app')?.className ?? '(no .app)'),
      firstLine: (q('.app')?.innerText ?? '').trim().split('\n').slice(0, 2).join(' | ').slice(0, 90),
      // every button a thumb could reach, so the loop can decide what to press
      buttons: [...document.querySelectorAll('button')]
        .filter(b => !b.disabled && b.offsetParent !== null)
        .map(b => (b.innerText || b.getAttribute('title') || '').trim())
        .filter(Boolean),
    }
  })
}

/** Hand the match to the assistant, wherever the chips happen to be.
 *
 *  The "how will you watch this one" chips are rendered twice, in the dressing
 *  room and in the ready check, and nowhere else - never on the preview. This is
 *  a tester's shortcut, not a workflow claim: five seasons of tick-by-tick
 *  commentary is tens of thousands of ticks, and the thing under test here is
 *  the week, not the pitch. */
async function pickAssistant() {
  const chip = page.locator('.preset-chip', { hasText: 'Assistant' }).first()
  if (!await chip.count()) return false
  await chip.click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(120)
  return true
}

/** The things that must never be on screen, whatever screen it is. */
const POISON = [
  [/\bNaN\b/, 'NaN on screen'],
  [/\bundefined\b/, 'the word undefined on screen'],
  [/\[object Object\]/, '[object Object] on screen'],
  [/\bInfinity\b/, 'Infinity on screen'],
  [/\bnull\b/, 'the word null on screen'],
  [/£NaN|£undefined/, 'a broken money figure'],
  [/NaN%|undefined%/, 'a broken percentage'],
]

let checks = 0
async function audit(v, where) {
  checks++
  if (v.crash) { flaw('CRASH', `the error boundary caught a render: ${v.crashMsg || 'no message'}`, where); return false }
  if (v.saveWarn) flaw('SAVE', 'the save-failure warning is showing', where)
  if (v.rotate) flaw('ROTATE', 'the rotate veil is blocking portrait play', where)
  for (const [re, what] of POISON) {
    const m = v.body.match(re)
    if (m) {
      // the surrounding words make it findable
      const i = v.body.indexOf(m[0])
      const ctx = v.body.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, ' ')
      flaw('TEXT', `${what}: "...${ctx}..."`, where)
    }
  }
  if (consoleErrors.length) {
    for (const e of consoleErrors.splice(0)) flaw('CONSOLE', e.slice(0, 200), where)
  }
  return true
}

/** Where the game thinks it is, straight out of the store. */
async function state() {
  return page.evaluate(() => {
    const w = window
    const g = w.__rmDebug?.()
    return g ?? null
  })
}

// ---------------------------------------------------------------- the run
let interactions = 0
let matchesPlayed = 0
let bulletins = 0
let reloads = 0
let screenVisits = 0
const weekTrail = []

try {
  await page.goto('http://localhost:4191/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await audit(await look(), 'title')

  // ---- a fresh install in portrait used to be met by a full-screen veil
  // telling the player to turn the phone round. That was found here and the veil
  // has gone; this is the tripwire that keeps it gone, measured on a profile
  // that has never answered the question.
  {
    const clean = await browser.newPage({ viewport: { width: 412, height: 915 } })
    await clean.goto('http://localhost:4191/')
    await clean.waitForTimeout(900)
    const veil = await clean.evaluate(() => !!document.querySelector('.rotate-veil'))
    if (veil) flaw('PORTRAIT-NAG', 'a first run in portrait is covered by the rotate-your-phone veil before anything can be touched', 'clean profile')
    await clean.close()
  }

  // ---- a real user starts a career
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership', { timeout: 15000 })
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile', { timeout: 15000 })
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player', { timeout: 15000 })
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Soak Tester')
  await page.click('.speech-tile >> nth=0')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })
  await audit(await look(), 'career start')
  await shot('00-start')

  /** Read the week and season out of the masthead date line: "MON 11 AUG · 2025-26 · WK 3" */
  const clock = async () => {
    const d = await page.evaluate(() => document.querySelector('.masthead .date')?.textContent ?? '')
    const wk = /WK\s*(\d+)/i.exec(d)
    const se = /(\d{4})-\d\d/.exec(d)
    return { week: wk ? Number(wk[1]) : null, seasonYear: se ? Number(se[1]) : null, raw: d }
  }

  const start = await clock()
  console.log(`start: ${start.raw}`)
  let seasonsDone = 0
  let lastYear = start.seasonYear
  let lastWeek = start.week
  let sinceProgress = 0
  // the week cannot move while a match is being played, so watching one gets its
  // own patience counter rather than counting against the stuck detector
  let livePatience = 0

  // every screen the rail can reach, checked periodically
  const HUB = ['Squad', 'Selection & Tactics', 'Fixtures & Results', 'Finances', 'Transfer Centre',
    'Medical Centre', 'Academy', 'Training & Staff', 'Club Infrastructure', 'Team Report']
  const MANAGER = ['Manager Profile', 'Press Room', 'Job Centre', 'Manager Legacy', "The Manager's Handbook", 'Save / Load Game']
  const WORLD = ['The Rugby Wire', 'Competitions', 'International Rugby', 'Team of the Week', 'Scouting Agency', 'Roll of Honour']

  async function sweepScreens(tag) {
    for (const [group, items] of [['Hub', HUB], ['Manager', MANAGER], ['World', WORLD]]) {
      for (const item of items) {
        try {
          await page.click(`.bottom-nav button[title="${group}"]`, { timeout: 4000 })
          await page.waitForSelector('.submenu-item', { timeout: 4000 })
          const has = await page.locator(`.submenu-item >> text=${item}`).count()
          if (!has) { await page.keyboard.press('Escape').catch(() => {}); continue }
          await page.click(`.submenu-item >> text=${item}`, { timeout: 4000 })
          await page.waitForTimeout(220)
          screenVisits++
          const v = await look()
          if (!await audit(v, `${tag} / ${item}`)) return false
          // a screen with nothing on it is a bug, not a state
          if (v.contentLen < 12) flaw('BLANK', `"${item}" rendered ${v.contentLen} characters`, tag)
          // and a screen whose tabs cannot be reached
          const tabs = await page.locator('.tab-bar button').count()
          for (let t = 0; t < Math.min(tabs, 6); t++) {
            await page.locator('.tab-bar button').nth(t).click({ timeout: 3000 }).catch(() => {})
            await page.waitForTimeout(120)
            const tv = await look()
            if (!await audit(tv, `${tag} / ${item} / tab ${t}`)) return false
            if (tv.contentLen < 12) flaw('BLANK', `"${item}" tab ${t} rendered ${tv.contentLen} characters`, tag)
          }
        } catch (e) {
          flaw('NAV', `could not reach "${item}": ${String(e).split('\n')[0].slice(0, 110)}`, tag)
        }
      }
    }
    await page.click('.bottom-nav button[title="Home"]').catch(() => {})
    await page.waitForTimeout(150)
    return true
  }

  await sweepScreens('week 1')

  // ---------------------------------------------------------- the main loop
  while (seasonsDone < SEASONS) {
    if (interactions > 40000) { flaw('STUCK', 'gave up after 40,000 interactions', 'main loop'); break }
    interactions++

    const v = await look()
    if (!await audit(v, `s${seasonsDone + 1} wk${lastWeek}`)) break

    // ---- clear whatever is in the way, in the order a thumb would
    if (v.tut) { await page.click('.tut-close .btn').catch(() => {}); await page.waitForTimeout(120); continue }
    if (v.celebrate) {
      // the celebration wants a tap to move on
      const btn = page.locator('.celebrate-veil button').first()
      if (await btn.count()) await btn.click().catch(() => {})
      else await page.click('.celebrate-veil').catch(() => {})
      await page.waitForTimeout(180)
      continue
    }
    if (v.talk) {
      await pickAssistant()
      await page.click('.talk-modal .speech-tile >> nth=0').catch(() => {})
      await page.waitForTimeout(250)
      continue
    }

    const has = t => v.buttons.some(b => b.includes(t))

    // ---- the match. Assistant + Instant Result: five seasons of full
    // commentary is forty thousand ticks and this is about the WORKFLOW.
    if (has('Kick Off') || has('Instant Result')) {
      // The big button opens the dressing room; the how-will-you-watch chips
      // live INSIDE it, not on the preview. Getting that order wrong is how the
      // first run of this harness sat through a hundred seconds of full
      // commentary and reported the match as frozen.
      const go = page.locator('button', { hasText: /Instant Result|Kick Off/ }).first()
      await go.click().catch(() => {})
      await page.waitForTimeout(250)
      await pickAssistant()
      const tl = page.locator('.talk-modal .speech-tile').first()
      if (await tl.count()) { await tl.click().catch(() => {}); await page.waitForTimeout(250) }
      // and the ready check, which carries its own copy of the chips
      await pickAssistant()
      for (const label of ['Let Him Take It', 'Take the Field']) {
        const b = page.locator('button', { hasText: label }).first()
        if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(200); break }
      }
      await page.waitForTimeout(400)
      matchesPlayed++
      continue
    }

    // ---- the screens that gate the week
    if (has('Continue to Results')) {
      await page.click('text=Continue to Results').catch(() => {})
      await page.waitForTimeout(300); continue
    }
    if (has('Back to the Dressing Room')) {
      await page.click('text=Back to the Dressing Room').catch(() => {})
      await page.waitForTimeout(250); continue
    }
    if (has('Next Story')) { await page.click('text=Next Story').catch(() => {}); await page.waitForTimeout(120); continue }
    if (has('On to the Week')) { await page.click('text=On to the Week').catch(() => {}); await page.waitForTimeout(180); continue }
    if (has('Skip the rest')) { await page.click('text=Skip the rest').catch(() => {}); await page.waitForTimeout(180); continue }

    // ---- an offer for one of your men must be answered before the week moves
    if (/Offers|Bids/i.test(v.title) || has('Reject') || has('Accept')) {
      const rej = page.locator('button', { hasText: /^Reject/ }).first()
      const acc = page.locator('button', { hasText: /^Accept/ }).first()
      if (await rej.count()) await rej.click().catch(() => {})
      else if (await acc.count()) await acc.click().catch(() => {})
      else await page.click('.continue-btn').catch(() => {})
      await page.waitForTimeout(220)
      continue
    }

    // ---- a day bulletin: read it and walk on
    if (v.day) {
      bulletins++
      // and read one of the day's stories now and then, which is the flow the
      // day screen exists for
      if (bulletins % 7 === 0) {
        const st = page.locator('.day-story').first()
        if (await st.count()) {
          await st.click().catch(() => {})
          await page.waitForTimeout(200)
          const wv = await look()
          if (!await audit(wv, 'wire from a bulletin')) break
          for (let i = 0; i < 4; i++) {
            const nx = page.locator('button', { hasText: /Next Story|On to the Week/ }).first()
            if (!await nx.count()) break
            await nx.click().catch(() => {})
            await page.waitForTimeout(120)
          }
          continue
        }
      }
    }

    // ---- a match is actually being watched. The live view is full screen by
    // design: no masthead, no back arrow, and for stretches of it no labelled
    // button either, because the ticker is running. That is not a dead end, so
    // let it run - but on its own patience counter, because the week cannot
    // move while a match is on and the ordinary stuck detector would cry wolf.
    if (v.live && !has('Continue to Results') && !has('Team Talk')) {
      livePatience++
      if (livePatience > 250) {
        flaw('FROZEN', `a live match sat for ${livePatience} looks without reaching an interval or full time`,
          `s${seasonsDone + 1} wk${lastWeek}`)
        await shot(`frozen-s${seasonsDone + 1}-w${lastWeek}`)
        break
      }
      await page.waitForTimeout(400)
      continue
    }
    livePatience = 0
    {
    // ---- otherwise: the button a thumb presses
    const cb = page.locator('.continue-btn')
    if (await cb.count()) {
      await cb.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(190)
    } else {
      // no Continue anywhere: this is the shape of a dead end
      const back = page.locator('.back-btn')
      if (await back.count()) { await back.click().catch(() => {}); await page.waitForTimeout(150) }
      else {
        flaw('DEADEND', `no Continue and no back button. shell=${v.shell} root="${v.root}" top="${v.firstLine}" buttons: ${v.buttons.slice(0, 8).join(' / ')}`,
          `s${seasonsDone + 1} wk${lastWeek}`)
        await shot(`deadend-s${seasonsDone + 1}-w${lastWeek}`)
        await page.click('.bottom-nav button[title="Home"]').catch(() => {})
        await page.waitForTimeout(200)
      }
    }
    }

    // ---- has the game actually moved?
    const c = await clock()
    if (c.week != null && (c.week !== lastWeek || c.seasonYear !== lastYear)) {
      if (c.seasonYear !== lastYear) {
        seasonsDone++
        console.log(`  --- season ${seasonsDone} done, now ${c.raw} (${interactions} taps, ${matchesPlayed} matches)`)
        await shot(`season-${seasonsDone}`)
        // a full sweep of every screen at each season boundary, when the world
        // has history in it and the tables are full
        if (!await sweepScreens(`season ${seasonsDone} rollover`)) break
        // and a reload, because a phone reloads tabs whenever it feels like it
        await page.reload()
        await page.waitForTimeout(1200)
        reloads++
        const rv = await look()
        if (!await audit(rv, `reload after season ${seasonsDone}`)) break
        if (/RUGBY MANAGER/i.test(rv.title) || !rv.title) {
          flaw('RESUME', `a reload after season ${seasonsDone} dropped to the title screen`, 'reload')
          // get back in so the run can continue
          await page.click('text=Continue -').catch(() => {})
          await page.waitForTimeout(800)
        }
      }
      weekTrail.push(`${c.seasonYear}w${c.week}`)
      // a heartbeat, so a run that is merely slow can be told apart from a run
      // that has quietly stopped moving
      if (c.week % 6 === 0) {
        console.log(`  .. ${c.raw} (${interactions} taps, ${matchesPlayed} matches, ${bulletins} bulletins)`)
      }
      lastWeek = c.week
      lastYear = c.seasonYear
      sinceProgress = 0
    } else {
      sinceProgress++
      if (sinceProgress > 60) {
        const sv = await look()
        flaw('STUCK', `60 taps without the week moving on "${sv.title}" (buttons: ${sv.buttons.slice(0, 6).join(' / ')})`,
          `s${seasonsDone + 1} wk${lastWeek}`)
        await shot(`stuck-s${seasonsDone + 1}-w${lastWeek}`)
        break
      }
    }
  }

  console.log(`\nplayed ${seasonsDone} season(s): ${interactions} interactions, ${matchesPlayed} matches, ${bulletins} bulletins, ${screenVisits} screen visits, ${reloads} reloads, ${checks} audits`)
  if (seasonsDone < SEASONS) flaw('SHORT', `only reached ${seasonsDone} of ${SEASONS} seasons`, 'main loop')

  // ---- the week is supposed to be revealed a day at a time, and this run plays
  // every match through the assistant. The first time it ran, it produced 30
  // bulletins across 36 weeks: the instant result was pushing the whole week's
  // stories into the Wire the moment the final whistle blew, so Monday to Friday
  // had nothing left to carry and Continue jumped from one match to the next.
  // The engine's own day probe measures 3.1 bulletins a week, so anything near
  // one a week means something upstream is eating them again.
  const weeksPlayed = weekTrail.length
  const perWeek = weeksPlayed ? bulletins / weeksPlayed : 0
  console.log(`bulletins per week: ${perWeek.toFixed(2)} over ${weeksPlayed} weeks`)
  if (weeksPlayed >= 40 && perWeek < 1.6) {
    flaw('DAY-WALK', `only ${perWeek.toFixed(2)} bulletins a week over ${weeksPlayed} weeks - the day reveal is being bypassed`, 'whole run')
  }

  // ---- the save survives a round trip after all that
  await page.click('.bottom-nav button[title="Manager"]').catch(() => {})
  await page.click('.submenu-item >> text=Save / Load Game').catch(() => {})
  await page.waitForTimeout(400)
  const sv = await look()
  await audit(sv, 'save screen after the run')
  await shot('99-saves')
} catch (e) {
  flaw('THREW', String(e).split('\n').slice(0, 2).join(' ').slice(0, 300), 'harness')
} finally {
  for (const e of consoleErrors.splice(0)) flaw('CONSOLE', e.slice(0, 200), 'end of run')
  writeFileSync(`${SHOTS}/findings.json`, JSON.stringify(findings, null, 2))
  await browser.close()
  server.kill()
}

console.log(`\n${'='.repeat(64)}`)
if (!findings.length) {
  console.log('SOAK UI PASSED: five seasons played, nothing broke')
} else {
  const byKind = {}
  for (const f of findings) (byKind[f.kind] ??= []).push(f)
  console.log(`SOAK UI FOUND ${findings.length} PROBLEM(S)`)
  for (const [k, list] of Object.entries(byKind)) {
    console.log(`\n${k} (${list.length}):`)
    for (const f of list.slice(0, 12)) console.log(`  - ${f.detail}${f.where ? `  [${f.where}]` : ''}`)
    if (list.length > 12) console.log(`  ... and ${list.length - 12} more`)
  }
}
process.exit(findings.length ? 1 : 0)
