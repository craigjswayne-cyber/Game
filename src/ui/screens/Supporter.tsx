import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import { buySupporter, canBuy, hasSupporter, restore, supporterPrice } from '../../game/monetise'
import { t } from '../../game/i18n'

/**
 * The till, and the only one in the game.
 *
 * It is reachable only where there is a store behind it (see monetise.ts): the
 * web build has no bridge, so this screen has no door in the menu and nobody
 * ever meets a button that cannot work.
 *
 * What it sells is deliberately almost nothing - the advertising stops and the
 * title screen carries a mark - because the alternative is a management game
 * where the man who paid gets better players, and that is a different game with
 * a worse reputation. The page says so in as many words, because a player who
 * suspects the till of touching the simulation will never trust a result again.
 *
 * Every ending of a purchase gets a sentence, including the two nobody
 * remembers: a cancel (which is not an error and must not be shouted about) and
 * a pending purchase (Play can hold one for days while a parent approves it -
 * telling somebody who has paid that they have not is the worst of the five).
 */
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

      <div className="muted" style={{ padding: '10px 16px', fontSize: 12 }}>{t('supporter.fineprint')}</div>
      <div className="spacer" />
    </>
  )
}
