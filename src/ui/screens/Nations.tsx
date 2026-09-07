import { useState } from 'react'
import { useStore } from '../../store'
import { sortTable } from '../../game/schedule'
import { flagOf, nationName } from '../../game/nations'
import { ClubLink, SectionTitle } from '../components'
import { answerIsles, islesCoach, islesEligible } from '../../game/isles'
import { weekDate } from '../../game/model'
import { t } from '../../game/i18n'

export default function Nations() {
  const game = useStore(s => s.game)!
  const go = useStore(st => st.go)
  const tabs = ([
    ['wc', 'world.natWc'], ['sn', 'world.natSn'], ['trc', 'world.natTrc'], ['pnc', 'world.natPnc'],
    ['aut', 'world.natAut'], ['tour', 'world.natTour'], ['lions', 'world.natLions'],
  ] as const).filter(([id]) => game.comps[id])
  const touch = useStore(s => s.touch)
  const [compId, setCompId] = useState<string>(tabs[0]?.[0] ?? 'sn')
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
          <div className="card" style={{ borderLeft: '4px solid #c8102e' }}>
            <SectionTitle sub={game.comps['lions']?.name}>{t('isles.title')}</SectionTitle>
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
      {!game.isles && game.comps['lions'] && !islesCoach(game) && (
        <div className="card">
          <SectionTitle sub={game.comps['lions']?.name}>{t('isles.title')}</SectionTitle>
          <div className="muted" style={{ padding: '0 10px 10px', fontSize: 12 }}>{t(islesEligible(game).why)}</div>
        </div>
      )}
      {myNat && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 14 }}>{t('world.natYouCoach', { nat: nationName(myNat) })}</h3>
          <div className="meta">
            {mySquad.length
              ? t('world.natWindowOpen', { n: mySquad.length })
              : t('world.natBetween')}
          </div>
          <div className="tblwrap" style={{ marginTop: 6 }}><table className="dtable"><tbody>
            {(mySquad.length ? mySquad : myPool).slice(0, 26).map(p => (
              <tr key={p.id} onClick={() => go('player', p.id)}>
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
      </div>
      {comp && comp.table.length > 0 && (
        <>
          <SectionTitle sub={comp.champion ? t('fixtures.champions', { club: nationName(comp.champion) }) : undefined}>{comp.name}</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>{t('tables.colRank')}</th><th>{t('world.natColNation')}</th><th className="num">{t('tables.colP')}</th><th className="num">{t('common.w')}</th><th className="num">{t('tables.colDiff')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
            <tbody>
              {sortTable(comp.table).map((r, i) => (
                <tr key={r.teamId}>
                  <td className="num muted">{i + 1}</td>
                  <td className="name">{flagOf(r.teamId)} {nationName(r.teamId)}</td>
                  <td className="num">{r.p}</td>
                  <td className="num">{r.w}</td>
                  <td className="num">{r.pf - r.pa}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      <SectionTitle>{t('world.natResults')}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {game.fixtures.filter(f => f.compId === compId).sort((a, b) => a.week - b.week).map(f => (
          <tr key={f.id}>
            <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
            <td className="name">{flagOf(f.homeId)} {nationName(f.homeId)} {t('common.v')} {nationName(f.awayId)} {flagOf(f.awayId)}</td>
            <td className="num">{f.played ? `${f.homeScore}-${f.awayScore}` : '-'}</td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="spacer" />
    </>
  )
}
