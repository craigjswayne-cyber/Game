// ---- THE SET PIECE, BENCH AND PREP PAGES, DRAWN (1.8.0) ----
//
// Owner: "I want to work on Set Piece / Bench & Prep... I want them to be
// more visual." Each call on those pages now carries a whiteboard picture
// (src/ui/tacticsArt.tsx), the bench is drawn as the 23, and the week's
// preparation is five cards. A redraw like that is exactly how an option
// quietly stops working, so this probe holds four things:
//
//   EVERY OPTION STILL TAKES. Each lineout and scrum call, exit, kicking
//     style, penalty call, bench split, bench brief and preparation focus is
//     tapped, and the club's tactic (or game.matchPrep) must then hold that
//     id, the tapped control must say so (.sel / .on and aria-pressed), and
//     no other control in its group may. The goal-kicker select is set too.
//   AND IS SAVED. The last choices are written with persistNow(), the page is
//     reloaded, and the career that comes back must carry them.
//   THE PICTURES ARE THERE. Every call and option button holds an inline SVG
//     diagram with real content, the 23 shows fifteen shirts and eight seats,
//     each seat shows its brief as an icon, and no emoji is left in the
//     briefs.
//   IT FITS. At 412 and 360 wide and in tablet mode: no sideways scroll, no
//     label clipped inside its own box, no two names on the 23 overlapping,
//     and no console errors anywhere along the way.
//
// Screenshots go to $SHOTS (default /tmp/setpieceui) for a human look.
// Run: npm run build && node scripts/setpieceui.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const SHOTS = process.env.SHOTS ?? '/tmp/setpieceui'
mkdirSync(SHOTS, { recursive: true })
const PORT = 4323
const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

async function career(page) {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
}

const tab = async (page, i) => {
  await page.evaluate(() => window.rugbyStore.getState().go('tactics'))
  await page.waitForSelector('.tab-bar')
  await page.locator('.tab-bar button').nth(i).click()
  await page.waitForTimeout(150)
}
const tac = page => page.evaluate(() => { const g = window.rugbyStore.getState().game; return g.clubs[g.userClubId].tactic })

/** No sideways scroll, and no label clipped by its own box. */
async function fits(page, label, sel) {
  const r = await page.evaluate(sel => {
    const doc = document.documentElement
    const clipped = [...document.querySelectorAll(sel)].filter(el => {
      if (!el.offsetParent) return false
      return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
    }).map(el => el.textContent.trim().slice(0, 30))
    // a button's content must stay inside the button
    const spill = [...document.querySelectorAll('.sp-call, .sp-card, .prep-card, .b23-seat, .split-grid .speech-tile')].filter(b => {
      const br = b.getBoundingClientRect()
      return [...b.querySelectorAll('b, .d, svg, .b23-sname, .b23-brief')].some(c => {
        const cr = c.getBoundingClientRect()
        return cr.width && (cr.left < br.left - 1 || cr.right > br.right + 1 || cr.bottom > br.bottom + 1)
      })
    }).map(b => b.textContent.trim().slice(0, 30))
    return { over: doc.scrollWidth - doc.clientWidth, clipped, spill }
  }, sel)
  ok(r.over <= 0, `${label}: no sideways scroll (${r.over}px over)`)
  ok(r.clipped.length === 0, `${label}: no label clipped${r.clipped.length ? ` (${r.clipped.join(' | ')})` : ''}`)
  ok(r.spill.length === 0, `${label}: every picture and label stays inside its button${r.spill.length ? ` (${r.spill.join(' | ')})` : ''}`)
}

const TEXT = '.sp-txt b, .sp-txt .d, .sp-card b, .prep-card b, .prep-card .d, .b23-sname, .b23-brief, .brief-key-row span, .bclock .meta, .split-grid .d, .split-grid b'

