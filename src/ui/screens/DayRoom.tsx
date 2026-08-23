import { useStore } from '../../store'
import { fmtMoney, unbeatenRun } from '../../game/model'
import { teamShort } from '../../game/matchEngine'
import {
  dayDate, dayName, daySub, dayTheme, medicalNews, pressWaiting, storiesForDay, today,
} from '../../game/days'
import { userFixtureThisWeek } from '../../game/season'
import { leaguePos } from '../../game/schedule'
import { analystClaim, analystRead, prepLabel, unitLabel } from '../../game/analyst'
import { CrestT, SectionTitle } from '../components'
import { ord, t } from '../../game/i18n'

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💼', injury: '🏥', intl: '🌍', board: '🏛',
  award: '🏅', contract: '✍️', general: '📰', youth: '🌱', gossip: '🎙',
}

/**
 * ---- ONE DAY OF THE WEEK ----
 *
 * The page Continue lands on between matches. Each day carries the part of the
 * week that belongs to it - Monday the weekend's fallout and the treatment room,
 * Tuesday the cameras, midweek the market, Thursday the squad, Friday the
 * opposition - and ends with the button that walks on to the next one.
 *
 * Everything here is a view over state that already existed. The point is not
 * new information, it is that the week arrives at the pace a week arrives:
 * before this, a Continue tap dropped a fortnight's worth of it on one screen.
 */
