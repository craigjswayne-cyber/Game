# Selling the game without breaking it

The game has never made a network call, and the "no data collected" answer on
both store questionnaires rests on that. Monetisation is the likeliest way to
lose it, so the whole design here is arranged around keeping it.

**The rule: the game never talks to a store. The shell around it does.**

`src/game/monetise.ts` is the only file that knows a store can exist, and even
it holds no transport. It looks for an object a packaged shell has injected -
`globalThis.rmBilling` for purchases, `globalThis.rmAds` for advertising - and
calls methods on it. The web build has neither, so it has no purchase door, no
ad slot, and no code path that could reach the network. Same bundle, same
source; the difference is entirely what the container puts in front of it.

Two probes hold the line:

* `scripts/netprobe.ts` sweeps everything that ships for fetch, XHR, beacons,
  sockets, third-party SDK names, remote fonts and absolute URLs, and fails the
  suite on any of them.
* `scripts/moneyprobe.ts` holds the four rules below.
* `scripts/storeprobe.mjs` runs the real build in a browser: no till by default,
  a working one with a bridge injected.

## The four rules

1. **It fails open.** A bridge that is missing, broken, offline or slow never
   takes anything away. The cached receipt stands on its own - a supporter on a
   plane is still a supporter - and a failed check can only fail to *add*.
2. **Nothing behind the till touches the simulation.** No player, no budget, no
   form, no result. What is sold is the absence of advertising and a mark on the
   title screen, which means a purchase can never be an advantage, and the
   balance harnesses never have to know this exists.
3. **Every ending is handled.** `owned`, `cancelled`, `pending`, `unavailable`,
   `error` - each gets its own sentence, and only `owned` grants anything.
   `pending` is the one that gets forgotten: Play can hold a purchase for days
   while a parent approves it, and telling somebody who has paid that they have
   not is the worst failure on the list.
4. **The receipt is not in the save.** Entitlement lives in `localStorage` under
   `rm-ent`, beside the night-mode flag. A career stays portable between a free
   phone and a paid one, and losing a receipt can never cost anybody a season.

## The two editions

`VITE_EDITION` at build time:

| Value | Who it is for | What the player sees |
|---|---|---|
| `free` (default) | the web build, and a free store listing | the Supporter page exists only when a bridge is there to open it |
| `paid` | a premium up-front listing | everybody is already a supporter: no ads, no purchase UI, no restore needed |

```sh
VITE_EDITION=paid npm run build     # premium listing
npm run build                       # what this repository deploys
```

## Wiring a store

### Android, inside a TWA (Play Billing)

Play's Digital Goods API is available to a Trusted Web Activity that declares
the billing permission. The shell is a few lines of JavaScript injected before
the app boots - see `packaging/twa/README.md` for where it goes:

```js
// runs in the TWA, before the bundle loads
const svc = await window.getDigitalGoodsService('https://play.google.com/billing')
globalThis.rmBilling = {
  async details(sku) {
    const [d] = await svc.getDetails([sku])
    return d ? { sku, price: d.price.value + ' ' + d.price.currency, title: d.title } : null
  },
  // optional, and worth having: the shelf's health check prices every product
  // it sells in ONE call with one deadline. Without this it asks one sku at a
  // time, and a slow service answers some in time and lets the rest expire -
  // which reported "2 of 10" about a store that was selling all ten (v1.2.3).
  async detailsMany(skus) {
    const got = await svc.getDetails(skus)
    return got.map(d => ({ sku: d.itemId, price: d.price.value + ' ' + d.price.currency, title: d.title }))
  },
  async buy(sku) {
    try {
      const req = new PaymentRequest(
        [{ supportedMethods: 'https://play.google.com/billing', data: { sku } }],
        { total: { label: 'Total', amount: { currency: 'GBP', value: '0' } } })
      const res = await req.show()
      const token = res.details.token
      // acknowledge, or Play refunds it automatically after three days
      await svc.acknowledge(token, 'onetime')
      await res.complete('success')
      return 'owned'
    } catch (e) {
      return e?.name === 'AbortError' ? 'cancelled' : 'error'
    }
  },
  async owned() {
    return (await svc.listPurchases()).map(p => p.itemId)
  },
}
```

Three things Play will fail a review over, all handled above: acknowledging the
purchase (an unacknowledged one is auto-refunded), treating an `AbortError` as a
cancellation rather than a failure, and offering a restore path
(`listPurchases`) for a reinstall.

### iOS, inside a WKWebView wrapper (StoreKit)

The native side owns StoreKit and posts results back; the injected bridge is the
same three methods over a message handler. `restore` maps to
`AppStore.sync()` / restoring completed transactions, which Apple requires as a
visible, user-initiated button - the Supporter page has one, and it is the
reason that page stays reachable after a purchase.

### Advertising

`globalThis.rmAds` gets `mount(el, place)` and `unmount(el)`. The provider owns
everything inside the element it is handed. Only two places are declared -
`home-foot` and `results-foot` - and `AD_PLACES` is asserted in the probe to
contain nothing inside a match, a modal or the title screen.

Turning ads on has consequences the free-and-silent build does not have: an ad
SDK collects data, so both store privacy questionnaires change, the privacy
policy needs a section naming the network, and (in the EU) a consent flow is
required before the first request. None of that is written yet, deliberately -
it should only be written if the owner decides to run ads, and the honest
default is the one shipping today, which is no ads at all.

## What is *not* here

No subscriptions, no consumables, no currency, no loot mechanic, no timers, no
energy. One non-consumable, bought once, restorable. That is also the cheapest
thing to get through review and the cheapest thing to keep truthful in a privacy
policy - and it is the only model that leaves rule 2 intact.
