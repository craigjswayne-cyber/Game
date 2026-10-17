import { billingCause, billingReason, bridge, creditAdd, creditCount, creditTake, type PurchaseOutcome } from '../game/monetise'
import { useStore } from '../store'
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
const endingKey = (out: Ending, cause = billingCause(), hasStore = !!bridge()): string => {
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

/**
 * SPEND ONE BANKED CREDIT ON ONE EFFECT, IN THE ORDER THAT CANNOT GIVE IT TWICE
 * (1.9.1).
 *
 * Every door used to grant first and call creditTake after, and none of them
 * read its answer. creditTake refuses when the ledger write fails, so a phone
 * with full storage got the effect and kept the credit: the same purchase
 * granted again on the next tap. And the grant reached the disk only on the
 * save queue's idle timer, so a phone that killed the app inside that window
 * had spent the credit on an effect that never saved.
 *
 * Now: take the credit first and stop if the ledger would not record it (the
 * credit is still there, nothing is lost); grant; give the credit back if the
 * career refused the grant; and wait for the career to be on disk before
 * saying it landed.
 */
export async function spendCredit(sku: string, grant: () => boolean): Promise<'done' | 'refused' | 'storage' | 'none'> {
  // mid-match the career is not written until full time (the save queue
  // holds), so nothing can be spent on it until then
  const st = useStore.getState()
  if (st.liveMatch || st.matchRec) return 'storage'
  // nothing banked is its own answer, not a storage fault: creditTake says no
  // to both, and the player should hear the right one (1.9.1 security re-audit)
  if (creditCount(sku) < 1) return 'none'
  if (!creditTake(sku)) return 'storage'
  let landed = false
  try {
    landed = grant()
  } catch (e) {
    creditAdd(sku)
    throw e
  }
  if (!landed) { creditAdd(sku); return 'refused' }
  // ON DISK OR NOT AT ALL (1.9.1 re-audit, N2). A full phone failed the write
  // and this still said 'done': the credit was gone and the effect lived only
  // in memory until the app was closed. If the career did not reach the disk,
  // the credit goes back and the career is reopened from its save, so the
  // effect and the credit are never both lost and never both kept.
  if (await useStore.getState().persistNow()) return 'done'
  creditAdd(sku)
  await useStore.getState().revertToDisk()
  return 'storage'
}
