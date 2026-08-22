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

  const load = async (slot: string, keepPlace = false) => {
    const g = await loadGame(slot)
    if (g) setGame(g, slot, keepPlace)
  }

  return (
    <div className="title-screen">
      <BrandMark size={60} />
      <hr className="rules" />
      <h1><b>PHASE</b><br />RUGBY MANAGER</h1>
      {/* set in caps at the user's request, so it reads as a strapline under the
          title rather than as a sentence someone left there */}
      <div className="tagline">STORIES, SEASONS &amp; SILVERWARE</div>
      {/* the release the player is holding. Bump WITH package.json - the pair
          drifting apart is how a bug report says v1.0.1 about a v1.0.3 build */}
      <div className="muted" style={{ marginTop: 10, letterSpacing: 1 }}>v1.0.1</div>
      <hr className="rules" />
      <div className="menu-btns">
        {(() => {
          // One tap back into the most recent save, landing on the screen it was
          // left on. Opening the game asks this question rather than answering it:
          // for a while the app honoured the same bookmark automatically on a cold
          // start, which skipped the title screen entirely and made this tile
          // unreachable. A refresh still resumes in place - see store.resume.
          const newest = [...saves].sort((a, b) => b.savedAt - a.savedAt)[0]
          if (!newest) return null
          return (
            <button className="btn gold continue-tile" onClick={() => void load(newest.slot, true)}>
              {/* one line, always: the longest club name in the game is
                  "Montpellier Hérault Rugby" and a manager can be called
                  anything, so the line ellipsises rather than wrapping */}
              <div className="ct-line">▸ Continue - {newest.managerName}, {newest.club}</div>
              <div className="ct-sub">{seasonLabel(newest.season)}, Week {newest.week}</div>
            </button>
          )
        })()}
        <button className={saves.length ? 'btn ghost' : 'btn gold'}
          style={saves.length ? { color: 'var(--text-primary)', borderColor: 'var(--border-strong)', fontSize: 15 } : { fontSize: 16, padding: '13px' }}
          onClick={() => go('newgame')}>
          New Career
        </button>
        {saves.length > 0 && (
          <button className="btn ghost" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-strong)', fontSize: 15 }}
            onClick={() => setShowLoad(!showLoad)}>
            Load Career
          </button>
        )}
        {showLoad && saves.map(s => (
          <div key={s.slot} style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ flex: 1, background: 'var(--surface-3)' }} onClick={() => void load(s.slot)}>
              {s.managerName} - {s.club}
              <div style={{ fontSize: 11, opacity: .8 }}>{seasonLabel(s.season)}, Week {s.week}</div>
            </button>
            <button className="btn danger" style={{ padding: '0 12px' }}
              onClick={() => void deleteSave(s.slot).then(() => listSaves().then(setSaves))}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 40, fontSize: 11, opacity: .65 }}>
        A personal project - real names used for fun, not for sale.
      </div>
      {/* WHICH BUILD IS THIS? Two phones, two people, and no way to tell a stale
          tab from a fresh deploy except by hunting for a feature. Stamped in at
          build time by vite.config.ts, and deliberately the quietest thing on
          the screen. */}
      <div className="build-tag">{__BUILD_TAG__}</div>
    </div>
  )
}