async function setPiece(page, label, full) {
  await tab(page, 1)
  const calls = await page.$$eval('.sp-call', bs => bs.map(b => b.dataset.call))
  ok(calls.length === 10, `${label}: ten set-piece calls drawn (${calls.length})`)
  const dg = await page.$$eval('.sp-call, .sp-card', bs => bs.map(b => {
    const s = b.querySelector('svg.dg')
    return s ? s.querySelectorAll('circle, path, line, rect, ellipse, polygon').length : 0
  }))
  ok(dg.length === 22 && dg.every(n => n >= 10), `${label}: every call and option carries a diagram (${dg.length} buttons, fewest shapes ${Math.min(...dg)})`)
  if (full) {
    for (const id of calls) {
      await page.click(`.sp-call[data-call="${id}"]`)
      const t = await tac(page)
      const on = await page.$eval(`.sp-call[data-call="${id}"]`, b => b.classList.contains('sel') && b.getAttribute('aria-pressed') === 'true')
      const kind = id.startsWith('lo_') ? 'lo_' : 'sc_'
      const others = await page.$$eval(`.sp-call[data-call^="${kind}"].sel`, bs => bs.length)
      const saved = kind === 'lo_' ? t.lineoutCall : t.scrumCall
      ok(saved === id && on && others === 1, `${label}: ${id} is the call (${saved}), and the only one shown picked`)
    }
    const groups = { exit: ['box', 'long', 'counter', 'fifty22'], kick: ['territory', 'contest', 'attack', 'balanced'], pen: ['ask', 'posts', 'corner', 'tap'] }
    const field = { exit: 'exit', kick: 'kickStyle', pen: 'penaltyCall' }
    for (const [g, ids] of Object.entries(groups)) {
      for (const id of ids) {
        await page.click(`.sp-card[data-opt="${g}-${id}"]`)
        const t = await tac(page)
        const on = await page.$eval(`.sp-card[data-opt="${g}-${id}"]`, b => b.classList.contains('sel') && b.getAttribute('aria-pressed') === 'true')
        const n = await page.$$eval(`.sp-card[data-opt^="${g}-"].sel`, bs => bs.length)
        ok(t[field[g]] === id && on && n === 1, `${label}: ${field[g]} = ${id} (${t[field[g]]}), shown picked alone`)
      }
    }
    // the goal kicker: the second name on the list becomes the first kicker
    const sel = page.locator('.lead-row select').first()
    const v = await sel.locator('option').nth(2).getAttribute('value')
    await sel.selectOption(v)
    ok(((await tac(page)).kickers ?? [])[0] === Number(v), `${label}: the first goal kicker is set (${v})`)
  }
  await fits(page, `${label} set piece`, TEXT)
}

async function bench(page, label, full) {
  await tab(page, 2)
  const b23 = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.b23-name')].map(n => n.getBoundingClientRect())
    let overlaps = 0
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j]
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps++
    }
    const pitch = document.querySelector('.b23-pitch')?.getBoundingClientRect()
    const outside = names.filter(r => pitch && (r.left < pitch.left - 1 || r.right > pitch.right + 1 || r.bottom > pitch.bottom + 1)).length
    return {
      men: document.querySelectorAll('.b23-man .b23-kit svg').length,
      seats: document.querySelectorAll('.b23-seat').length,
      icons: document.querySelectorAll('.b23-seat .brief-ico svg').length,
      overlaps, outside,
      emoji: /\p{Extended_Pictographic}/u.test(document.querySelector('.content, main, body').innerText),
      pips: [...document.querySelectorAll('.split-grid .split-pips')].map(p => p.querySelectorAll('i.fw').length),
    }
  })
  ok(b23.men === 15 && b23.seats === 8, `${label}: the 23 drawn, ${b23.men} shirts in the fifteen and ${b23.seats} seats on the bench`)
  ok(b23.icons === 8, `${label}: every bench seat shows its brief as an icon (${b23.icons})`)
  ok(b23.overlaps === 0 && b23.outside === 0, `${label}: no two names on the 23 overlap (${b23.overlaps}), none off the grass (${b23.outside})`)
  ok(b23.pips.join() === '5,6,4', `${label}: the splits drawn as forwards on the bench (${b23.pips.join(' / ')})`)
  ok(!b23.emoji, `${label}: no emoji left on the bench page`)
  // the eight brief rows are folded behind a toggle since the drawn 23 took
  // over showing them (scrollaudit had the tab at 3.9 screenfuls), so they are
  // opened here: the brief clicks below and the fit check both need them there
  if (await page.locator('.brief-row').count() === 0) await page.click('[data-briefs-toggle]')
  ok(await page.locator('.brief-row').count() === 8, `${label}: the brief controls open on a tap, one row per seat`)
  if (full) {
    for (const sp of ['6-2', '4-4', '5-3']) {
      await page.click(`.split-grid [data-split="${sp}"]`)
      const t = await tac(page)
      const on = await page.$eval(`.split-grid [data-split="${sp}"]`, b => b.classList.contains('sel') && b.getAttribute('aria-pressed') === 'true')
      const benchFilled = t.lineup.slice(15).filter(x => x != null).length
      ok(t.bench === sp && on && benchFilled === 8, `${label}: split ${sp} chosen (${t.bench}), bench re-seated (${benchFilled}/8)`)
    }
    const briefs = ['impact', 'shore', 'manage', 'orders']
    for (let seat = 0; seat < 8; seat++) {
      const want = briefs[seat % 4]
      await page.locator('.brief-row').nth(seat).locator(`[data-brief="${want}"]`).click()
      const t = await tac(page)
      const pressed = await page.locator('.brief-row').nth(seat).locator('.preset-chip.on').getAttribute('data-brief')
      const shown = await page.locator('.b23-seat').nth(seat).locator('.b23-brief').innerText()
      ok((t.briefs ?? [])[seat] === want && pressed === want && shown.trim().length > 0,
        `${label}: seat ${seat + 16} briefed "${want}" (${(t.briefs ?? [])[seat]}), the 23 says "${shown.trim()}"`)
    }
  }
  await fits(page, `${label} bench`, TEXT)
}

