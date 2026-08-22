import { useState } from 'react'
import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { fixtureDate } from '../../game/model'
import { CrestT, PosBadge, SectionTitle, Stars } from '../components'
import { acadStandings, academySquad, academyStrength, academyXV, ensureAcademyLeague, ACADEMY_SIZE } from '../../game/academy'

/** The academy section: the squad, the A League table, and the fixtures.
 *
 *  User: "Teams academy should be a squad of 27. They should also play games but
 *  managed by academy coach. Results should be reported and fixtures/table should
 *  be in an academy section."
 *
 *  The academy used to be four names on the squad screen with a promote button. It
 *  is a team now, so it gets what a team gets: a table it is trying to win, a fixture
 *  list, and a squad page showing who the coach has been picking. */
export default function Academy() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [tab, setTab] = useState<'squad' | 'table' | 'fixtures'>('squad')

  const club = game.clubs[game.userClubId]
  // an old save arriving here for the first time gets its A League built now.
  // ensureAcademyLeague writes onto the state object this render is already
  // holding, so what it returns is what the screen draws - no touch needed.
  const l = ensureAcademyLeague(game)
  if (!club) return <div className="muted" style={{ padding: 14 }}>No club, no academy.</div>

  const squad = academySquad(game, club)
  const xv = new Set(academyXV(game, club).map(p => p.id))
  const coach = game.staffPeople?.academyCoach?.name
  const level = game.staff?.academyCoach ?? 0
  const me = game.userClubId
  const rows = l ? acadStandings(l) : []
  // no position before a ball is kicked. An all-zero table still has an ORDER -
  // the tie-break falls through to club id - and printing "6th" in week one is
  // the bug the league table already learned not to have (blocker B1).
  const pos = rows.some(r => r.p > 0) ? rows.findIndex(r => r.teamId === me) + 1 : 0
  const mine = l ? l.fixtures.filter(f => f.homeId === me || f.awayId === me).sort((a, b) => a.round - b.round) : []

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <h3 style={{ margin: 0 }}>🎓 {club.short} Academy</h3>
        <div className="meta">
          {squad.length} of {ACADEMY_SIZE} registered ·{' '}
          {coach ? `${coach} runs it` : level > 0 ? 'your academy coach runs it' : 'nobody runs it - the post is vacant'}
          {l ? ` · ${l.name}${pos > 0 ? `, ${pos}${pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th'}` : ''}` : ''}
        </div>
        <div className="meta">
          Team strength {Math.round(academyStrength(game, club))}. The coach rotates the side, so every scholar
          gets rugby - minutes are what turn one of them into a first-team player.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 14px 6px', flexWrap: 'wrap' }}>
        {([['squad', 'Squad'], ['table', 'A League Table'], ['fixtures', 'Fixtures & Results']] as const).map(([k, label]) => (
          <button key={k} className="preset-chip"
            style={tab === k ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'squad' && (
        <>
          <SectionTitle sub={`${squad.filter(p => xv.has(p.id)).length} in this week's XV`}>The Scholars</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Pos</th><th>Name</th><th className="num">Age</th><th>Ability</th>
              <th className="num">Apps</th><th className="num">Form</th><th /></tr></thead>
            <tbody>
              {[...squad].sort((a, b) => b.ca + b.pa / 2 - (a.ca + a.pa / 2)).map(p => (
                <tr key={p.id} onClick={() => go('player', p.id)} style={{ cursor: 'pointer' }}>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="name">{p.name}{p.injury ? ' 🩹' : ''}</td>
                  <td className="num muted">{p.age}</td>
                  <td><Stars ca={p.ca} /></td>
                  <td className="num">{p.stats.apps}</td>
                  <td className="num">{p.form.toFixed(1)}</td>
                  <td className="num muted">{xv.has(p.id) ? 'XV' : ''}</td>
                </tr>
              ))}
              {!squad.length && <tr><td colSpan={7} className="muted">Nobody on the books. The summer intake will fix that.</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'table' && l && (
        <>
          <SectionTitle sub={l.champion ? `Champions: ${teamShort(game, l.champion)}` : `${l.fixtures.filter(f => f.played).length} of ${l.fixtures.length} played`}>{l.name}</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th>
              <th className="num">D</th><th className="num">L</th><th className="num">+/-</th>
              <th className="num">BP</th><th className="num">Pts</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className={r.teamId === me ? 'me' : ''}
                  onClick={() => game.clubs[r.teamId] && go('club', r.teamId)}
                  style={{ cursor: 'pointer' }}>
                  <td className="num muted">{i + 1}</td>
                  <td className="name"><CrestT g={game} teamId={r.teamId} size={15} />{teamShort(game, r.teamId)}</td>
                  <td className="num">{r.p}</td>
                  <td className="num">{r.w}</td>
                  <td className="num">{r.d}</td>
                  <td className="num">{r.l}</td>
                  <td className="num">{r.pf - r.pa > 0 ? '+' : ''}{r.pf - r.pa}</td>
                  <td className="num">{r.bp}</td>
                  <td className="num"><b>{r.pts}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="filter-note">
            No trophy, no promotion, no relegation. What the table is for is telling you whether the men coming
            through are winning games against the men coming through everywhere else.
          </div>
        </>
      )}

      {tab === 'fixtures' && l && (
        <>
          <SectionTitle sub={`${mine.filter(f => f.played).length} of ${mine.length} played`}>A League Fixtures</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Scorers</th></tr></thead>
            <tbody>
              {mine.map(f => {
                const home = f.homeId === me
                const opp = home ? f.awayId : f.homeId
                const us = home ? f.homeScore : f.awayScore
                const them = home ? f.awayScore : f.homeScore
                const names = (f.scorers ?? []).map(id => game.players[id]?.name).filter(Boolean) as string[]
                const tally = new Map<string, number>()
                for (const n of names) tally.set(n, (tally.get(n) ?? 0) + 1)
                return (
                  <tr key={`${f.round}-${f.homeId}`}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fixtureDate(game.season, f.week, f.round, -1)}</td>
                    <td className="name">
                      <span className="muted" style={{ width: 12, display: 'inline-block', textAlign: 'center' }}>{home ? 'v' : '@'}</span>
                      <CrestT g={game} teamId={opp} size={15} />{teamShort(game, opp)} A
                    </td>
                    <td className={!f.played ? 'muted' : us > them ? 'result-w' : us < them ? 'result-l' : 'result-d'}>
                      {f.played ? `${us > them ? 'W' : us < them ? 'L' : 'D'} ${us}-${them}` : (home ? 'H' : 'A')}
                    </td>
                    <td className="muted" style={{ fontSize: 11 }}>
                      {[...tally].map(([n, c]) => (c > 1 ? `${n} (${c})` : n)).join(', ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </>
      )}

      {tab !== 'squad' && !l && (
        <div className="muted" style={{ padding: 14 }}>
          No A League this season. Your league needs at least four clubs to run one.
        </div>
      )}
      <div className="spacer" />
    </>
  )
}
