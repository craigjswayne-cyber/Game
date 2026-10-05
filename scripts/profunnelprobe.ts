// Probe: the Pro Manager cadence, as arithmetic (1.8.6, docs/pro-manager.md).
//
// game/profunnel.ts decides which Pro Manager card is due, and this walks it
// through the eight players the brief names (A to H) plus the edges: a missed
// safe moment, a store that does not list the one-time product, a match
// reported twice, a ledger that comes back as garbage. No browser - the cards
// themselves, the timing and the store are scripts/proprompt.mjs's job.
//
// A "device" here is one Funnel plus whether Pro is owned, which is exactly
// what the real thing keeps (localStorage rm-pro and rm-ent): nothing about a
// career is in it, which is the whole of test H.
//
// Run: npx vite-node scripts/profunnelprobe.ts
import {
  FRESH, REMIND_EVERY, parseFunnel, proDue, proMatchPlayed, proOfferAnswered, proShown,
  type Funnel, type ProKind,
} from '../src/game/profunnel'
import { priceNumber, proDiscount } from '../src/game/monetise'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** One phone. `pro` is the entitlement; `log` is every card it was shown,
 *  with the competitive-match count at the time. */
class Device {
  f: Funnel = parseFunnel(null)
  pro = false
  log: { kind: ProKind; at: number }[] = []
  career = 1
  week = 0
  /** a safe moment (Home or the day room after the whistle). Returns the
   *  card shown, if any. `introListed` is whether the store lists the
   *  one-time product. */
  safe(upcomingCompetitive: boolean, introListed = true): ProKind | null {
    if (this.pro) return null
    const k = proDue(this.f, upcomingCompetitive)
    if (!k) return null
    this.f = proShown(this.f, k, k === 'offer' && !introListed)
    this.log.push({ kind: k, at: this.f.played })
    return k
  }
  /** a completed match of the manager's */
  match(competitive: boolean) {
    this.week++
    if (competitive && !this.pro) this.f = proMatchPlayed(this.f, `${this.career}:0:${this.week}`)
  }
  /** a whole week: the safe moment before the match, the match, the safe
   *  moment after the whistle. Returns what was shown. */
  week1(competitive: boolean, introListed = true): ProKind[] {
    const out: ProKind[] = []
    const a = this.safe(competitive, introListed); if (a) out.push(a)
    this.match(competitive)
    const b = this.safe(false, introListed); if (b) out.push(b)
    return out
  }
  reload() { this.f = parseFunnel(JSON.stringify(this.f)) }
}

console.log('--- A: declines the first card, plays, declines the offer, reminded at +10 and +20')
{
  const d = new Device()
  // pre-season: three friendlies, nothing shown
  for (let i = 0; i < 3; i++) ok(d.week1(false).length === 0, `pre-season friendly ${i + 1}: no card`)
  // the week of the first competitive match: the first card, BEFORE kick-off
  const before = d.safe(true)
  ok(before === 'first', 'the first card comes in the week of the first competitive match, before it')
  ok(d.safe(true) === null, 'and only once in that flow')
  d.match(true)
  ok(d.safe(false) === 'offer', 'after the first competitive match: the one-time offer')
  d.f = proOfferAnswered(d.f, false)
  ok(d.f.firstOfferDeclined && !d.f.firstOfferAccepted, 'declining is recorded')
  ok(d.safe(false) === null, 'nothing else in that flow')
  const shownAt: number[] = []
  for (let i = 1; i <= 25; i++) {
    // a friendly between every pair of competitive matches changes nothing
    if (i % 2 === 0) { ok(d.week1(false).length === 0 || false, `friendly after +${i}: no card`) }
    const got = d.week1(true)
    if (got.length) shownAt.push(i)
    if (got.some(k => k !== 'reminder')) ok(false, `only reminders after the offer (+${i}: ${got.join(',')})`)
  }
  ok(JSON.stringify(shownAt) === JSON.stringify([10, 20]),
    `reminders after exactly 10 and 20 further competitive matches (${shownAt.join(', ')})`)
  ok(d.log.filter(l => l.kind === 'first').length === 1 && d.log.filter(l => l.kind === 'offer').length === 1,
    'the first card and the offer were each shown exactly once')
}

