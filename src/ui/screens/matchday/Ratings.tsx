// The post-match player ratings.

import { useStore } from '../../../store'
import { t } from '../../../game/i18n'
import { PosBadge } from '../../components'
import { Glyph } from '../../glyphs'

/** Post-match player ratings for the user's side, FM style. */
export function RatingsPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (mine.teamId !== ctx.userSideId) return null
  // THE SETTLED MARK ONCE THERE IS ONE. mine.ratings is the running in-match
  // accumulator; finalizeMatch adds the result, the margin and the spread and
  // files THAT against the season, the player's form and Player of the Month.
  // Rendering the accumulator meant the manager read 6.0 off a 75-7 win while a
  // different number went into the record. finalR is absent until full time, so
  // a half-time peek still shows the live marks.
  const rows = [...(mine.finalR ?? mine.ratings).entries()]
    .map(([id, r]) => ({ p: game.players[id], r }))
    .filter(x => x.p)
    .sort((a, b) => b.r - a.r)
  return (
    <div className="card" style={{ margin: '0 0 12px' }}>
      <h3 style={{ fontSize: '0.875rem' }}>{t('matchday.yourRatings')}</h3>
      <table className="dtable"><tbody>
        {rows.map(({ p, r }) => (
          <tr key={p!.id}>
            <td><PosBadge pos={p!.pos} /></td>
            <td className="name">{p!.name}{ctx.motmId === p!.id ? <> <Glyph name="star" /></> : ''}</td>
            <td className="num" style={{ fontWeight: 700, color: r >= 7.5 ? 'var(--text-positive)' : r < 5.5 ? 'var(--text-negative)' : undefined }}>
              {Math.min(10, Math.max(1, r)).toFixed(1)}
            </td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}