export default function DayRoom() {
  const game = useStore(s => s.game)!
  const openWire = useStore(s => s.openWire)
  const continueWeek = useStore(s => s.continueWeek)
  const day = today(game)
  const stories = storiesForDay(game, day)

  return (
    <>
      <div className="day-head">
        <div className="dh-day">{dayName(day)}</div>
        <div className="dh-theme">{dayTheme(day)}</div>
        <div className="dh-date">{t('dayroom.headDate', { date: dayDate(game.season, game.week, day), week: game.week })}</div>
        <div className="dh-sub">{daySub(day)}</div>
      </div>

      {/* A draw waiting to be watched comes before anything else in the week:
          it is the one thing on the page that changes what the season looks
          like, and it goes stale the moment the manager sees the fixture
          somewhere else (F19). */}
      <DrawWaiting />

      {/* The between-jobs week keeps the day room but not the desk: the
          physio's list, the press queue and Saturday-reviewed all belong to a
          club, and an unemployed manager was still being shown his old club's
          treatment room (round 25, from a screenshot). The papers below stay -
          they are about the world. */}
      {game.unemployed ? (
        <div className="card">
          <div className="fact-label">{t('dayroom.betweenJobs')}</div>
          <div className="meta">{t('dayroom.betweenJobsBody')}</div>
        </div>
      ) : (
        <>
          {day === 0 && <MondayBlocks />}
          {day === 1 && <TuesdayBlocks />}
          {day === 2 && <WednesdayBlocks />}
          {day === 3 && <ThursdayBlocks />}
          {day === 4 && <FridayBlocks />}
        </>
      )}

      {stories.length > 0 && (
        <>
          <SectionTitle sub={t('dayroom.storiesSub', { n: stories.length })}>
            {t(day === 0 ? 'dayroom.papersMon' : day === 4 ? 'dayroom.papersFri' : 'dayroom.papersWire')}
          </SectionTitle>
          <div className="card" style={{ padding: '4px 0' }}>
            {stories.map(n => (
              <button key={n.id} className="day-story" onClick={() => openWire(stories.map(s => s.id), n.id)}>
                <span className="ds-ico">{TYPE_ICON[n.type] ?? '📰'}</span>
                <span className="ds-subj">{n.subject}</span>
                <span className="ds-go">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* the walk-on button. The masthead has one too, and they call the same
          action: this one exists because the bottom of the page is where a
          reader's thumb already is when they have finished reading it. */}
      <button className="btn gold block day-next" onClick={continueWeek}>{t('dayroom.continue')}</button>
      <div className="spacer" />
    </>
  )
}

/** The cup draw, held back until the manager has watched it (F19). */
function DrawWaiting() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const draw = game.draw
  if (!draw || !draw.ties.length) return null
  const comp = game.comps[draw.compId]
  // the stage code IS the key suffix - dayroom.stageR16, stageQF and so on -
  // and an unknown code falls back to the code rather than to a missing key
  const known = ['R16', 'QF', 'SF', 'F', 'BAR'].includes(draw.stage)
  const stageName = known ? t(`dayroom.stage${draw.stage}`) : draw.stage
  const watched = draw.revealed >= draw.ties.length
  return (
    <button className="card day-draw" onClick={() => go('draw')}>
      <div className="day-draw-top">
        {t('dayroom.drawTitle', { comp: comp?.short ?? t('dayroom.drawCup'), stage: stageName })}
      </div>
      <div className="meta">
        {watched ? t('dayroom.drawWatched') : t('dayroom.drawTies', { n: draw.ties.length })}
      </div>
    </button>
  )
}

function MondayBlocks() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  // the week just gone: processWeekAndAdvance has already moved the counter on,
  // so last week's round is week - 1
  const lastWeek = game.week - 1
  const mine = game.fixtures.find(f =>
    f.week === lastWeek && f.played && (f.homeId === game.userClubId || f.awayId === game.userClubId))
  const med = medicalNews(game)
  const leagueId = club?.leagueId
  return (
    <>
      {mine && (() => {
        const home = mine.homeId === game.userClubId
        const us = home ? mine.homeScore : mine.awayScore
        const them = home ? mine.awayScore : mine.homeScore
        const oppId = home ? mine.awayId : mine.homeId
        const verdict = t(us > them ? 'dayroom.won' : us < them ? 'dayroom.lost' : 'dayroom.drew')
        const col = us > them ? 'var(--text-positive)' : us < them ? 'var(--danger)' : undefined
        return (
          <div className="card" style={{ borderLeft: `4px solid ${us > them ? 'var(--text-positive)' : us < them ? 'var(--danger)' : 'var(--gold)'}` }}>
            <div className="fact-label">{t('dayroom.satReviewed')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <CrestT g={game} teamId={oppId} size={22} />
              <b style={{ fontSize: 15, color: col }}>{verdict} {us}-{them}</b>
              <span className="muted">
                {t(home ? 'dayroom.homeTo' : 'dayroom.awayAt', { club: teamShort(game, oppId) })}
              </span>
            </div>
            {leagueId && (
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => go('results', `${mine.compId}:${lastWeek}`)}>
                {t('dayroom.roundUp')}
              </button>
            )}
          </div>
        )
      })()}
      {!mine && leagueId && (
        <div className="card">
          <div className="fact-label">{t('dayroom.blankWeekend')}</div>
          <div className="meta">{t('dayroom.blankWeekendBody')}</div>
        </div>
      )}
      {(med.out.length > 0 || med.back.length > 0) && (
        <>
          <SectionTitle sub={t('dayroom.treatmentSub')}>{t('dayroom.treatmentRoom')}</SectionTitle>
          <div className="card">
            {med.out.map(line => (
              <div key={line} className="meta" style={{ padding: '2px 0' }}>🏥 {line}</div>
            ))}
            {med.back.map(line => (
              <div key={line} className="meta" style={{ padding: '2px 0', color: 'var(--text-positive)' }}>🟢 {line}</div>
            ))}
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('medical')}>
              {t('dayroom.medicalCentre')}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function TuesdayBlocks() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  const waiting = pressWaiting(game)
  return (
    <>
      {waiting > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="fact-label">{t('dayroom.pressWaiting')}</div>
          <div className="meta">{t('dayroom.pressWaitingBody', { n: waiting })}</div>
          <button className="btn gold block" style={{ marginTop: 8 }} onClick={() => go('press')}>
            {t('dayroom.faceCameras')}
          </button>
        </div>
      )}
      {club && (
        <div className="card">
          <div className="fact-label">{t('dayroom.boardroom')}</div>
          <div className="meta">
            {t('dayroom.confidenceIn')}<b>{Math.round(club.boardConfidence)}%</b>
            {t(club.boardConfidence > 70 ? 'dayroom.moodEnjoying'
              : club.boardConfidence > 45 ? 'dayroom.moodSatisfied'
              : club.boardConfidence > 25 ? 'dayroom.moodSoon'
              : 'dayroom.moodOut')}
          </div>
          <div className="meta" style={{ marginTop: 2 }}>
            {t('dayroom.balanceLabel')}<b>{fmtMoney(club.balance)}</b>
            {t('dayroom.budgetLabel')}<b>{fmtMoney(club.budget)}</b>
          </div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('finances')}>
            {t('dayroom.financesObjectives')}
          </button>
        </div>
      )}
    </>
  )
}

function WednesdayBlocks() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  const offers = game.offers.filter(o => o.status === 'pending' && o.forUser).length
  const open = game.week <= 7 || game.week === 26 || game.week === 27
  const expiring = club
    ? club.players.map(id => game.players[id]).filter(p => p && (p.contractEnds <= game.season || (p.wantsDeal ?? 0) > 0)).length
    : 0
  return (
    <>
      <div className="card">
        <div className="fact-label">{t('dayroom.market')}</div>
        <div className="meta">
          {t(open ? 'dayroom.windowOpen' : 'dayroom.windowShut')}
          {t('dayroom.marketBudgetPre')}<b>{fmtMoney(club?.budget ?? 0)}</b>{t('dayroom.marketBudgetEnd')}
        </div>
        {offers > 0 && (
          <div className="meta" style={{ marginTop: 3, color: 'var(--info)', fontWeight: 700 }}>
            {t('dayroom.bids', { n: offers })}
          </div>
        )}
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('transfers')}>
          {t('dayroom.transferCentre')}
        </button>
      </div>
      {expiring > 0 && (
        <div className="card">
          <div className="fact-label">{t('dayroom.paperwork')}</div>
          <div className="meta">{t('dayroom.paperworkBody', { n: expiring })}</div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('squad')}>
            {t('dayroom.contracts')}
          </button>
        </div>
      )}
    </>
  )
}

