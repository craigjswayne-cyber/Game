import { billingReason, type PurchaseOutcome } from '../game/monetise'
import { t } from '../game/i18n'

/** Every way a tap on Buy can end, including the ones the store never reaches. */
export type Ending = PurchaseOutcome | 'error'

const endingKey = (out: Ending) =>
  out === 'cancelled' ? 'supporter.cancelled'
    : out === 'pending' ? 'supporter.pending'
      : out === 'unavailable' ? 'supporter.unavailable'
        : out === 'refused' ? 'supporter.refused'
          : 'supporter.error'

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
