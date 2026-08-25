import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, mgrReputation } from '../../game/model'
import { jobChance } from '../../game/jobs'
import { squadValue } from '../../game/analysis'
import { Crest, SectionTitle } from '../components'
import { t } from '../../game/i18n'

/** The reply slot for a tap whose card is no longer in the pile. Falling back
 *  above the list is right (the card it belongs on is gone) but the thumb that
 *  tapped Apply on the fifth vacancy is 900px below it - which is how "You're
 *  in. Welcome to Gloucester RFC." rendered off-screen: a HIRE removes the
 *  vacancy from the pile, so the one sentence of the career you most want to
 *  read fell into this slot and out of sight (replyreach.mjs caught it on the
 *  seeds where the last application succeeds). The answer follows the reader:
 *  when it cannot land beside the button, it brings the screen to itself. */
function FallbackReply({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'center' }) }, [text])
  return (
    <div ref={ref} className="meta sheet-log" style={{ margin: '0 16px 8px', borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>
      {text}
    </div>
  )
}

export default function Jobs() {
  const game = useStore(s => s.game)!
  const applyJob = useStore(s => s.applyJob)
  const passJob = useStore(s => s.passJob)
  const resign = useStore(s => s.resign)
  // KEYED TO THE ROW THAT ASKED. This used to be a bare string rendered in one
  // card above the vacancy list, so applying for the fifth job printed the
  // club's answer several hundred pixels above the thumb that tapped Apply -
  // the off-screen reply bug hireprobe.mjs was built for, in a second place.
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null)
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
              {t('world.jbClubMeta', { league: game.comps[club.leagueId]?.short ?? '', rep: club.rep, squad: fmtMoney(squadValue(game, club.id)), budget: fmtMoney(club.budget) })}
            </div>
          </div>
          <button className="btn gold" disabled={!!v.applied}
            onClick={() => setMsg({ key: club.id, text: applyJob(club.id) })}>
            {t(v.applied ? 'world.jbApplied' : 'world.jbApply')}
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
              setMsg({
                key: club.id,
                text: t(wasPassed ? 'world.jbBackOnList' : 'world.jbTurnedDown', { club: club.name }),
              })
            }}>
            {t(v.passed ? 'world.jbPutBack' : 'world.jbNotInterested')}
          </button>
        )}
        {msg?.key === club.id && (
          <div className="meta sheet-log" style={{ marginTop: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>
            {msg.text}
          </div>
        )}
        <div className="meta" style={{ marginTop: 5 }}>
          {t('world.jbProspects')}<b style={{ color: chance > 0.65 ? 'var(--text-positive)' : chance > 0.35 ? 'var(--gold)' : 'var(--danger)' }}>
            {t(chance > 0.75 ? 'world.jbExcellent' : chance > 0.5 ? 'world.jbGood' : chance > 0.3 ? 'world.jbOutsideShot' : 'world.jbLongShot')}
          </b>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h3 style={{ fontSize: 16 }}>{t(game.unemployed ? 'world.jbBetweenJobs' : 'world.jbMarket')}</h3>
        <div className="meta">
          {t('world.jbYourRep')}<b style={{ color: 'var(--info)' }}>{rep}/95</b>
          {t(game.mgr.trophies.length === 1 ? 'world.jbRepBuiltOne' : 'world.jbRepBuilt', {
            m: game.mgr.m,
            matches_k: game.mgr.m === 1 ? 'count.matchOne' : 'count.matchMany',
            pct: game.mgr.m ? Math.round((game.mgr.w / game.mgr.m) * 100) : 0,
            n: game.mgr.trophies.length,
          })}
        </div>
        {game.unemployed && (
          <div className="meta" style={{ marginTop: 4 }}>
            {t('world.jbPressContinue')}
          </div>
        )}
        {/* The international route existed and was invisible (user: "you cant
            manage international sides?" - you can, the phone just had not
            rung). The rule is now on the page it belongs to. */}
        {!game.natTeam && (
          <div className="meta" style={{ marginTop: 4 }}>
            {t('world.jbUnions', {
              at: 64,
              rest: rep >= 64 ? t('world.jbQualify') : t('world.jbMoreToGo', { n: 64 - rep }),
            })}
          </div>
        )}
      </div>

      <SectionTitle sub={open.length === 1 ? t('world.jbOneJob') : t('world.jbNJobs', { n: open.length })}>{t('world.jbVacancies')}</SectionTitle>
      {/* THE REPLY LANDS ON THE ROW THAT ASKED (scripts/replyreach.mjs holds
          that rule across the game), so the confirmation renders inside the
          club's own card - EXCEPT when the tap is the one that removes the
          card from the list. Turning down your only vacancy sends it behind
          the turned-down line and used to take the sentence with it, so you
          tapped and the screen said nothing. When the club it refers to is no
          longer in the pile, and only then, it falls back to the list. */}
      {msg && !open.some(o => o.v.clubId === msg.key) && <FallbackReply text={msg.text} />}
      {open.length === 0 && (
        <div className="muted" style={{ padding: '4px 16px 12px' }}>
          {t(turned.length ? 'world.jbNothingLeft' : 'world.jbNothingOpen')}
        </div>
      )}
      {open.map(jobCard)}

      {turned.length > 0 && (
        <>
          <button className="btn ghost block" style={{ marginTop: 8, fontSize: 12.5 }}
            onClick={() => setShowPassed(!showPassed)}>
            {showPassed ? t('world.jbHideTurned') : t('world.jbShowTurned', { n: turned.length })}
          </button>
          {showPassed && turned.map(jobCard)}
        </>
      )}

      {!game.unemployed && (
        <>
          <SectionTitle>{t('world.jbYourPosition')}</SectionTitle>
          {!confirmResign ? (
            <button className="btn ghost block" onClick={() => setConfirmResign(true)}>
              {t('world.jbResignFrom', { club: game.clubs[game.userClubId].short })}
            </button>
          ) : (
            <div className="btn-row">
              <button className="btn danger" onClick={() => { resign(); setConfirmResign(false) }}>
                {t('world.jbConfirmWalk')}
              </button>
              <button className="btn ghost" onClick={() => setConfirmResign(false)}>{t('world.jbStay')}</button>
            </div>
          )}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
