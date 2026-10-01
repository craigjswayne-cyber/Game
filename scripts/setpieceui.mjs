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
//     no other control in its group may. A goal kicker is named off the sheet.
//   AND IS SAVED. The last choices are written with persistNow(), the page is
//     reloaded, and the career that comes back must carry them.
//   THE PICTURES ARE THERE. Every call and option button holds an inline SVG
//     diagram with real content, the 23 shows fifteen shirts and eight seats,
//     each seat shows its brief as an icon, and no emoji is left in the
//     briefs.
//   IT FITS. At 412 and 360 wide, on its side at 844x390 and in tablet mode: no sideways scroll, no
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

/** One of the Set Piece tab's three views (1.8.2): the segmented control
 *  under the tab bar, [data-sp-sub] = calls | moves | kicking. */
const view = async (page, v) => {
  await page.click(`[data-sp-sub="${v}"]`)
  await page.waitForTimeout(150)
  return page.$eval(`[data-sp-sub="${v}"]`, b => b.classList.contains('sel') && b.getAttribute('aria-selected') === 'true')
}
const diagrams = (page, sel) => page.$$eval(sel, bs => bs.map(b => {
  const s = b.querySelector('svg.dg')
  return s ? s.querySelectorAll('circle, path, line, rect, ellipse, polygon').length : 0
}))

/** THE PLAYBOOK: PREVIEW, THEN PICK THE SLOT (owner: "You should be able to
 *  select which of the moves goes where, like the main menu save option"):
 *  tap a move and it plays on a loop; "Add to playbook" opens the four slots
 *  as rows, each saying what it holds, the ones the move cannot go in greyed;
 *  a tap on a row puts the move there, replacing what was; Cancel closes the
 *  rows; a move in the playbook offers Remove. No "it will misfire" line:
 *  familiarity is learnt in the matches (owner). */
