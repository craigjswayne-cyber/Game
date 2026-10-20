import { useEffect, useState } from 'react'
import { noteStep } from '../../game/firststeps'
import { DataTable } from '../DataTable'
import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { fixtureDate, type Player } from '../../game/model'
import { CrestT, Mark, PosBadge, SectionTitle, Stars } from '../components'
import { acadLeagueName, acadStandings, academySquad, academyStrength, academyXV, ensureAcademyLeague, ACADEMY_SIZE } from '../../game/academy'
import { ord, t } from '../../game/i18n'
import { scoutPa } from '../../game/scout'
import { rowNavTr } from '../rowNav'
import { acc } from '../accent'

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
  const touch = useStore(s => s.touch)
  // a visit here is the first season checklist's "check the academy" (firststeps.ts)
  useEffect(() => { if (noteStep(game, 'academy')) touch() }, [game, touch])
  const [tab, setTab] = useState<'squad' | 'table' | 'fixtures'>('squad')

  const club = game.clubs[game.userClubId]
  // an old save arriving here for the first time gets its A League built now.
  // ensureAcademyLeague writes onto the state object this render is already
  // holding, so what it returns is what the screen draws - no touch needed.
  const l = ensureAcademyLeague(game)
  if (!club) return <div className="muted" style={{ padding: 14 }}>{t('report.acNoClub')}</div>

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
      <div className="card" style={{ ...acc('var(--gold)') }}>
        {/* no inline margin: it beat the band rule's edge-to-edge margins and
            left the title an inset block (owner, 1.9.4: "this is messy") */}
        <h3>{t('report.acTitle', { club: club.short })}</h3>
        <div className="meta">
          {t('report.acRegistered', { n: squad.length, max: ACADEMY_SIZE })}
          {coach ? t('report.acCoachRuns', { name: coach }) : t(level > 0 ? 'report.acCoachGeneric' : 'report.acNoCoach')}
          {l ? (pos > 0 ? t('report.acLeaguePos', { league: acadLeagueName(game, l), pos: ord(pos) }) : t('report.acLeagueNoPos', { league: acadLeagueName(game, l) })) : ''}
        </div>
        <div className="meta" style={{ marginTop: 6 }}>
          {t('report.acStrength', { n: Math.round(academyStrength(game, club)) })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 14px 6px', flexWrap: 'wrap' }}>
        {([['squad', 'report.acSquad'], ['table', 'report.acTable'], ['fixtures', 'report.acFixtures']] as const).map(([k, label]) => (
          <button key={k} className="preset-chip"
            style={tab === k ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onClick={() => setTab(k)}>{t(label)}</button>
        ))}
      </div>

      {tab === 'squad' && (
        <>
          <SectionTitle sub={t('report.acInXV', { n: squad.filter(p => xv.has(p.id)).length })}>{t('report.acScholars')}</SectionTitle>
          {squad.length ? (
            <div className="tblwrap">
              <DataTable<Player> rows={[...squad].sort((a, b) => b.ca + scoutPa(game, b) / 2 - (a.ca + scoutPa(game, a) / 2))}
                rowKey={p => p.id} rowProps={p => ({ ...rowNavTr(() => go('player', p.id)), style: { cursor: 'pointer' } })}
                cols={[
                  { id: 'pos', head: t('squad.colPos'), cell: p => <PosBadge pos={p.pos} /> },
                  { id: 'name', head: t('squad.colName'), className: 'name', cell: p => <>{p.name}{p.injury && <> <Mark name="medical" color="var(--danger)" title={t('selection.injured')} /></>}</> },
                  { id: 'age', head: t('report.acColAge'), align: 'right', td: () => ({ className: 'muted' }), cell: p => p.age },
                  { id: 'ability', head: t('transfers.colAbility'), cell: p => <Stars ca={p.ca} /> },
                  { id: 'apps', head: t('report.acColApps'), align: 'right', cell: p => (p.stats.acadApps ?? 0) + p.stats.apps },
                  { id: 'form', head: t('report.acColForm'), align: 'right', cell: p => p.form.toFixed(1) },
                  { id: 'xv', align: 'right', td: () => ({ className: 'muted' }), cell: p => (xv.has(p.id) ? t('report.acXV') : '') },
                ]} />
            </div>
          ) : <div className="muted" style={{ padding: '8px 16px' }}>{t('report.acEmpty')}</div>}
        </>
      )}

      {tab === 'table' && l && (
        <>
          <SectionTitle sub={l.champion ? t('fixtures.champions', { club: teamShort(game, l.champion) }) : t('report.acPlayedOf', { played: l.fixtures.filter(f => f.played).length, total: l.fixtures.length })}>{acadLeagueName(game, l)}</SectionTitle>
          {/* the rank sits under its "#" and the names get room (owner, 27
              Sep 2026: "the numbers are out of alignment") */}
          <div className="tblwrap"><table className="dtable a-table">
            <colgroup><col width="30" /><col /><col width="28" /><col width="28" /><col width="28" /><col width="28" /><col width="40" /><col width="32" /><col width="36" /></colgroup>
            <thead><tr><th className="center">{t('tables.colRank')}</th><th>{t('tables.colTeam')}</th><th className="num">{t('tables.colP')}</th><th className="num">{t('common.w')}</th>
              <th className="num">{t('common.d')}</th><th className="num">{t('common.l')}</th><th className="num">{t('tables.colDiff')}</th>
              <th className="num">{t('tables.colBP')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className={r.teamId === me ? 'me' : ''}
                  {...rowNavTr(() => game.clubs[r.teamId] && go('club', r.teamId))}
                  style={{ cursor: 'pointer' }}>
                  <td className="center muted">{i + 1}</td>
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
            {t('report.acTableNote')}
          </div>
        </>
      )}

      {tab === 'fixtures' && l && (
        <>
          <SectionTitle sub={t('report.acPlayedOf', { played: mine.filter(f => f.played).length, total: mine.length })}>{t('report.acFixturesTitle')}</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>{t('fixtures.colDate')}</th><th>{t('fixtures.colOpponent')}</th><th>{t('fixtures.colResult')}</th><th>{t('report.acColScorers')}</th></tr></thead>
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
                      <span className="muted" style={{ width: 14, marginRight: 6, display: 'inline-block', textAlign: 'center' }}>{t(home ? 'fixtures.atHomeMark' : 'fixtures.awayMark')}</span>
                      {/* no badges here (owner: they sat out of line) */}
                      {teamShort(game, opp)}{t('report.acAwayTag')}
                    </td>
                    <td className={!f.played ? 'muted' : us > them ? 'result-w' : us < them ? 'result-l' : 'result-d'}>
                      {f.played ? `${t(us > them ? 'common.w' : us < them ? 'common.l' : 'common.d')} ${us}-${them}` : t(home ? 'common.h' : 'common.a')}
                    </td>
                    <td className="muted" style={{ fontSize: '0.6875rem' }}>
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
          {t('report.acNoLeague')}
        </div>
      )}
      <div className="spacer" />
    </>
  )
}
