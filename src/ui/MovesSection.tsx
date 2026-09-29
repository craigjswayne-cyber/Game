import type { Club, GameState, Tactic } from '../game/model'
import { MOVES, MOVE_BY_ID, moveEdge, moveFit, moveMatchup, type DefTrait, type Launch, type Move } from '../game/moves'
import { userFixtureThisWeek } from '../game/season'
import { t } from '../game/i18n'
import { SectionTitle } from './components'
import { MoveDiagram } from './tacticsArt'

/**
 * THE ATTACKING MOVES, on the Set Piece tab (1.8.1, game/moves.ts).
 *
 * Three calls, one card each: the strike move off our lineout, the one off
 * our scrum, and the shape we play in open phases. A row of chips picks the
 * call and the card underneath draws it and says what it needs, what it
 * beats, how well drilled it is, whether the men in the XV suit it and what
 * this week's opposition defence does to it. One picture per call rather
 * than a tile per move: eighteen tiles was a phone's worth of scrolling to
 * make three choices.
 */

const TRAIT_KEY: Record<DefTrait, string> = {
  rush: 'moves.traitRush', drift: 'moves.traitDrift', narrow: 'moves.traitNarrow', wide: 'moves.traitWide',
}

const CALLS: [Launch, string, 'moveLineout' | 'moveScrum' | 'moveShape'][] = [
  ['lineout', 'moves.offLineout', 'moveLineout'],
  ['scrum', 'moves.offScrum', 'moveScrum'],
  ['open', 'moves.shape', 'moveShape'],
]

export default function MovesSection({ game, club, touch }: { game: GameState; club: Club; touch: () => void }) {
  const tac = club.tactic
  const fx = userFixtureThisWeek(game)
  const oppId = fx ? (fx.homeId === club.id ? fx.awayId : fx.homeId) : null
  const opp = oppId ? game.clubs[oppId] : undefined
  const oppName = oppId ? (game.clubs[oppId]?.short ?? oppId) : ''
  // the men in the shirts the move names, off the sheet as it stands
  const at = (shirt: number, a: keyof import('../game/model').Attrs) => {
    const id = tac.lineup[shirt - 1]
    const p = id != null ? game.players[id] : undefined
    return p ? p.a[a] : null
  }
  const attrList = (m: Move) => m.needs.map(n => t('moves.needPart', {
    shirts: n.shirts.join('/'),
    attrs: n.attrs.map(a => t(`attrs.${a}`)).join(', '),
  })).join(' · ')

  return <>
    <SectionTitle>{t('moves.heading')}</SectionTitle>
    <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
      <div className="meta">{t('moves.rule')}</div>
    </div>
    {CALLS.map(([launch, heading, key]) => {
      const cur = tac[key] && MOVE_BY_ID[tac[key]!]?.from.includes(launch) ? tac[key]! : null
      const options = MOVES.filter(m => m.from.includes(launch))
      const m = cur ? MOVE_BY_ID[cur] : null
      const fit = m ? moveFit(m, at) : 0
      const match = m ? moveMatchup(m, opp?.tactic as Tactic | undefined) : 0
      const e = m ? moveEdge(game, club, m.id, fit, opp ? match : 0) : null
      const drilledOf = (id: string) => Math.round(moveEdge(game, club, id, 0, 0).drilled)
      return (
        <div key={launch} className="card mv-card" data-moves={launch}>
          <b className="mv-head">{t(heading)}</b>
          <div className="preset-row mv-chips">
            <button className={`preset-chip${!cur ? ' on' : ''}`} aria-pressed={!cur} data-move="none"
              onClick={() => { tac[key] = undefined; touch() }}>{t('moves.none')}</button>
            {options.map(o => (
              <button key={o.id} className={`preset-chip${cur === o.id ? ' on' : ''}`} aria-pressed={cur === o.id} data-move={o.id}
                title={t(o.desc)} onClick={() => { tac[key] = o.id; touch() }}>
                {t(o.name)} <span className="mv-pct">{drilledOf(o.id)}%</span>
              </button>
            ))}
          </div>
          <div className="mv-body">
            <MoveDiagram id={cur ?? 'none'} />
            <div className="sp-txt">
              <b>{m ? t(m.name) : t('moves.none')}</b>
              <span className="d">{m ? t(m.desc) : t('moves.noneDesc')}</span>
              {m && e && <>
                <span className="d mv-need">{attrList(m)}</span>
                <span className="d">
                  {m.beats.map(b => t('moves.beats', { trait: t(TRAIT_KEY[b]) })).join(' · ')}
                  {' · '}
                  {m.weak.map(w => t('moves.weak', { trait: t(TRAIT_KEY[w]) })).join(' · ')}
                </span>
                <span className="rt-bar"><i style={{ width: `${Math.round(e.drilled)}%` }} /></span>
                <span className="d">
                  {t('tacticsScreen.drilled', { pct: Math.round(e.drilled) })}
                  {e.gain >= 0.02 ? t('tacticsScreen.worth', { pct: Math.round(e.gain * 100) })
                    : e.gain <= -0.02 ? t('tacticsScreen.costing', { pct: Math.round(-e.gain * 100) }) : t('tacticsScreen.aboutLevel')}
                </span>
                {e.q < 0 && <span className="d mv-warn">{t('moves.misfire')}</span>}
                <span className={`d${fit < -0.15 ? ' mv-warn' : ''}`}>
                  {t(fit > 0.15 ? 'moves.fitGood' : fit < -0.15 ? 'moves.fitPoor' : 'moves.fitOk')}
                </span>
                {opp && <span className={`d${match < -0.15 ? ' mv-warn' : ''}`}>
                  {t(match > 0.15 ? 'moves.vsGood' : match < -0.15 ? 'moves.vsBad' : 'moves.vsEven', { team: oppName })}
                </span>}
              </>}
            </div>
          </div>
        </div>
      )
    })}
  </>
}