async function playbook(page, label) {
  await page.evaluate(() => {
    const S = window.rugbyStore.getState(), g = S.game, t = g.clubs[g.userClubId].tactic
    t.moveShape = t.moveMain = t.moveAlt = t.moveRed = t.movePen = undefined
    S.touch()
  })
  await view(page, 'calls'); await view(page, 'moves')
  ok(await page.locator('.mv-preview').count() === 0 && await page.locator('.mv-card .mv-hint').count() === 1,
    `${label}: nothing is previewed until a move is tapped`)
  // EVERY SLOT TAKES A TAP (round 6, owner: "I can't tap Open-Play Call"):
  // the slots were disabled while empty. Five of them now, none disabled; an
  // empty one shows the moves that fit it, and the one picked goes straight in
  const calls = await page.$$eval('.mv-callchip', bs => bs.map(b => `${b.dataset.call}${b.disabled ? '-' : '+'}`).join())
  ok(calls === 'shape+,main+,alt+,red+,pen+', `${label}: five slots, every one tappable while empty (${calls})`)
  await page.click('.mv-callchip[data-call="shape"]')
  const shapeList = await page.$$eval('.mv-chips:not(.mv-mix) [data-move]', bs => bs.map(b => b.dataset.move).join())
  ok(await page.locator('.mv-callchip[data-call="shape"][aria-pressed="true"]').count() === 1
    && await page.locator('.mv-want[data-want="shape"]').count() === 1 && shapeList === 'mv_1331,mv_242,mv_backdoor',
    `${label}: tapping the empty Open-Play Call shows the moves that fit it (${shapeList})`)
  if (process.env.OWNER_SHOTS) await page.screenshot({ path: `${process.env.OWNER_SHOTS}/${label}-openplay-slot-tapped.png` })
  await page.click('.mv-card [data-move="mv_242"]')
  ok(await page.locator('.mv-preview[data-pick="mv_242"]').count() === 1 && await page.locator('.mv-card [data-act="put"][data-slot="shape"]').count() === 1,
    `${label}: a move picked from there previews, with one button to put it in that slot`)
  await page.click('.mv-card [data-act="put"]')
  let tc0 = await tac(page)
  ok(tc0.moveShape === 'mv_242' && await page.locator('.mv-want').count() === 0
    && await page.locator('.mv-callchip[data-call="shape"]').getAttribute('data-filled') === 'mv_242',
    `${label}: and one tap puts it there (${tc0.moveShape}), the list back to every move`)
  await page.click('.mv-card [data-move="mv_loop"]')
  await page.click('.mv-callchip[data-call="shape"]')
  ok(await page.locator('.mv-preview[data-pick="mv_242"]').count() === 1, `${label}: a filled slot, tapped, previews what it holds`)
  // THE PENALTY SLOT (round 6): the tap plays, and only them
  await page.click('.mv-callchip[data-call="pen"]')
  const penList = await page.$$eval('.mv-chips:not(.mv-mix) [data-move]', bs => bs.map(b => b.dataset.move).join())
  ok(penList === 'mv_tap,mv_tapspread,mv_tapgo', `${label}: the empty Penalty slot shows the three tap plays (${penList})`)
  await page.click('.mv-card [data-move="mv_tapspread"]')
  ok(await page.locator('.mv-preview[data-pick="mv_tapspread"] svg.mv-anim').count() === 1, `${label}: the tap play previews on its loop`)
  await page.click('.mv-card [data-act="put"]')
  tc0 = await tac(page)
  ok(tc0.movePen === 'mv_tapspread' && !tc0.moveRed, `${label}: and goes in the penalty slot (${tc0.movePen})`)
  await page.click('.mv-callchip[data-call="pen"]')
  if (process.env.OWNER_SHOTS) await page.screenshot({ path: `${process.env.OWNER_SHOTS}/${label}-penalty-slot.png` })
  await page.click('.mv-card [data-act="remove"]')
  await page.click('.mv-card [data-move="mv_242"]'); await page.click('.mv-card [data-act="remove"]')
  tc0 = await tac(page)
  ok(!tc0.movePen && !tc0.moveShape, `${label}: and Remove empties them again`)
  await page.click('.mv-callchip[data-call="main"]'); await page.click('.mv-card [data-act="all"]')
  ok(await page.locator('.mv-want').count() === 0 && await page.locator('.mv-chips:not(.mv-mix) [data-move]').count() === 21,
    `${label}: Show all puts every move back`)
  await page.click('.mv-card [data-move="mv_loop"]')
  const svg = page.locator('.mv-preview[data-pick="mv_loop"] svg.mv-anim')
  ok(await svg.count() === 1, `${label}: tapping a move shows its animated preview`)
  const t0 = await svg.getAttribute('data-t'); await page.waitForTimeout(700)
  const t1 = await svg.getAttribute('data-t')
  ok(t0 !== t1, `${label}: the preview is playing (t ${t0} then ${t1})`)
  ok(await page.locator('.mv-preview .mv-warn').count() === 0, `${label}: no undrilled warning on the preview`)
  ok(await page.locator('.mv-slots').count() === 0, `${label}: the slot picker is shut until Add is tapped`)
  await page.click('.mv-card [data-act="add"]')
  const open = await page.$$eval('.mv-slots .mv-slot', bs => bs.map(b => `${b.dataset.slot}${b.disabled ? '-' : '+'}`).join())
  ok(open === 'shape-,main+,alt+,red+,pen-', `${label}: Add opens all five slots, the ones a strike cannot go in greyed (${open})`)
  await page.click('.mv-slots [data-slot="red"]')
  let tc = await tac(page)
  ok(tc.moveRed === 'mv_loop' && !tc.moveMain && await page.locator('.mv-slots').count() === 0
    && await page.locator('.mv-card [data-act="remove"]').count() === 1,
    `${label}: a tap on a slot puts it there, not in the first free one (${tc.moveRed}), and shuts the picker`)
  const put = async (id, slot) => {
    await page.click(`.mv-card [data-move="${id}"]`); await page.click('.mv-card [data-act="add"]')
    await page.click(`.mv-slots [data-slot="${slot}"]`)
  }
  await page.click('.mv-card [data-move="mv_1331"]'); await page.click('.mv-card [data-act="add"]')
  const shp = await page.$$eval('.mv-slots .mv-slot:not(:disabled)', bs => bs.map(b => b.dataset.slot).join())
  ok(shp === 'shape', `${label}: an open-play shape can go in the open-play slot only (${shp})`)
  await page.click('.mv-slots [data-slot="shape"]')
  await put('mv_switch', 'alt'); await put('mv_crash', 'main')
  tc = await tac(page)
  ok(tc.moveMain === 'mv_crash' && tc.moveAlt === 'mv_switch' && tc.moveRed === 'mv_loop' && tc.moveShape === 'mv_1331',
    `${label}: each move went where it was put (${tc.moveShape} / ${tc.moveMain} / ${tc.moveAlt} / ${tc.moveRed})`)
  ok(await page.locator('.mv-callchip[data-call="main"]').getAttribute('data-filled') === 'mv_crash', `${label}: the slot shows what it holds`)
  await page.click('.mv-card [data-move="mv_decoy"]'); await page.click('.mv-card [data-act="add"]')
  const held = await page.$$eval('.mv-slots .mv-slot', bs => bs.map(b => b.dataset.filled).join())
  ok(held === 'mv_1331,mv_crash,mv_switch,mv_loop,', `${label}: each row in the picker says what is in that slot now (${held})`)
  await page.click('.mv-card [data-act="cancel"]')
  ok(await page.locator('.mv-slots').count() === 0 && await page.locator('.mv-card [data-act="add"]').count() === 1,
    `${label}: Cancel shuts the picker and changes nothing`)
  await page.click('.mv-card [data-act="add"]'); await page.click('.mv-slots [data-slot="alt"]')
  tc = await tac(page)
  ok(tc.moveAlt === 'mv_decoy' && tc.moveMain === 'mv_crash', `${label}: a tap on a full slot replaces it (${tc.moveAlt})`)
  await page.click('.mv-card [data-act="remove"]')
  tc = await tac(page)
  ok(tc.moveAlt === undefined && await page.locator('.mv-card [data-act="add"]').count() === 1,
    `${label}: Remove empties its slot and the button offers Add again`)
  // a phone asking for less motion gets the still whiteboard diagram
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(150)
  ok(await page.locator('.mv-preview svg.mv-anim').count() === 0 && await page.locator('.mv-preview svg.dg').count() === 1,
    `${label}: under reduced motion the preview is the static diagram`)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(150)
  ok(await page.locator('.mv-preview svg.mv-anim').count() === 1, `${label}: and it plays again when motion is back`)
}

