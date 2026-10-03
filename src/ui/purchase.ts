import { billingCause, billingReason, bridge, type PurchaseOutcome } from '../game/monetise'
import { t } from '../game/i18n'

/** Every way a tap on Buy can end, including the ones the store never reaches. */
export type Ending = PurchaseOutcome | 'error'

/**
 * WHICH SENTENCE, FROM THE OUTCOME AND THE CAUSE (1.8.3).
 *
 * A player read "not on sale in your country" off a refusal that the store
 * had given for some other reason, because 'refused' had one sentence for
 * every refusal and that sentence guessed. The shells now say which kind of
 * "no" it was, and each kind has its own line:
 *
 *   notOffered  - the store answered and did not list this product here
 *   disabled    - purchases are switched off on this device
 *   playBilling - Google Play would not take payment on this account
 *   unreachable - the store did not answer
 *   config      - a set-up fault on our side
 *
 * Without a cause (an older shell, an injected wrapper) the line says only
 * what is true of every cause behind that word. "No store attached to this
 * build" is kept for the one case it describes: no bridge at all.
 */
export const endingKey = (out: Ending, cause = billingCause(), hasStore = !!bridge()): string => {
  if (out === 'cancelled') return 'supporter.cancelled'
  if (out === 'pending') return 'supporter.pending'
  if (out === 'owned') return 'supporter.error' // never shown: an owned ending is a sale
  if (out === 'unavailable' && !hasStore) return 'supporter.unavailable'
  if (out === 'unavailable' || out === 'refused') {
    switch (cause) {
      case 'notOffered': return 'supporter.notOffered'
      case 'disabled': return 'supporter.disabled'
      case 'playBilling': return 'supporter.playBilling'
      case 'unreachable': return 'supporter.error'
      case 'config': return 'supporter.setup'
      default: return out === 'refused' ? 'supporter.refused' : 'supporter.notNow'
    }
  }
  return 'supporter.error'
}

/**
 * What a purchase says when it ends, plus - on a refusal only - the store's own
 * words for why. A player who pressed Back gets one short line and nothing
 * else; a store that would not open the sheet gets named, because otherwise the
 * fault is invisible from inside the game.
 *
 * SHARED, since Full Fitness started selling from the medical room and the
 * country desk as well as the Store (v1.1.14). Three copies of a purchase
 * ending is three chances for one of them to start lying about a refusal.
 */
export const endingText = (out: Ending) => {
  const line = t(endingKey(out))
  const why = out === 'refused' ? billingReason() : null
  return why ? `${line} (${why})` : line
}
