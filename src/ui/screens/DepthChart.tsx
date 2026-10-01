import { useStore } from '../../store'
import { POS_ORDER, type Player } from '../../game/model'
import { PosBadge } from '../components'
import { t } from '../../game/i18n'

/**
 * THE DEPTH CHART (owner, v1.2.7: "nothing shows at a glance that you are one
 * hooker deep before a cup run"). One row per position, the men whose own
 * position it is, best first, with the men who
 * cannot play this week greyed and the reason on them.
 *
 * It lives on the Team Report now (owner, round 4: move Depth into the Team
 * Report section); it was a tab on the Team screen before that. And it no
 * longer flags a thin position: no red edge, no red count, no warning line.
 * The assistant says it instead, once, in the inbox (game/depthwatch.ts).
 */
export default function DepthPane() {
  const game = useStore(s => s.game)!
  const club = game.clubs[game.userClubId]
  const pool = club.players.map(id => game.players[id]).filter((p): p is Player => !!p && !p.acad)
  const why = (p: Player) => p.injury ? t('squad.depthInjured') : p.bans > 0 ? t('squad.depthBanned') : p.natSquad ? t('squad.depthAway') : p.onLoan ? t('squad.depthOnLoan') : null
  return (
    <div className="depth-chart">
      {POS_ORDER.map(pos => {
        // SPECIALISTS ONLY (owner, round 2: remove the italic names). The men
        // who cover from another position were listed here in italics; they
        // are gone and the count reads the men shown.
        const men = pool.filter(p => p.pos === pos).sort((a, b) => b.ca - a.ca)
        const fit = men.filter(p => !why(p)).length
        return (
          <div key={pos} className="depth-row">
            <div className="depth-pos">
              <PosBadge pos={pos} />
              <span className="depth-count">{t('squad.depthFit', { n: fit })}</span>
            </div>
            <div className="depth-men">
              {men.length === 0 && <span className="meta muted">{t('squad.depthNobody')}</span>}
              {men.map(p => {
                const out = why(p)
                return (
                  <button key={p.id} className={`depth-man${out ? ' out' : ''}`}
                    title={out ?? undefined}
                    onClick={() => useStore.getState().go('player', p.id)}>
                    <span className="depth-name">{p.name}</span>
                    <span className="depth-ca">{p.ca}</span>
                    {out && <span className="depth-why">{out}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
