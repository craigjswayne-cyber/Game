import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney } from '../../game/model'
import type { GameState } from '../../game/model'
import { agencyKids, agencySeniors } from '../../game/agency'
import { natRankOrder } from '../../game/natrank'
import { nationByCode, nationName } from '../../game/nations'
import { CrestT, Nat, PosBadge, SectionTitle } from '../components'
import { t } from '../../game/i18n'

/** The Scouting Agency: monthly world rankings, FM-style. */
/** What the movement arrows are measured from.
 *
 *  These tables are the CURRENT standings, recomputed every week; the snapshot
 *  behind the arrows only republishes every four (season.ts). Saying "since
 *  last month" while showing today's order is how the two ended up reading as
 *  out of sync, so the screen now names the week it is comparing against. */
function sinceLine(game: GameState): string {
  const at = game.agency?.at
  if (!at) return t('world.agFirstList')
  const same = at.season === game.season
  return t(same ? 'world.agSinceThis' : 'world.agSinceLast', { week: at.week })
}

export default function Agency() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [tab, setTab] = useState<'seniors' | 'kids' | 'nations'>('seniors')

  const list = tab === 'seniors' ? agencySeniors(game) : agencyKids(game)
  const prev = tab === 'seniors' ? (game.agency?.seniors ?? []) : (game.agency?.kids ?? [])

  if (tab === 'nations') {
    const order = natRankOrder(game)
    const prevOrder = game.natRankPrev ?? []
    return (
      <>
        <div className="tab-bar">
          <button onClick={() => setTab('seniors')}>{t('world.agWorldRankings')}</button>
          <button onClick={() => setTab('kids')}>{t('world.agWonderkids')}</button>
          <button className="active">{t('world.agTestNations')}</button>
        </div>
        <SectionTitle sub={t('world.agTestSub')}>{t('world.agTestTitle')}</SectionTitle>
        <div className="tblwrap"><table className="dtable">
          <thead><tr><th>{t('tables.colRank')}</th><th></th><th>{t('world.natColNation')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
          <tbody>
            {order.map((code, i) => {
              const n = nationByCode(code)
              const prevIdx = prevOrder.indexOf(code)
              const move = prevIdx < 0 ? 'flat' : prevIdx > i ? 'up' : prevIdx < i ? 'down' : 'flat'
              const mine = game.natTeam === code
              return (
                <tr key={code} style={mine ? { background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}>
                  <td className="num" style={{ fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ width: 18, fontSize: 11 }}>
                    {move === 'up' ? <span style={{ color: 'var(--text-positive)' }}>▲</span>
                      : move === 'down' ? <span style={{ color: 'var(--text-negative)' }}>▼</span>
                      : <span className="muted">·</span>}
                  </td>
                  <td className="name" style={mine ? { fontWeight: 800 } : undefined}>
                    {n?.flag ?? ''} {nationName(code)}{mine ? t('world.agYou') : ''}
                  </td>
                  {/* breathing room on the table's outer edge - the points sat
                      flush against the screen (round 25, from a screenshot) */}
                  <td className="num" style={{ paddingRight: 14 }}>{(game.natRank?.[code] ?? 0).toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
          {sinceLine(game)}{t('world.agNatFoot')}
        </div>
        <div className="spacer" />
      </>
    )
  }

  return (
    <>
      <div className="tab-bar">
        <button className={tab === 'seniors' ? 'active' : ''} onClick={() => setTab('seniors')}>{t('world.agWorldRankings')}</button>
        <button className={tab === 'kids' ? 'active' : ''} onClick={() => setTab('kids')}>{t('world.agWonderkids')}</button>
        <button onClick={() => setTab('nations')}>{t('world.agTestNations')}</button>
      </div>
      <SectionTitle sub={t(tab === 'seniors' ? 'world.agSeniorSub' : 'world.agKidSub')}>
        {t(tab === 'seniors' ? 'world.agSeniorTitle' : 'world.agKidTitle')}
      </SectionTitle>
      <div className="tblwrap"><table className="dtable">
        {/* No High column. It shadowed the rank number one cell to its left and
            cost the width that pushed Club off a portrait screen (user: "we dont
            want a high column"). The movement arrow already tells the story. */}
        <thead><tr><th>{t('tables.colRank')}</th><th></th><th>{t('squad.colName')}</th><th>{t('squad.colPos')}</th><th></th><th>{t('transfers.colClub')}</th><th className="num">{t('squad.colValue')}</th></tr></thead>
        <tbody>
          {list.map((p, i) => {
            const prevIdx = prev.indexOf(p.id)
            const move = prevIdx < 0 ? 'new' : prevIdx > i ? 'up' : prevIdx < i ? 'down' : 'flat'
            const mine = p.clubId === game.userClubId
            return (
              <tr key={p.id} onClick={() => go('player', p.id)}
                style={mine ? { background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}>
                <td className="num" style={{ fontWeight: 700 }}>{i + 1}</td>
                <td style={{ width: 18, fontSize: 11 }}>
                  {move === 'up' ? <span style={{ color: 'var(--text-positive)' }}>▲</span>
                    : move === 'down' ? <span style={{ color: 'var(--text-negative)' }}>▼</span>
                    : move === 'new' ? <span style={{ color: 'var(--info)' }}>★</span>
                    : <span className="muted">·</span>}
                </td>
                <td className="name" style={mine ? { fontWeight: 800 } : undefined}>
                  {p.name}{tab === 'kids' ? ` (${p.age})` : ''}
                </td>
                <td><PosBadge pos={p.pos} /></td>
                <td><Nat code={p.nat} /></td>
                <td className="muted"><CrestT g={game} teamId={p.clubId!} size={15} />{game.clubs[p.clubId!]?.short}</td>
                <td className="num">{fmtMoney(p.value)}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
        {sinceLine(game)}{t('world.agFoot')}
      </div>
      <div className="spacer" />
    </>
  )
}
