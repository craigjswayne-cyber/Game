import type { GameState } from '../game/model'
import { XV_SLOTS } from '../game/model'
import { t } from '../game/i18n'
import type { TalkRead } from '../game/teamtalk'

/**
 * ---- HOW THEY TOOK IT (round 4, teamtalk.ts) ----
 *
 * The classic manager game answers a team talk with the room: every player,
 * a mood arrow and a few plain words ("looks motivated", "seems
 * complacent"). That is the whole of the feedback, and it is enough: the
 * manager learns his room by watching which men flinch at which tones, never
 * by reading a number or the name of a hidden trait.
 *
 * The words are the engine's own verdict on each man (TalkRead.k), so what
 * this says is exactly what the match is about to play with.
 */
export function TalkReactions({ game, reads, lineup, msg, onClose }: {
  game: GameState
  reads: TalkRead[]
  /** the sheet the shirts are read from (the side's own match-day lineup) */
  lineup: (number | null)[]
  msg?: string | null
  onClose?: () => void
}) {
  if (!reads.length) return null
  const up = reads.filter(r => r.dir > 0).length
  const down = reads.filter(r => r.dir < 0).length
  const flat = reads.length - up - down
  const shirt = (pid: number) => {
    const i = lineup.indexOf(pid)
    return i < 0 ? '' : i < 15 ? String(XV_SLOTS[i].shirt) : String(i + 1)
  }
  return (
    <div className="card talk-react" data-talk-reactions={reads.length}>
      <div className="tr-head">
        <div>
          <div className="fact-label">{t('tt.reactions')}</div>
          <div className="meta muted">{t('tt.reactionsSub')}</div>
        </div>
        {onClose && <button className="btn ghost tiny" onClick={onClose}>{t('tt.gotIt')}</button>}
      </div>
      {msg && <div className="meta tr-msg">{msg}</div>}
      <div className="mood-sum">{t('tt.summary', { up, flat, down })}</div>
      <ul className="tr-list">
        {reads.map(r => {
          const p = game.players[r.pid]
          if (!p) return null
          return (
            <li key={r.pid} className={lineup.indexOf(r.pid) >= 15 ? 'bench' : ''}>
              <span className="num">{shirt(r.pid)}</span>
              <span className="nm">{p.name}</span>
              <span className={`mood-chip ${r.tone}`}>
                <i className={`tr-dir ${r.dir > 0 ? 'up' : r.dir < 0 ? 'down' : 'flat'}`} aria-hidden="true" />
                {t(r.k)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
