import { useStore } from '../../store'
import { fmtMoney } from '../../game/model'
import { teamShort } from '../../game/matchEngine'
import {
  DAY_NAMES, DAY_SUB, DAY_THEME, dayDate, medicalNews, pressWaiting, storiesForDay, today,
} from '../../game/days'
import { userFixtureThisWeek } from '../../game/season'
import { analystRead, PREP_LABEL, UNIT_LABEL } from '../../game/analyst'
import { CrestT, SectionTitle } from '../components'

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
        <div className="dh-day">{DAY_NAMES[day]}</div>
        <div className="dh-theme">{DAY_THEME[day]}</div>
        <div className="dh-date">{dayDate(game.season, game.week, day)} · Week {game.week}</div>
        <div className="dh-sub">{DAY_SUB[day]}</div>
      </div>

      {/* A draw waiting to be watched comes before anything else in the week:
          it is the one thing on the page that changes what the season looks
          like, and it goes stale the moment the manager sees the fixture
          somewhere else (F19). */}
      <DrawWaiting />

      {day === 0 && <MondayBlocks />}
      {day === 1 && <TuesdayBlocks />}
      {day === 2 && <WednesdayBlocks />}
      {day === 3 && <ThursdayBlocks />}
      {day === 4 && <FridayBlocks />}

      {stories.length > 0 && (
        <>
          <SectionTitle sub={`${stories.length} ${stories.length === 1 ? 'story' : 'stories'} · tap to read`}>
            {day === 0 ? 'The Morning Papers' : day === 4 ? "Friday's Paper" : 'On The Wire'}
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
      <button className="btn gold block day-next" onClick={continueWeek}>Continue ▸</button>
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
  const stage = { R16: 'last sixteen', QF: 'quarter-final', SF: 'semi-final', F: 'final', BAR: 'barrage' }[draw.stage] ?? draw.stage
  const watched = draw.revealed >= draw.ties.length
  return (
    <button className="card day-draw" onClick={() => go('draw')}>
      <div className="day-draw-top">🎟 The {comp?.short ?? 'cup'} {stage} draw</div>
      <div className="meta">
        {watched
          ? 'You have seen the balls come out. Tap to look again.'
          : `${draw.ties.length} ties in the hat, and one of them is yours. Tap to watch the draw.`}
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
        const verdict = us > them ? 'Won' : us < them ? 'Lost' : 'Drew'
        const col = us > them ? 'var(--win)' : us < them ? 'var(--red)' : undefined
        return (
          <div className="card" style={{ borderLeft: `4px solid ${us > them ? 'var(--win)' : us < them ? 'var(--red)' : 'var(--gold)'}` }}>
            <div className="fact-label">Saturday, reviewed</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <CrestT g={game} teamId={oppId} size={22} />
              <b style={{ fontSize: 15, color: col }}>{verdict} {us}-{them}</b>
              <span className="muted">{home ? 'at home to' : 'away at'} {teamShort(game, oppId)}</span>
            </div>
            {leagueId && (
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => go('results', `${mine.compId}:${lastWeek}`)}>
                The full round-up and the table ▸
              </button>
            )}
          </div>
        )
      })()}
      {!mine && leagueId && (
        <div className="card">
          <div className="fact-label">A blank weekend</div>
          <div className="meta">No match for you, so the week starts with the training ground rather than the video room.</div>
        </div>
      )}
      {(med.out.length > 0 || med.back.length > 0) && (
        <>
          <SectionTitle sub="the physio's list, first thing Monday">Treatment Room</SectionTitle>
          <div className="card">
            {med.out.map(line => (
              <div key={line} className="meta" style={{ padding: '2px 0' }}>🏥 {line}</div>
            ))}
            {med.back.map(line => (
              <div key={line} className="meta" style={{ padding: '2px 0', color: 'var(--win)' }}>🟢 {line}</div>
            ))}
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('medical')}>
              Medical Centre ▸
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
          <div className="fact-label">🎙 The press are waiting</div>
          <div className="meta">
            {waiting === 1 ? 'One question' : `${waiting} questions`} you have not answered. Say nothing and
            they will write it for you.
          </div>
          <button className="btn gold block" style={{ marginTop: 8 }} onClick={() => go('press')}>
            Face the cameras ▸
          </button>
        </div>
      )}
      {club && (
        <div className="card">
          <div className="fact-label">🏛 The boardroom</div>
          <div className="meta">
            Confidence in you: <b>{Math.round(club.boardConfidence)}%</b>
            {club.boardConfidence > 70 ? ' - they are enjoying this.'
              : club.boardConfidence > 45 ? ' - broadly satisfied, watching closely.'
              : club.boardConfidence > 25 ? ' - they want results and soon.'
              : ' - patience has run out.'}
          </div>
          <div className="meta" style={{ marginTop: 2 }}>
            Balance <b>{fmtMoney(club.balance)}</b> · transfer budget <b>{fmtMoney(club.budget)}</b>
          </div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('finances')}>
            Finances and objectives ▸
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
        <div className="fact-label">💼 The market</div>
        <div className="meta">
          {open ? 'The window is open.' : 'The window is shut, so nothing moves until it reopens.'}
          {' '}Transfer budget <b>{fmtMoney(club?.budget ?? 0)}</b>.
        </div>
        {offers > 0 && (
          <div className="meta" style={{ marginTop: 3, color: 'var(--accent-ink)', fontWeight: 700 }}>
            {offers === 1 ? 'One bid' : `${offers} bids`} on your players need answering.
          </div>
        )}
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('transfers')}>
          Transfer Centre ▸
        </button>
      </div>
      {expiring > 0 && (
        <div className="card">
          <div className="fact-label">✍️ Paperwork</div>
          <div className="meta">
            {expiring === 1 ? 'One man' : `${expiring} men`} with a deal running down or an agent asking for
            improved terms. Leave it long enough and somebody else has the conversation for you.
          </div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('squad')}>
            Contracts ▸
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
        <div className="fact-label">🏉 The training ground</div>
        <div className="meta">
          {squad.length - out} of {squad.length} available{out ? `, ${out} unavailable` : ''}.
          {tired ? ` ${tired} still carrying the weekend in their legs.` : ' Legs are fresh.'}
        </div>
        <div className="meta" style={{ marginTop: 2 }}>
          This week's emphasis: <b>{game.matchPrep ? PREP_LABEL[game.matchPrep] ?? game.matchPrep : 'nothing set'}</b>
        </div>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('training')}>
          Training and staff ▸
        </button>
      </div>
      {flat > 0 && (
        <div className="card">
          <div className="fact-label">😐 The dressing room</div>
          <div className="meta">
            {flat === 1 ? 'One man is' : `${flat} men are`} flat. A word now is cheaper than a word in February.
          </div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('club', club.id)}>
            Dressing room ▸
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
            <div className="fact-label">Tomorrow</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <CrestT g={game} teamId={oppId} size={26} />
              <b style={{ fontSize: 16 }}>{home ? 'v' : 'at'} {opp?.name ?? teamShort(game, oppId)}</b>
            </div>
            <div className="meta" style={{ marginTop: 3 }}>
              {game.comps[fx.compId]?.name ?? 'Friendly'} · {home ? `${club?.stadium}` : `${opp?.stadium ?? 'away'}`}
            </div>
            {read && (
              <div className="meta" style={{ marginTop: 6 }}>
                <b style={{ color: '#a8841a' }}>{UNIT_LABEL[read.unit]}.</b> {read.claim}
              </div>
            )}
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => go('tactics')}>
              Team sheet and game plan ▸
            </button>
          </div>
        )
      })()}
      {others.length > 0 && (
        <>
          <SectionTitle sub="the rest of the round">Elsewhere This Weekend</SectionTitle>
          <div className="card" style={{ padding: '4px 0' }}>
            {others.map(f => (
              <div key={f.id} className="day-fx">
                <span className="dfx-side">{teamShort(game, f.homeId)}</span>
                <CrestT g={game} teamId={f.homeId} size={15} />
                <span className="dfx-v">v</span>
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
