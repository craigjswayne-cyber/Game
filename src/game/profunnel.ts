/**
 * ---- WHEN THE GAME MAY MENTION PRO MANAGER (1.8.6) ----
 *
 * docs/pro-manager.md is the brief; this is its arithmetic. Three cards, and
 * the rules that keep them from becoming a nag:
 *
 *   FIRST    - once ever, before the first competitive match: what Pro is and
 *              what it costs, with Continue Free beside it at equal weight.
 *   OFFER    - once ever, after the first completed competitive match: the
 *              same product at the one-time price (PRO_INTRO_SKU).
 *   REMINDER - after that, one light card per ten competitive matches played
 *              while free.
 *
 * ALL OF IT IS DEVICE STATE, NEVER CAREER STATE. It lives in localStorage
 * beside the entitlement ledger (rm-ent), so a new career, a club change, a
 * language switch, a restart, a save loaded or imported and a new season all
 * leave it exactly where it was - and no save format changes. A reinstall
 * clears it, which docs/pro-manager.md says plainly.
 *
 * NOTHING HERE TOUCHES THE SIMULATION. It counts matches the store layer has
 * already finished, reads no rng and writes nothing into a GameState, so the
 * fingerprint cannot move. And nothing leaves the device: these are three
 * flags and two counters, not analytics (scripts/netprobe.ts).
 *
 * The decision functions are PURE (state in, state out) so the cadence is
 * tested without a browser (scripts/profunnelprobe.ts); the storage wrappers
 * below are the only impure part.
 */

export type ProKind = 'first' | 'offer' | 'reminder'

export interface Funnel {
  v: 1
  firstPromptShown: boolean
  firstOfferShown: boolean
  firstOfferAccepted: boolean
  firstOfferDeclined: boolean
  /** competitive matches completed on this device while free */
  played: number
  /** the offer is not tried before this count (moved on when the store did
   *  not list the intro product and the normal one was shown instead) */
  offerDueAt: number
  /** the next reminder is due at this count; 0 until the offer is resolved */
  remindAt: number
  /** the count when a card was last shown: at most one per match flow */
  lastShownAt: number
  /** the last few matches counted, so one match is never counted twice (a
   *  reload that plays a match out, a duplicate finish) */
  seen: string[]
}

/** How many competitive matches between reminders. */
export const REMIND_EVERY = 10

export const FRESH: Funnel = {
  v: 1, firstPromptShown: false, firstOfferShown: false, firstOfferAccepted: false, firstOfferDeclined: false,
  played: 0, offerDueAt: 1, remindAt: 0, lastShownAt: -1, seen: [],
}

const int = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : d)

/** Read back whatever was stored, repairing anything malformed to FRESH's
 *  value for that field rather than throwing the whole record away. */
export function parseFunnel(raw: string | null): Funnel {
  if (!raw) return { ...FRESH, seen: [] }
  try {
    const o = JSON.parse(raw) as Partial<Funnel>
    if (!o || typeof o !== 'object') return { ...FRESH, seen: [] }
    return {
      v: 1,
      firstPromptShown: o.firstPromptShown === true,
      firstOfferShown: o.firstOfferShown === true,
      firstOfferAccepted: o.firstOfferAccepted === true,
      firstOfferDeclined: o.firstOfferDeclined === true,
      played: Math.max(0, int(o.played, 0)),
      offerDueAt: Math.max(1, int(o.offerDueAt, 1)),
      remindAt: Math.max(0, int(o.remindAt, 0)),
      lastShownAt: int(o.lastShownAt, -1),
      seen: Array.isArray(o.seen) ? o.seen.filter((k): k is string => typeof k === 'string').slice(-8) : [],
    }
  } catch { return { ...FRESH, seen: [] } }
}

/**
 * WHICH CARD, IF ANY, IS DUE.
 *
 * `upcomingCompetitive` is whether the manager's match this week counts - the
 * first card waits for the week of the first competitive match, so a pre-season
 * of friendlies does not open with a sales pitch.
 *
 * If that week slipped past without a safe moment to show it (a match kicked
 * off straight from the desk), the first card simply comes next, and the offer
 * waits one more match: the order never changes and nothing doubles up.
 */
export function proDue(f: Funnel, upcomingCompetitive: boolean): ProKind | null {
  // one card per match flow, whichever it was
  if (f.lastShownAt >= 0 && f.lastShownAt === f.played) return null
  if (!f.firstPromptShown) return f.played > 0 || upcomingCompetitive ? 'first' : null
  if (!f.firstOfferShown) return f.played >= Math.max(1, f.offerDueAt) ? 'offer' : null
  return f.remindAt > 0 && f.played >= f.remindAt ? 'reminder' : null
}

/** The state after a card has been put on screen.
 *
 *  `fallback` is the offer shown WITHOUT its product: the store did not list
 *  PRO_INTRO_SKU, so the card offered Pro at the normal price with no discount
 *  wording. The one-time offer is then NOT spent - it is tried again a
 *  reminder's distance later - and it counts as this flow's card. */
export function proShown(f: Funnel, kind: ProKind, fallback = false): Funnel {
  const n: Funnel = { ...f, seen: [...f.seen], lastShownAt: f.played }
  if (kind === 'first') n.firstPromptShown = true
  else if (kind === 'offer') {
    if (fallback) n.offerDueAt = f.played + REMIND_EVERY
    else { n.firstOfferShown = true; n.remindAt = f.played + REMIND_EVERY }
  } else {
    let next = Math.max(f.remindAt, 1) + REMIND_EVERY
    while (next <= f.played) next += REMIND_EVERY
    n.remindAt = next
  }
  return n
}

/** The offer's answer. Declining is for ever; so is accepting, which is the
 *  sale. Nothing else changes: the next card is a reminder either way. */
export function proOfferAnswered(f: Funnel, accepted: boolean): Funnel {
  return { ...f, seen: [...f.seen], firstOfferAccepted: f.firstOfferAccepted || accepted, firstOfferDeclined: f.firstOfferDeclined || !accepted }
}

/** One competitive match completed while free. `key` names the match so a
 *  second report of the same one changes nothing. */
export function proMatchPlayed(f: Funnel, key: string): Funnel {
  if (f.seen.includes(key)) return f
  return { ...f, played: f.played + 1, seen: [...f.seen, key].slice(-8) }
}

// ---- the device ledger ----

export const FUNNEL_KEY = 'rm-pro'

export function readFunnel(): Funnel {
  try { return parseFunnel(globalThis.localStorage?.getItem(FUNNEL_KEY) ?? null) } catch { return { ...FRESH, seen: [] } }
}

/** TRUE ONLY IF IT STUCK. A device that cannot remember a card was shown
 *  would show it again on every visit, so the prompt asks this before it
 *  opens and stays shut on a false (private mode, a full disk). */
export function writeFunnel(f: Funnel): boolean {
  try {
    const s = JSON.stringify(f)
    globalThis.localStorage?.setItem(FUNNEL_KEY, s)
    return globalThis.localStorage?.getItem(FUNNEL_KEY) === s
  } catch { return false }
}
