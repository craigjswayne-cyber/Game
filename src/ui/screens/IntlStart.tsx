import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { t } from '../../game/i18n'
import { PINNACLE_SKU, buyOwnable, hasEntitlement, saveSlotLimit } from '../../game/monetise'
import { startNations } from '../../game/intlstart'
import { nationName } from '../../game/nations'
import { listSaves, type SaveMeta } from '../../game/save'
import { seasonLabel } from '../../game/model'
import { Flag } from '../flags'
import { endingText } from '../purchase'
import { SLOTS as SAVE_SLOTS, slotName } from './Saves'
import { capitaliseName } from './NewGame'

/**
 * ---- START AS AN INTERNATIONAL COACH (1.9.16, game/intlstart.ts) ----
 *
 * The paid door beside New Career on the title screen. One page, because
 * there are only three things to say: which game, which country, and your
 * name. The purchase is the store's own Become an International Coach
 * (PINNACLE_SKU), so somebody who bought it inside a career already owns this
 * and is never asked to pay twice.
 *
 * The money is taken on the last button and only there: he can look at every
 * country first. If the sale does not complete, nothing is started and the
 * store's own reason is printed under the button (purchase.ts endingText).
 *
 * The save slot follows the New Career wizard's rule exactly (1.8.0): an empty
 * slot if there is one, and if not he chooses which career to replace.
 */
export default function IntlStart() {
  const back = useStore(s => s.back)
  const startIntl = useStore(s => s.startIntl)
  const newGender = useStore(s => s.newGender)
  const setNewGender = useStore(s => s.setNewGender)
  const activeSlot = useStore(s => s.saveSlot)
  const [nat, setNat] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [owned, setOwned] = useState(() => hasEntitlement(PINNACLE_SKU))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [saves, setSaves] = useState<SaveMeta[] | null>(null)
  const [pickSlot, setPickSlot] = useState<string | null>(null)
  useEffect(() => { void listSaves().then(setSaves).catch(() => setSaves([])) }, [])

  const nations = startNations(newGender)
  const usedSlots = new Set((saves ?? []).map(sv => sv.slot))
  const limited = saveSlotLimit() < SAVE_SLOTS.length
  const atLimit = (saves ?? []).length >= saveSlotLimit()
  const freeSlot = atLimit ? null : !usedSlots.has(activeSlot) ? activeSlot : SAVE_SLOTS.find(sl => !usedSlots.has(sl)) ?? null
  const pickSlots = [...SAVE_SLOTS, ...(saves ?? []).map(sv => sv.slot).filter(sl => !SAVE_SLOTS.includes(sl))]
  const targetSlot = saves == null ? null : freeSlot ?? pickSlot

  const needed = !nat ? t('intl.needNation') : !name.trim() ? t('wizard.needName') : !targetSlot ? t('wizard.needSlot') : null

  const go = async () => {
    if (!nat || !name.trim() || !targetSlot || busy) return
    setMsg(null)
    if (!owned) {
      setBusy(true)
      const out = await buyOwnable(PINNACLE_SKU)
      setBusy(false)
      if (out !== 'owned') { setMsg(endingText(out)); return }
      setOwned(true)
    }
    useStore.getState().setSlot(targetSlot)
    if (!startIntl(nat, name.trim())) setMsg(t('intl.failed'))
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={back} aria-label={t('common.backLabel')}><span aria-hidden="true">‹</span></button>
          <div style={{ flex: 1 }}>
            <h1>{t('intl.title')}</h1>
            <div className="date">{t('intl.sub')}</div>
          </div>
        </div>
      </header>

      <main className="content" style={{ paddingBottom: 150 }} data-intl-wizard>
        <div className="card" style={{ marginTop: 10 }}>
          <div className="meta">{t('intl.blurb')}</div>
          <div className="meta" style={{ marginTop: 6, fontWeight: 700, color: 'var(--gold)' }}>{t(owned ? 'intl.owned' : 'intl.oneOff')}</div>
        </div>

        <div className="wizard-hint">{t('wizard.whichGame')}</div>
        <div className="game-pick" style={{ margin: '0 14px' }} role="radiogroup" aria-label={t('wizard.whichGame')}>
          {(['m', 'w'] as const).map(g => (
            <button key={g} type="button" role="radio" aria-checked={newGender === g}
              className={`${g === 'w' ? 'new-career-w' : 'new-career-m'}${newGender === g ? ' sel' : ''}`}
              onClick={() => { if (newGender !== g) { setNewGender(g); setNat(null) } }}>
              {t(g === 'w' ? 'wizard.gameWomen' : 'wizard.gameMen')}
            </button>
          ))}
        </div>

        <div className="wizard-hint">{t('intl.pick')}</div>
        <div className="intl-grid" role="radiogroup" aria-label={t('intl.pick')}>
          {nations.map(n => (
            <button key={n} type="button" role="radio" aria-checked={nat === n} data-nat={n}
              className={`intl-tile${nat === n ? ' sel' : ''}`} onClick={() => { setNat(n); setMsg(null) }}>
              <Flag code={n} size={18} />
              <span className="nm">{nationName(n)}</span>
            </button>
          ))}
        </div>

        <div className="card">
          <label className="fact-label" htmlFor="intl-name">{t('wizard.yourName')}</label>
          <input id="intl-name" className="inline-input" placeholder={t('wizard.namePlaceholder')} autoCapitalize="words"
            value={name} onChange={e => setName(capitaliseName(e.target.value))} style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>

        {saves != null && (freeSlot ? (
          <div className="meta muted" style={{ margin: '0 14px 8px' }}>{t('wizard.savesTo', { slot: slotName(freeSlot) })}</div>
        ) : (
          <div className="card">
            <label className="fact-label">{t(limited ? 'wizard.slotsFreeFull' : 'wizard.slotsFull')}</label>
            <div className="meta" style={{ marginBottom: 6 }}>{t(limited ? 'wizard.slotsFreeBlurb' : 'wizard.slotsFullBlurb')}</div>
            <div className="speech-grid" style={{ padding: 0 }}>
              {pickSlots.map(sl => {
                const sv = saves.find(x => x.slot === sl)
                return (
                  <button key={sl} className={`speech-tile${pickSlot === sl ? ' sel' : ''}`} disabled={!sv} onClick={() => setPickSlot(sl)}>
                    <b>{slotName(sl)}</b>
                    {sv && <span className="d">{sv.managerName} · {sv.club} · {seasonLabel(sv.season)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {msg && <div className="card" role="alert" data-intl-msg><div className="meta" style={{ fontWeight: 600 }}>{msg}</div></div>}
      </main>

      <div className="action-bar wiz-bar">
        {needed && <div className="wiz-need">{needed}</div>}
        <button className="btn ghost" onClick={back}>{t('wizard.mainMenu')}</button>
        <button className="btn gold" style={{ flex: 1.6, fontSize: '1rem' }} disabled={!!needed || busy} data-intl-go onClick={() => void go()}>
          {busy ? t('till.asking') : t(owned ? 'intl.start' : 'intl.buyStart')}
        </button>
      </div>
    </>
  )
}