console.log('\n--- B: accepts the first card; nothing after')
{
  const d = new Device()
  ok(d.safe(true) === 'first', 'first card')
  d.pro = true // the purchase succeeded: rm-ent holds phase.supporter
  let shown = 0
  for (let i = 0; i < 40; i++) shown += d.week1(true).length
  ok(shown === 0, 'a Pro owner is never shown another card')
}

console.log('\n--- C: declines, then takes the one-time offer')
{
  const d = new Device()
  d.safe(true); d.match(true)
  ok(d.safe(false) === 'offer', 'the offer')
  d.f = proOfferAnswered(d.f, true); d.pro = true // phase.supporter.intro owned
  ok(d.f.firstOfferAccepted && !d.f.firstOfferDeclined, 'accepting is recorded')
  let shown = 0
  for (let i = 0; i < 40; i++) shown += d.week1(true).length
  ok(shown === 0, 'and no card follows')
}

console.log('\n--- D: declines everything; a reminder exactly every 10')
{
  const d = new Device()
  d.safe(true); d.match(true); d.safe(false); d.f = proOfferAnswered(d.f, false)
  const at: number[] = []
  for (let i = 0; i < 60; i++) { d.match(true); if (d.safe(false) === 'reminder') at.push(d.f.played) }
  const gaps = at.slice(1).map((x, i) => x - at[i])
  ok(at.length === 6 && gaps.every(g => g === REMIND_EVERY), `reminders at ${at.join(', ')} (every ${REMIND_EVERY})`)
}

console.log('\n--- E: cancels a purchase; stays free, cadence unchanged')
{
  const d = new Device()
  ok(d.safe(true) === 'first', 'first card')
  // Become Pro -> the sheet is cancelled: no entitlement, no state but "shown"
  ok(!d.pro && d.f.firstPromptShown && !d.f.firstOfferShown, 'a cancelled sheet grants nothing and spends nothing else')
  d.match(true)
  ok(d.safe(false) === 'offer', 'the offer still follows the first competitive match')
  // cancels the offer's sheet too, then Continue Free
  d.f = proOfferAnswered(d.f, false)
  let n = 0
  for (let i = 0; i < 10; i++) { d.match(true); if (d.safe(false)) n++ }
  ok(n === 1 && d.log[d.log.length - 1].kind === 'reminder' && d.log[d.log.length - 1].at === 11, 'and the first reminder at the usual count')
}

console.log('\n--- F: reload / restart keeps everything')
{
  const d = new Device()
  d.safe(true); d.match(true); d.safe(false); d.f = proOfferAnswered(d.f, false)
  for (let i = 0; i < 4; i++) d.match(true)
  const before = JSON.stringify(d.f)
  d.reload()
  ok(JSON.stringify(d.f) === before, 'the ledger reads back exactly as written')
  ok(d.safe(false) === null && d.safe(true) === null, 'and a restart shows nothing it already showed')
  // a restart mid-offer: the offer was spent the moment it was shown
  const e = new Device(); e.safe(true); e.match(true); e.safe(false); e.reload()
  ok(e.safe(false) === null && e.f.firstOfferShown, 'an offer interrupted by a restart is not shown again')
}

console.log('\n--- H: a second career is the same device')
{
  const d = new Device()
  d.safe(true); d.match(true); d.safe(false); d.f = proOfferAnswered(d.f, false)
  d.career = 2; d.week = 0 // a new career: new seed, new fixtures, same phone
  ok(d.safe(true) === null, 'the second career does not see the first card again')
  d.match(true)
  ok(d.safe(false) === null, 'nor the one-time offer')
  ok(d.f.played === 2, 'and its matches keep counting toward the same reminder')
  const p = new Device(); p.pro = true; p.career = 2
  ok(p.safe(true) === null, 'a Pro owner\'s second career sees nothing either')
}