async function prep(page, label, full) {
  await tab(page, 3)
  const cards = await page.$$eval('.prep-card', bs => bs.map(b => ({ k: b.dataset.prep, svg: !!b.querySelector('.prep-ico svg') })))
  ok(cards.length === 5 && cards.every(c => c.svg), `${label}: five preparation cards, each with its icon`)
  if (full) {
    for (const { k } of cards) {
      await page.click(`.prep-card[data-prep="${k}"]`)
      const p = await page.evaluate(() => window.rugbyStore.getState().game.matchPrep)
      const n = await page.$$eval('.prep-card.sel', bs => bs.map(b => b.dataset.prep))
      ok(p === k && n.length === 1 && n[0] === k, `${label}: preparation ${k} set (${p}), only it shown picked`)
    }
    // tapping the chosen card again clears the week, as the chips did
    await page.click('.prep-card[data-prep="recovery"]')
    const cleared = await page.evaluate(() => window.rugbyStore.getState().game.matchPrep)
    ok(cleared === undefined && (await page.$$('.prep-card.sel')).length === 0, `${label}: a second tap clears the focus (${cleared})`)
    await page.click('.prep-card[data-prep="setpiece"]')
  }
  await fits(page, `${label} prep`, TEXT)
}

const shoot = async (page, name) => {
  // one screenshot per screenful of the tab, so the whole page is seen: the
  // app scrolls inside its own column, so a full-page shot shows one screen
  const n = await page.evaluate(() => {
    const sc = [...document.querySelectorAll('*')].find(el => {
      const o = getComputedStyle(el).overflowY
      return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 20
    })
    window.__sc = sc ?? document.scrollingElement
    window.__sc.scrollTop = 0
    return Math.ceil(window.__sc.scrollHeight / (window.__sc.clientHeight * 0.8))
  })
  for (let i = 0; i < Math.min(n, 8); i++) {
    await page.evaluate(i => { window.__sc.scrollTop = i * window.__sc.clientHeight * 0.8 }, i)
    await page.waitForTimeout(120)
    await page.screenshot({ path: `${SHOTS}/${name}-${i + 1}.png` })
  }
  await page.evaluate(() => { window.__sc.scrollTop = 0 })
}

const errors = []
const watch = (page, label) => {
  page.on('pageerror', e => errors.push(`${label}: ${String(e).slice(0, 200)}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`${label}: ${m.text().slice(0, 200)}`) })
}

try {
  // ---- phone, 412 x 915: every option, and the save ----
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } })
  const page = await ctx.newPage()
  watch(page, 'phone')
  await career(page)
  await setPiece(page, '412', true); await shoot(page, 'setpiece-412')
  await bench(page, '412', true); await shoot(page, 'bench-412')
  await prep(page, '412', true); await shoot(page, 'prep-412')

  const want = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    const t = g.clubs[g.userClubId].tactic
    return { lo: t.lineoutCall, sc: t.scrumCall, exit: t.exit, kick: t.kickStyle, pen: t.penaltyCall, bench: t.bench, briefs: (t.briefs ?? []).join(), prep: g.matchPrep, k: (t.kickers ?? [])[0] }
  })
  await page.evaluate(() => window.rugbyStore.getState().persistNow())
  await page.reload()
  await page.waitForTimeout(1500)
  if (!(await page.locator('.bottom-nav').count())) {
    const cont = page.locator('button:has-text("Continue")').first()
    if (await cont.count()) await cont.click()
  }
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  const got = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    const t = g.clubs[g.userClubId].tactic
    return { lo: t.lineoutCall, sc: t.scrumCall, exit: t.exit, kick: t.kickStyle, pen: t.penaltyCall, bench: t.bench, briefs: (t.briefs ?? []).join(), prep: g.matchPrep, k: (t.kickers ?? [])[0] }
  })
  ok(JSON.stringify(got) === JSON.stringify(want), `the choices survive a save and reload (${JSON.stringify(got)})`)

  // ---- phone, 360 wide ----
  await page.setViewportSize({ width: 360, height: 800 })
  await setPiece(page, '360', false); await shoot(page, 'setpiece-360')
  await bench(page, '360', false); await shoot(page, 'bench-360')
  await prep(page, '360', false); await shoot(page, 'prep-360')
  await ctx.close()

  // ---- tablet: a touch screen, so the .tablet layout is live ----
  const tctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })
  const tp = await tctx.newPage()
  watch(tp, 'tablet')
  await career(tp)
  ok(await tp.evaluate(() => document.querySelector('.app')?.classList.contains('tablet')), 'tablet: the tablet layout is on')
  await setPiece(tp, 'tablet', true); await shoot(tp, 'setpiece-tablet')
  await bench(tp, 'tablet', false); await shoot(tp, 'bench-tablet')
  await prep(tp, 'tablet', false); await shoot(tp, 'prep-tablet')
  await tctx.close()

  ok(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' || ')}` : ''}`)
} catch (e) {
  console.log('FAIL  probe crashed:', e)
  fails++
} finally {
  await browser.close()
  server.stop()
}
console.log(fails ? `\nSETPIECEUI: ${fails} FAILED` : '\nSETPIECEUI: all passed')
done(fails)
