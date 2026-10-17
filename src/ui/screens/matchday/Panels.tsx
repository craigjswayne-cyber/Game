// The half-time word from the assistant and the kickable-penalty decision.

import { useStore } from '../../../store'
import { goalKicker, teamShort, refFor } from '../../../game/matchEngine'
import { halfTimeHints } from '../../../game/conditions'
import { LEVERS, buildEvidence, halfSides, htEvidence, type WhyCause } from '../../../game/evidence'
import { SLIDER_INFO } from '../../../game/tactics'
import { t } from '../../../game/i18n'
import { Glyph } from '../../glyphs'

/** THE ASSISTANT'S WORD AT HALF TIME (1.8.2 depth): one or two plain lines
 *  read off what the first forty did against the referee and the day
 *  (conditions.ts halfTimeHints), and since 1.8.3 what is working and what
 *  is hurting, off the first half's evidence (evidence.ts htEvidence).
 *
 *  AND WHAT TO DO ABOUT IT (1.8.4). Under the hurting line, the touchline
 *  dial that answers its cause (evidence.ts LEVERS), as a tap that brings
 *  that dial on the panel below into view. Only where a dial measurably
 *  moves the count, and only in a club match, where the dials are his.
 *  Nothing drawn; silent when there is nothing worth saying. */
export function HalfTimeWord() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const ctx = live.ctx
  const ev = game ? buildEvidence(game, ctx) : null
  if (!ev || !game) return null
  const [mine, opp] = halfSides(ev)
  const lines = halfTimeHints(refFor(ctx.fx.id), ctx.weather, mine, opp, !!ctx.uncontested, htEvidence(ev))
  if (!lines.length) return null
  const club = ctx.userSideId === game.userClubId
  const hurt = lines.find(l => l.tag === 'hurt')
  const lever = club && hurt?.cause ? LEVERS[hurt.cause as WhyCause] : undefined
  const info = lever ? SLIDER_INFO.find(s => s.key === lever.dial) : undefined
  // to the dial on the panel below, and a moment's ring round it
  const showDial = () => {
    const row = document.querySelector<HTMLElement>(`[data-dial="${lever!.dial}"]`)
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    row.querySelector('input')?.focus({ preventScroll: true })
    row.style.outline = '2px solid var(--gold)'
    window.setTimeout(() => { row.style.outline = '' }, 1600)
  }
  return (
    <div className="card" style={{ margin: '8px 14px' }} data-halftime-word={lines.length}>
      <div className="fact-label">{t('matchday.htWord')}</div>
      {lines.map(l => (
        <div key={l.k} className="meta" data-ht-tag={l.tag} data-ht-cause={l.cause}>
          {l.tag && <b style={{ color: l.tag === 'work' ? 'var(--text-positive)' : 'var(--text-negative)' }}>{t(l.tag === 'work' ? 'matchday.htWorking' : 'matchday.htHurting')} </b>}
          {t(l.k, l.v)}
        </div>
      ))}
      {lever && info && (
        <button className="preset-chip" style={{ marginTop: 6 }} data-ht-lever={lever.dial} onClick={showDial}>
          <Glyph name="tactics" /> {t(lever.dir < 0 ? 'matchday.htLeverDown' : 'matchday.htLeverUp', { dial_k: info.label, n: game.clubs[game.userClubId].tactic[lever.dial] })}
        </button>
      )}
    </div>
  )
}

/** A kickable penalty: posts, corner, or tap - your call, gaffer. */
export function DecisionPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { decide } = useStore.getState()
  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const diff = mine.score - opp.score
  // whoever will actually take it: the first choice may be in the bin
  const kicker = goalKicker(game, mine)

  const options = [
    {
      id: 'posts' as const, icon: 'posts', name: t('matchday.optPosts'),
      desc: t(diff < 0 && diff >= -3 ? 'matchday.optPostsDLead' : 'matchday.optPostsD',
        { kicker: kicker ? kicker.name : t('matchday.yourKicker') }),
    },
    {
      id: 'corner' as const, icon: 'attack', name: t('matchday.optCorner'),
      desc: t('matchday.optCornerD'),
    },
    {
      id: 'tap' as const, icon: 'bolt', name: t('matchday.optTap'),
      desc: t('matchday.optTapD'),
    },
  ]

  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--danger)' }}>
      <h3 style={{ fontSize: '1rem' }}>{t('matchday.penCall')}</h3>
      <div className="meta" style={{ marginBottom: 8 }}>
        {t('matchday.penScore', { home: teamShort(game, mine.teamId), hs: mine.score, as: opp.score, away: teamShort(game, opp.teamId) })}
        {diff < 0 ? t('matchday.penBehind', { n: -diff }) : diff > 0 ? t('matchday.penAhead', { n: diff }) : t('matchday.penLevel')}
        {t('matchday.penMin', { min: ctx.lastMin })}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map(o => (
          <button key={o.id} className="btn ghost" style={{ textAlign: 'left', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
            onClick={() => decide(o.id)}>
            <span style={{ fontSize: '1.25rem' }}><Glyph name={o.icon} /></span>
            <span>
              <b style={{ display: 'block', fontSize: '0.875rem' }}>{o.name}</b>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
