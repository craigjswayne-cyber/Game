import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { listSaves, loadGame, deleteSave, type SaveMeta } from '../../game/save'
import { seasonLabel } from '../../game/model'
import { BrandMark } from '../components'

export default function Menu() {
  const go = useStore(s => s.go)
  const setGame = useStore(s => s.setGame)
  const [saves, setSaves] = useState<SaveMeta[]>([])
  const [showLoad, setShowLoad] = useState(false)

  useEffect(() => { void listSaves().then(setSaves) }, [])

  const load = async (slot: string) => {
    const g = await loadGame(slot)
    if (g) setGame(g, slot)
  }

  return (
    <div className="title-screen">
      <BrandMark size={60} />
      <hr className="rules" />
      <h1>RUGBY<br />MANAGER</h1>
      <div className="tagline">Stories, seasons & silverware - the rugby world awaits.</div>
      <hr className="rules" />
      <div className="menu-btns">
        <button className="btn gold" style={{ fontSize: 16, padding: '13px' }} onClick={() => go('newgame')}>
          New Career
        </button>
        {saves.length > 0 && (
          <button className="btn ghost" style={{ color: '#ffffff', borderColor: '#9fc2e8', fontSize: 15 }}
            onClick={() => setShowLoad(!showLoad)}>
            Load Career
          </button>
        )}
        {showLoad && saves.map(s => (
          <div key={s.slot} style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ flex: 1, background: '#2e57ab' }} onClick={() => void load(s.slot)}>
              {s.managerName} - {s.club}
              <div style={{ fontSize: 11, opacity: .8 }}>{seasonLabel(s.season)}, week {s.week}</div>
            </button>
            <button className="btn danger" style={{ padding: '0 12px' }}
              onClick={() => void deleteSave(s.slot).then(() => listSaves().then(setSaves))}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 40, fontSize: 11, opacity: .65 }}>
        A personal project - real names used for fun, not for sale.
      </div>
    </div>
  )
}
