import { useState } from 'react'
import { useStore } from '../../store'
import { dreamState, dreamPct } from '../../game/dream'
import { fmtMoney, seasonLabel } from '../../game/model'
import { Crest, SectionTitle } from '../components'
import { careerVerdict, clockLine, mayRetire, retire } from '../../game/career'
import { nemesis, protegeLine } from '../../game/records'
import { CHALLENGES } from '../../game/newgame'
import { horizon, horizonPct } from '../../game/legacy'

const ord = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

export default function Legacy() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const [retireMsg, setRetireMsg] = useState<string | null>(null)
  const club = game.clubs[game.userClubId]
  const m = game.mgr
  const winPct = m.m ? Math.round((m.w / m.m) * 100) : 0
  const challenge = game.challenge ? CHALLENGES.find(c => c.id === game.challenge) : null

  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Crest club={club} size={44} mr={0} /></div>
        <h3 style={{ fontSize: 21, marginTop: 6 }}>{game.managerName}</h3>
        <div className="meta">Director of Rugby, {club.name}</div>
        {challenge && <div className="meta" style={{ color: 'var(--gold)', fontWeight: 700, marginTop: 3 }}>Challenge: {challenge.title}</div>}
      </div>

      {(() => {
        const d = dreamState(game)
        if (!d) return null
        return (
          <>
            <SectionTitle sub={d.progress.done ? 'realised' : 'what this career is for'}>The Dream</SectionTitle>
            <div className="card" style={{ borderLeft: `4px solid ${d.progress.done ? 'var(--primary)' : 'var(--gold)'}` }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{d.title}</div>
              <div style={{ height: 7, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 5px' }}>
                <div style={{ width: `${dreamPct(d.progress)}%`, height: '100%', background: d.progress.done ? 'var(--primary)' : 'var(--gold-fill)' }} />
              </div>
              <div className="meta">{d.progress.note}</div>
            </div>
          </>
        )
      })()}

      {/* THE ENDING, or the clock ticking towards it (career.ts, wave 3). A
          career with no last season has no third act: nothing is ever the last
          chance, and the dream can always wait until next year. */}
      {(() => {
        const v = careerVerdict(game)
        if (game.retired) {
          return (
            <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
              <div className="meta" style={{ letterSpacing: 1 }}>
                RETIRED {game.retired.forced ? '(the game called time)' : 'on his own terms'} AT {game.retired.age}
              </div>
              <h3 style={{ fontSize: 19, marginTop: 4 }}>{v.title}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
                <b style={{ fontSize: 34, color: 'var(--gold)', lineHeight: 1 }}>{v.grade}</b>
                <span className="muted">career grade</span>
              </div>
              {v.lines.map((l, i) => <div key={i} className="meta" style={{ marginTop: 4 }}>{l}</div>)}
            </div>
          )
        }
        return (
          <div className="card">
            <div className="meta">{clockLine(game)}</div>
            {mayRetire(game) && (
              <>
                <div className="meta" style={{ marginTop: 8 }}>
                  If you stopped today: <b style={{ color: 'var(--gold)' }}>{v.grade}</b> - {v.title.toLowerCase()}.
                </div>
                {confirmRetire ? (
                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button className="btn danger" onClick={() => { setRetireMsg(retire(game)); setConfirmRetire(false); touch() }}>
                      Yes, that is that
                    </button>
                    <button className="btn ghost" onClick={() => setConfirmRetire(false)}>One more season</button>
                  </div>
                ) : (
                  <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setConfirmRetire(true)}>
                    Hang up the clipboard
                  </button>
                )}
                {retireMsg && <div className="meta sheet-log" style={{ marginTop: 8 }}>{retireMsg}</div>}
              </>
            )}
          </div>
        )
      })()}

      <SectionTitle>Career Record</SectionTitle>
      <div className="chips">
        <span className="chip">Matches <b>{m.m}</b></span>
        <span className="chip">Won <b style={{ color: 'var(--text-positive)' }}>{m.w}</b></span>
        <span className="chip">Drawn <b>{m.d}</b></span>
        <span className="chip">Lost <b style={{ color: 'var(--danger)' }}>{m.l}</b></span>
        <span className="chip">Win rate <b>{winPct}%</b></span>
        <span className="chip">Signings <b>{m.signings}</b></span>
        <span className="chip">Spent <b>{fmtMoney(m.spent)}</b></span>
      </div>

      {/* WHAT YOU ARE CHASING (C4).
          The audit's read was that this screen is an obituary: every number on it
          is something that has already happened, so there is nothing on it to play
          towards. The marks were already in the engine and already celebrated -
          your 250th win arrives with a salute - but nothing anywhere had ever
          mentioned that a 250th win was a thing, so the salute was a surprise
          rather than an arrival. Same numbers, shown before they land. */}
      {/* WHAT THE CAREER LEAVES BEHIND (records.ts, wave 5): marks to beat, the
          men you made who play elsewhere now, and the club that has your
          number. Two of the three are pure lenses over state that already
          existed, which is why an old save gets its whole history for free. */}
      {(() => {
        const e = game.era
        const nem = nemesis(game)
        const prot = protegeLine(game)
        if (!e?.biggestWin && !nem && !prot) return null
        return (
          <>
            <SectionTitle sub="what this era leaves behind">The Book</SectionTitle>
            <div className="card">
              {e?.biggestWin && (
                <div className="dash-line">
                  <span className="dl-t">Biggest win</span>
                  <b>{e.biggestWin.us}-{e.biggestWin.them}</b>
                  <span className="muted">v {game.clubs[e.biggestWin.oppId]?.short ?? e.biggestWin.oppId}</span>
                </div>
              )}
              {e?.worstLoss && (
                <div className="dash-line">
                  <span className="dl-t">Heaviest defeat</span>
                  <b>{e.worstLoss.us}-{e.worstLoss.them}</b>
                  <span className="muted">v {game.clubs[e.worstLoss.oppId]?.short ?? e.worstLoss.oppId}</span>
                </div>
              )}
              {e?.longestUnbeaten && e.longestUnbeaten.n > 1 && (
                <div className="dash-line">
                  <span className="dl-t">Longest unbeaten</span>
                  <b>{e.longestUnbeaten.n}</b>
                  <span className="muted">matches</span>
                </div>
              )}
              {e?.recordSigning && (
                <div className="dash-line">
                  <span className="dl-t">Record signing</span>
                  <b>{fmtMoney(e.recordSigning.fee)}</b>
                  <span className="muted">{game.players[e.recordSigning.playerId]?.name ?? ''}</span>
                </div>
              )}
              {nem && (
                <div className="meta" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <b style={{ color: 'var(--danger)' }}>Nemesis. </b>{nem.line}
                </div>
              )}
              {prot && <div className="meta" style={{ marginTop: 6 }}>🎓 {prot}</div>}
            </div>
          </>
        )
      })()}

      <SectionTitle sub="the next four things this career is working towards">On the Horizon</SectionTitle>
      <div className="card">
        {horizon(game).map((h, i, all) => (
          <div key={h.label} style={{ marginBottom: i === all.length - 1 ? 0 : 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <b>{h.label}</b>
              <span className="muted">{h.note}</span>
            </div>
            {/* the same bar the tactics screen uses, so it is night-aware already */}
            <span className="rt-bar"><i style={{ width: `${horizonPct(h)}%` }} /></span>
          </div>
        ))}
      </div>

      <SectionTitle sub={m.trophies.length ? undefined : 'the cabinet awaits'}>Trophy Cabinet</SectionTitle>
      {m.trophies.length === 0 ? (
        <div className="muted" style={{ padding: '4px 16px 12px' }}>
          Empty shelves and big dreams. Win something.
        </div>
      ) : (
        <div className="chips">
          {m.trophies.map((t, i) => (
            <span key={i} className="chip" style={{ borderColor: 'var(--gold)' }}>
              🏆 <b>{game.comps[t.compId]?.name ?? t.compId}</b> {seasonLabel(t.season)}
            </span>
          ))}
        </div>
      )}

      {m.finishes.length > 0 && (
        <>
          <SectionTitle>Season By Season</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Season</th><th>League</th><th className="num">Finish</th></tr></thead>
            <tbody>
              {[...m.finishes].reverse().map((f, i) => {
                // the cups won that year belong on the year's row (user:
                // "season by season... doesnt include champions cup success?").
                // They ride in the league column so Finish stays a league fact.
                const cups = m.trophies.filter(t => t.season === f.season && t.compId !== f.leagueId)
                return (
                  <tr key={i}>
                    <td>{seasonLabel(f.season)}</td>
                    {/* .name caps the cell width - the full league name used to
                        shove the Finish column half off a 412px screen (user:
                        "1st is out of screen") */}
                    <td className="name">
                      {game.comps[f.leagueId]?.name ?? f.leagueId}
                      {cups.map((t, j) => (
                        <div key={j} style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 700 }}>
                          🏆 {game.comps[t.compId]?.name ?? t.compId}
                        </div>
                      ))}
                    </td>
                    <td className="num" style={{ fontWeight: 700, color: f.pos === 1 ? 'var(--gold)' : undefined }}>
                      {f.pos === 1 ? '🏆 1st' : ord(f.pos)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </>
      )}

      {(game.hof ?? []).length > 0 && (
        <>
          <SectionTitle sub="the immortals - careers that closed the argument">🏛 Hall of Fame</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Name</th><th>Pos</th><th className="num">Apps</th><th className="num">Tries</th><th className="num">Pts</th><th>Retired</th></tr></thead>
            <tbody>
              {(game.hof ?? []).map((h, i) => (
                <tr key={i}>
                  <td className="name">{h.name} <span className="muted">({h.club})</span></td>
                  <td>{h.pos}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{h.apps}</td>
                  <td className="num">{h.tries}</td>
                  <td className="num">{h.points}</td>
                  <td>{seasonLabel(h.season)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      <div className="spacer" />
    </>
  )
}
