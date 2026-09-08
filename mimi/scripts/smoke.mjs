/*
 * ---- THE SMOKE TEST FOR MADE BY MIMI ----
 *
 * Serves this directory, drives a real Chromium through the whole app, and
 * fails on any console error, any page exception, or any step that does not do
 * what it says. It walks the intake, both workout filters, a logged session
 * with its rest timer, every habit on the tracker, the macro calculator, the
 * recipe vault, the analytics, a breathing session, a community post, a
 * coaching check-in, and it reloads at the end to prove the save survives.
 *
 * One of the steps posts markup into the feed and checks it did not run. That
 * is the only defence this app has against a person's own text, so it is
 * checked rather than assumed.
 *
 * Run:  node mimi/scripts/smoke.mjs
 * Shots land in mimi/shots/ (gitignored). Needs playwright-core, which the
 * repository already carries, and a Chromium: set CHROME to point at one, or
 * let it find the usual Playwright location.
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { mkdirSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SHOTS = join(ROOT, 'shots')
const PORT = Number(process.env.PORT || 4173)
const BASE = `http://127.0.0.1:${PORT}`

const CHROME = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium',
  join(process.env.PLAYWRIGHT_BROWSERS_PATH || '', 'chromium'),
].find((p) => p && existsSync(p))

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, BASE)
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  const file = join(ROOT, rel === '/' ? 'index.html' : rel)
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})

mkdirSync(SHOTS, { recursive: true })
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const errors = []
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) })
const step = async (label, fn) => {
  try { await fn(); console.log(`PASS  ${label}`) }
  catch (e) { errors.push(`${label}: ${e.message}`); console.log(`FAIL  ${label}: ${e.message}`) }
}

await page.goto(BASE, { waitUntil: 'load' })

await step('intake renders', async () => {
  await page.waitForSelector('.onb')
  await page.fill('[data-text="name"]', 'Sam')
  await shot('01-intake')
})

await step('intake completes', async () => {
  await page.click('[data-next]')                       // welcome to level
  await page.click('[data-pick="intermediate"]')
  await page.click('[data-next]')                       // level to environment
  await page.click('[data-pick="gym"]')
  await page.click('[data-next]')                       // environment to discipline
  await page.click('[data-pick="hybrid"]')              // strength is already on
  await page.click('[data-next]')                       // discipline to goals
  await page.click('[data-pick="endurance"]')
  await page.click('[data-next]')                       // goals to metrics
  await shot('02-metrics')
  await page.click('[data-next]')                       // metrics to habits
  await page.click('[data-next]')                       // finish
  await page.waitForSelector('.tabbar')
})

await step('home shows the next session', async () => {
  const txt = await page.textContent('.card--brand')
  if (!/Up next|Pick a block/.test(txt)) throw new Error(`unexpected hero: ${txt.slice(0, 60)}`)
  await shot('03-home')
})

await step('workout filters', async () => {
  await page.click('.tabbar button:nth-child(2)')
  await page.click('[data-env="both"]')
  await page.click('[data-disc="strength"]')
  if (await page.locator('.card--tap').count() < 1) throw new Error('no programmes listed')
  await shot('04-workouts')
})

await step('exercise library', async () => {
  await page.click('[data-tab="library"]')
  await page.click('.listrow')
  await page.waitForSelector('.video')
  await shot('05-exercise')
})

await step('programme detail', async () => {
  await page.goto(`${BASE}/#/program/strong-foundations`)
  await page.waitForSelector('[data-enrol]')
  await page.click('[data-week="2"]')
  await shot('06-program')
})

await step('session logging and rest timer', async () => {
  await page.goto(`${BASE}/#/session/strong-foundations/1/d1`)
  await page.waitForSelector('.setrow')
  await page.fill('.setrow input[data-field="weight"]', '40')
  await page.fill('.setrow input[data-field="reps"]', '8')
  await page.click('.setrow [data-tick]')
  await page.waitForSelector('.timer')
  if (await page.textContent('[data-sets-done]') !== '1') throw new Error('set counter did not move')
  await shot('07-session')
  await page.click('[data-rest-skip]')
  if (await page.locator('.timer').count()) throw new Error('rest timer outlived skip')
  await page.click('[data-finish]')
  await page.waitForSelector('.cal')
})

await step('tracker habits', async () => {
  await page.click('[data-water="250"]')
  await page.click('[data-water="500"]')
  await page.click('[data-mood="strong"]')
  await page.fill('[data-todo-input]', 'Walk before the call')
  await page.click('[data-todo-form] button[type="submit"]')
  const todo = await page.locator('.todo label').first().textContent()
  if (!todo.includes('Walk')) throw new Error('to-do not saved')
  if (!(await page.textContent('main')).includes('750ml')) throw new Error('water did not add up')
  await shot('08-tracker')
})

await step('macro calculator', async () => {
  await page.click('.tabbar button:nth-child(4)')
  await page.click('[data-goal="cut"]')
  const kcal = Number((await page.textContent('.card--brand h1')).replace(/[^0-9]/g, ''))
  if (!(kcal >= 1200 && kcal < 5000)) throw new Error(`implausible target: ${kcal}`)
  await shot('09-nutrition')
})

await step('recipe vault', async () => {
  await page.click('[data-tab="vault"]')
  await page.click('[data-tag="High protein"]')
  await page.click('.listrow')
  await page.waitForSelector('[data-fav]')
  await shot('10-recipe')
})

await step('analytics', async () => {
  await page.goto(`${BASE}/#/account`)
  await page.waitForSelector('.bars')
  await shot('11-account')
})

await step('mindset breathing', async () => {
  await page.goto(`${BASE}/#/mindset/box-breath`)
  await page.click('[data-breath-start]')
  await page.waitForTimeout(400)
  if (!(await page.locator('.orb.is-in').count())) throw new Error('the orb never opened')
  await shot('12-mindset')
  await page.click('[data-complete]')
})

await step('community post', async () => {
  await page.goto(`${BASE}/#/community`)
  await page.fill('[data-post-input]', 'First week done and I am still standing.')
  await page.click('[data-post-form] button[type="submit"]')
  await page.waitForTimeout(150)
  if (!(await page.textContent('.post')).includes('still standing')) throw new Error('post not rendered')
  await shot('13-community')
})

await step('coaching check-in', async () => {
  await page.goto(`${BASE}/#/coaching`)
  await page.click('[data-checkin]')
  await page.waitForSelector('.sheet')
  await page.fill('textarea[name="wins"]', 'Hit every session.')
  await page.click('.sheet button[type="submit"]')
  await page.waitForTimeout(200)
  if (!(await page.textContent('main')).includes('Hit every session')) throw new Error('check-in not stored')
  await shot('14-coaching')
})

await step('a post cannot carry markup', async () => {
  await page.goto(`${BASE}/#/community`)
  await page.fill('[data-post-input]', '<img src=x onerror="window.__pwned=1">')
  await page.click('[data-post-form] button[type="submit"]')
  await page.waitForTimeout(250)
  if (await page.evaluate(() => window.__pwned)) throw new Error('markup in a post executed')
})

await step('the save survives a reload', async () => {
  await page.goto(`${BASE}/#/tracker`)
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.cal')
  const txt = await page.textContent('main')
  if (!txt.includes('Walk before the call')) throw new Error('to-do lost on reload')
  if (!txt.includes('750ml')) throw new Error('water lost on reload')
})

await browser.close()
server.close()

if (errors.length) {
  console.error(`\nSMOKE FAILED (${errors.length})`)
  errors.forEach((e) => console.error(`  ${e}`))
  process.exit(1)
}
console.log(`\nSMOKE PASSED (shots in ${SHOTS})`)
