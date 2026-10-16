import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { deleteSave, isPlayable, listSaves, loadGame, migrate, saveGame, type SaveMeta } from '../../game/save'
import { seasonLabel, weekDate, type GameState } from '../../game/model'
import { SectionTitle } from '../components'
import { t, localeTag } from '../../game/i18n'
import { canShareNatively, shareSaveNatively } from '../../game/nativeshare'

export const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4']
/* keys, not words - t()d wherever a slot is named */
const SLOT_NAMES: Record<string, string> = { slot1: 'world.svSlotA', slot2: 'world.svSlotB', slot3: 'world.svSlotC', slot4: 'world.svSlotD' }
export const slotName = (slot: string) => (SLOT_NAMES[slot] ? t(SLOT_NAMES[slot]) : slot)

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
  // MID-MATCH, THE COPY CARRIES THE MATCH (1.8.2). What goes to a slot or a
  // file is the pre-match save with the match in progress stamped inside it,
  // so opening the copy resumes that match rather than offering it again on a
  // squad already carrying half of it (store.saveCopy, game/resume.ts).
  const copy = () => useStore.getState().saveCopy() ?? game

  const doSave = async (slot: string) => {
    // a week that threw and could not be put back: the career in memory is
    // half-turned, and a manual save is the one write that would keep it
    if (useStore.getState().weekFailed === 2) { setMsg(t('common.weekStuck')); return }
    try {
      await saveGame(slot, copy())
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

  /** In the store shells (1.8.18) both buttons hand the file to the phone's
   *  share sheet, which is the only road out of a WebView: the old download
   *  link did nothing there and still said "exported". */
  const native = canShareNatively()

  const [sharing, setSharing] = useState(false)
  const doNativeShare = async () => {
    if (sharing) return
    setSharing(true)
    const r = await shareSaveNatively(saveName(), JSON.stringify(copy())).finally(() => setSharing(false))
    if (r === 'shared') setMsg(t('world.svShared'))
    else if (r === 'failed' || r === 'unavailable') setMsg(t('world.svExportFailed'))
    // 'cancelled': the player backed out, and saying nothing is the truth
  }

  const doExport = () => {
    if (native) { void doNativeShare(); return }
    const blob = new Blob([JSON.stringify(copy())], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = saveName()
    a.click()
    // NOT AT ONCE (1.9.0): revoking the URL straight after click() can cancel
    // the download before it starts in some WebKit and Firefox builds, and the
    // line below would then say "exported" about a file that never arrived
    const href = a.href
    setTimeout(() => URL.revokeObjectURL(href), 30_000)
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
  const canShareSave = native || (() => {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [new File(['{}'], 'probe.json', { type: 'application/json' })] })
    } catch { return false }
  })()

  const doShare = async () => {
    if (native) return doNativeShare()
    try {
      await navigator.share({
        files: [new File([JSON.stringify(copy())], saveName(), { type: 'application/json' })],
        title: saveName(),
      })
      setMsg(t('world.svShared'))
    } catch (e) {
      // a share the player backs out of rejects too, and calling that a failure
      // is how a button earns a reputation for not working
      if ((e as Error)?.name !== 'AbortError') setMsg(t('world.svShareFailed'))
    }
  }

  /** BIGGER THAN ANY CAREER (1.8.18). A fresh save is about 6 MB and twenty
   *  seasons about 11; a file several times that is not a save, and reading it
   *  whole into memory on a phone is how a "save" crashes the app. */
  const IMPORT_MAX_BYTES = 64 * 1024 * 1024

  const doImport = (file: File) => {
    if (file.size > IMPORT_MAX_BYTES) { setMsg(t('world.svNotASave')); return }
    file.text().then(txt => {
      const raw = JSON.parse(txt) as GameState
      if (!raw || !raw.clubs || !raw.players || !raw.userClubId || raw.week == null) {
        setMsg(t('world.svNotASave'))
        return
      }
      const g = migrate(raw)
      // THE SAME BAR AS LOADING (1.8.1). The shape check above is only a sniff
      // for "is this a save at all"; loadGame also refuses a healed state with
      // no competitions or a manager's club that is not in it (isPlayable), and
      // an import skipped that, so a damaged file was written to a slot and
      // opened, then fell over some weeks later. Refused here, it is the same
      // "not a save" message as any other file that is not one.
      if (!isPlayable(g)) {
        setMsg(t('world.svNotASave'))
        return
      }
      // A NEW FILE NEVER LANDS ON AN OLD ONE (1.9.0). Every import went to the
      // one key 'imported', and after an import that slot is where autosave
      // writes, so importing a second file silently replaced a career the
      // player might have played for seasons. The first import is still
      // 'imported'; the next goes to 'imported-2', and so on, and all of them
      // are listed under Other Saves. The career on screen is flushed to its
      // own slot first, so its last change is not lost either.
      void (async () => {
        await useStore.getState().persistNow()
        const taken = new Set((await listSaves()).map(s => s.slot))
        let slot = 'imported'
        for (let n = 2; taken.has(slot); n++) slot = `imported-${n}`
        return slot
      })().then(slot =>
        // a write that fails (a full phone, storage switched off) must say so:
        // this used to be fire-and-forget, so the player saw nothing and the
        // career they thought they had imported was not there next time
        saveGame(slot, g).then(() => {
          setGame(g, slot)
          setMsg(null)
        }, (e: unknown) => {
          setMsg(t('world.svCouldNotSave', { slot: slotName(slot), why: e instanceof Error ? e.message : String(e) }))
        }),
      ).catch((e: unknown) => {
        setMsg(t('world.svCouldNotSave', { slot: slotName('imported'), why: e instanceof Error ? e.message : String(e) }))
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

      {/* the In-Game Editor's door lived here (v1.1.0-v1.1.2). Removed on the
          owner's call, 27 Aug: "this isnt needed for this game". Nothing was
          ever sold - the product never existed in any store - so there is no
          owner to grandfather and no stamp on any save. */}

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
                    {t('world.svSavedAt', { season: seasonLabel(meta.season), date: weekDate(meta.season, meta.week), when: new Date(meta.savedAt).toLocaleString(localeTag()) })}
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
            <button className="btn gold block" style={{ marginBottom: 8 }} disabled={sharing} onClick={() => { void doShare() }}>
              {t('world.svShare')}
            </button>
            <div className="meta" style={{ marginBottom: 8 }}>{t('world.svBackupPhone')}</div>
          </>
        )}
        <div className="btn-row" style={{ margin: 0 }}>
          <button className="btn" disabled={sharing} onClick={doExport}>{t('world.svExport')}</button>
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
