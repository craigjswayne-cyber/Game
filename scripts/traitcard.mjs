// Probe: the player page names who a man is, and only as far as the club knows.
//
// THE CHARACTER CARD (1.9.0). The signature trait (attributes.ts deriveTrait)
// and the personality have driven the match engine and the office for many
// releases and no screen named either. The card that names them must also keep
// the scouting gate the temper card keeps: an unscouted man at another club
// gives nothing away, the trait arrives with a detailed report, the personality
// only with the full file. And the attribute page must read in four honest
// groups, with every figure on the attribute-times-five grid the engine
// actually plays (the old -2..+2 per-player offset was decoration).
//
// Saves a 412px screenshot of the profile and the attributes tab under
// shots/traitcard/ for a human to look at.
//
// Run: npm run build && node scripts/traitcard.mjs [port]
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, writeSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'
import { ok, done } from './lib/probe.mjs'

const server = await startPreview(0, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
mkdirSync('shots/traitcard', { recursive: true })
const EN = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'))

const openPlayer = async (page, id) => {
  await page.evaluate(pid => { const S = window.rugbyStore.getState(); S.touch(); S.go('player', pid) }, id)
  await page.waitForSelector('.tab-bar', { timeout: 6000 })
  await page.waitForTimeout(250)
}

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
  page.setDefaultTimeout(6000)
  await page.addInitScript(() => { localStorage.setItem('rm-lang', 'en') })
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('bath', 'Trait Card'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})

  // ---- 1. your own man with a trait: named, with what it does
  const own = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && q.trait && !q.acad)
    return p ? { id: p.id, trait: p.trait, pers: p.pers } : null
  })
  ok(!!own, `your squad has a man with a signature trait${own ? ` (${own.trait})` : ''}`)
  if (own) {
    await openPlayer(page, own.id)
    const card = page.locator('[data-testid="char-card"]')
    ok(await card.count() === 1, 'his profile carries the character card')
    const trait = (await page.locator('[data-testid="char-trait"]').innerText().catch(() => '')).trim()
    ok(trait.startsWith(own.trait), `the trait is named: "${trait.slice(0, 70)}"`)
    // the description follows the name, and is a sentence rather than a key
    const desc = trait.slice(own.trait.length).replace(/^\s*·\s*/, '')
    ok(desc === EN.traitFx[own.trait], `with one line on what it does: "${desc.slice(0, 70)}"`)
    const pers = (await page.locator('[data-testid="char-pers"]').innerText().catch(() => '')).trim()
    ok(pers === `${own.pers} · ${EN.persFx[own.pers]}`, `and his personality, with what it means: "${pers.slice(0, 70)}"`)
    await page.screenshot({ path: 'shots/traitcard/profile-412.png', fullPage: true })

    // ---- 2. four honest groups, and each figure is his attribute out of a
    // hundred with the fixed per-player fifth the owner asked for (fineAttr:
    // "37 or 86", kept in 1.9.0 by the owner's choice)
    await page.click('.tab-bar >> text=Attributes')
    await page.waitForSelector('.fm-attrs')
    const heads = await page.locator('.fm-col-head').allInnerTexts()
    const want = ['SET PIECE & CONTACT', 'SKILLS', 'PHYSICAL', 'MENTAL']
    ok(heads.length === 4 && heads.every((h, i) => h.trim().toUpperCase() === want[i]), `four attribute groups render: ${heads.join(' / ')}`)
    const counts = await page.locator('.fm-col').evaluateAll(cols => cols.map(c => c.querySelectorAll('.fm-attr').length))
    ok(counts.join(',') === '5,4,3,6', `holding 5, 4, 3 and 6 attributes (${counts.join(', ')})`)
    const chips = (await page.locator('.fm-attr .fm-chip').allInnerTexts()).map(s => s.trim())
    const off = chips.filter(s => !/^\d+$/.test(s) || Number(s) < 1 || Number(s) > 100)
    ok(chips.length === 18 && off.length === 0, `all ${chips.length} of his figures are whole numbers out of a hundred${off.length ? `; off: ${off.join(', ')}` : ''}`)
    // and each is within two of his attribute times five
    const truth = await page.evaluate(pid => {
      const p = window.rugbyStore.getState().game.players[pid]
      return ['scr', 'lin', 'ruc', 'tac', 'str', 'han', 'pas', 'kic', 'goa', 'pac', 'agi', 'sta', 'vis', 'dec', 'pos', 'wor', 'agg', 'lea'].map(k => String(p.a[k] * 5))
    }, own.id)
    ok(chips.length === truth.length && chips.every((c, i) => Math.abs(Number(c) - Number(truth[i])) <= 2), 'every figure is the engine\'s attribute times five, give or take the fixed fifth')
    await page.screenshot({ path: 'shots/traitcard/attributes-412.png', fullPage: true })
  }

  // ---- 3. an unscouted man at another club gives nothing away
  const opp = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    const p = Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && q.trait && !q.acad && !g.shortlist.includes(q.id))
    if (!p) return null
    p.sc = 20
    return { id: p.id, trait: p.trait, pers: p.pers }
  })
  ok(!!opp, `another club has a man with a trait to test the gate on${opp ? ` (${opp.trait}, ${opp.pers})` : ''}`)
  if (opp) {
    await openPlayer(page, opp.id)
    await page.click('.tab-bar >> text=Profile')
    await page.waitForTimeout(200)
    const text = await page.locator('[data-testid="char-card"]').innerText().catch(() => '')
    ok(text.length > 0, 'his page still has the card, saying what is not known')
    ok(await page.locator('[data-testid="char-trait-hidden"]').count() === 1 && await page.locator('[data-testid="char-pers-hidden"]').count() === 1,
      'both the trait and the personality read as not known yet')
    ok(!text.includes(opp.trait) && !text.includes(opp.pers), `neither "${opp.trait}" nor "${opp.pers}" is on the card`)
    const body = await page.locator('body').innerText()
    ok(!body.includes(EN.traitFx[opp.trait]) && !body.includes(EN.persFx[opp.pers]), 'and nothing else on the page describes them either')
    await page.screenshot({ path: 'shots/traitcard/unscouted-412.png', fullPage: true })

    // ---- 4. a detailed report shows the trait; the personality waits for the full file
    await page.evaluate(pid => { window.rugbyStore.getState().game.players[pid].sc = 60 }, opp.id)
    await openPlayer(page, opp.id)
    const t2 = await page.locator('[data-testid="char-card"]').innerText().catch(() => '')
    ok(t2.includes(opp.trait) && await page.locator('[data-testid="char-pers-hidden"]').count() === 1,
      'at a detailed report the trait is named and the personality is still hidden')
    await page.evaluate(pid => { window.rugbyStore.getState().game.players[pid].sc = 95 }, opp.id)
    await openPlayer(page, opp.id)
    const t3 = await page.locator('[data-testid="char-card"]').innerText().catch(() => '')
    ok(t3.includes(opp.trait) && t3.includes(opp.pers), 'with the full file both are named')
  }
  await page.close()
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

done('TRAIT CARD', 'a man\'s character is named, as far as the club knows it', { exit: true })
