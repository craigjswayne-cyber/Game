// The injury sheet can always be answered (owner, round 6).
//
// "Player injured but have nobody on the bench who can replace him by
// position - he is a back rower so I should be able to replace him with
// anyone. I can't continue in the game. Only front row players should be
// harder to replace... if a back has to play front row for example then it
// would be uncontested scrums."
//
// scripts/injurysubprobe.ts holds the engine's side of it. This holds the
// sheet the manager actually taps, at 390x844. An injury cannot be summoned
// from a live match on demand, so each stoppage is written into the running
// match through the store handle exactly as the engine writes one (the
// injured man off, the assistant's man on in his shirt, the stoppage's lines,
// side.lastInj), and then the sheet is driven by taps:
//
//   1. a flanker down, no back-rower on the bench, a centre sent on: the sheet
//      reads the bench for the flanker's shirt, every bench man can be
//      tapped, a different back takes the shirt, and play goes on
//   2. a prop down with a front-rower on the bench: only front-rowers can be
//      tapped, and the sheet says why
//   3. a prop down with no front-rower on the bench: anybody can go on, and
//      the sheet says the scrums are uncontested
//   4. an injury with nobody left on the bench: nobody is armed, the door is
//      open, and play goes on a man down
//   5. full time: no highlights list (owner: "Remove highlights from the
//      after game bit")
//
// Run: node scripts/injurysheet.mjs [outdir]   (port 4231, PORT to override)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'

const PORT = process.env.PORT ?? '4231'
const OUT = process.argv[2] ?? 'shots-injurysheet'
mkdirSync(OUT, { recursive: true })
const server = await startPreview(PORT, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok' : 'FAIL'} ${what}`); if (!c) fails++ }

/**
 * Write one injury stoppage into the live match, the way the engine does
 * (matchEngine.ts, the injury block), at the current cursor.
 *   hurtPos: the shirt that goes down ('FL', 'LP' ...)
 *   bench:   'noBackRow' | 'noFrontRow' | 'empty' | 'asIs' - reshape the bench first
 *   cover:   'back' | 'frontRower' | 'none' - who the assistant sends on
 */
const stage = (hurtPos, bench, cover) => page.evaluate(([hurtPos, bench, cover]) => {
  const st = window.rugbyStore.getState()
  const lm = st.liveMatch
  const g = st.game
  const ctx = lm.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const FR = ['LP', 'HK', 'TP'], BR = ['FL', 'N8'], BK = ['SH', 'FH', 'CE', 'WG', 'FB']
  const plays = (p, ps) => ps.includes(p.pos) || p.alt.some(a => ps.includes(a))
  const club = g.clubs[g.userClubId]
  const inUse = new Set(mine.lineup.filter(x => x != null))
  const spare = () => club.players.map(i => g.players[i])
    .find(q => q && !inUse.has(q.id) && !q.injury && q.bans === 0 && BK.includes(q.pos) && !plays(q, [...FR, ...BR]))
  for (let s = 15; s < mine.lineup.length; s++) {
    const id = mine.lineup[s]
    const p = id != null ? g.players[id] : null
    if (!p || mine.onPitch.has(id) || mine.ratings.has(id)) continue
    const out = bench === 'empty' || (bench === 'noBackRow' && plays(p, BR)) || (bench === 'noFrontRow' && plays(p, FR))
    if (!out) continue
    const rep = bench === 'empty' ? null : spare()
    mine.lineup[s] = rep ? rep.id : null
    if (rep) inUse.add(rep.id)
  }
  const slot = mine.lineup.slice(0, 15).findIndex(id => id != null && mine.onPitch.has(id) && g.players[id].pos === hurtPos)
  if (slot < 0) return { err: `no ${hurtPos} on the pitch` }
  const hurt = g.players[mine.lineup[slot]]
  const fit = mine.lineup.slice(15).map(id => id != null ? g.players[id] : null)
    .filter(p => p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))
  const sub = cover === 'none' ? null
    : cover === 'frontRower' ? fit.find(p => plays(p, FR))
    : fit.find(p => BK.includes(p.pos) && !plays(p, [...FR, ...BR]))
  if (cover !== 'none' && !sub) return { err: `no ${cover} on the bench` }
  hurt.injury = { desc: 'Hamstring', dk: 'injury.hamstring', until: g.week + 3, weeks: 3 }
  mine.onPitch.delete(hurt.id)
  const min = Math.max(1, ctx.lastMin)
  const ev = (type, k, v, pid) => ({
    min, type, teamId: mine.teamId, fld: 50, playerId: pid, playerName: pid != null ? g.players[pid].name : undefined,
    text: `${k}`, k, v, homeScore: ctx.home.score, awayScore: ctx.away.score,
  })
  const lines = [ev('INJ', 'comm.injuryDown', { player: hurt.name, injury_k: 'injury.hamstring', rush_k: 'common.nothing' }, hurt.id)]
  if (sub) {
    mine.onPitch.add(sub.id)
    mine.ratings.set(sub.id, 6)
    mine.energy.set(sub.id, 90)
    const b = mine.lineup.indexOf(sub.id)
    mine.lineup[slot] = sub.id
    mine.lineup[b] = hurt.id
    lines.push(ev('SUB', 'comm.subComesOn', { player: sub.name, brief_k: 'common.nothing' }, sub.id))
    if (!plays(sub, [hurtPos])) lines.push(ev('SUB', 'comm.outOfCover', { team: 'Us', player: sub.name, pos: sub.pos, shirt: hurtPos }, sub.id))
  } else mine.short += 1
  if (FR.includes(hurtPos) && !(sub && plays(sub, FR))) {
    // nobody trained went on: the referee orders uncontested scrums (Law 3)
    ctx.uncontested = true
    lines.push(ev('SUB', 'comm.uncontestedNow', { team: 'Us', player: hurt.name }, hurt.id))
  }
  const at = lm.cursor
  ctx.events.splice(at, 0, ...lines)
  mine.lastInj = { hurtId: hurt.id, coverId: sub ? sub.id : null, upTo: at + lines.length }
  st.matchCursor(at + 1, false)
  return { hurt: hurt.name, hurtPos, cover: sub ? `${sub.name} (${sub.pos})` : null, bench: fit.map(p => p.pos).join(' ') }
}, [hurtPos, bench, cover])

