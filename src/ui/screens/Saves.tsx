import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { deleteSave, listSaves, loadGame, saveGame, type SaveMeta } from '../../game/save'
import { seasonLabel, weekDate } from '../../game/model'
import { SectionTitle } from '../components'

const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4']
const SLOT_NAMES: Record<string, string> = { slot1: 'Slot A', slot2: 'Slot B', slot3: 'Slot C', slot4: 'Slot D' }

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

  const doSave = async (slot: string) => {
    await saveGame(slot, game)
    setSlot(slot)
    setMsg(`Career saved to ${SLOT_NAMES[slot] ?? slot}.`)
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

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <h3 style={{ fontSize: 14 }}>Autosave is on</h3>
        <div className="meta">
          Your career autosaves to <b>{SLOT_NAMES[saveSlot] ?? saveSlot}</b> after every match and every few weeks.
          Use the slots below for manual backups or parallel careers.
        </div>
        {msg && <div className="meta" style={{ color: '#2f7d4f', fontWeight: 700, marginTop: 6 }}>{msg}</div>}
      </div>

      <SectionTitle>Save Slots</SectionTitle>
      {SLOTS.map(slot => {
        const meta = saves.find(s => s.slot === slot)
        const isCurrent = slot === saveSlot
        return (
          <div key={slot} className="card" style={isCurrent ? { borderLeft: '4px solid var(--club1)' } : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 14 }}>
                  {SLOT_NAMES[slot]}{isCurrent ? ' · ACTIVE' : ''}
                </h3>
                {meta ? (
                  <div className="meta">
                    {meta.managerName} — {meta.club}<br />
                    {seasonLabel(meta.season)}, {weekDate(meta.season, meta.week)} · saved {new Date(meta.savedAt).toLocaleString()}
                  </div>
                ) : (
                  <div className="meta">Empty slot.</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => void doSave(slot)}>
                  💾 Save
                </button>
                {meta && !isCurrent && (
                  <button className="btn ghost" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => void doLoad(slot)}>
                    📂 Load
                  </button>
                )}
                {meta && (
                  confirmDel === slot
                    ? <button className="btn danger" style={{ fontSize: 12, padding: '7px 8px' }} onClick={() => void doDelete(slot)}>Sure?</button>
                    : <button className="btn ghost" style={{ fontSize: 12, padding: '7px 14px', color: '#9b2c2c' }} onClick={() => setConfirmDel(slot)}>✕ Delete</button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {saves.some(s => !SLOTS.includes(s.slot)) && (
        <>
          <SectionTitle>Other Saves</SectionTitle>
          {saves.filter(s => !SLOTS.includes(s.slot)).map(s => (
            <div key={s.slot} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14 }}>{s.slot}</h3>
                  <div className="meta">{s.managerName} — {s.club} · {seasonLabel(s.season)} wk {s.week}</div>
                </div>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => void doLoad(s.slot)}>📂 Load</button>
              </div>
            </div>
          ))}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
