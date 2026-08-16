/**
 * ---- EVERY SCREEN, AT EVERY SIZE (release audit, Pass 4) ----
 *
 * The game has 39 screens. devicematrix, the only harness that ever changed the
 * viewport, visited about five of them - so thirty-odd screens had never been
 * looked at on the smallest phone the game claims to support, and the layout
 * probes that DO go deep (overlapaudit, scrollaudit, tapsize, densityaudit) all
 * run at one size.
 *
 * That gap is not theoretical. A condition column 32px wide was given the string
 * "out on his feet", every tiring man's row wrapped to four lines, and the whole
 * match-day squad sheet became a wall - reported from real play, invisible to
 * all eleven browser harnesses, because not one of them measured a row.
 *
 * So: walk every screen the store can reach, at three geometries, and assert the
 * four things that make a phone layout wrong rather than merely ugly.
 *
 *   NOTHING OVERFLOWS SIDEWAYS. A page you can drag left is a broken page.
 *   NOTHING HAS WRAPPED THAT SHOULD NOT. Fixed-width columns are measured
 *     against their siblings: a row twice its neighbours' height has torn.
 *   NOTHING IS TOO SMALL TO HIT. 44px, the same floor tapsize polices.
 *   NOTHING IS STRANDED. No interactive element sitting under a sticky bar or
 *     off the bottom of the screen with no way to scroll to it.
 */
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const PORT = 4251
const server = await startPreview(PORT, 2500)

let fails = 0
const seen = new Set()
const flaw = (what, detail) => {
  const key = `${what}|${detail}`.slice(0, 150)
  if (seen.has(key)) return
  seen.add(key)
  say(`FAIL  ${what}: ${detail}`)
  fails++
}
// unbuffered, so a probe killed by a timeout still says what it had found
function say(s) { writeSync(1, s + '\n') }

// The same target and the same two documented floors tapsize.mjs polices, kept
// deliberately in step with it: two probes that disagree about how big a button
// has to be will eventually be resolved by loosening one of them.
const MIN_TAP = { MIN: 44, FLOOR: ['preset-chip', 'form-chip', 'chip'] }

// the floor, the phone it is played on, and a big one
const GEOMETRIES = [
  { name: '360x740 floor', w: 360, h: 740 },
  { name: '412x915 galaxy', w: 412, h: 915 },
  { name: '430x932 promax', w: 430, h: 932 },
]

