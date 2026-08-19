import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SIX_NATIONS_WEEKS } from '../../game/schedule'
import { nationByCode, flagOf } from '../../game/nations'
import { leaguePos, sortTable } from '../../game/schedule'
import { arrangeFriendly, userFixtureThisWeek } from '../../game/season'
import { teamShort } from '../../game/matchEngine'
import { derbyName, rivalsOf } from '../../game/rivalries'
import { CrestT, SectionTitle } from '../components'
import { InboxList } from './Inbox'
import { inInbox } from '../../game/days'
import { fmtMoney, formGuide, grudgeBetween, weekDate } from '../../game/model'
import { OBJECTIVE_DEFS } from '../../game/objectives'
import { ordinal } from '../../game/gossip'
import { natRankOrder } from '../../game/natrank'

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💰', injury: '🩹', intl: '🌍', board: '🏛️',
  award: '🏅', contract: '✍️', general: '📰', youth: '🎓', gossip: '🗞️',
}

export default function Home() {
  const game = useStore(s => s.game)!
  // The same predicate the reader uses, for the same reason the rail's badge was
  // fixed in 14B: a cue that counts a different set from the screen it opens sends
  // you to a blank page. This one excluded gossip and ignored the five-day window,
  // so it did both at once.
  //
  // Oldest first, because that is the one a tap opens: store.openInbox serves the
  // queue front to back, so sorting newest-first here would put a different
  // headline under the count from the story the cue leads to.
  const unreadItems = game.news.filter(n => inInbox(game, n) && !n.read).sort((a, b) => a.id - b.id)
  const unread = unreadItems.length
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  // ---- Home no longer eats a story on the way past ----
  //
  // There used to be an `openId` state here whose initialiser marked the oldest
  // unread story as READ, left over from when Home was the inbox. Nothing rendered
  // it any more, so every arrival at Home silently consumed one unread message and
  // showed it nowhere: on a fresh career that was the letter appointing you, and
  // the manager's first sight of his own inbox began at story two (user: "it has
  // already shared a scout report so you wouldnt see it"). Reading is the inbox's
  // job and the inbox does it on a tap.
  // the welcome dialog moved out to App: it is an overlay over the whole game,
  // not a piece of the Home screen, and it needed to be re-openable (blocker A2)

  // There was a "keep this career safe" cue here with a one-tap Install button.
  // The install did not work on the phones this game is played on, so the whole
  // card is gone (user: "the install to your device doesnt work, remove this from
  // the game"). Save durability still has its route: Game Status exports the
  // career to a file, and the handbook's save entry says why that matters on
  // Safari.

  const club = game.clubs[game.userClubId]
  const fx = userFixtureThisWeek(game) ?? game.fixtures
    .filter(f => !f.played && f.week >= game.week && (f.homeId === club.id || f.awayId === club.id))
    .sort((a, b) => a.week - b.week)[0]
  const comp = fx ? game.comps[fx.compId] : null
  const isThisWeek = fx && fx.week === game.week
  const pressOpen = game.press.filter(p => !p.answered).length

  // hub widgets: form pips, league position, money. The pips sort by week
  // inside formGuide - see its comment for the W W W W W screenshot this
  // array-order slice put on the Home screen.
  const recent = formGuide(game, club.id)
  const leagueOrder = sortTable(game.comps[club.leagueId]?.table ?? [])
  // 0 until a league game is played, so the widget's dash actually shows
  const pos = leaguePos(game.comps[club.leagueId]?.table, club.id)
  const finState = club.balance >= 3_000_000 ? ['Rich', '#2f7d4f']
    : club.balance >= 500_000 ? ['Secure', '#6f8f4f']
    : club.balance >= 0 ? ['Okay', '#8a7a3a'] : ['In the red', '#9b2c2c']

  if (game.unemployed) {
    return (
      <>
        <button className="card" style={{ borderLeft: '4px solid var(--stripe)' }}
          onClick={() => go('jobs')}>
          <h3>📋 The Job Centre</h3>
          <div className="meta">You're between jobs. {game.vacancies.length} vacanc{game.vacancies.length === 1 ? 'y' : 'ies'} open - apply, or press Continue and wait for the right one.</div>
        </button>
        {/* With no club there is no summary to separate the inbox from, so it
            stays inline here. */}
        <SectionTitle sub="the rugby world keeps turning">Inbox</SectionTitle>
        <InboxList compact />
        <div className="spacer" />
      </>
    )
  }

  return (
    <>
      {/* THE FIRST THREE WEEKS TELL YOU WHAT THE GAME IS.
          Found in the studio audit: nothing teaches the core loop. The tutorial
          is one dismissible panel, and a new manager lands on a dashboard of
          board confidence, fan mood, objectives, money and mail with no way to
          know which of it is a job and which is a readout. One line, for three
          weeks of a first season, then it is gone for good. */}
      {game.season === 0 && game.mgr.m === 0 && (
        <div className="first-hint">
          <b>Continue is the game.</b> It moves the week on and brings the next
          thing to you. Everything else on this screen can wait until you want it.
        </div>
      )}
      <div className="card-grid">
      {game.comps['sn'] && game.week >= SIX_NATIONS_WEEKS[0] - 1 && game.week <= SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1] && (() => {
        const rows = sortTable(game.comps['sn'].table).slice(0, 3)
        const thisWk = game.fixtures.filter(f => f.compId === 'sn' && f.week === game.week)
        return (
          <div className="card" onClick={() => go('nations')}
            style={{ background: 'linear-gradient(135deg, var(--brand-900), var(--brand-950))', color: '#eef3fb', cursor: 'pointer' }}>
            <div className="fact-label" style={{ color: 'var(--gold-bright)' }}>🏆 SIX NATIONS - THE GREATEST CHAMPIONSHIP</div>
            {thisWk.map(f => (
              <div key={f.id} style={{ fontSize: 13, marginTop: 3 }}>
                {flagOf(f.homeId)} {nationByCode(f.homeId)?.name} {f.played ? <b>{f.homeScore}–{f.awayScore}</b> : 'v'} {nationByCode(f.awayId)?.name} {flagOf(f.awayId)}
              </div>
            ))}
            {rows.length > 0 && rows[0].p > 0 && (
              <div className="meta" style={{ color: '#adc4e8', marginTop: 5 }}>
                Table: {rows.map((r, i) => `${i + 1}. ${nationByCode(r.teamId)?.name} (${r.pts})`).join(' · ')}
              </div>
            )}
            <div className="meta" style={{ color: 'var(--gold-bright)', marginTop: 3 }}>Tap for the full championship ▸</div>
          </div>
        )
      })()}
      {(() => {
        // the hook: why THIS week matters - the reason to press Continue
        const grudge = fx ? grudgeBetween(game, fx.homeId, fx.awayId) : null
        const derby = fx ? derbyName(fx.homeId, fx.awayId) : null
        const hook = derby ? `⚔️ ${derby.toUpperCase()} WEEK`
          : grudge ? `🔥 GRUDGE MATCH: ${grudge.reason}`
          : fx?.stage ? `🏆 KNOCKOUT RUGBY: ${stageName(fx.stage)} this week`
          : game.week === 7 || game.week === 27 ? '🚨 DEADLINE WEEK: the window slams shut'
          : null
        // streak framing: the cheapest dopamine in sport
        const res = game.fixtures.filter(f => f.played && (f.homeId === club.id || f.awayId === club.id) && f.compId !== 'fr')
          .sort((a, b) => b.week - a.week)
        let unbeaten = 0, winless = 0
        for (const f of res) {
          const us = f.homeId === club.id ? f.homeScore : f.awayScore
          const them = f.homeId === club.id ? f.awayScore : f.homeScore
          if (us >= them && winless === 0) unbeaten++
          else if (us <= them && unbeaten === 0) winless++
          else break
        }
        const streak = unbeaten >= 3 ? `🔥 Unbeaten in ${unbeaten}` : winless >= 3 ? `❄️ ${winless} without a win` : null
        if (!hook && !streak) return null
        return (
          <div className="card" style={{ borderLeft: `4px solid ${winless >= 3 ? '#9b2c2c' : 'var(--gold-bright)'}`, display: 'flex', gap: 10, alignItems: 'center' }}>
            {hook && <b style={{ fontSize: 13 }}>{hook}</b>}
            {streak && <span className="chip" style={{ marginLeft: 'auto', fontWeight: 700 }}>{streak}</span>}
          </div>
        )
      })()}
      {fx && (
        <div className="card" onClick={() => go('tactics')} style={{
          borderLeft: `4px solid ${game.clubs[fx.homeId === club.id ? fx.awayId : fx.homeId]?.colors[0] ?? '#c9a227'}`,
        }}>
          <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10.5 }}>
            Next match · {comp?.name ?? (fx.compId === 'fr' ? 'Club Friendly' : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''}
          </div>
          {/* a class, not an inline font-size: inline wins over any media query,
              so portrait could not shrink this and "Northampton v La Rochelle"
              lost 20px off the end of the opponent's name at 412px */}
          <h3 className="fx-line">
            <CrestT g={game} teamId={fx.homeId} size={20} />{teamShort(game, fx.homeId)} v <CrestT g={game} teamId={fx.awayId} size={20} />{teamShort(game, fx.awayId)}
          </h3>
          <div className="meta">
            {fx.venue?.name ?? game.clubs[fx.homeId]?.stadium ?? 'Neutral venue'} · {weekDate(game.season, fx.week)}
            {fx.venue ? ' · Neutral ground' : fx.homeId === club.id ? ' · Home' : ' · Away'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {isThisWeek
              ? 'Tap to set your team, then press Continue to play.'
              : 'No match this week - Continue advances to the next round.'}
          </div>
        </div>
      )}
      {/* THE COUNTRY DESK (user: "the game doesnt feel like it currently
          nails the international element. its meant to be the pinnacle but is
          hidden away"). A Test job lives on Home beside the club: the next
          Test, the world ranking, the union's confidence - and on a Test week
          the card says plainly that this Saturday is your country's, with the
          assistant minding any club fixture. */}
      {game.natTeam && (() => {
        const nat = nationByCode(game.natTeam)
        const next = game.fixtures
          .filter(f => !f.played && (f.homeId === game.natTeam || f.awayId === game.natTeam))
          .sort((a, b) => a.week - b.week)[0]
        const rank = natRankOrder(game).indexOf(game.natTeam) + 1
        const testWeek = next && next.week === game.week
        return (
          <div className="card" onClick={() => go('country')} style={{ borderLeft: '4px solid #2f7d4f' }}>
            <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10.5 }}>
              Head coach · {nat?.name ?? game.natTeam}{rank > 0 ? ` · world No. ${rank}` : ''}{game.natConfidence != null ? ` · union ${Math.round(game.natConfidence)}%` : ''}
            </div>
            {next ? (
              <>
                <h3 className="fx-line">
                  {flagOf(next.homeId)} {nationByCode(next.homeId)?.name ?? next.homeId} v {flagOf(next.awayId)} {nationByCode(next.awayId)?.name ?? next.awayId}
                </h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  {testWeek
                    ? `🌍 TEST WEEK: this Saturday is your country's. Your assistant minds any club fixture.`
                    : `Next Test ${weekDate(game.season, next.week)}.`}
                </div>
              </>
            ) : (
              <div className="muted">No Test on the calendar - the union watches your club work in the meantime.</div>
            )}
          </div>
        )
      })()}
      {/* the objectives, the annual and the press call used to sit in a second
          grid below the dashboard, where they got a whole row to themselves.
          In the same grid as the next match they share its row instead. */}
      {(() => {
        const objs = (game.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
        if (!objs.length) return null
        return (
          <button className="card" onClick={() => go('finances')}>
            {/* A TICK MEANS DONE, AND DONE HAS TO MEAN DONE.
                Reported from a new Bedford save: "one of the season objectives
                had been completed without a game being played." It had. The brief
                was to finish the season in the black, the club opens with £240k in
                the bank, so met() was true in week 1 and the screen said so.
                An objective that is banked once achieved (six starts given, a
                derby won) is ticked the moment it happens, because it cannot be
                lost. One that is merely TRUE TODAY reads as on course until the
                season is actually over - see ObjectiveDef.banked. */}
            <div className="fact-label">🎯 Season Objectives · {objs.filter(o => o!.met(game)).length}/{objs.length} on track</div>
            <div className="meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
              {objs.map(o => {
                const met = o!.met(game)
                const done = met && o!.banked
                return (
                  <span key={o!.id} style={{ color: done ? '#2f7d4f' : met ? 'var(--accent-ink)' : 'var(--ink-soft)' }}>
                    {done ? '✓' : met ? '◍' : '○'} {o!.text(game)}
                    {met && !o!.banked ? ' (on course)' : ''}
                  </span>
                )
              })}
            </div>
          </button>
        )
      })()}
      {game.review && game.review.season === game.season - 1 && game.week <= 6 && (
        <button className="card" style={{ borderLeft: '4px solid var(--stripe)' }}
          onClick={() => go('seasonreview')}>
          <h3>📖 The Annual is out</h3>
          <div className="meta">Last season on one page - the league, the cups, the stars and the money. Tap to read.</div>
        </button>
      )}
      {pressOpen > 0 && (
        <button className="card" style={{ borderLeft: '4px solid var(--stripe)' }}
          onClick={() => go('press')}>
          <h3>🗞️ The press want a word</h3>
          <div className="meta">{pressOpen} question{pressOpen > 1 ? 's' : ''} awaiting your reply - your answers move morale.</div>
        </button>
      )}
      {!fx && !game.unemployed && (() => {
        const idle = Object.values(game.clubs)
          .filter(c => c.id !== club.id &&
            !game.fixtures.some(f => f.week === game.week && !f.played && (f.homeId === c.id || f.awayId === c.id)))
          .sort((a, b) => Math.abs(a.rep - club.rep) - Math.abs(b.rep - club.rep))
          .slice(0, 3)
        if (!idle.length) return null
        return (
          <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
            <div className="fact-label">Blank Weekend</div>
            <div className="meta" style={{ marginBottom: 6 }}>
              No fixture this week. A friendly banks sharpness and combinations for the squad - but injuries in a meaningless game sting twice as much.
            </div>
            <div className="chips" style={{ padding: 0 }}>
              {idle.map(c => (
                <button key={c.id} className="chip" onClick={() => { arrangeFriendly(game, c.id); touch() }}>
                  🤝 {c.short} (rep {c.rep})
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      </div>
      <div className="hub-row">
        <button className="hub-widget" onClick={() => go('tables')}>
          <label>League</label>
          <b>{pos > 0 ? `${pos}${pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th'}` : '-'}</b>
          <span>{game.comps[club.leagueId]?.short}</span>
        </button>
        <button className="hub-widget" onClick={() => go('fixtures')}>
          <label>Form</label>
          <b style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
            {recent.length === 0 ? <span style={{ fontSize: 12, fontWeight: 400 }}>no games</span> : recent.map((r, i) => (
              <span key={i} className={`form-pip ${r}`}>{r}</span>
            ))}
          </b>
          <span>{recent.length ? `last ${recent.length} match${recent.length > 1 ? 'es' : ''}` : 'season ahead'}</span>
        </button>
        <button className="hub-widget" onClick={() => go('report')}>
          <label>Board</label>
          <b style={{ color: club.boardConfidence > 55 ? '#2f7d4f' : club.boardConfidence > 25 ? '#8a7a3a' : '#9b2c2c' }}>
            {Math.round(club.boardConfidence)}%
          </b>
          <span>confidence</span>
        </button>
        <button className="hub-widget" onClick={() => go('club', club.id)}>
          <label>Fans</label>
          {(() => {
            const m = game.fanMood ?? 60
            const word = m >= 80 ? '🔥' : m >= 62 ? '😊' : m >= 45 ? '😐' : m >= 30 ? '😠' : '🤬'
            return <b>{word}</b>
          })()}
          <span>{(() => {
            const m = game.fanMood ?? 60
            return m >= 80 ? 'bouncing' : m >= 62 ? 'behind you' : m >= 45 ? 'watching' : m >= 30 ? 'restless' : 'mutinous'
          })()}</span>
        </button>
      </div>
      {(() => {
        // FM-style one-page dashboard: everything glanceable, everything tappable
        const mine = (f: { homeId: string; awayId: string }) => f.homeId === club.id || f.awayId === club.id
        // Chronological, top to bottom. This read wk2, wk1, wk3, wk4, wk6 - the
        // results descending and the fixtures ascending, because the sort that
        // picks the LAST two results was also the sort that rendered them. One
        // reverse after the slice and the panel reads like a fixture list.
        const played = game.fixtures.filter(f => f.played && mine(f))
          .sort((a, b) => b.week - a.week).slice(0, 2).reverse()
        const coming = game.fixtures.filter(f => !f.played && mine(f)).sort((a, b) => a.week - b.week).slice(0, 3)
        const out = club.players.map(id => game.players[id]).filter(p => p?.injury)
        const wageRoom = club.wageBudget - club.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)
        const resStr = (f: typeof played[0]) => {
          const us = f.homeId === club.id ? f.homeScore : f.awayScore
          const them = f.homeId === club.id ? f.awayScore : f.homeScore
          return { txt: `${us}-${them}`, c: us > them ? '#2f7d4f' : us < them ? '#9b2c2c' : undefined }
        }
        return (
          <div className="dash-row">
            <button className="dash-panel" onClick={() => go('fixtures')}>
              <div className="dash-head">Fixtures & Results</div>
              {played.map(f => {
                const r = resStr(f)
                return (
                  <div key={f.id} className="dash-line">
                    <span className="muted dl-wk">wk{f.week}</span>
                    <span className="dl-t">{teamShort(game, f.homeId === club.id ? f.awayId : f.homeId)}</span>
                    <span>{f.homeId === club.id ? 'H' : 'A'}</span>
                    <b style={{ color: r.c }}>{r.txt}</b>
                  </div>
                )
              })}
              {/* The comp tag is the compId, not comp.short: "Champions Cup"
                  muted at the end of a half-width row cost 72px and the club
                  name beside it arrived as "Highlande..." (device matrix,
                  round 23). PREM/CC/TOP14 says which shirt the week is about
                  in the space a glance panel actually has. */}
              {coming.map(f => (
                <div key={f.id} className="dash-line">
                  <span className="muted dl-wk">wk{f.week}</span>
                  <span className="dl-t">{teamShort(game, f.homeId === club.id ? f.awayId : f.homeId)}</span>
                  <span>{f.homeId === club.id ? 'H' : 'A'}</span>
                  <span className="muted">{game.comps[f.compId] ? f.compId.toUpperCase() : 'FR'}</span>
                </div>
              ))}
            </button>
            <button className="dash-panel" onClick={() => go('finances')}>
              <div className="dash-head">Finances</div>
              <div className="dash-line"><span>State</span><b style={{ color: finState[1] }}>{finState[0]}</b></div>
              <div className="dash-line"><span>Balance</span><b>{fmtMoney(club.balance)}</b></div>
              <div className="dash-line"><span>Transfer budget</span><b>{fmtMoney(club.budget)}</b></div>
              <div className="dash-line"><span>Wage room</span><b>{fmtMoney(Math.max(0, wageRoom))}/wk</b></div>
            </button>
            <button className="dash-panel" onClick={() => go('medical')}>
              <div className="dash-head">Medical Centre</div>
              {out.length === 0 && <div className="dash-line"><span className="muted">A clean bill of health</span></div>}
              {out.slice(0, 4).map(p => (
                <div key={p!.id} className="dash-line">
                  <span className="dl-t" style={{ color: '#9b2c2c' }}>{p!.name.split(' ').slice(-1)[0]}</span>
                  <span className="muted">{Math.max(1, p!.injury!.until - game.week)}w</span>
                </div>
              ))}
              {out.length > 4 && <div className="dash-line"><span className="muted">+{out.length - 4} more</span></div>}
            </button>
            {(() => {
              // rival watch: their misery is your dopamine, all season long.
              // Its own panel - it used to squat inside the Medical Centre,
              // which read as the physio listing another club's players
              const rival = rivalsOf(club.id).find(id => game.clubs[id])
              if (!rival) return null
              const rf = game.fixtures.filter(f => f.played && f.compId !== 'fr' && (f.homeId === rival || f.awayId === rival))
                .sort((a, b) => b.week - a.week)[0]
              const rComp = game.comps[game.clubs[rival].leagueId]
              const rPos = leaguePos(rComp?.table, rival)
              const rr = rf ? (() => {
                const us = rf.homeId === rival ? rf.homeScore : rf.awayScore
                const them = rf.homeId === rival ? rf.awayScore : rf.homeScore
                // W/L/D, not won/LOST/drew: the words plus the eyes emoji cost
                // this half-width row 40px and the rival's name paid for it
                return { txt: `${us > them ? 'W' : us < them ? 'L' : 'D'} ${us}-${them}`, c: us < them ? '#2f7d4f' : us > them ? '#9b2c2c' : undefined }
              })() : null
              return (
                <button className="dash-panel" onClick={() => go('club', rival)}>
                  <div className="dash-head">Rival Watch</div>
                  <div className="dash-line">
                    <span className="dl-t">{teamShort(game, rival)}</span>
                    {rr && <b style={{ color: rr.c }}>{rr.txt}</b>}
                    {rPos > 0 && <span className="muted">{ordinal(rPos)}</span>}
                  </div>
                </button>
              )
            })()}
          </div>
        )
      })()}
      {/* The messages live on their own screen now (user: "inbox and summary
          should be separated"). What stays here is the one line that says whether
          there is anything to read.

          The tap SERVES, it does not just navigate. It used to go('inbox') bare,
          which left the reader on whatever inboxId last pointed at - usually a
          story already read - so a cue promising nine unread opened onto none of
          them (user: "it often says 9 messages in inbox, click on it and nothing
          shows up"). openInbox is what the rail's mail icon does: oldest unread,
          served and marked. */}
      {unread > 0 && (
        <button className="card inbox-cue" onClick={() => useStore.getState().openInbox()}>
          <h3>✉ {unread} unread message{unread === 1 ? '' : 's'}</h3>
          <div className="meta">{unreadItems[0]?.subject ?? ''}</div>
        </button>
      )}
      <div className="spacer" />
    </>
  )
}

export function stageName(s: string): string {
  return { QF: 'Quarter-Final', SF: 'Semi-Final', F: 'FINAL', BAR: 'Play-off' }[s] ?? s
}