function ThursdayBlocks() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  if (!club) return null
  const squad = club.players.map(id => game.players[id]).filter(p => p && !p.acad)
  const out = squad.filter(p => p.injury || p.bans > 0 || p.natSquad || p.onLoan).length
  const flat = squad.filter(p => p.morale <= 4.5).length
  const tired = squad.filter(p => p.cond < 75).length
  return (
    <>
      <div className="card">
        <div className="fact-label">{t('dayroom.trainingGround')}</div>
        <div className="meta">
          {out
            ? t('dayroom.availableOut', { fit: squad.length - out, all: squad.length, n: out })
            : t('dayroom.available', { fit: squad.length - out, all: squad.length })}
          {tired ? t('dayroom.tired', { n: tired }) : t('dayroom.fresh')}
        </div>
        <div className="meta" style={{ marginTop: 2 }}>
          {t('dayroom.emphasis')}<b>{game.matchPrep ? prepLabel(game.matchPrep) : t('dayroom.nothingSet')}</b>
        </div>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('training')}>
          {t('dayroom.trainingStaff')}
        </button>
      </div>
      {flat > 0 && (
        <div className="card">
          <div className="fact-label">{t('dayroom.dressingRoom')}</div>
          <div className="meta">{t('dayroom.dressingBody', { n: flat })}</div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('club', club.id)}>
            {t('dayroom.dressingRoomBtn')}
          </button>
        </div>
      )}
    </>
  )
}

