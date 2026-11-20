import { useState } from 'react'
import { useStore } from '../../store'
import { sortTable, tableRule } from '../../game/schedule'
import { nationName } from '../../game/nations'
import { Flag } from '../flags'
import { natRankOrder } from '../../game/natrank'
import { MoveCell, sinceLine } from './Agency'
import type { GameState } from '../../game/model'
import { ClubLink, SectionTitle } from '../components'
import { answerIsles, islesCoach, islesEligible } from '../../game/isles'
import { weekDate } from '../../game/model'
import { t, compLabel } from '../../game/i18n'
import { rowNavTr } from '../rowNav'
import { acc } from '../accent'
import { stageShort } from './Home'

/** THE TEST RANKINGS, WITH THE REST OF INTERNATIONAL RUGBY (owner, 1.8.2).
 *  They sat as a third tab on the Scouting Agency, between two lists of club
 *  players; a nation's standing belongs beside its tournaments. */
function TestRankings({ game }: { game: GameState }) {
  const order = natRankOrder(game)
  const prevOrder = game.natRankPrev ?? []
  return (
    <>
      <SectionTitle sub={t('world.agTestSub')}>{t('world.agTestTitle')}</SectionTitle>
      <div className="tblwrap"><table className="dtable natranks">
        <thead><tr><th>{t('tables.colRank')}</th><th></th><th>{t('world.natColNation')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
        <tbody>
          {order.map((code, i) => {
            const prevIdx = prevOrder.indexOf(code)
            const mine = game.natTeam === code
            return (
              <tr key={code} style={mine ? { background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}>
                <td className="num" style={{ fontWeight: 700 }}>{i + 1}</td>
                {/* a nation missing from the last table is not a new
                    entry, only one the table had not ranked yet */}
                <MoveCell from={prevIdx < 0 ? i : prevIdx} to={i} compared={prevOrder.length > 0} />
                <td className="name" style={mine ? { fontWeight: 800 } : undefined}>
                  <Flag code={code} /> {nationName(code)}{mine ? t('world.agYou') : ''}
                </td>
                {/* the gap to the screen's edge is .natranks' last-child
                    rule in theme.css, so the heading moves with the figures */}
                <td className="num">{(game.natRank?.[code] ?? 0).toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: '0.75rem' }}>
        {sinceLine(game)}{t('world.agNatFoot')}
      </div>
    </>
  )
}

export default function Nations() {
  const game = useStore(s => s.game)!
  const go = useStore(st => st.go)
  // THE WOMEN'S TESTS HAVE TABS TOO (QA, 1.9.15). The list named the men's
  // ids only, so a women's career saw its World Championship and nothing else
  const tabs = ([
    ['wc', 'world.natWc'], ['sn', 'world.natSn'], ['w:sn', 'world.natSn'], ['trc', 'world.natTrc'], ['w:p4', 'world.natP4'],
    ['pnc', 'world.natPnc'], ['aut', 'world.natAut'], ['w:aut', 'world.natAut'], ['tour', 'world.natTour'], ['w:sum', 'world.natTour'],
    ['lions', 'world.natLions'], ['w:lions', 'world.natLions'],
  ] as const).filter(([id]) => game.comps[id])
  // a provincial side on the Isles tour is a club, not a nation (QA, 1.9.15:
  // the tour's results read "blues v LIO")
  const side = (id: string) => game.clubs[id]
    ? <>{game.clubs[id].name}</>
    : <><Flag code={id} /> {nationName(id)}</>
  const sideR = (id: string) => game.clubs[id]
    ? <>{game.clubs[id].name}</>
    : <>{nationName(id)} <Flag code={id} /></>
  const touch = useStore(s => s.touch)
  const [compId, setCompId] = useState<string>(tabs[0]?.[0] ?? 'rank')
  const comp = game.comps[compId]

  const myNat = game.natTeam
  const mySquad = myNat ? (game.natSquads[myNat] ?? []).map(id => game.players[id]).filter(Boolean) : []
  // no rating floor: the user's federation calls its best REAL players,
  // whatever their age or number - the preview must agree with the rule
  const myPool = myNat && !mySquad.length
    ? Object.values(game.players).filter(p => p.nat === myNat && p.clubId).sort((a, b) => b.ca - a.ca).slice(0, 26)
    : []

  return (
    <>
      {/* ---- THE LETTER FROM THE FOUR UNIONS ----
          Offer only: there is no button anywhere that asks for this job. The
          panel appears when they have written, and disappears once he answers.
          While he is on tour it stays, saying what he took on. */}
      {(game.isles?.season === game.season || islesCoach(game)) && (() => {
        const open = game.isles?.answer === 'open'
        const took = game.isles?.answer === 'yes'
        return (
          <div className="card" style={{ ...acc('var(--primary)') }}>
            <SectionTitle sub={compLabel(game.comps['lions']?.name)}>{t('isles.title')}</SectionTitle>
            <div className="meta" style={{ padding: '0 10px 8px' }}>
              {open ? t('isles.whyYes') : took ? t('isles.took') : t('isles.passed')}
            </div>
            {open && (
              <div className="filter-line" style={{ padding: '0 10px 10px' }}>
                <button className="btn" onClick={() => { answerIsles(game, true); touch() }}>{t('isles.accept')}</button>
                <button className="btn ghost" onClick={() => { answerIsles(game, false); touch() }}>{t('isles.decline')}</button>
              </div>
            )}
          </div>
        )
      })()}
      {/* and when there is a tour on that he is NOT part of, the panel says
          which condition he has not met - a locked door with no sign on it is
          just a missing feature */}
      {/* only for a coach of one of the four unions it picks from (1.9.14): the
          international stage shows itself to the men and women who hold it */}
      {!game.isles && game.comps['lions'] && !islesCoach(game) && ['ENG', 'IRE', 'SCO', 'WAL'].includes(game.natTeam ?? '') && (
        <div className="card">
          <SectionTitle sub={compLabel(game.comps['lions']?.name)}>{t('isles.title')}</SectionTitle>
          <div className="muted" style={{ padding: '0 10px 10px', fontSize: '0.75rem' }}>{t(islesEligible(game).why)}</div>
        </div>
      )}
      {myNat && (
        <div className="card" style={{ ...acc('var(--gold)') }}>
          <h3 style={{ fontSize: '0.875rem' }}>{t('world.natYouCoach', { nat: nationName(myNat) })}</h3>
          <div className="meta">
            {mySquad.length
              ? t('world.natWindowOpen', { n: mySquad.length })
              : t('world.natBetween')}
          </div>
          <div className="tblwrap" style={{ marginTop: 6 }}><table className="dtable"><tbody>
            {(mySquad.length ? mySquad : myPool).slice(0, 26).map(p => (
              <tr key={p.id} {...rowNavTr(() => go('player', p.id))}>
                <td className="muted">{p.pos}</td>
                <td className="name">{p.name}</td>
                <td className="muted">{p.clubId ? <ClubLink g={game} clubId={p.clubId} /> : ''}</td>
                <td className="num">{p.age}</td>
              </tr>
            ))}
          </tbody></table></div>
        </div>
      )}
      <div className="tab-bar">
        {tabs.map(([id, name]) => (
          <button key={id} className={id === compId ? 'active' : ''} onClick={() => setCompId(id)}>{t(name)}</button>
        ))}
        <button className={compId === 'rank' ? 'active' : ''} onClick={() => setCompId('rank')}>{t('world.agTestNations')}</button>
      </div>
      {compId === 'rank' && <TestRankings game={game} />}
      {comp?.pools && comp.pools.length > 2 && (() => {
        // A WORLD CHAMPIONSHIP IS POOLS AND A BRACKET (QA, 1.9.15), not one
        // table of twenty-four: a pool each, the two going through marked,
        // and the knockouts as they are drawn
        const rows = (pool: string[]) => sortTable(comp.table.filter(r => pool.includes(r.teamId)))
        const ko = game.fixtures.filter(f => f.compId === comp.id && f.stage).sort((a, b) => a.week - b.week || a.id - b.id)
        const through = new Set(ko.filter(f => f.stage === ko[0]?.stage).flatMap(f => [f.homeId, f.awayId]))
        return (
          <>
            <SectionTitle sub={comp.champion ? t('fixtures.champions', { club: nationName(comp.champion) }) : t(comp.pools.length === 6 ? 'world.natPoolFoot6' : 'world.natPoolFoot4')}>{compLabel(comp.name)}</SectionTitle>
            {comp.pools.map((pool, pi) => (
              <div key={pi}>
                <div className="meta" style={{ padding: '6px 16px 2px', fontWeight: 700 }}>{t('world.natPool', { p: String.fromCharCode(65 + pi) })}</div>
                <div className="tblwrap"><table className="dtable">
                  <thead><tr><th className="num">{t('tables.colRank')}</th><th>{t('world.natColNation')}</th><th className="num">{t('tables.colP')}</th><th className="num">{t('common.w')}</th><th className="num">{t('tables.colDiff')}</th><th className="num">{t('tables.colBP')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
                  <tbody>
                    {rows(pool).map((r, i) => {
                      const q = through.size ? through.has(r.teamId) : i < 2
                      return (
                        <tr key={r.teamId} style={game.natTeam === r.teamId ? { background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}>
                          <td className="num muted" style={q ? { color: 'var(--text-positive)', fontWeight: 700 } : undefined}>{i + 1}</td>
                          <td className="name"><Flag code={r.teamId} /> {nationName(r.teamId)}</td>
                          <td className="num">{r.p}</td>
                          <td className="num">{r.w}</td>
                          <td className="num">{r.pf - r.pa}</td>
                          <td className="num">{r.bp}</td>
                          <td className="num" style={{ fontWeight: 700 }}>{r.pts}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table></div>
              </div>
            ))}
            {ko.length > 0 && <>
              <SectionTitle>{t('world.natKnockouts')}</SectionTitle>
              <div className="tblwrap"><table className="dtable"><tbody>
                {ko.map(f => (
                  <tr key={f.id}>
                    <td className="muted">{stageShort(f.stage!)}</td>
                    <td className="name">{side(f.homeId)} {t('common.v')} {sideR(f.awayId)}</td>
                    <td className="num">{f.played ? `${f.homeScore}-${f.awayScore}` : '-'}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </>}
          </>
        )
      })()}
      {comp && comp.table.length > 0 && !(comp.pools && comp.pools.length > 2) && (
        <>
          <SectionTitle sub={comp.champion ? t('fixtures.champions', { club: nationName(comp.champion) }) : undefined}>{compLabel(comp.name)}</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th className="num">{t('tables.colRank')}</th><th>{t('world.natColNation')}</th><th className="num">{t('tables.colP')}</th><th className="num">{t('common.w')}</th><th className="num">{t('tables.colDiff')}</th><th className="num">{t('tables.colBP')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
            <tbody>
              {sortTable(comp.table, tableRule(comp.id)).map((r, i) => (
                <tr key={r.teamId}>
                  <td className="num muted">{i + 1}</td>
                  <td className="name"><Flag code={r.teamId} /> {nationName(r.teamId)}</td>
                  <td className="num">{r.p}</td>
                  <td className="num">{r.w}</td>
                  <td className="num">{r.pf - r.pa}</td>
                  <td className="num">{r.bp}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      {compId !== 'rank' && <>
      <SectionTitle>{t('world.natResults')}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {game.fixtures.filter(f => f.compId === compId && !(comp?.pools && comp.pools.length > 2 && f.stage)).sort((a, b) => a.week - b.week).map(f => (
          <tr key={f.id}>
            <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}{f.stage ? ` · ${stageShort(f.stage)}` : ''}</td>
            <td className="name">{side(f.homeId)} {t('common.v')} {sideR(f.awayId)}</td>
            <td className="num">{f.played ? `${f.homeScore}-${f.awayScore}` : '-'}</td>
          </tr>
        ))}
      </tbody></table></div>
      </>}
      <div className="spacer" />
    </>
  )
}