async function setPiece(page, label, full) {
  await tab(page, 1)
  // THE TAB IN THREE: three views, one shown at a time, each picked alone
  const subs = await page.$$eval('[data-sp-sub]', bs => bs.map(b => b.dataset.spSub))
  ok(subs.join() === 'calls,moves,kicking', `${label}: the set piece tab has its three views (${subs.join(' / ')})`)
  const tap = await page.evaluate(() => [...document.querySelectorAll('[data-sp-sub]')].map(b => Math.round(b.getBoundingClientRect().height)))
  ok(tap.every(h => h >= 44), `${label}: every view button is a full tap target (${tap.join(', ')}px)`)

  ok(await view(page, 'calls'), `${label}: the calls view is picked`)
  const calls = await page.$$eval('.sp-call', bs => bs.map(b => b.dataset.call))
  ok(calls.length === 10, `${label}: ten set-piece calls drawn (${calls.length})`)
  ok(await page.locator('.sp-card, .mv-card, .kick-btn').count() === 0, `${label}: and nothing from the other two views on it`)
  const dgc = await diagrams(page, '.sp-call')
  ok(dgc.length === 10 && dgc.every(n => n >= 10), `${label}: every call carries a diagram (${dgc.length} buttons, fewest shapes ${Math.min(...dgc)})`)
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
  }
  await fits(page, `${label} set piece calls`, TEXT)

  ok(await view(page, 'moves'), `${label}: the moves view is picked`)
  ok(await page.locator('.mv-card').count() === 1 && await page.locator('.sp-call, .sp-card').count() === 0,
    `${label}: the moves view is the attacking moves card on its own`)
  if (full) await playbook(page, label)
  // a move picked, so its preview and its line are measured too
  await page.click('.mv-card [data-move="mv_loop"]')
  await page.waitForSelector('.mv-preview[data-pick="mv_loop"] svg.dg')
  await fits(page, `${label} set piece moves`, TEXT)

  ok(await view(page, 'kicking'), `${label}: the kicking view is picked`)
  const dgk = await diagrams(page, '.sp-card')
  ok(dgk.length === 12 && dgk.every(n => n >= 10), `${label}: every kicking option carries a diagram (${dgk.length} buttons, fewest shapes ${Math.min(...dgk)})`)
  ok(await page.locator('button.kick-btn').count() === 2 && await page.locator('.sp-call, .mv-card').count() === 0,
    `${label}: the two goal kickers are on the kicking view, and no calls or moves`)
  if (full) {
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
    // the goal kicker: a row opens the squad sheet (1.8.1 replaced the two
    // selects this used to set, which had left the probe waiting on a
    // select that no longer exists), and the second name on the sheet
    // becomes the first kicker
    await page.locator('button.kick-btn').first().click()
    await page.waitForSelector('.lead-sheet')
    const row = page.locator('.lead-sheet tbody tr').nth(1)
    const nm = (await row.locator('td.name').textContent()).trim()
    await row.click()
    await page.waitForTimeout(200)
    const k0 = ((await tac(page)).kickers ?? [])[0]
    const kName = await page.evaluate(id => window.rugbyStore.getState().game.players[id]?.name, k0)
    ok(k0 != null && kName === nm && await page.locator('.lead-sheet').count() === 0, `${label}: the first goal kicker is set (${kName})`)
  }
  await fits(page, `${label} set piece kicking`, TEXT)

  // REMEMBERED FOR THE SESSION: leave the tab on kicking, go to another
  // screen and back, and the Set Piece tab opens on kicking again
  await page.evaluate(() => window.rugbyStore.getState().go('squad'))
  await page.waitForTimeout(200)
  await tab(page, 1)
  ok(await page.$eval('[data-sp-sub="kicking"]', b => b.classList.contains('sel')), `${label}: the kicking view is still the one open after leaving the screen`)
  await view(page, 'calls')
}

