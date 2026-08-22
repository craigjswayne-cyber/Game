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

  const [showPassed, setShowPassed] = useState(false)

  const rep = mgrReputation(game)
  const vacancies = game.vacancies
    .map(v => ({ v, club: game.clubs[v.clubId] }))
    .filter(x => x.club)
    .sort((a, b) => b.club.rep - a.club.rep)
  // TURNED DOWN MEANS GONE FROM THE PILE (user: "when you reject it, remove it
  // from the pile"). It used to sink to the bottom at 55% opacity, on the grounds
  // that hiding it would make Reconsider unreachable - which was true of hiding it
  // outright, and is not a reason to leave a dead card in a list you are reading to
  // find work. So the card leaves the pile on the tap, and one quiet line at the
  // foot of the list gets it back: a club you would not touch in October can look
  // different in March, and a mistap should not cost you the job.
  const open = vacancies.filter(x => !x.v.passed)
  const turned = vacancies.filter(x => x.v.passed)

  const jobCard = ({ v, club }: typeof vacancies[number]) => {
    const chance = jobChance(game, club.id)
    return (
      <div className="card" key={club.id} style={v.passed ? { opacity: .62 } : undefined}>
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
            had no interest in. */}
        {!v.applied && (
          <button className="btn ghost block" style={{ marginTop: 6, fontSize: 12.5 }}
            onClick={() => {
              // READ IT BEFORE THE CALL. passJob writes v.passed straight onto the
              // vacancy in game state, and `v` here is that same object - so a
              // ternary after the call read the value the call had just written and
              // the confirmation was always the opposite of what you did. Turning a
              // club down answered "Back on the list: you would consider Northampton
              // Saints after all." Caught in a screenshot, not by a test, which is
              // why the probe now asserts the sentence.
              const wasPassed = !!v.passed
              passJob(club.id, !wasPassed)
              setMsg(wasPassed
                ? `Back on the list: you would consider ${club.name} after all.`
                : `Turned down: you have let it be known you are not a candidate for ${club.name}.`)
            }}>
            {v.passed ? '↩ Put it back on the list' : '✕ Not interested'}
          </button>
        )}
        <div className="meta" style={{ marginTop: 5 }}>
          Interview prospects: <b style={{ color: chance > 0.65 ? 'var(--text-positive)' : chance > 0.35 ? 'var(--gold)' : 'var(--danger)' }}>
            {chance > 0.75 ? 'Excellent' : chance > 0.5 ? 'Good' : chance > 0.3 ? 'Outside shot' : 'Long shot'}
          </b>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h3 style={{ fontSize: 16 }}>{game.unemployed ? 'Between jobs' : 'The managerial market'}</h3>
        <div className="meta">
          Your reputation: <b style={{ color: 'var(--info)' }}>{rep}/95</b> - built on {game.mgr.m} matches,
          {' '}{game.mgr.m ? Math.round((game.mgr.w / game.mgr.m) * 100) : 0}% won, {game.mgr.trophies.length} troph{game.mgr.trophies.length === 1 ? 'y' : 'ies'}.
        </div>
        {game.unemployed && (
          <div className="meta" style={{ marginTop: 4 }}>
            Press Continue to let the weeks pass - boards lose patience with strugglers, and new vacancies appear.
          </div>
        )}
        {/* The international route existed and was invisible (user: "you cant
            manage international sides?" - you can, the phone just had not
            rung). The rule is now on the page it belongs to. */}
        {!game.natTeam && (
          <div className="meta" style={{ marginTop: 4 }}>
            🌍 The unions watch this page too: managers with a reputation of <b>64</b> or
            better get national-team offers alongside the club job, the biggest nations
            holding out for the mid-80s.{rep >= 64
              ? ' You qualify - the call can come any time.'
              : ` ${64 - rep} more to reach the threshold.`}
          </div>
        )}
      </div>

      {msg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>{msg}</div>}

      <SectionTitle sub={open.length === 1 ? 'one job open' : `${open.length} jobs open`}>Vacancies</SectionTitle>
      {open.length === 0 && (
        <div className="muted" style={{ padding: '4px 16px 12px' }}>
          {turned.length
            ? 'Nothing left that you have not turned down. Somebody is always one bad month from the sack - check back after a few Continues.'
            : 'Nothing open this week. Somebody is always one bad month from the sack - check back after a few Continues.'}
        </div>
      )}
      {open.map(jobCard)}

      {turned.length > 0 && (
        <>
          <button className="btn ghost block" style={{ marginTop: 8, fontSize: 12.5 }}
            onClick={() => setShowPassed(!showPassed)}>
            {showPassed ? '▾ Hide the ones you turned down' : `▸ ${turned.length} turned down`}
          </button>
          {showPassed && turned.map(jobCard)}
        </>
      )}

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
