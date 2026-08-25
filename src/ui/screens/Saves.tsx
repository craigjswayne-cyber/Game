import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { deleteSave, listSaves, loadGame, migrate, saveGame, type SaveMeta } from '../../game/save'
import { seasonLabel, weekDate, type GameState } from '../../game/model'
import { SectionTitle } from '../components'
import { t } from '../../game/i18n'
import { EDITOR_SKU, hasEntitlement } from '../../game/monetise'

const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4']
/* keys, not words - t()d wherever a slot is named */
const SLOT_NAMES: Record<string, string> = { slot1: 'world.svSlotA', slot2: 'world.svSlotB', slot3: 'world.svSlotC', slot4: 'world.svSlotD' }
const slotName = (slot: string) => (SLOT_NAMES[slot] ? t(SLOT_NAMES[slot]) : slot)

/** Game Status: multi-slot save & load, FM style. */
export default function Saves() {
  const game = useStore(s => s.game)!
  const saveSlot = useStore(s => s.saveSlot)
  const { setGame, setSlot } = useStore.getState()
  const [saves, setSaves] = useState<SaveMeta[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const refresh = () => { void listSaves().then(setSaves) }
  useEffect(refresh, [])

  // the one save in the game that does not go through the store's persist(), so
  // it needs the same treatment: an await with no catch showed neither a
  // success message nor a failure, and looked exactly like nothing happened
  const doSave = async (slot: string) => {
    try {
      await saveGame(slot, game)
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      useStore.getState().noteSaveFail(why)
      setMsg(t('world.svCouldNotSave', { slot: slotName(slot), why }))
      return
    }
    setSlot(slot)
    setMsg(t('world.svSavedTo', { slot: slotName(slot) }))
    refresh()
  }

  const doLoad = async (slot: string) => {
    const g = await loadGame(slot)
    if (g) {
      setGame(g, slot)
      setMsg(null)
    }
  }

  const doDelete = async (slot: string) => {
    await deleteSave(slot)
    setConfirmDel(null)
    refresh()
  }

  const fileRef = useRef<HTMLInputElement>(null)

  const saveName = () => {
    const club = game.clubs[game.userClubId]
    return `phase-rugby-${club?.short?.toLowerCase().replace(/\W+/g, '') ?? 'save'}-s${game.season + 1}w${game.week}.json`
  }

  const doExport = () => {
    const blob = new Blob([JSON.stringify(game)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = saveName()
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg(t('world.svExported'))
  }

  /**
   * THE BACKUP THAT LEAVES THE PHONE.
   *
   * Export writes a file into Downloads, which is on the same device as the
   * career it is meant to protect - and the risk this whole section exists for
   * is losing the device or having the browser clear its storage. The share
   * sheet is the phone's own answer: two taps into a cloud drive, a chat with
   * yourself, or an e-mail, with no account here and nothing uploaded by the
   * game (the OS hands the file to whatever the player picks).
   *
   * Offered only where the browser really can share a FILE - canShare({files})
   * is the question, because plain navigator.share exists in places that will
   * only take text and would silently drop the save.
   */
  const canShareSave = (() => {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [new File(['{}'], 'probe.json', { type: 'application/json' })] })
    } catch { return false }
  })()

  const doShare = async () => {
    try {
      await navigator.share({
        files: [new File([JSON.stringify(game)], saveName(), { type: 'application/json' })],
        title: saveName(),
      })
      setMsg(t('world.svShared'))
    } catch (e) {
      // a share the player backs out of rejects too, and calling that a failure
      // is how a button earns a reputation for not working
      if ((e as Error)?.name !== 'AbortError') setMsg(t('world.svShareFailed'))
    }
  }

  const doImport = (file: File) => {
    file.text().then(txt => {
      const raw = JSON.parse(txt) as GameState
      if (!raw || !raw.clubs || !raw.players || !raw.userClubId || raw.week == null) {
        setMsg(t('world.svNotASave'))
        return
      }
      const g = migrate(raw)
      void saveGame('imported', g).then(() => {
        setGame(g, 'imported')
        setMsg(null)
      })
    }).catch(() => setMsg(t('world.svUnreadable')))
  }

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <h3 style={{ fontSize: 14 }}>{t('world.svAutosaveOn')}</h3>
        <div className="meta">
          {t('world.svAutosaveBody')}<b>{slotName(saveSlot)}</b>{t('world.svAutosaveRest')}
        </div>
        {msg && <div className="meta" style={{ color: 'var(--text-positive)', fontWeight: 700, marginTop: 6 }}>{msg}</div>}
      </div>

      {/* the In-Game Editor's door (v1.1.0): tools live with tools, so the
          save/load surface hosts it - and only for an owner, so the free game
          never meets a locked door here */}
      {hasEntitlement(EDITOR_SKU) && (
        <div className="card">
          <h3 style={{ fontSize: 14 }}>{t('editor.doorTitle')}</h3>
          <div className="meta">{t(game.edited ? 'editor.doorStamped' : 'editor.doorBody')}</div>
          <button className="btn ghost block" style={{ marginTop: 6 }}
            onClick={() => useStore.getState().go('editor')}>{t('editor.doorOpen')}</button>
        </div>
      )}

      <SectionTitle>{t('world.svSaveSlots')}</SectionTitle>
      {SLOTS.map(slot => {
        const meta = saves.find(s => s.slot === slot)
        const isCurrent = slot === saveSlot
        return (
          <div key={slot} className="card" style={isCurrent ? { borderLeft: '4px solid var(--club1)' } : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 14 }}>
                  {slotName(slot)}{isCurrent ? t('world.svActive') : ''}
                </h3>
                {meta ? (
                  <div className="meta">
                    {meta.managerName} - {meta.club}<br />
                    {t('world.svSavedAt', { season: seasonLabel(meta.season), date: weekDate(meta.season, meta.week), when: new Date(meta.savedAt).toLocaleString() })}
                  </div>
                ) : (
                  <div className="meta">{t('world.svEmpty')}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn slot-act" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => void doSave(slot)}>
                  {t('world.svSave')}
                </button>
                {meta && !isCurrent && (
                  <button className="btn ghost slot-act" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => void doLoad(slot)}>
                    {t('world.svLoad')}
                  </button>
                )}
                {meta && (
                  confirmDel === slot
                    ? <button className="btn danger slot-act" style={{ fontSize: 12, padding: '7px 8px' }} onClick={() => void doDelete(slot)}>{t('world.svSure')}</button>
                    : <button className="btn ghost slot-act" style={{ fontSize: 12, padding: '7px 14px', color: 'var(--text-negative)' }} onClick={() => setConfirmDel(slot)}>{t('world.svDelete')}</button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <SectionTitle sub={t('world.svBackupSub')}>{t('world.svBackup')}</SectionTitle>
      <div className="card">
        <div className="meta" style={{ marginBottom: 8 }}>
          {t('world.svBackupBody')}
        </div>
        {canShareSave && (
          <>
            <button className="btn gold block" style={{ marginBottom: 8 }} onClick={() => { void doShare() }}>
              {t('world.svShare')}
            </button>
            <div className="meta" style={{ marginBottom: 8 }}>{t('world.svBackupPhone')}</div>
          </>
        )}
        <div className="btn-row" style={{ margin: 0 }}>
          <button className="btn" onClick={doExport}>{t('world.svExport')}</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>{t('world.svImport')}</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
      </div>

      {saves.some(s => !SLOTS.includes(s.slot)) && (
        <>
          <SectionTitle>{t('world.svOtherSaves')}</SectionTitle>
          {saves.filter(s => !SLOTS.includes(s.slot)).map(s => (
            <div key={s.slot} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14 }}>{s.slot}</h3>
                  <div className="meta">{t('world.svOtherLine', { manager: s.managerName, club: s.club, season: seasonLabel(s.season), week: s.week })}</div>
                </div>
                <button className="btn ghost slot-act" style={{ fontSize: 12 }} onClick={() => void doLoad(s.slot)}>{t('world.svLoad')}</button>
              </div>
            </div>
          ))}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