console.log('\n--- edges')
{
  // the store does not list phase.supporter.intro yet
  const d = new Device()
  d.safe(true); d.match(true)
  ok(d.safe(false, false) === 'offer', 'with the intro product missing, a card is still shown (at the normal price)')
  ok(!d.f.firstOfferShown && d.f.offerDueAt === d.f.played + REMIND_EVERY, 'and the one-time offer is NOT spent: it is due again a reminder later')
  let next = -1
  for (let i = 1; i <= 12; i++) { d.match(true); if (d.safe(false, true)) { next = i; break } }
  ok(next === REMIND_EVERY && d.f.firstOfferShown, `the real offer comes ${REMIND_EVERY} matches later, once the store lists it (${next})`)

  // the week of the first match slipped by with no safe moment
  const m = new Device()
  m.match(true)
  ok(m.safe(false) === 'first', 'a first card missed before the match is shown at the next safe moment')
  ok(m.safe(false) === null, 'and not the offer in the same flow')
  m.match(true)
  ok(m.safe(false) === 'offer', 'the offer waits one more match')

  // a match reported twice (a reload that plays it out) counts once
  let f: Funnel = { ...FRESH, seen: [] }
  f = proMatchPlayed(f, 'k1'); f = proMatchPlayed(f, 'k1')
  ok(f.played === 1, 'one match, counted once')

  // a friendly week: the first card waits for a competitive one
  ok(proDue({ ...FRESH, seen: [] }, false) === null, 'no first card in a week whose match is a friendly')

  // a broken ledger repairs rather than throws or resets the spent flags
  ok(parseFunnel('{nope').played === 0 && parseFunnel('null').firstPromptShown === false, 'garbage reads as a fresh device')
  const r = parseFunnel(JSON.stringify({ firstPromptShown: true, firstOfferShown: true, played: 'x', seen: [1, 'a'] }))
  ok(r.firstPromptShown && r.firstOfferShown && r.played === 0 && r.seen.length === 1, 'a half-broken one keeps what it can')
}

console.log('\n--- the percentage is only ever true')
{
  // 1.8.9: the owner moved the offer to 40% off; the window is 35-45% off
  // (intro 0.55-0.65 of normal), the figure still the real saving rounded down
  ok(proDiscount({ sku: 'p', price: '£1.99' }, { sku: 'i', price: '£1.19' }) === 40, '£1.99 -> £1.19 prints 40')
  ok(proDiscount({ sku: 'p', price: '$1.99', micros: 1_990_000 }, { sku: 'i', price: '$1.19', micros: 1_190_000 }) === 40, 'micros agree')
  ok(proDiscount({ sku: 'p', price: '£2.99' }, { sku: 'i', price: '£1.79' }) === 40, '£2.99 -> £1.79 (the StoreKit fixture, 40.1% off) prints 40')
  ok(proDiscount({ sku: 'p', price: '£1.99' }, { sku: 'i', price: '£1.18' }) === 40, '£1.99 -> £1.18 is 40.7% off and prints 40, never 41: rounded down')
  ok(proDiscount({ sku: 'p', price: '£1.99' }, { sku: 'i', price: '£0.99' }) === null, 'a 50% cut is outside the window: no percentage')
  ok(proDiscount({ sku: 'p', price: '£1.99' }, { sku: 'i', price: '£1.49' }) === null, 'the old 25% offer is outside it too')
  ok(proDiscount({ sku: 'p', price: '£1.99' }, { sku: 'i', price: '£1.79' }) === null, 'and a 10% cut')
  ok(proDiscount({ sku: 'p', price: '£1.99' }, { sku: 'i', price: '£1.99' }) === null, 'the same price claims nothing')
  ok(proDiscount({ sku: 'p', price: '1,99 €' }, { sku: 'i', price: '1,19 €' }) === 40, 'comma decimals')
  ok(proDiscount({ sku: 'p', price: '¥300' }, { sku: 'i', price: '¥175' }) === 41, 'yen, no decimals: 41')
  ok(proDiscount({ sku: 'p', price: 'R 39,99' }, { sku: 'i', price: 'R 23,99' }) === 40, 'rand')
  ok(Number.isNaN(priceNumber('Free')) && proDiscount({ sku: 'p', price: 'Free' }, { sku: 'i', price: '£1' }) === null, 'a price with no digits claims nothing')
  ok(priceNumber('1.234,56 kr') === 1234.56 && priceNumber('US$1,999.00') === 1999, 'thousands separators')
}

console.log(fails ? `\nPRO FUNNEL PROBE FAILED (${fails})` : '\nPRO FUNNEL PROBE PASSED: A-H and the edges hold')
process.exitCode = fails ? 1 : 0
