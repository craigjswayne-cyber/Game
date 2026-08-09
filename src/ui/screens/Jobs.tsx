import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, mgrReputation } from '../../game/model'
import { jobChance } from '../../game/jobs'
import { squadValue } from '../../game/analysis'
import { Crest, SectionTitle } from '../components'

export default function Jobs() {
  const game = useStore(s => s.game)!
  const applyJob = useStore(s => s.applyJob)
  const passJob = useStore(s => s.passJob)
  const resign = useStore(s => s.resign)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)

  const rep = mgrReputation(game)
  const vacancies = game.vacancies
    .map(v => ({ v, club: game.clubs[v.clubId] }))
    .filter(x => x.club)
    // the ones he has turned down sink to the bottom rather than vanish:
    // hiding them would make 'Reconsider' unreachable
    .sort((a, b) => Number(!!a.v.passed) - Number(!!b.v.passed) || b.club.rep - a.club.rep)

  return (
    <>
      <div className="card">
        <h3 style={{ fontSize: 16 }}>{game.unemployed ? 'Between jobs' : 'The managerial market'}</h3>
        <div className="meta">
          Your reputation: <b style={{ color: 'var(--accent-ink)' }}>{rep}/95</b> - built on {game.mgr.m} matches,
          {' '}{game.mgr.m ? Math.round((game.mgr.w / game.mgr.m) * 100) : 0}% won, {game.mgr.trophies.length} troph{game.mgr.trophies.length === 1 ? 'y' : 'ies'}.
        </div>
        {game.unemployed && (
          <div className="meta" style={{ marginTop: 4 }}>
            Press Continue to let the weeks pass - boards lose patience with strugglers, and new vacancies appear.
          </div>
        )}
      </div>

      {msg && <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>{msg}</div>}

      <SectionTitle sub={`${vacancies.filter(x => !x.v.passed).length} of ${vacancies.length} of interest`}>Vacancies</SectionTitle>
      {vacancies.length === 0 && (
        <div className="muted" style={{ padding: '4px 16px 12px' }}>
          Nothing open this week. Somebody is always one bad month from the sack - check back after a few Continues.
        </div>
      )}
      {vacancies.map(({ v, club }) => {
        const chance = jobChance(game, club.id)
        return (
          <div className="card" key={club.id} style={v.passed ? { opacity: .55 } : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crest club={club} size={30} mr={4} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 15 }}>{club.name}</h3>
                <div className="meta">
                  {game.comps[club.leagueId]?.short} · rep {club.rep} · squad {fmtMoney(squadValue(game, club.id))} · budget {fmtMoney(club.budget)}
                </div>
              </div>
              <button className="btn gold" disabled={!!v.applied}
                onClick={() => setMsg(applyJob(club.id))}>
                {v.applied ? 'Applied' : 'Apply'}
              </button>
            </div>
            {/* TURNING IT DOWN IS AN ANSWER. The badge on the rail counts jobs he
                has not answered, and before this there was no way to answer one
                except by applying for it - so the red dot sat there for a job he
                had no interest in. Reversible, because a club you would not touch
                in October can look different in March. */}
            {!v.applied && (
              <button className="btn ghost block" style={{ marginTop: 6, fontSize: 12.5 }}
                onClick={() => { passJob(club.id, !v.passed); setMsg(v.passed
                  ? `Back on the list: you would consider ${club.name} after all.`
                  : `Turned down: you have let it be known you are not a candidate for ${club.name}.`) }}>
                {v.passed ? '↩ Reconsider this one' : '✕ Not interested'}
              </button>
            )}
            <div className="meta" style={{ marginTop: 5 }}>
              Interview prospects: <b style={{ color: chance > 0.65 ? '#2f7d4f' : chance > 0.35 ? '#a8841a' : '#a12f2f' }}>
                {chance > 0.75 ? 'Excellent' : chance > 0.5 ? 'Good' : chance > 0.3 ? 'Outside shot' : 'Long shot'}
              </b>
            </div>
          </div>
        )
      })}

      {!game.unemployed && (
        <>
          <SectionTitle>Your Position</SectionTitle>
          {!confirmResign ? (
            <button className="btn ghost block" onClick={() => setConfirmResign(true)}>
              Resign from {game.clubs[game.userClubId].short}
            </button>
          ) : (
            <div className="btn-row">
              <button className="btn danger" onClick={() => { resign(); setConfirmResign(false) }}>
                Confirm - walk away
              </button>
              <button className="btn ghost" onClick={() => setConfirmResign(false)}>Stay</button>
            </div>
          )}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
