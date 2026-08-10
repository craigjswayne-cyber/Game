import { useState } from 'react'
import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { venueBadge, venueEffect } from '../../game/venue'
import { fixtureDate, weekDate, type Fixture, type MatchEvent } from '../../game/model'
import { CrestT, Jersey, SectionTitle } from '../components'
import LeagueTable from '../LeagueTable'
import { stageName } from './Home'

export default function Fixtures() {
  const game = useStore(s => s.game)!
  const [replayId, setReplayId] = useState<number | null>(null)
  const [comp, setComp] = useState('ALL')
  // "fixtures and results should also have the table for the league in there as
  // an additional page". Two pages behind one tab bar, and the table follows the
  // competition chip: filter the list to Europe and the table you flip to is the
  // European one, because a table for a competition you are not looking at is
  // just the Competitions screen with extra steps.
  const [page, setPage] = useState<'fixtures' | 'table'>('fixtures')
  const me = game.userClubId
  const mine = game.fixtures.filter(f => f.homeId === me || f.awayId === me)
  const comps = [...new Set(mine.map(f => f.compId))]
  const fx = mine
    .filter(f => comp === 'ALL' || f.compId === comp)
    .sort((a, b) => a.week - b.week)
  const replay = replayId != null ? game.fixtures.find(f => f.id === replayId) : null

  const res = (f: Fixture) => {
    if (!f.played) return <span className="muted">{f.homeId === me ? 'H' : 'A'}</span>
    const us = f.homeId === me ? f.homeScore : f.awayScore
    const them = f.homeId === me ? f.awayScore : f.homeScore
    const cls = us > them ? 'result-w' : us < them ? 'result-l' : 'result-d'
    return <span className={cls}>{us > them ? 'W' : us < them ? 'L' : 'D'} {f.homeScore}-{f.awayScore}</span>
  }

  // magazine-style THIS WEEKEND card: this round in the user's league
  const leagueId = game.clubs[me]?.leagueId
  const weekend = game.fixtures
    .filter(f => f.compId === leagueId && f.week === game.week && !f.played)
    .slice(0, 7)

  // The table page follows the chip where it can. "All comps" has no table of
  // its own, and neither does a friendly, so both fall back to the league the
  // club actually plays in rather than showing nothing.
  const tableId = comp !== 'ALL' && game.comps[comp]?.table?.length ? comp : leagueId
  const tableComp = tableId ? game.comps[tableId] : undefined

  // one filter, shown on both pages, because the alternative is a table page
  // that tells you to go to the other page to change which table you are on
  const chips = (
    <div style={{ display: 'flex', gap: 6, padding: '0 14px 6px', flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="preset-chip" style={comp === 'ALL' ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
        onClick={() => setComp('ALL')}>{page === 'table' ? 'My league' : 'All comps'}</button>
      {comps.map(cid => (
        <button key={cid} className="preset-chip" style={comp === cid ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
          onClick={() => setComp(cid)}>{game.comps[cid]?.short ?? (cid === 'fr' ? 'Friendly' : cid)}</button>
      ))}
      {/* Played and To Come are gone at the user's request. The list is in date
          order with the next match highlighted, so where you are in the season
          is already on the screen: the chips split one readable column into two
          halves of itself and cost a row to do it. */}
    </div>
  )

  return (
    <>
      <div className="tab-bar">
        <button className={page === 'fixtures' ? 'active' : ''} onClick={() => setPage('fixtures')}>Fixtures</button>
        <button className={page === 'table' ? 'active' : ''} onClick={() => setPage('table')}>Table</button>
      </div>
      {page === 'table' ? (
        <>
          <SectionTitle sub={tableComp?.champion
            ? `Champions: ${teamShort(game, tableComp.champion)}`
            : tableComp?.table.some(r => r.p > 0)
              ? `${Math.max(...tableComp.table.map(r => r.p))} rounds played`
              : 'no games played yet'}>
            {tableComp?.name ?? 'League Table'}
          </SectionTitle>
          {chips}
          {tableComp && tableId
            ? <LeagueTable compId={tableId} />
            : <div className="card"><div className="muted" style={{ padding: 12 }}>
                This competition is a knockout, so there is no table to show. Pick a league above.
              </div></div>}
          <div className="spacer" />
        </>
      ) : (
        <>
      {weekend.length > 0 && (
        <div className="card" style={{ padding: '10px 0' }}>
          <h3 style={{ textAlign: 'center', fontFamily: 'var(--cond)', letterSpacing: 3, fontSize: 15 }}>THIS WEEKEND</h3>
          <div className="meta" style={{ textAlign: 'center', marginBottom: 4 }}>{weekDate(game.season, game.week)} · {game.comps[leagueId!]?.short}</div>
          {weekend.map(f => (
            /* YOUR game is marked by tinting the row and bolding YOUR name, and the V
               stays in the middle like every other row (user: "highlight the team
               name in a colour and keep the v in the middle"). The YOUR MATCH pill
               replaced the V, so your row was the one row with no v in it. */
            <div key={f.id} className={`wknd-row${f.homeId === me || f.awayId === me ? ' yours' : ''}`}>
              <span className={`side${f.homeId === me ? ' mine' : ''}`}>{game.clubs[f.homeId] && <Jersey club={game.clubs[f.homeId]} size={36} />} {teamShort(game, f.homeId)}</span>
              <span className="vs">V</span>
              <span className={`side right${f.awayId === me ? ' mine' : ''}`}>{teamShort(game, f.awayId)} {game.clubs[f.awayId] && <Jersey club={game.clubs[f.awayId]} size={36} />}</span>
            </div>
          ))}
        </div>
      )}
      <SectionTitle sub={`${mine.filter(f => f.played).length}/${mine.length} played`}>Season Fixtures</SectionTitle>
      {chips}
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Date</th><th>Opponent</th><th>Comp</th><th>Result</th></tr></thead>
        <tbody>
          {fx.map(f => {
            const opp = f.homeId === me ? f.awayId : f.homeId
            const isNext = !f.played && f.week === game.week
            return (
              <tr key={f.id} className={isNext ? 'next-fx' : undefined}
                onClick={() => f.played && f.events?.length ? setReplayId(f.id) : undefined}
                style={f.played && f.events?.length ? { cursor: 'pointer' } : undefined}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fixtureDate(game.season, f.week, f.id).replace(/day /, " ")}</td>
                <td className="name">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span className="muted" style={{ width: 12, display: 'inline-block', textAlign: 'center' }}>{f.homeId === me ? 'v' : '@'}</span>
                    <CrestT g={game} teamId={opp} size={16} />
                    {teamShort(game, opp)}
                    {/* The altitude/travel badge lived here (F27) and is gone
                        (user: "on the fixture graphic the sea level isnt
                        needed"). The trip's difficulty still shows where the
                        decision is made: the match-day venue panel. */}
                    {f.played && f.events?.length ? <span className="muted" style={{ fontSize: 10 }}>▸</span> : null}
                  </span>
                </td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{game.comps[f.compId]?.short ?? (f.compId === 'fr' ? 'Friendly' : f.compId)}{f.stage ? ` ${stageName(f.stage)}` : ''}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{res(f)}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
        </>
      )}
      {replay && (
        <div className="modal-veil" onClick={() => setReplayId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <SectionTitle sub={`${weekDate(game.season, replay.week)}${replay.att ? ` · ${replay.att.toLocaleString()} at ${game.clubs[replay.homeId]?.stadium ?? 'a neutral venue'}` : ''}`}>
              {teamShort(game, replay.homeId)} {replay.homeScore} – {replay.awayScore} {teamShort(game, replay.awayId)}
            </SectionTitle>
            <div style={{ padding: '0 4px' }}>
              {(replay.events ?? []).filter(e => e.type !== 'SUB' || /replaces/.test(e.text)).map((e: MatchEvent, i: number) => (
                <div key={i} className={`tick-event ${e.type === 'TRY' || e.type === 'FT' || e.type === 'DG' ? 'big' : e.type === 'YC' ? 'card-y' : e.type === 'RC' ? 'card-r' : e.type === 'INJ' ? 'inj' : ''}`}>
                  <span className="min">{e.min}'</span>
                  <span className="txt">{e.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="spacer" />
    </>
  )
}
