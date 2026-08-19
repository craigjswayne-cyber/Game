import { Fragment, useState } from 'react'
import { useStore } from '../../store'
import { weekDate } from '../../game/model'
import { flagOf, nationByCode } from '../../game/nations'
import { natRankOrder } from '../../game/natrank'
import { natFixtureThisWeek } from '../../game/season'
import { NAT_SQUAD_FLOOR, natCallUp, natDrop, natEligible, natWindow } from '../../game/country'
import { PosBadge, SectionTitle } from '../components'

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
        <h3 style={{ fontSize: 15 }}>🌍 No national job</h3>
        <div className="meta">Unions come calling when a club coach's work is hard to ignore. Keep winning.</div>
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
        {p.name}{(p.caps ?? 0) > 0 ? <span className="muted"> · {p.caps} caps</span> : <span className="muted"> · uncapped</span>}
      </td>
      <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : ''}</td>
      <td style={{ width: 64, textAlign: 'right' }}>
        {w && (
          <button className="btn ghost" style={{ fontSize: 12, padding: '6px 10px', color: inSquad ? '#9b2c2c' : '#2f7d4f' }}
            onClick={e => { e.stopPropagation(); act(p, inSquad ? natDrop : natCallUp) }}>
            {inSquad ? 'Drop' : 'Call up'}
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
            <tr><td colSpan={4} className="meta" style={{ color: '#9b2c2c', paddingTop: 0 }}>{msg.text}</td></tr>
          )}
        </Fragment>
      ))}
    </tbody></table></div>
  )

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid #2f7d4f' }}>
        <h3 style={{ fontSize: 17 }}>{flagOf(natId)} {nat?.name ?? natId}</h3>
        <div className="meta" style={{ marginTop: 2 }}>
          {rank > 0 ? `World No. ${rank}` : 'Unranked'} · {(game.natRank?.[natId] ?? 0).toFixed(2)} pts
          {rec ? ` · Tests ${rec.w}-${rec.d}-${rec.l} under you` : ''}
        </div>
        {conf != null && (
          <div style={{ margin: '8px 2px 2px' }}>
            <div style={{ height: 8, background: 'var(--cream-3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${conf}%`, height: '100%', background: conf >= 60 ? '#2f7d4f' : conf >= 40 ? 'var(--gold)' : '#a12f2f' }} />
            </div>
            <div className="meta" style={{ marginTop: 4 }}>
              Union confidence {conf}/100 · the annual review sacks below 28
            </div>
          </div>
        )}
        {testFx && (
          <div className="muted" style={{ marginTop: 8, fontWeight: 700 }}>
            🌍 TEST WEEK: {nationByCode(testFx.homeId)?.name ?? testFx.homeId} v {nationByCode(testFx.awayId)?.name ?? testFx.awayId} this Saturday.
            Your assistant minds any club fixture.
          </div>
        )}
      </div>

      {/* both hats, and the way out of either - in the open, not buried
          (user: "OR you can step down from your club role") */}
      <div className="card">
        <SectionTitle sub="one man, two touchlines - and the door out of either, should you want it">Your Appointments</SectionTitle>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ fontSize: 20 }}>🏟️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{club.name}</div>
              <div className="meta">Director of Rugby · board {Math.round(club.boardConfidence)}%</div>
            </div>
            {confirmClub
              ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resign(); setConfirmClub(false) }}>Confirm</button>
              : <button className="btn ghost" style={{ fontSize: 12, color: '#9b2c2c' }} onClick={() => { setConfirmClub(true); setConfirmNat(false) }}>Step down…</button>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
          <span style={{ fontSize: 20 }}>{flagOf(natId) || '🌍'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{nat?.name ?? natId}</div>
            <div className="meta">National head coach{conf != null ? ` · union ${conf}%` : ''}</div>
          </div>
          {confirmNat
            ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resignNat(); setConfirmNat(false); go('home') }}>Confirm</button>
            : <button className="btn ghost" style={{ fontSize: 12, color: '#9b2c2c' }} onClick={() => { setConfirmNat(true); setConfirmClub(false) }}>Step down…</button>}
        </div>
        {!club && <div className="meta">No club post - the Test job is the whole desk for now.</div>}
      </div>

      {w ? (
        <>
          <SectionTitle sub={`the federation caps camp at ${w.size} and will not let it fall below ${NAT_SQUAD_FLOOR} - your club's men in bold`}>
            Test Squad · {squad.length}/{w.size}
          </SectionTitle>
          <div className="meta" style={{ padding: '0 16px 4px' }}>
            Window open: drop a name, call the next man up. The Test XV is picked from this room on match day.
          </div>
          <SectionTitle>Forwards</SectionTitle>
          {table(squad.filter(p => FWD.includes(p.pos)), true)}
          <SectionTitle>Backs</SectionTitle>
          {table(squad.filter(p => !FWD.includes(p.pos)), true)}
          <SectionTitle sub="every qualified name in the game, best first - no age limit, no rating floor, your call">The Next Men In</SectionTitle>
          {pool.length ? table(pool, false) : <div className="meta" style={{ padding: '0 16px' }}>Nobody left standing outside camp.</div>}
        </>
      ) : (
        <>
          <SectionTitle sub="call-ups happen when the federation opens camp - shape the squad then">Between Windows</SectionTitle>
          <div className="meta" style={{ padding: '0 16px 4px' }}>
            The likely squad, on current form. When a window opens the federation names its list and hands it to you.
          </div>
          {table((pool.length ? pool : squad).slice(0, 26), false)}
        </>
      )}

      <SectionTitle>Tests</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {upcoming.map(f => (
          <tr key={f.id}>
            <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
            <td className="name">{flagOf(f.homeId)} {nationByCode(f.homeId)?.name ?? f.homeId} v {nationByCode(f.awayId)?.name ?? f.awayId} {flagOf(f.awayId)}</td>
            <td className="num muted">-</td>
          </tr>
        ))}
        {results.map(f => {
          const us = f.homeId === natId ? f.homeScore : f.awayScore
          const them = f.homeId === natId ? f.awayScore : f.homeScore
          return (
            <tr key={f.id}>
              <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
              <td className="name">{flagOf(f.homeId)} {nationByCode(f.homeId)?.name ?? f.homeId} v {nationByCode(f.awayId)?.name ?? f.awayId} {flagOf(f.awayId)}</td>
              <td className="num" style={{ fontWeight: 700, color: us > them ? '#2f7d4f' : us < them ? '#9b2c2c' : undefined }}>
                {f.homeScore}-{f.awayScore}
              </td>
            </tr>
          )
        })}
        {!upcoming.length && !results.length && (
          <tr><td className="meta">No Tests on the calendar yet this season.</td></tr>
        )}
      </tbody></table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
        Full tables and every competition live on the International Rugby screen.
      </div>
      <div className="spacer" />
    </>
  )
}
