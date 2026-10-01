import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, XV_SLOTS, type Player } from '../../game/model'
import { effAt } from '../../game/attributes'
import { assistantAdvice, squadValue, starPlayerIds } from '../../game/analysis'
import { leaguePos } from '../../game/schedule'
import { PosBadge, SectionTitle, Stars } from '../components'
import { t } from '../../game/i18n'
import MentoringPanel from './MentoringPanel'
import DepthPane from './DepthChart'
import { Glyph } from '../glyphs'

/** The assistant's full report on the squad, FM Team Report style. */
export default function TeamReport({ initial }: { initial?: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  // where we stand, the XV, the depth chart and mentoring. The depth chart is
  // the only copy in the game: it left the Team screen's tabs for here (owner,
  // round 4: "move Depth into the Team Report section"), which undoes the
  // 27 Sep change that had kept it on Team instead. Mentoring came over from
  // Club in 1.8.0; the Training screen's signpost opens it directly.
  type RTab = 'standing' | 'xv' | 'depth' | 'mentoring'
  const [rtab, setRtab] = useState<RTab>(initial === 'mentoring' || initial === 'depth' ? initial : 'standing')
  const club = game.clubs[game.userClubId]
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p && !p.onLoan)
  const stars = starPlayerIds(game, club.id)

  // league context
  const leagueClubs = Object.values(game.clubs).filter(c => c.leagueId === club.leagueId)
  const valueRank = [...leagueClubs].sort((a, b) => squadValue(game, b.id) - squadValue(game, a.id))
    .findIndex(c => c.id === club.id) + 1
  const repRank = [...leagueClubs].sort((a, b) => b.rep - a.rep).findIndex(c => c.id === club.id) + 1
  const pos = leaguePos(game.comps[club.leagueId]?.table, club.id)

  // age profile
  const buckets = [
    { label: 'U21', n: squad.filter(p => p.age <= 21).length },
    { label: '22-25', n: squad.filter(p => p.age >= 22 && p.age <= 25).length },
    { label: '26-29', n: squad.filter(p => p.age >= 26 && p.age <= 29).length },
    { label: '30-32', n: squad.filter(p => p.age >= 30 && p.age <= 32).length },
    { label: '33+', n: squad.filter(p => p.age >= 33).length },
  ]
  const maxB = Math.max(...buckets.map(b => b.n), 1)
  const avgAge = squad.length ? squad.reduce((s, p) => s + p.age, 0) / squad.length : 0

  const bestXi = XV_SLOTS.map((slot, i) => {
    const p = club.tactic.lineup[i] != null ? game.players[club.tactic.lineup[i]!] : null
    return { slot, p }
  })

  return (
    <>
      <div className="tab-bar">
        <button className={rtab === 'standing' ? 'active' : ''} onClick={() => setRtab('standing')}>{t('report.trWhereWeStand')}</button>
        <button className={rtab === 'xv' ? 'active' : ''} onClick={() => setRtab('xv')}>{t('report.trBestXV')}</button>
        <button className={rtab === 'depth' ? 'active' : ''} onClick={() => setRtab('depth')}>{t('squad.tabDepth')}</button>
        <button className={rtab === 'mentoring' ? 'active' : ''} onClick={() => setRtab('mentoring')}>{t('training.mentoring')}</button>
      </div>
      {(rtab === 'standing' || rtab === 'xv') && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <h3 style={{ fontSize: 14 }}>{t('report.trVerdict')}</h3>
        <div className="meta" style={{  }}>{assistantAdvice(game)}</div>
      </div>}
      {rtab === 'mentoring' && <MentoringPanel />}
      {rtab === 'depth' && <DepthPane />}

      {rtab === 'standing' && <>
      <SectionTitle>{t('report.trWhereWeStand')}</SectionTitle>
      <div className="chip-row" style={{ padding: '0 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span className="chip">{t('report.trLeaguePos')} <b>{pos > 0 ? `${pos} / ${leagueClubs.length}` : '-'}</b></span>
        <span className="chip">{t('report.trSquadValue')} <b>{fmtMoney(squadValue(game, club.id))}</b>{t('report.trValueRank', { n: valueRank })}</span>
        <span className="chip">{t('report.trRepRank')} <b>{repRank} / {leagueClubs.length}</b></span>
        <span className="chip">{t('report.trAvgAge')} <b>{avgAge.toFixed(1)}</b></span>
        <span className="chip">{t('report.trSquadSize')} <b>{squad.length}</b></span>
      </div>

      <SectionTitle sub={t('report.trStarSub')}>{t('report.trStarPlayers')}</SectionTitle>
      {/* Fixed columns, because auto layout let the name take what it wanted and
          pushed the value off the right-hand edge of the phone (user: "star player
          money doesnt stay within phone boundaries"). The name is the only thing
          here that can afford to ellipsise, so it gets the elastic column and
          everything else gets a width. */}
      <div className="tblwrap"><table className="dtable fit">
        <colgroup>
          <col style={{ width: 42 }} /><col /><col style={{ width: 74 }} /><col style={{ width: 62 }} />
        </colgroup>
        <tbody>
        {squad.filter(p => stars.has(p.id)).map(p => (
          <tr key={p.id} onClick={() => go('player', p.id)}>
            <td><PosBadge pos={p.pos} /></td>
            <td className="name"><Glyph name="star" /> {p.name}</td>
            <td><Stars ca={p.ca} /></td>
            <td className="num">{fmtMoney(p.value)}</td>
          </tr>
        ))}
        </tbody>
      </table></div>

      <SectionTitle sub={t('report.trAgeSub')}>{t('report.trAgeProfile')}</SectionTitle>
      {/* 12px of air above the bars. In portrait the section title's hint wraps
          onto its own line, which put "a healthy squad peaks in the middle"
          directly against the top of the tallest bar with nothing between them
          (user: "a healthy squad text is too close to the table chart"). */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 102, padding: '12px 24px 4px' }}>
        {buckets.map(b => (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{b.n}</span>
            <div style={{ width: '100%', height: `${(b.n / maxB) * 58}px`, background: 'var(--club-show, var(--club1))', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.label}</span>
          </div>
        ))}
      </div>

      </>}
      {rtab === 'xv' && <>
      <SectionTitle>{t('report.trCurrentXV')}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {bestXi.map(({ slot, p }, i) => (
          <tr key={i} onClick={() => p && go('player', p.id)}>
            <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{slot.shirt}</td>
            <td><PosBadge pos={slot.pos} /></td>
            <td className="name">{p?.name ?? '-'}</td>
            <td>{p && <Stars ca={effAt(p, slot.pos)} />}</td>
          </tr>
        ))}
      </tbody></table></div>
      </>}
      <div className="spacer" />
    </>
  )
}
