import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import { LICENSE_SKU, buyOwnable, buySupporter, canBuy, hasSupporter, hasEntitlement, restore, skuPrice, supporterPrice, tillOpen } from '../../game/monetise'
import { t } from '../../game/i18n'

/**
 * The till's quiet shelf.
 *
 * It is reachable only where there is a store behind it (see monetise.ts): the
 * web build has no bridge, so this screen has no door in the menu and nobody
 * ever meets a button that cannot work.
 *
 * The quiet shelf. Remove Ads (the original supporter purchase) and the
 * Manager's License live here; what touches a club's money lives in the
 * Boardroom on the Finances screen, written as club business. This page still
 * says plainly what each thing does and does not do, because a player who
 * suspects the till of touching the simulation behind his back will never
 * trust a result again - v1.1.0's rule is that power is sold openly, bounded
 * where it is cheap, and stamped on the save that uses it (grants.ts).
 *
 * Every ending of a purchase gets a sentence, including the two nobody
 * remembers: a cancel (which is not an error and must not be shouted about) and
 * a pending purchase (Play can hold one for days while a parent approves it -
 * telling somebody who has paid that they have not is the worst of the five).
 */
/** The Manager's License: bought once for the account here, chosen per career
 *  in the New Career wizard's final step. Rendered only where a store bridge
 *  exists, like every purchase surface. */
function LicenseShelf() {
  const claim = useStore(s => s.claimSupporter)
  const [price, setPrice] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const open = tillOpen()
  useEffect(() => { if (open) void skuPrice(LICENSE_SKU).then(setPrice) }, [open])
  if (!open) return null
  const owned = hasEntitlement(LICENSE_SKU)

  const doBuy = async () => {
    setBusy(true)
    const out = await buyOwnable(LICENSE_SKU)
    setBusy(false)
    if (out === 'owned') claim()
    setMsg(t(out === 'owned' ? 'till.licenseThanks'
      : out === 'cancelled' ? 'supporter.cancelled'
      : out === 'pending' ? 'supporter.pending'
      : out === 'unavailable' ? 'supporter.unavailable'
      : 'supporter.error'))
  }

  return (
    <>
      <SectionTitle sub={t('till.licenseSub')}>{t('till.licenseTitle')}</SectionTitle>
      <div className="card" style={owned ? { borderLeft: '4px solid var(--gold)' } : undefined}>
        <div className="meta">{t(owned ? 'till.licenseOwned' : 'till.licenseBody')}</div>
        {!owned && (
          <button className="btn gold block" style={{ marginTop: 8 }} disabled={busy} onClick={() => { void doBuy() }}>
            {price ? t('till.buyFor', { price }) : t('till.buy')}
          </button>
        )}
        {msg && <div className="meta sheet-log" style={{ marginTop: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg}</div>}
      </div>
    </>
  )
}

export default function Supporter() {
  const supporter = useStore(s => s.supporter)
  const claim = useStore(s => s.claimSupporter)
  const [price, setPrice] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void supporterPrice().then(setPrice) }, [])

  const doBuy = async () => {
    setBusy(true)
    const out = await buySupporter()
    setBusy(false)
    if (out === 'owned') claim()
    setMsg(t(out === 'owned' ? 'supporter.thanks'
      : out === 'cancelled' ? 'supporter.cancelled'
      : out === 'pending' ? 'supporter.pending'
      : out === 'unavailable' ? 'supporter.unavailable'
      : 'supporter.error'))
  }

  const doRestore = async () => {
    setBusy(true)
    const changed = await restore()
    setBusy(false)
    if (changed) claim()
    setMsg(t(changed ? 'supporter.restored' : hasSupporter() ? 'supporter.alreadyYours' : 'supporter.nothingToRestore'))
  }

  return (
    <>
      <SectionTitle sub={t('supporter.sub')}>{t('supporter.title')}</SectionTitle>

      {supporter ? (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="fact-label">{t('supporter.ownedTitle')}</div>
          <div className="meta">{t('supporter.ownedBody')}</div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="fact-label">{t('supporter.whatTitle')}</div>
            <div className="meta">{t('supporter.whatBody')}</div>
          </div>
          <div className="card">
            <div className="fact-label">{t('supporter.notTitle')}</div>
            <div className="meta">{t('supporter.notBody')}</div>
          </div>
          {canBuy() && (
            <button className="btn gold block" style={{ margin: '4px 14px' }} disabled={busy} onClick={() => { void doBuy() }}>
              {price ? t('supporter.buyPriced', { price }) : t('supporter.buy')}
            </button>
          )}
        </>
      )}

      <button className="btn ghost block" style={{ margin: '4px 14px' }} disabled={busy} onClick={() => { void doRestore() }}>
        {t('supporter.restore')}
      </button>
      {msg && <div className="meta sheet-log" style={{ margin: '0 16px' }}>{msg}</div>}

      <LicenseShelf />

      <div className="muted" style={{ padding: '10px 16px', fontSize: 12 }}>{t('supporter.fineprint')}</div>
      <div className="spacer" />
    </>
  )
}
