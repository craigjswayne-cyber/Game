import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SIX_NATIONS_WEEKS } from '../../game/schedule'
import { nationByCode, flagOf } from '../../game/nations'
import { leaguePos, sortTable } from '../../game/schedule'
import { arrangeFriendly, userFixtureThisWeek } from '../../game/season'
import { teamShort } from '../../game/matchEngine'
import { derbyName, rivalsOf } from '../../game/rivalries'
import { dreamState, dreamPct } from '../../game/dream'
import { matchStakes, seasonTentpoles } from '../../game/stakes'
import { huntLine } from '../../game/living'
import { CrestT, SectionTitle } from '../components'
import { InboxList } from './Inbox'
import { inInbox } from '../../game/days'
import { fmtMoney, formGuide, grudgeBetween, newsSubject, weekDate } from '../../game/model'
import { OBJECTIVE_DEFS } from '../../game/objectives'
import { natRankOrder } from '../../game/natrank'
import { ord, t } from '../../game/i18n'
import { AdSlot } from '../AdSlot'

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
  const finState = club.balance >= 3_000_000 ? ['wizard.rich', 'var(--text-positive)']
    : club.balance >= 500_000 ? ['wizard.secure', 'var(--text-positive)']
    : club.balance >= 0 ? ['wizard.okay', 'var(--border-strong)'] : ['home.inTheRed', 'var(--text-negative)']

  if (game.unemployed) {
    return (
      <>
        <button className="card" style={{ borderLeft: '4px solid var(--gold)' }}
          onClick={() => go('jobs')}>
          <h3>{t('home.jobCentre')}</h3>
          <div className="meta">{t('home.betweenJobs', { n: game.vacancies.length })}</div>
        </button>
        {/* With no club there is no summary to separate the inbox from, so it
            stays inline here. */}
        <SectionTitle sub={t('home.inboxSub')}>{t('home.inbox')}</SectionTitle>
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
          <b>{t('home.hintBold')}</b> {t('home.hintRest')}
        </div>
      )}
      <div className="card-grid">
      {game.comps['sn'] && game.week >= SIX_NATIONS_WEEKS[0] - 1 && game.week <= SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1] && (() => {
        const rows = sortTable(game.comps['sn'].table).slice(0, 3)
        const thisWk = game.fixtures.filter(f => f.compId === 'sn' && f.week === game.week)
        return (
          <div className="card" onClick={() => go('nations')}
            style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div className="fact-label" style={{ color: 'var(--gold)' }}>{t('home.snLabel', { comp: (game.comps['sn']?.name ?? t('home.theChampionship')).toUpperCase() })}</div>
            {thisWk.map(f => (
              <div key={f.id} style={{ fontSize: 13, marginTop: 3 }}>
                {flagOf(f.homeId)} {nationByCode(f.homeId)?.name} {f.played ? <b>{f.homeScore}–{f.awayScore}</b> : t('common.v')} {nationByCode(f.awayId)?.name} {flagOf(f.awayId)}
              </div>
            ))}
            {rows.length > 0 && rows[0].p > 0 && (
              <div className="meta" style={{ color: 'var(--text-muted)', marginTop: 5 }}>
                {t('home.snTable', { rows: rows.map((r, i) => `${i + 1}. ${nationByCode(r.teamId)?.name} (${r.pts})`).join(' · ') })}
              </div>
            )}
            <div className="meta" style={{ color: 'var(--gold)', marginTop: 3 }}>{t('home.snTap')}</div>
          </div>
        )
      })()}
      {(() => {
        // the hook: why THIS week matters - the reason to press Continue
        const grudge = fx ? grudgeBetween(game, fx.homeId, fx.awayId) : null
        const derby = fx ? derbyName(fx.homeId, fx.awayId) : null
        const hook = derby ? t('home.derbyWeek', { derby: derby.toUpperCase() })
          : grudge ? t('home.grudge', { reason: grudge.reason })
          : fx?.stage ? t('home.knockout', { stage: stageName(fx.stage) })
          : game.week === 7 || game.week === 27 ? t('home.deadlineWeek')
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
        const streak = unbeaten >= 3 ? t('home.unbeaten', { n: unbeaten }) : winless >= 3 ? t('home.winless', { n: winless }) : null
        if (!hook && !streak) return null
        return (
          <div className="card" style={{ borderLeft: `4px solid ${winless >= 3 ? 'var(--text-negative)' : 'var(--gold)'}`, display: 'flex', gap: 10, alignItems: 'center' }}>
            {hook && <b style={{ fontSize: 13 }}>{hook}</b>}
            {streak && <span className="chip" style={{ marginLeft: 'auto', fontWeight: 700 }}>{streak}</span>}
          </div>
        )
      })()}
      {fx && (
        <div className="card" onClick={() => go('tactics')} style={{
          borderLeft: `4px solid ${game.clubs[fx.homeId === club.id ? fx.awayId : fx.homeId]?.colors[0] ?? 'var(--gold)'}`,
        }}>
          <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10.5 }}>
            {t('home.nextMatch')} · {comp?.name ?? (fx.compId === 'fr' ? t('common.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''}
          </div>
          {/* a class, not an inline font-size: inline wins over any media query,
              so portrait could not shrink this and "Northampton v La Rochelle"
              lost 20px off the end of the opponent's name at 412px */}
          <h3 className="fx-line">
            <CrestT g={game} teamId={fx.homeId} size={20} />{teamShort(game, fx.homeId)} {t('common.v')} <CrestT g={game} teamId={fx.awayId} size={20} />{teamShort(game, fx.awayId)}
          </h3>
          <div className="meta">
            {fx.venue?.name ?? game.clubs[fx.homeId]?.stadium ?? t('common.neutralVenue')} · {weekDate(game.season, fx.week)}
            {fx.venue ? t('home.atNeutral') : fx.homeId === club.id ? t('home.atHome') : t('home.atAway')}
          </div>
          {/* WHAT THIS MATCH MEANS. The engine has always known - the table
              maths, the boardroom, the grudge, the man one try short of fifty -
              and never said it at the one moment it lands. One line, the loudest
              true thing, and nothing at all when there is nothing to say. */}
          {isThisWeek && (() => {
            const bill = matchStakes(game, fx)
            return bill ? (
              <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)',
                            fontWeight: 600, color: 'var(--gold)' }}>{bill}</div>
            ) : null
          })()}
          <div className="muted" style={{ marginTop: 6 }}>
            {isThisWeek ? t('home.tapSetTeam') : t('home.noMatchWeek')}
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
          <div className="card" onClick={() => go('country')} style={{ borderLeft: '4px solid var(--text-positive)' }}>
            <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10.5 }}>
              {t('home.headCoach')} · {nat?.name ?? game.natTeam}{rank > 0 ? t('home.worldNo', { rank }) : ''}{game.natConfidence != null ? t('home.unionPct', { pct: Math.round(game.natConfidence) }) : ''}
            </div>
            {next ? (
              <>
                <h3 className="fx-line">
                  {flagOf(next.homeId)} {nationByCode(next.homeId)?.name ?? next.homeId} {t('common.v')} {flagOf(next.awayId)} {nationByCode(next.awayId)?.name ?? next.awayId}
                </h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  {testWeek ? t('home.testWeek') : t('home.nextTest', { date: weekDate(game.season, next.week) })}
                </div>
              </>
            ) : (
              <div className="muted">{t('home.noTest')}</div>
            )}
          </div>
        )
      })()}
      {/* THE DREAM sits above the season objectives on purpose. The board's
          brief expires in May; this does not, and the whole point of putting it
          here is that a manager sees the reason for the save every single week.
          Absent on a career started before dreams existed - the Legacy screen's
          horizons carry those saves as they always did. */}
      {(() => {
        const d = dreamState(game)
        if (!d) return null
        const pct = dreamPct(d.progress)
        return (
          <button className="card" style={{ borderLeft: `4px solid ${d.progress.done ? 'var(--primary)' : 'var(--gold)'}` }}
            onClick={() => go('legacy')}>
            <div className="fact-label">{t(d.progress.done ? 'home.dreamDone' : 'home.dream')}</div>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>{d.title}</div>
            <div style={{ height: 6, background: 'var(--border-strong)', borderRadius: 3, overflow: 'hidden', margin: '7px 0 4px' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: d.progress.done ? 'var(--primary)' : 'var(--gold-fill)' }} />
            </div>
            <div className="meta">{d.progress.note}</div>
          </button>
        )
      })()}
      {/* THE SEASON AHEAD. Anticipation needs dates: derbies, deadlines,
          intake day, the finals you have reached. Everything here already
          fires on schedule - the player has simply never been able to see it
          coming. Three at a time, so it is a glance and not a calendar app. */}
      {/* THE CIRCLING (living.ts, wave 4). A rival building towards a bid for
          your best player across a whole season, said out loud from the first
          paragraph of paper talk - so losing him is the end of a story you
          watched happen rather than an alert that arrived one Tuesday. */}
      {(() => {
        const line = huntLine(game)
        if (!line) return null
        return (
          <button className="card" onClick={() => go('transfers')}
            style={{ borderLeft: '4px solid var(--prop-red, var(--danger))' }}>
            <div className="fact-label">{t('home.circling')}</div>
            <div style={{ marginTop: 4 }}>{line}</div>
          </button>
        )
      })()}

      {(() => {
        // `tp`, not `t`: the i18n t() is in scope here now, and shadowing it
        // inside the map is how a screen ends up rendering "[object Object]"
        const soon = seasonTentpoles(game).filter(tp => tp.week >= game.week).slice(0, 3)
        if (!soon.length) return null
        return (
          <button className="card" onClick={() => go('fixtures')}>
            <div className="fact-label">{t('home.seasonAhead')}</div>
            <div className="meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', marginTop: 2 }}>
              {soon.map(tp => (
                <span key={`${tp.week}-${tp.label}`}>
                  {tp.icon} {tp.label}
                  <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {tp.week === game.week ? t('home.tentpoleThisWeek') : t('home.tentpoleIn', { n: tp.week - game.week })}
                  </b>
                </span>
              ))}
            </div>
          </button>
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
            <div className="fact-label">{t('home.objectives', { met: objs.filter(o => o!.met(game)).length, total: objs.length })}</div>
            <div className="meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
              {objs.map(o => {
                const met = o!.met(game)
                const done = met && o!.banked
                return (
                  <span key={o!.id} style={{ color: done ? 'var(--text-positive)' : met ? 'var(--info)' : 'var(--text-secondary)' }}>
                    {done ? '✓' : met ? '◍' : '○'} {o!.text(game)}
                    {met && !o!.banked ? t('home.onCourse') : ''}
                  </span>
                )
              })}
            </div>
          </button>
        )
      })()}
      {game.review && game.review.season === game.season - 1 && game.week <= 6 && (
        <button className="card" style={{ borderLeft: '4px solid var(--gold)' }}
          onClick={() => go('seasonreview')}>
          <h3>{t('home.annualOut')}</h3>
          <div className="meta">{t('home.annualSub')}</div>
        </button>
      )}
      {pressOpen > 0 && (
        <button className="card" style={{ borderLeft: '4px solid var(--gold)' }}
          onClick={() => go('press')}>
          <h3>{t('home.pressWord')}</h3>
          <div className="meta">{t('home.pressSub', { n: pressOpen })}</div>
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
          <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
            <div className="fact-label">{t('home.blankWeekend')}</div>
            <div className="meta" style={{ marginBottom: 6 }}>
              {t('home.blankSub')}
            </div>
            <div className="chips" style={{ padding: 0 }}>
              {idle.map(c => (
                <button key={c.id} className="chip" onClick={() => { arrangeFriendly(game, c.id); touch() }}>
                  {t('home.friendlyChip', { club: c.short, rep: c.rep })}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      </div>
      <div className="hub-row">
        <button className="hub-widget" onClick={() => go('tables')}>
          <label>{t('home.wLeague')}</label>
          <b>{pos > 0 ? ord(pos) : '-'}</b>
          <span>{game.comps[club.leagueId]?.short}</span>
        </button>
        <button className="hub-widget" onClick={() => go('fixtures')}>
          <label>{t('home.wForm')}</label>
          <b style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
            {recent.length === 0 ? <span style={{ fontSize: 12, fontWeight: 400 }}>{t('home.noGames')}</span> : recent.map((r, i) => (
              // the class stays W/L/D - it is what colours the pip - while the
              // letter shown follows the language (V/N/D in French)
              <span key={i} className={`form-pip ${r}`}>{t(r === 'W' ? 'common.w' : r === 'L' ? 'common.l' : 'common.d')}</span>
            ))}
          </b>
          <span>{recent.length ? t('home.lastMatches', { n: recent.length }) : t('home.seasonAheadShort')}</span>
        </button>
        <button className="hub-widget" onClick={() => go('report')}>
          <label>{t('home.wBoard')}</label>
          {/* rule 4: a key number renders in text-primary - colour belongs on
              the delta beside it, never on the figure itself */}
          <b>{Math.round(club.boardConfidence)}%</b>
          <span>{t('home.confidence')}</span>
        </button>
        <button className="hub-widget" onClick={() => go('club', club.id)}>
          <label>{t('home.wFans')}</label>
          {(() => {
            const m = game.fanMood ?? 60
            const word = m >= 80 ? '🔥' : m >= 62 ? '😊' : m >= 45 ? '😐' : m >= 30 ? '😠' : '🤬'
            return <b>{word}</b>
          })()}
          <span>{(() => {
            const m = game.fanMood ?? 60
            return t(m >= 80 ? 'home.fanBouncing' : m >= 62 ? 'home.fanBehind' : m >= 45 ? 'home.fanWatching' : m >= 30 ? 'home.fanRestless' : 'home.fanMutinous')
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
          return { txt: `${us}-${them}`, c: us > them ? 'var(--text-positive)' : us < them ? 'var(--text-negative)' : undefined }
        }
        return (
          <div className="dash-row">
            <button className="dash-panel" onClick={() => go('fixtures')}>
              <div className="dash-head">{t('home.dashFixtures')}</div>
              {played.map(f => {
                const r = resStr(f)
                return (
                  <div key={f.id} className="dash-line">
                    <span className="muted dl-wk">{t('common.wk', { n: f.week })}</span>
                    <span className="dl-t">{teamShort(game, f.homeId === club.id ? f.awayId : f.homeId)}</span>
                    <span>{t(f.homeId === club.id ? 'common.h' : 'common.a')}</span>
                    <b style={{ color: r.c }}>{r.txt}</b>
                  </div>
                )
              })}
              {/* The comp tag is the compId, not comp.short: "Continental Cup"
                  muted at the end of a half-width row cost 72px and the club
                  name beside it arrived as "Highlande..." (device matrix,
                  round 23). PREM/CC/TOP14 says which shirt the week is about
                  in the space a glance panel actually has. */}
              {coming.map(f => (
                <div key={f.id} className="dash-line">
                  <span className="muted dl-wk">{t('common.wk', { n: f.week })}</span>
                  <span className="dl-t">{teamShort(game, f.homeId === club.id ? f.awayId : f.homeId)}</span>
                  <span>{t(f.homeId === club.id ? 'common.h' : 'common.a')}</span>
                  <span className="muted">{game.comps[f.compId] ? f.compId.toUpperCase() : 'FR'}</span>
                </div>
              ))}
            </button>
            <button className="dash-panel" onClick={() => go('finances')}>
              <div className="dash-head">{t('home.dashFinances')}</div>
              <div className="dash-line"><span>{t('home.state')}</span><b style={{ color: finState[1] }}>{t(finState[0])}</b></div>
              <div className="dash-line"><span>{t('home.balance')}</span><b>{fmtMoney(club.balance)}</b></div>
              <div className="dash-line"><span>{t('home.transferBudget')}</span><b>{fmtMoney(club.budget)}</b></div>
              <div className="dash-line"><span>{t('home.wageRoom')}</span><b>{fmtMoney(Math.max(0, wageRoom))}{t('common.perWeek')}</b></div>
            </button>
            <button className="dash-panel" onClick={() => go('medical')}>
              <div className="dash-head">{t('home.dashMedical')}</div>
              {out.length === 0 && <div className="dash-line"><span className="muted">{t('home.cleanBill')}</span></div>}
              {out.slice(0, 4).map(p => (
                <div key={p!.id} className="dash-line">
                  <span className="dl-t" style={{ color: 'var(--text-negative)' }}>{p!.name.split(' ').slice(-1)[0]}</span>
                  <span className="muted">{t('common.weeksOut', { n: Math.max(1, p!.injury!.until - game.week) })}</span>
                </div>
              ))}
              {out.length > 4 && <div className="dash-line"><span className="muted">{t('home.andMore', { n: out.length - 4 })}</span></div>}
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
                return { txt: `${t(us > them ? 'common.w' : us < them ? 'common.l' : 'common.d')} ${us}-${them}`, c: us < them ? 'var(--text-positive)' : us > them ? 'var(--text-negative)' : undefined }
              })() : null
              return (
                <button className="dash-panel" onClick={() => go('club', rival)}>
                  <div className="dash-head">{t('home.rivalWatch')}</div>
                  <div className="dash-line">
                    <span className="dl-t">{teamShort(game, rival)}</span>
                    {rr && <b style={{ color: rr.c }}>{rr.txt}</b>}
                    {rPos > 0 && <span className="muted">{ord(rPos)}</span>}
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
          <h3>{t('home.unread', { n: unread })}</h3>
          <div className="meta">{unreadItems[0] ? newsSubject(unreadItems[0]) : ''}</div>
        </button>
      )}
      {/* Renders nothing at all unless a packaged shell has attached an ad
          provider, which the web build never does (game/monetise.ts). Here
          rather than higher up because the foot of the dashboard is the one
          place on this screen nobody is mid-decision. */}
      <AdSlot place="home-foot" />
      <div className="spacer" />
    </>
  )
}

/** Shared with Tables, Fixtures and MatchDay, which is why it lives in the
 *  common namespace rather than under home. */
export function stageName(s: string): string {
  const key = { QF: 'common.stageQF', SF: 'common.stageSF', F: 'common.stageF', BAR: 'common.stageBAR' }[s]
  return key ? t(key) : s
}