function FridayBlocks() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  const fx = userFixtureThisWeek(game)
  const leagueId = club?.leagueId
  const others = leagueId
    ? game.fixtures.filter(f => f.compId === leagueId && f.week === game.week && !f.played
        && f.homeId !== game.userClubId && f.awayId !== game.userClubId).slice(0, 6)
    : []
  return (
    <>
      {fx && (() => {
        const home = fx.homeId === game.userClubId
        const oppId = home ? fx.awayId : fx.homeId
        const opp = game.clubs[oppId]
        const read = analystRead(game, oppId)
        return (
          <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
            <div className="fact-label">{t('dayroom.tomorrow')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <CrestT g={game} teamId={oppId} size={26} />
              <b style={{ fontSize: 16 }}>
                {t(home ? 'dayroom.vHome' : 'dayroom.vAway', { club: opp?.name ?? teamShort(game, oppId) })}
              </b>
            </div>
            <div className="meta" style={{ marginTop: 3 }}>
              {game.comps[fx.compId]?.name ?? t('dayroom.friendly')} · {fx.venue
                ? t('dayroom.venueLine', { name: fx.venue.name, city: fx.venue.city })
                : home ? `${club?.stadium}` : `${opp?.stadium ?? t('dayroom.away')}`}
            </div>
            {/* WHO ARE THEY, RIGHT NOW (user: "it would be good to see A teams
                position in the league if its not a cup game and their last 5
                form guide so do they have momentum"). League games only - a cup
                tie's table place is noise. Momentum already reaches the pitch:
                every player carries a form rating that moves with results and
                feeds his match output, so a side on a run really is harder to
                beat - and an upset stays possible because form is one dial
                among many. */}
            {(() => {
              const lg = opp ? game.comps[opp.leagueId] : null
              if (!fx || !opp || fx.compId !== opp.leagueId || !lg) return null
              const pos = leaguePos(lg.table, oppId)
              const last5 = game.fixtures
                .filter(f => f.played && (f.homeId === oppId || f.awayId === oppId) && f.compId !== 'fr')
                .sort((a, b) => a.week - b.week).slice(-5)
                .map(f => {
                  const us = f.homeId === oppId ? f.homeScore : f.awayScore
                  const them = f.homeId === oppId ? f.awayScore : f.homeScore
                  return us > them ? 'W' : us < them ? 'L' : 'D'
                })
              if (!pos && !last5.length) return null
              return (
                <div className="meta" style={{ marginTop: 3 }}>
                  {pos ? t('dayroom.posInLeague', { pos: ord(pos), league: lg.short }) : ''}
                  {pos && last5.length ? ' · ' : ''}
                  {/* the class stays W/L/D - it is what colours the letter -
                      while the letter shown follows the language */}
                  {last5.length ? <>{t('dayroom.formLabel')} {last5.map((r, i) => (
                    <b key={i} style={{ color: r === 'W' ? 'var(--text-positive)' : r === 'L' ? 'var(--danger)' : 'var(--gold)', marginLeft: i ? 3 : 4 }}>
                      {t(r === 'W' ? 'common.w' : r === 'L' ? 'common.l' : 'common.d')}
                    </b>
                  ))}</> : ''}
                </div>
              )
            })()}
            {/* the eve of a final gets its own line: the one night of the
                season when the fixture card is not just a fixture card */}
            {fx.stage === 'F' && fx.compId !== 'fr' && (
              <div className="meta" style={{ marginTop: 3 }}>
                🏆 <b>{t('dayroom.theFinalB')}</b>
                {fx.venue ? t('dayroom.finalVenue', { n: fx.venue.capacity, venue: fx.venue.name }) : ''}
                {t('dayroom.finalRest')}
              </div>
            )}
            {/* the weight of the run, named on the eve (16C): once you are 8+
                unbeaten every opponent plays their cup final against you */}
            {(() => {
              const run = unbeatenRun(game, game.userClubId)
              if (run < 8 || fx.compId === 'fr') return null
              return (
                <div className="meta" style={{ marginTop: 3 }}>
                  🛡️ <b>{t('dayroom.unbeatenB', { n: run })}</b>{t('dayroom.unbeatenRest')}
                </div>
              )
            })()}
            {read && (
              <div className="meta" style={{ marginTop: 6 }}>
                <b style={{ color: 'var(--gold)' }}>{unitLabel(read.unit)}.</b> {analystClaim(read)}
              </div>
            )}
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('tactics')}>
              {t('dayroom.teamSheet')}
            </button>
          </div>
        )
      })()}
      {others.length > 0 && (
        <>
          <SectionTitle sub={t('dayroom.elsewhereSub')}>{t('dayroom.elsewhere')}</SectionTitle>
          <div className="card" style={{ padding: '4px 0' }}>
            {others.map(f => (
              <div key={f.id} className="day-fx">
                <span className="dfx-side">{teamShort(game, f.homeId)}</span>
                <CrestT g={game} teamId={f.homeId} size={15} />
                <span className="dfx-v">{t('common.v')}</span>
                <CrestT g={game} teamId={f.awayId} size={15} />
                <span className="dfx-side right">{teamShort(game, f.awayId)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