/** what the sheet shows */
const sheet = () => page.evaluate(() => {
  const s = document.querySelector('.squad-sheet')
  if (!s) return null
  const cols = s.querySelectorAll('.sheet-col')
  const benchRows = cols[1] ? [...cols[1].querySelectorAll('.sheet-row')] : []
  const gold = s.querySelector('.btn.gold')
  return {
    head: cols[1]?.querySelector('.fact-label')?.textContent ?? '',
    text: s.textContent ?? '',
    bench: benchRows.map(r => ({ pos: r.querySelector('.sh-num')?.textContent, on: !r.disabled })),
    armed: s.querySelector('.sheet-row.armed .sh-name')?.textContent ?? null,
    goldOn: !!gold && !gold.disabled,
    goldText: gold?.textContent ?? '',
  }
})

const pause = () => page.evaluate(() => {
  const st = window.rugbyStore.getState()
  const lm = st.liveMatch
  if (lm?.playing) st.matchCursor(lm.cursor, false)
  return lm?.cursor ?? -1
})
const mineState = () => page.evaluate(() => {
  const lm = window.rugbyStore.getState().liveMatch
  const ctx = lm.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  return { on: [...mine.onPitch], uncontested: !!ctx.uncontested, cursor: lm.cursor, playing: lm.playing, seg: ctx.seg }
})
const closeSheet = async () => {
  await page.locator('.squad-sheet .btn.gold').click({ timeout: 2000 })
  await page.waitForTimeout(300)
}
/** run on a few lines so the stoppage is behind us */
const playOn = async () => {
  const c0 = (await mineState()).cursor
  await page.evaluate(() => { const st = window.rugbyStore.getState(); st.matchCursor(st.liveMatch.cursor, true) })
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250)
    if (await page.locator('.sheet-casualty').count()) await closeSheet().catch(() => {})
    const s = await mineState()
    if (s.cursor >= c0 + 3 || s.seg === 3) return true
  }
  return false
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Physio')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  for (let tap = 0; tap < 8; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 })
  await page.click('.talk-modal .speech-tile >> text=Calm the nerves')
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* clean sheet */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  await page.waitForTimeout(1500)
  await pause()
  await page.locator('.talk-react >> text=Got it').click({ timeout: 2000 }).catch(() => {})

  // ---- 1. the owner's case
  console.log('--- 1. a flanker down, no back-rower on the bench')
  const s1 = await stage('FL', 'noBackRow', 'back')
  console.log(`  staged: ${JSON.stringify(s1)}`)
  ok(!s1.err, 'staged')
  await page.locator('.sheet-casualty').waitFor({ timeout: 5000 })
  let sh = await sheet()
  ok(/cover for flanker/i.test(sh.head), `the bench is read for the flanker's shirt ("${sh.head}")`)
  ok(!sh.bench.some(b => b.pos === 'FL' || b.pos === 'N8'), `no back-rower on the bench (${sh.bench.map(b => b.pos).join(' ')})`)
  ok(sh.bench.length > 0 && sh.bench.every(b => b.on), `every man on the bench can be tapped (${sh.bench.filter(b => b.on).length} of ${sh.bench.length})`)
  ok(!sh.goldOn, 'play waits for a decision')
  await page.locator('.squad-sheet .sheet-col').nth(1).locator('.fact-label').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/injury-backrow-bench.png` })
  // a different back than the one the assistant chose
  const rows = page.locator('.squad-sheet .sheet-col').nth(1).locator('.sheet-row:not([disabled])')
  const n = await rows.count()
  let pick = -1
  for (let i = 0; i < n; i++) {
    const pos = await rows.nth(i).locator('.sh-num').innerText()
    if (['SH', 'FH', 'CE', 'WG', 'FB'].includes(pos)) { pick = i; break }
  }
  if (pick < 0) pick = 0
  const pickName = await rows.nth(pick).locator('.sh-name').innerText()
  await rows.nth(pick).click()
  await page.waitForTimeout(300)
  sh = await sheet()
  ok(sh.goldOn, `${pickName} takes the shirt and the door opens ("${sh.goldText.trim()}")`)
  ok(!/too late/i.test(sh.text), 'and nothing says it is too late')
  const onNow = await page.evaluate(nm => {
    const st = window.rugbyStore.getState()
    const ctx = st.liveMatch.ctx
    const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
    return [...mine.onPitch].some(id => st.game.players[id].name === nm)
  }, pickName)
  ok(onNow, `${pickName} is on the pitch`)
  await page.screenshot({ path: `${OUT}/injury-backrow-any.png` })
  await closeSheet()
  ok(await playOn(), 'and the match goes on')

  // ---- 2. a prop down, a front-rower on the bench
  console.log('--- 2. a prop down with a front-rower on the bench')
  await pause()
  const s2 = await stage('LP', 'asIs', 'frontRower')
  console.log(`  staged: ${JSON.stringify(s2)}`)
  if (s2.err) console.log(`  (skipped: ${s2.err})`)
  else {
    await page.locator('.sheet-casualty').waitFor({ timeout: 5000 })
    sh = await sheet()
    const fr = sh.bench.filter(b => ['LP', 'HK', 'TP'].includes(b.pos))
    const rest = sh.bench.filter(b => !['LP', 'HK', 'TP'].includes(b.pos))
    ok(rest.length > 0 && rest.every(b => !b.on), `the backs and the back five cannot take a front-row shirt (${rest.length} greyed)`)
    ok(fr.every(b => b.on), `front-rowers can (${fr.length})`)
    ok(/front-row shirt/i.test(sh.text), 'and the sheet says why')
    // keep the assistant's man
    await page.locator('.squad-sheet .sheet-row.armed').click()
    await page.waitForTimeout(250)
    ok((await sheet()).goldOn, 'keeping the assistant\'s front-rower answers it')
    await closeSheet()
    ok(await playOn(), 'and the match goes on')
  }

  // ---- 3. a prop down with no front-rower on the bench
  console.log('--- 3. a prop down with no front-rower on the bench')
  await pause()
  const s3 = await stage('TP', 'noFrontRow', 'back')
  console.log(`  staged: ${JSON.stringify(s3)}`)
  ok(!s3.err, 'staged')
  await page.locator('.sheet-casualty').waitFor({ timeout: 5000 })
  sh = await sheet()
  ok(sh.bench.length > 0 && sh.bench.every(b => b.on), `anybody can go on (${sh.bench.length})`)
  ok(/uncontested/i.test(sh.text), 'and the sheet says the scrums are uncontested')
  ok((await mineState()).uncontested, 'which they are')
  await page.screenshot({ path: `${OUT}/injury-frontrow-uncontested.png` })
  await page.locator('.squad-sheet .sheet-col').nth(1).locator('.fact-label').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/injury-frontrow-bench.png` })
  await page.locator('.squad-sheet .sheet-row.armed').click()
  await page.waitForTimeout(250)
  ok((await sheet()).goldOn, 'keeping the assistant\'s man answers it')
  await closeSheet()
  ok(await playOn(), 'and the match goes on')

  // ---- 4. nobody left on the bench
  console.log('--- 4. an injury with nobody left on the bench')
  await pause()
  const s4 = await stage('WG', 'empty', 'none')
  console.log(`  staged: ${JSON.stringify(s4)}`)
  ok(!s4.err, 'staged')
  await page.locator('.sheet-casualty').waitFor({ timeout: 5000 })
  sh = await sheet()
  ok(sh.armed == null, 'nobody is armed')
  ok(sh.goldOn, `the door is open straight away ("${sh.goldText.trim()}")`)
  ok(/plays on a player short/i.test(sh.text), 'and the sheet says the side plays on a player short')
  await page.screenshot({ path: `${OUT}/injury-nobody-left.png` })
  await closeSheet()
  ok(await playOn(), 'and the match goes on')

  // ---- 5. full time
  console.log('--- 5. full time')
  for (let i = 0; i < 80; i++) {
    const s = await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      const lm = st.liveMatch
      if (!lm) return 'none'
      if (lm.ctx.seg === 3 && lm.cursor >= lm.events.length) return 'ft'
      if (lm.ctx.decision) { st.decide('posts'); return 'decided' }
      if (lm.ctx.awaiting === 'HT' || lm.ctx.awaiting === 'BRK') {
        if (lm.cursor >= lm.events.length) { st.startSecondHalf(); return 'resumed' }
      }
      if (lm.playing) st.matchCursor(lm.cursor, false)
      st.skipToBreak()
      return 'skipped'
    })
    if (s === 'ft' || s === 'none') break
    if (await page.locator('.sheet-casualty').count()) await closeSheet().catch(() => {})
    await page.waitForTimeout(200)
  }
  await page.waitForSelector('text=Full Time', { timeout: 15000 }).catch(() => {})
  // the result stamp lands and clears first
  await page.waitForTimeout(3500)
  const ft = await page.evaluate(() => document.body.textContent ?? '')
  ok(/full time/i.test(ft), 'the full-time screen is up')
  ok(!/The Highlights/.test(ft), 'with no highlights list on it')
  await page.screenshot({ path: `${OUT}/fulltime.png`, fullPage: false })
} catch (e) {
  console.log('FAIL flow: ' + (e?.message ?? e).split('\n')[0])
  fails++
  await page.screenshot({ path: `${OUT}/injurysheet-fail.png` }).catch(() => {})
} finally {
  await browser.close()
  server.stop()
}
console.log(fails ? `\nINJURY SHEET FAILED (${fails})` : '\nINJURY SHEET PASSED')
done(fails)
