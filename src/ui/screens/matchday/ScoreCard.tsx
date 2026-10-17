// The broadcast score card at half time, the hour and full time.

import { useStore } from '../../../store'
import { teamShort } from '../../../game/matchEngine'
import { t } from '../../../game/i18n'
import { CrestT } from '../../components'
import { Glyph } from '../../glyphs'

/**
 * THE BROADCAST CARD (owner, 25 Sep 2026, idea 5): half-time, the hour and
 * full time as a television would put them up. Both crests and the score, who
 * got the points (tries with their minutes, kicks as a row of marks). The
 * numbers are the Match Stats panel's, which sits under it and fills its bars
 * in as it opens; one list of them, not two.
 *
 * Everything on it is read from the events; nothing is computed that the
 * engine did not say.
 */
export function ScoreCard({ label, story = false }: { label: string; story?: boolean }) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { fixture, ctx } = live
  const shown = ctx.events.slice(0, live.cursor)
  const last = shown[shown.length - 1]
  const hs = last?.homeScore ?? 0
  const as = last?.awayScore ?? 0
  const scorers = (teamId: string) => {
    const tries = new Map<string, number[]>()
    const kicks = new Map<string, { c: number; p: number; dg: number }>()
    for (const e of shown) {
      if (e.teamId !== teamId) continue
      const full = e.playerId != null ? game.players[e.playerId]?.name : e.playerName
      if (!full) continue
      const who = full.split(' ').slice(-1)[0]
      if (e.type === 'TRY') tries.set(who, [...(tries.get(who) ?? []), Math.min(80, e.min)])
      else if (e.type === 'CON' || e.type === 'PEN' || e.type === 'DG') {
        // counted, in the scoreline's own shorthand (2c, 1p, 1dg), not a row of emoji
        const k = kicks.get(who) ?? { c: 0, p: 0, dg: 0 }
        if (e.type === 'CON') k.c++; else if (e.type === 'PEN') k.p++; else k.dg++
        kicks.set(who, k)
      }
    }
    return (
      <div className="sc-scorers">
        {[...tries].map(([who, mins]) => <div key={`t${who}`}><Glyph name="ball" /> {who} <span className="muted">{mins.map(m => `${m}'`).join(' ')}</span></div>)}
        {[...kicks].map(([who, k]) => <div key={`k${who}`}><Glyph name="posts" /> {who} <span className="muted">({[k.c && `${k.c}c`, k.p && `${k.p}p`, k.dg && `${k.dg}dg`].filter(Boolean).join(', ')})</span></div>)}
      </div>
    )
  }
  return (
    <div className="card score-card">
      <div className="sc-head">{label}</div>
      <div className="sc-teams">
        <div className="sc-team"><CrestT g={game} teamId={fixture.homeId} size={34} /><span>{teamShort(game, fixture.homeId)}</span></div>
        <div className="sc-score">{hs}<i>–</i>{as}</div>
        <div className="sc-team"><CrestT g={game} teamId={fixture.awayId} size={34} /><span>{teamShort(game, fixture.awayId)}</span></div>
      </div>
      {/* at a stoppage this IS the story so far (audit 20E), and says so */}
      {story && <div className="fact-label sc-story">{t('matchday.storySoFar')}</div>}
      <div className="sc-lists">
        {scorers(fixture.homeId)}
        {scorers(fixture.awayId)}
      </div>
    </div>
  )
}