async function bench(page, label, full) {
  await tab(page, 2)
  const b23 = await page.evaluate(() => {
    // the page reads in the owner's order (round 5): the split, the eight
    // replacements, then the finisher briefs; the fifteen on grass are gone
    const y = sel => document.querySelector(sel)?.getBoundingClientRect().top ?? -1
    return {
      pitch: document.querySelectorAll('.b23-pitch, .b23-man').length,
      seats: document.querySelectorAll('.b23-seat').length,
      icons: document.querySelectorAll('.b23-seat .brief-ico svg').length,
      order: [y('.split-grid'), y('.b23-seats'), y('[data-briefs-toggle]')],
      emoji: /\p{Extended_Pictographic}/u.test(document.querySelector('.content, main, body').innerText),
      pips: [...document.querySelectorAll('.split-grid .split-pips')].map(p => p.querySelectorAll('i.fw').length),
    }
  })
  ok(b23.pitch === 0 && b23.seats === 8, `${label}: no starting fifteen drawn (${b23.pitch}), ${b23.seats} seats on the bench`)
  ok(b23.icons === 8, `${label}: every bench seat shows its brief as an icon (${b23.icons})`)
  ok(b23.order.every(v => v >= 0) && b23.order[0] < b23.order[1] && b23.order[1] < b23.order[2],
    `${label}: split, then replacements, then finisher briefs (${b23.order.map(Math.round).join(' < ')})`)
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
/** the Set Piece tab is three views since 1.8.2: a set of shots for each */
const shootSp = async (page, name) => {
  for (const v of ['calls', 'moves', 'kicking']) { await view(page, v); await shoot(page, `${name}-${v}`) }
  await view(page, 'calls')
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
  await setPiece(page, '412', true); await shootSp(page, 'setpiece-412')
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
  await setPiece(page, '360', false); await shootSp(page, 'setpiece-360')
  await bench(page, '360', false); await shoot(page, 'bench-360')
  await prep(page, '360', false); await shoot(page, 'prep-360')

  // ---- phone on its side, 844 x 390: the calls and options lay their
  // pictures beside their words here (theme.css), so the fit is checked too
  await page.setViewportSize({ width: 844, height: 390 })
  await setPiece(page, 'landscape', false); await shootSp(page, 'setpiece-landscape')
  await ctx.close()

  // ---- tablet: a touch screen, so the .tablet layout is live ----
  const tctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })
  const tp = await tctx.newPage()
  watch(tp, 'tablet')
  await career(tp)
  ok(await tp.evaluate(() => document.querySelector('.app')?.classList.contains('tablet')), 'tablet: the tablet layout is on')
  await setPiece(tp, 'tablet', true); await shootSp(tp, 'setpiece-tablet')
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
