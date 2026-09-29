import { useState } from 'react'
import type { Attrs, Club, GameState } from '../game/model'
import { MOVES, MOVE_BY_ID, moveEdge, moveFit, moveMatchup, type DefTrait, type Launch, type Move } from '../game/moves'
import { userFixtureThisWeek } from '../game/season'
import { t } from '../game/i18n'
import { SectionTitle } from './components'
import { MoveDiagram } from './tacticsArt'

/**
 * THE ATTACKING MOVES, on the Set Piece tab (1.8.1, game/moves.ts).
 *
 * Three calls: the strike move off our lineout, the one off our scrum, and
 * the shape we play in open phases. ONE card for all three, because the Set
 * Piece tab was already the longest on the Tactics screen: the top row picks
 * which call you are looking at (and says what each is set to), the chips
 * under it make the call, and the picture and the facts beside it say what
 * the move needs, what it beats, how well drilled it is, whether the men in
 * the XV suit it and what this week's opposition defence does to it.
 *
 * Since 1.8.2 the card is the Set Piece tab's Moves view on its own (the tab
 * is three views now, screens/Tactics.tsx), so it no longer has to share a
 * scroll with the lineout calls above it and the kicking below.
 */

const TRAIT_KEY: Record<DefTrait, string> = {
  rush: 'moves.traitRush', drift: 'moves.traitDrift', narrow: 'moves.traitNarrow', wide: 'moves.traitWide',
}

type CallKey = 'moveLineout' | 'moveScrum' | 'moveShape'
const CALLS: [Launch, string, CallKey][] = [
  ['lineout', 'moves.offLineout', 'moveLineout'],
  ['scrum', 'moves.offScrum', 'moveScrum'],
  ['open', 'moves.shape', 'moveShape'],
]

export default function MovesSection({ game, club, touch }: { game: GameState; club: Club; touch: () => void }) {
  const [which, setWhich] = useState<Launch>('lineout')
  const tac = club.tactic
  const fx = userFixtureThisWeek(game)
  const oppId = fx ? (fx.homeId === club.id ? fx.awayId : fx.homeId) : null
  const opp = oppId ? game.clubs[oppId] : undefined
  // the men in the shirts the move names, off the sheet as it stands
  const at = (shirt: number, a: keyof Attrs) => {
    const id = tac.lineup[shirt - 1]
    const p = id != null ? game.players[id] : undefined
    return p ? p.a[a] : null
  }
  const current = (launch: Launch, key: CallKey) => {
    const id = tac[key]
    return id && MOVE_BY_ID[id]?.from.includes(launch) ? id : null
  }
  const needs = (m: Move) => m.needs.map(n => t('moves.needPart', {
    shirts: n.shirts.join('/'),
    attrs: n.attrs.map(a => t(`attrs.${a}`)).join(', '),
  })).join(' · ')

  const [launch, , key] = CALLS.find(c => c[0] === which) ?? CALLS[0]
  const cur = current(launch, key)
  const m = cur ? MOVE_BY_ID[cur] : null
  const fit = m ? moveFit(m, at) : 0
  const match = m && opp ? moveMatchup(m, opp.tactic) : 0
  const e = m ? moveEdge(game, club, m.id, fit, match) : null
  const drilledPct = (id: string) => Math.round(moveEdge(game, club, id, 0, 0).drilled)

  return <>
    <SectionTitle>{t('moves.heading')}</SectionTitle>
    <div className="card mv-card" data-moves={which}>
      <div className="meta">{t('moves.rule')}</div>
      <div className="mv-calls">
        {CALLS.map(([l, heading, k]) => {
          const c = current(l, k)
          return (
            <button key={l} className={`preset-chip mv-callchip${which === l ? ' on' : ''}`} aria-pressed={which === l}
              data-call={l} onClick={() => setWhich(l)}>
              <b>{t(heading)}</b>
              <span>{c ? t(MOVE_BY_ID[c].name) : t('moves.none')}</span>
            </button>
          )
        })}
      </div>
      <div className="preset-row mv-chips">
        <button className={`preset-chip${!cur ? ' on' : ''}`} aria-pressed={!cur} data-move="none"
          onClick={() => { tac[key] = undefined; touch() }}>{t('moves.none')}</button>
        {MOVES.filter(o => o.from.includes(launch)).map(o => (
          <button key={o.id} className={`preset-chip${cur === o.id ? ' on' : ''}`} aria-pressed={cur === o.id} data-move={o.id}
            onClick={() => { tac[key] = o.id; touch() }}>
            {t(o.name)} <span className="mv-pct">{drilledPct(o.id)}%</span>
          </button>
        ))}
      </div>
      <div className="mv-body">
        <MoveDiagram id={cur ?? 'none'} />
        <div className="sp-txt">
          <b>{m ? t(m.name) : t('moves.none')}</b>
          <span className="d">{m ? t(m.desc) : t('moves.noneDesc')}</span>
          {m && e && <>
            <span className="d mv-need">{needs(m)}</span>
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
              {t(match > 0.15 ? 'moves.vsGood' : match < -0.15 ? 'moves.vsBad' : 'moves.vsEven', { team: opp.short })}
            </span>}
          </>}
        </div>
      </div>
    </div>
  </>
}
