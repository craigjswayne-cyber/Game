import { Fragment, useState } from 'react'
import { useStore } from '../../store'
import { weekDate } from '../../game/model'
import { flagOf, nationByCode } from '../../game/nations'
import { natRankOrder } from '../../game/natrank'
import { natFixtureThisWeek } from '../../game/season'
import { NAT_SQUAD_FLOOR, natCallUp, natDrop, natEligible, natWindow } from '../../game/country'
import { PosBadge, SectionTitle } from '../components'
import { ord, t } from '../../game/i18n'

const FWD = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8']

/** The country desk: club and country side by side (user: "we may need to
 *  get creative and maybe a new menu appears or something with both club and
 *  country?"). One screen holds the Test job: the ranking, the union's
 *  confidence, your Test record, the window squad you can actually shape,
 *  the calendar - and the door out of either job, in plain sight. */
export default function Country() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const { resign, resignNat, persist } = useStore.getState()
  const bump = useStore(s => s.tick)
  void bump
  const [msg, setMsg] = useState<{ key: number | string; text: string } | null>(null)
  const [confirmClub, setConfirmClub] = useState(false)
  const [confirmNat, setConfirmNat] = useState(false)
  const [, redraw] = useState(0)

  const natId = game.natTeam
  if (!natId) {
    // stepped down (or sacked) with the screen open - nothing to run here
    return (
      <div className="card">
        <h3 style={{ fontSize: 15 }}>{t('legacy.coNoJob')}</h3>
        <div className="meta">{t('legacy.coNoJobBody')}</div>
      </div>
    )
  }

  const nat = nationByCode(natId)
  const order = natRankOrder(game)
  const rank = order.indexOf(natId) + 1
  const conf = game.natConfidence != null ? Math.round(game.natConfidence) : null
  const rec = game.natRecord
  const club = game.unemployed ? null : game.clubs[game.userClubId]
  const w = natWindow(game)
  const squad = (game.natSquads[natId] ?? []).map(id => game.players[id]).filter(Boolean)
  const pool = natEligible(game)
  const testFx = natFixtureThisWeek(game)
  const upcoming = game.fixtures
    .filter(f => !f.played && (f.homeId === natId || f.awayId === natId))
    .sort((a, b) => a.week - b.week).slice(0, 4)
  const results = game.fixtures
    .filter(f => f.played && (f.homeId === natId || f.awayId === natId) &&
      !game.clubs[f.homeId] && !game.clubs[f.awayId])
    .sort((a, b) => b.week - a.week).slice(0, 5)

  const act = (p: { id: number; name: string }, fn: (g: typeof game, id: number) => string | null) => {
    const refusal = fn(game, p.id)
    setMsg({ key: p.id, text: refusal ?? '' })
    if (!refusal) void persist()
    redraw(n => n + 1)
  }

  const row = (p: NonNullable<(typeof squad)[number]>, inSquad: boolean) => (
    <tr key={p.id} onClick={() => go('player', p.id)}>
      <td style={{ width: 34 }}><PosBadge pos={p.pos} /></td>
      <td className="name" style={p.clubId === game.userClubId ? { fontWeight: 800 } : undefined}>
        {p.name}{(p.caps ?? 0) > 0 ? <span className="muted">{t('legacy.coCaps', { n: p.caps ?? 0 })}</span> : <span className="muted">{t('legacy.coUncapped')}</span>}
      </td>
      <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : ''}</td>
      <td style={{ width: 64, textAlign: 'right' }}>
        {w && (
          <button className="btn ghost" style={{ fontSize: 12, padding: '6px 10px', color: inSquad ? 'var(--text-negative)' : 'var(--text-positive)' }}
            onClick={e => { e.stopPropagation(); act(p, inSquad ? natDrop : natCallUp) }}>
            {t(inSquad ? 'legacy.coDrop' : 'legacy.coCallUp')}
          </button>
        )}
      </td>
    </tr>
  )

  const table = (list: typeof squad, inSquad: boolean) => (
    <div className="tblwrap"><table className="dtable"><tbody>
      {list.map(p => (
        <Fragment key={p.id}>
          {row(p, inSquad)}
          {msg?.key === p.id && msg.text && (
            <tr><td colSpan={4} className="meta" style={{ color: 'var(--text-negative)', paddingTop: 0 }}>{msg.text}</td></tr>
          )}
        </Fragment>
      ))}
    </tbody></table></div>
  )

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--text-positive)' }}>
        <h3 style={{ fontSize: 17 }}>{flagOf(natId)} {nat?.name ?? natId}</h3>
        <div className="meta" style={{ marginTop: 2 }}>
          {t('legacy.coRankLine', {
            rank: rank > 0 ? t('legacy.coWorldNo', { n: rank }) : t('legacy.coUnranked'),
            pts: (game.natRank?.[natId] ?? 0).toFixed(2),
            rec: rec ? t('legacy.coTestsUnder', { w: rec.w, d: rec.d, l: rec.l }) : '',
          })}
        </div>
        {conf != null && (
          <div style={{ margin: '8px 2px 2px' }}>
            <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${conf}%`, height: '100%', background: conf >= 60 ? 'var(--text-positive)' : conf >= 40 ? 'var(--gold)' : 'var(--danger)' }} />
            </div>
            <div className="meta" style={{ marginTop: 4 }}>
              {t('legacy.coUnionConf', { n: conf })}
            </div>
          </div>
        )}
        {testFx && (
          <div className="muted" style={{ marginTop: 8, fontWeight: 700 }}>
            {t('legacy.coTestWeek', {
              home: nationByCode(testFx.homeId)?.name ?? testFx.homeId,
              away: nationByCode(testFx.awayId)?.name ?? testFx.awayId,
            })}
          </div>
        )}
      </div>

      {/* both hats, and the way out of either - in the open, not buried
          (user: "OR you can step down from your club role") */}
      <div className="card">
        <SectionTitle sub={t('legacy.coAppointmentsSub')}>{t('legacy.coAppointments')}</SectionTitle>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ fontSize: 20 }}>🏟️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{club.name}</div>
              <div className="meta">{t('legacy.coDirectorBoard', { n: Math.round(club.boardConfidence) })}</div>
            </div>
            {confirmClub
              ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resign(); setConfirmClub(false) }}>{t('legacy.coConfirm')}</button>
              : <button className="btn ghost" style={{ fontSize: 12, color: 'var(--text-negative)' }} onClick={() => { setConfirmClub(true); setConfirmNat(false) }}>{t('legacy.coStepDown')}</button>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
          <span style={{ fontSize: 20 }}>{flagOf(natId) || '🌍'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{nat?.name ?? natId}</div>
            <div className="meta">{t('legacy.coNatCoach')}{conf != null ? t('legacy.coNatUnion', { n: conf }) : ''}</div>
          </div>
          {confirmNat
            ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resignNat(); setConfirmNat(false); go('home') }}>{t('legacy.coConfirm')}</button>
            : <button className="btn ghost" style={{ fontSize: 12, color: 'var(--text-negative)' }} onClick={() => { setConfirmNat(true); setConfirmClub(false) }}>{t('legacy.coStepDown')}</button>}
        </div>
        {!club && <div className="meta">{t('legacy.coNoClubPost')}</div>}
      </div>

      {w ? (
        <>
          <SectionTitle sub={t('legacy.coSquadSub', { max: w.size, floor: NAT_SQUAD_FLOOR })}>
            {t('legacy.coTestSquad', { n: squad.length, max: w.size })}
          </SectionTitle>
          <div className="meta" style={{ padding: '0 16px 4px' }}>
            {t('legacy.coWindowOpen')}
          </div>
          <SectionTitle>{t('legacy.coForwards')}</SectionTitle>
          {table(squad.filter(p => FWD.includes(p.pos)), true)}
          <SectionTitle>{t('legacy.coBacks')}</SectionTitle>
          {table(squad.filter(p => !FWD.includes(p.pos)), true)}
          <SectionTitle sub={t('legacy.coNextMenSub')}>{t('legacy.coNextMen')}</SectionTitle>
          {pool.length ? table(pool, false) : <div className="meta" style={{ padding: '0 16px' }}>{t('legacy.coNobodyLeft')}</div>}
        </>
      ) : (
        <>
          <SectionTitle sub={t('legacy.coBetweenSub')}>{t('legacy.coBetweenWindows')}</SectionTitle>
          <div className="meta" style={{ padding: '0 16px 4px' }}>
            {t('legacy.coLikelySquad')}
          </div>
          {table((pool.length ? pool : squad).slice(0, 26), false)}
        </>
      )}

      <SectionTitle>{t('legacy.coTests')}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {upcoming.map(f => (
          <tr key={f.id}>
            <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
            <td className="name">{flagOf(f.homeId)} {nationByCode(f.homeId)?.name ?? f.homeId} {t('common.v')} {nationByCode(f.awayId)?.name ?? f.awayId} {flagOf(f.awayId)}</td>
            <td className="num muted">-</td>
          </tr>
        ))}
        {results.map(f => {
          const us = f.homeId === natId ? f.homeScore : f.awayScore
          const them = f.homeId === natId ? f.awayScore : f.homeScore
          return (
            <tr key={f.id}>
              <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
              <td className="name">{flagOf(f.homeId)} {nationByCode(f.homeId)?.name ?? f.homeId} {t('common.v')} {nationByCode(f.awayId)?.name ?? f.awayId} {flagOf(f.awayId)}</td>
              <td className="num" style={{ fontWeight: 700, color: us > them ? 'var(--text-positive)' : us < them ? 'var(--text-negative)' : undefined }}>
                {f.homeScore}-{f.awayScore}
              </td>
            </tr>
          )
        })}
        {!upcoming.length && !results.length && (
          <tr><td className="meta">{t('legacy.coNoTests')}</td></tr>
        )}
      </tbody></table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
        {t('legacy.coFullTables')}
      </div>
      <div className="spacer" />
    </>
  )
}