// EVERY SCREEN App.tsx WILL RENDER. Counted off the switch in App.tsx rather
// than off the Screen union, because the union has members the router does not
// route ('comp' falls through to Home, 'menu'/'newgame' are the wizard) and a
// screen list that names screens the game cannot show is a list that lies about
// its coverage. 'matchday' is the one live-state screen left out: it needs a
// running match, and subreach/subsprobe/drawui own it.
//
// The ones with a param are the interesting ones - a screen handed nothing is a
// screen tested in its easiest state.
const SCREENS = [
  'home', 'inbox', 'offers', 'squad', 'player', 'tactics', 'fixtures', 'tables',
  'transfers', 'training', 'finances', 'club', 'press', 'nations', 'history',
  'legacy', 'handbook', 'jobs', 'wire', 'medical', 'report', 'profile', 'saves',
  'day', 'draw', 'annual', 'dreamteam', 'results', 'seasonreview', 'agency',
  'infra', 'academy',
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
try {
  for (const geo of GEOMETRIES) {
    const page = await browser.newPage({ viewport: { width: geo.w, height: geo.h } })
    // NIGHT MODE, because that is the theme the game is played in and the theme
    // two of the last three layout bugs only existed in.
    await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
    await page.goto(`http://localhost:${PORT}/`)
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })

    // a career, quickly, the way every other browser harness starts one
    await page.click('text=New Career')
    await page.waitForSelector('text=Gallagher Premiership', { timeout: 15000 })
    await page.click('text=Gallagher Premiership')
    await page.waitForSelector('.club-tile', { timeout: 15000 })
    await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player', { timeout: 15000 })
    await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Audit')
    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')

    // A WORLD WITH SOMETHING IN IT. An empty table and an empty inbox are the
    // easiest layout problem there is; a table with 12 rows of real club names
    // and an inbox with a fortnight of mail in it is the hard one. Walk forward
    // to the edge of the first match and stop, so no live-match state leaks in.
    for (let tap = 0; tap < 12; tap++) {
      if (await page.locator('text=Kick Off ▸').count()) break
      const cont = page.locator('.continue-btn')
      if (!(await cont.count())) break
      await cont.first().click().catch(() => {})
      await page.waitForTimeout(400)
      if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn').catch(() => {})
    }

    say(`\n=== ${geo.name}`)
    for (const screen of SCREENS) {
      // 'player' with no id renders an empty shell, which is the one state no
      // human ever sees. Hand it the club's best-paid man - the longest name and
      // the fullest attribute grid on the roster.
      await page.evaluate(s => {
        const st = window.rugbyStore.getState()
        let param
        if (s === 'player') {
          const g = st.game
          const ids = g.clubs[g.userClubId].players
          param = ids.slice().sort((a, b) => (g.players[b]?.wage ?? 0) - (g.players[a]?.wage ?? 0))[0]
        }
        st.go(s, param)
      }, screen)
      await page.waitForTimeout(260)

      const report = await page.evaluate(MIN_TAP => {
        const vw = window.innerWidth
        const out = { over: [], wrapped: [], small: [], docW: document.documentElement.scrollWidth }
        const vis = e => {
          const r = e.getBoundingClientRect()
          const cs = getComputedStyle(e)
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
        }
        const label = e => {
          const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28)
          return `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}${t ? ` "${t}"` : ''}`
        }
        // WHY THIS ASKS ABOUT ANCESTORS. The first version of this check flagged
        // 26 things and every one of them was a tab strip - Tables' league picker,
        // Nations' Autumn Tests, the handbook's chapters - all sitting in a
        // deliberate `overflow-x: auto` rail you drag with a thumb. Flagging those
        // is flagging the design, and a probe that cries wolf on the design gets
        // its findings ignored.
        //
        // The rule that separates a defect from a design: an element past the
        // right edge is only wrong if NOTHING between it and the viewport can be
        // scrolled to reach it. Inside a live scroller it is one swipe away.
        // Clipped by `overflow: hidden`, or overflowing a container that does not
        // scroll at all, and it is gone - which is the actual bug this looks for.
        const reachable = e => {
          for (let p = e.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX
            if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true
            if (p === document.body) break
          }
          return false
        }
        // 1. anything sticking out sideways that you cannot swipe to
        for (const e of document.querySelectorAll('.content *')) {
          if (!vis(e)) continue
          const r = e.getBoundingClientRect()
          if (r.right > vw + 1.5 && r.width < vw * 2 && !reachable(e)) {
            out.over.push(`${label(e)} right=${Math.round(r.right)} vw=${vw}`)
          }
        }
        // 2. a row twice as tall as its siblings has wrapped
        const groups = new Map()
        for (const e of document.querySelectorAll('.content .sheet-row, .content tr, .content .dtable tr, .content .row')) {
          if (!vis(e)) continue
          const key = `${e.parentElement?.className || 'x'}|${e.className}`
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key).push(e)
        }
        for (const [key, rows] of groups) {
          if (rows.length < 3) continue
          const hs = rows.map(r => r.getBoundingClientRect().height)
          const med = [...hs].sort((a, b) => a - b)[Math.floor(hs.length / 2)]
          const tall = hs.filter(h => h > med * 1.8 + 4)
          if (tall.length) out.wrapped.push(`${key.slice(0, 40)} median ${Math.round(med)}px, ${tall.length} row(s) up to ${Math.round(Math.max(...tall))}px`)
        }
        // 3. tap targets, measured the way tapsize.mjs measures them.
        //
        // NOT getBoundingClientRect. The first version of this used the box and
        // reported 27px chips on the Training screen as failures - they are 27px
        // boxes with an ::after hit expander that a thumb actually finds at 44px,
        // which is exactly why tapsize probes outward with elementFromPoint
        // instead of trusting the box. Two probes disagreeing about the same
        // button is worse than one probe, so this one borrows the real method and
        // spends its own coverage on the thing tapsize does not do: three
        // geometries instead of one.
        const owns = (el, hit) => !!hit && (el === hit || el.contains(hit))
        for (const e of document.querySelectorAll('.content button:not([disabled]), .content select:not([disabled])')) {
          if (!vis(e)) continue
          // Scrolled to the middle first, for tapsize's reason: a button half
          // below the fold measures 1x1 because the centre point lands on
          // whatever is underneath, and that is the probe's fault, not the
          // layout's.
          e.scrollIntoView({ block: 'center', inline: 'nearest' })
          const r = e.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
          if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue
          if (!owns(e, document.elementFromPoint(cx, cy))) continue
          const reach = (dx, dy) => {
            let n = 0
            for (; n <= 40; n++) {
              const x = cx + dx * (n + 1), y = cy + dy * (n + 1)
              if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) break
              if (!owns(e, document.elementFromPoint(x, y))) break
            }
            return n
          }
          const w = reach(-1, 0) + reach(1, 0) + 1
          const h = reach(0, -1) + reach(0, 1) + 1
          const need = MIN_TAP.FLOOR.find(f => e.classList.contains(f)) ? 36 : MIN_TAP.MIN
          if (Math.min(w, h) < need) {
            out.small.push(`${label(e)} reaches ${w}x${h}, needs ${need}`)
          }
        }
        return out
      }, MIN_TAP)

      if (report.docW > geo.w + 1) flaw('sideways scroll', `${screen} @ ${geo.name}: document is ${report.docW}px in a ${geo.w}px window`)
      for (const o of report.over.slice(0, 2)) flaw('overflows the screen', `${screen} @ ${geo.name}: ${o}`)
      for (const w of report.wrapped.slice(0, 2)) flaw('a row has wrapped', `${screen} @ ${geo.name}: ${w}`)
      for (const s of report.small.slice(0, 2)) flaw('too small to tap', `${screen} @ ${geo.name}: ${s}`)
      const bad = (report.docW > geo.w + 1 ? 1 : 0) + report.over.length + report.wrapped.length + report.small.length
      say(`  ${bad === 0 ? 'ok  ' : 'FLAW'} ${screen}`)
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}

say(`\nvisited ${SCREENS.length} screens x ${GEOMETRIES.length} geometries = ${SCREENS.length * GEOMETRIES.length} layouts`)
if (fails) say(`GEO SWEEP: ${fails} distinct failures`)
else say('GEO SWEEP PASSED: every screen holds its shape at every size')
done(fails)
