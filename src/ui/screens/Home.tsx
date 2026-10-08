import { genderOf } from '../../game/gender'
import { isDeadlineWeek } from '../../game/window'
import { useStore } from '../../store'
import { dismiss, dismissed, isOldPlayApp } from '../../game/shell'
import { snIdFor, snWeeksFor } from '../../game/schedule'
import { nationByCode, nationName } from '../../game/nations'
import { Flag } from '../flags'
import { leaguePos, sortTable } from '../../game/schedule'
import { arrangeFriendly, assistantFixtureThisWeek, userFixtureThisWeek } from '../../game/season'
import { teamShort } from '../../game/matchEngine'
import { derbyName, rivalsOf } from '../../game/rivalries'
import { OBJECTIVE_DEFS } from '../../game/objectives'
import { dreamNote, dreamPct, dreamState, dreamTitle } from '../../game/dream'
import { matchStakes, seasonTentpoles } from '../../game/stakes'
import { huntLine } from '../../game/living'
import { CrestT, SectionTitle } from '../components'
import { InboxList } from './Inbox'
import { formGuide, grudgeBetween, grudgeReason, fxDate, weekDate, type Fixture, type GameState } from '../../game/model'
import { natRankOrder } from '../../game/natrank'
import { ord, t, compLabel } from '../../game/i18n'
import { AdSlot } from '../AdSlot'
import { tillOpen } from '../../game/monetise'
import { natWindow, weeksToSquad } from '../../game/country'
import { FanFace, Glyph } from '../glyphs'
import { COMMUNITY_URL } from '../../game/community'
import { buildDesk, deskText } from '../../game/desk'
import { DeskCard } from '../Desk'


export default function Home() {
  const game = useStore(s => s.game)!
  // The unread count and its headline moved into the desk's decisions
  // (game/desk.ts), which counts with the reader's own predicate (inInbox) and
  // serves the queue through openInbox, oldest first, as the old cue did.
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
  // WHOSE SATURDAY IS THIS. On a week holding both a club fixture and a Test
  // the manager takes his country (season.userMatchThisWeek) and the assistant
  // takes the club - so this card must stop inviting a team sheet for a match
  // the manager is not at (user: "it showed my club game, I ran it and it
  // played another international game").
  const assistantFx = assistantFixtureThisWeek(game)
  const assistants = !!assistantFx && !!fx && assistantFx.id === fx.id

  // hub widgets: form pips, the board and the fans. The pips sort by week
  // inside formGuide - see its comment for the W W W W W screenshot this
  // array-order slice put on the Home screen. League position and money are
  // the desk's season and finance rows now.
  const recent = formGuide(game, club.id)

  const desk = buildDesk(game)
  const hook = weekHook(game, fx)

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
      {/* THE DESK (1.8.2, game/desk.ts): what holds the week first, then the
          match, then one line each on the rest of the club, then Continue. */}
      <DeskCard desk={desk} match={fx ? (
        <div className="desk-match" onClick={() => go(assistants ? 'country' : 'squad')} style={{
          borderLeftColor: assistants ? 'var(--border-strong)' : game.clubs[fx.homeId === club.id ? fx.awayId : fx.homeId]?.colors[0] ?? 'var(--gold)',
        }}>
          <div className="desk-mhead">
            <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
              {t(assistants ? 'home.assistantMatch' : 'home.nextMatch')} · {compLabel(comp?.name) ?? (fx.compId === 'fr' ? t('common.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''}
            </div>
            {/* the run the club is on, which had a card of its own with the hook */}
            {hook.streak && <span className="chip" style={{ fontWeight: 700, color: hook.winless ? 'var(--text-negative)' : undefined }}>{hook.streak}</span>}
          </div>
          {/* a class, not an inline font-size: inline wins over any media query,
              so portrait could not shrink this and "Northampton v La Rochelle"
              lost 20px off the end of the opponent's name at 412px */}
          <h3 className="fx-line">
            <CrestT g={game} teamId={fx.homeId} size={20} />{teamShort(game, fx.homeId)} {t('common.v')} <CrestT g={game} teamId={fx.awayId} size={20} />{teamShort(game, fx.awayId)}
          </h3>
          <div className="meta">
            {fx.venue?.name ?? game.clubs[fx.homeId]?.stadium ?? t('common.neutralVenue')} · {fxDate(game.season, fx)}
            {fx.venue ? t('home.atNeutral') : fx.homeId === club.id ? t('home.atHome') : t('home.atAway')}
          </div>
          {/* why this week matters, which had that card too */}
          {hook.hook && <div className="desk-hook"><b>{hook.hook}</b></div>}
          {/* WHAT THIS MATCH MEANS. The engine has always known - the table
              maths, the boardroom, the grudge, the man one try short of fifty -
              and never said it at the one moment it lands. One line, the loudest
              true thing, and nothing at all when there is nothing to say. */}
          {isThisWeek && (() => {
            const bill = matchStakes(game, fx)
            return bill ? (
              <div className="desk-stakes">{bill}</div>
            ) : null
          })()}
          {/* the analyst's one line on them, this week only (oppreport.ts) */}
          {desk.match?.analyst && (
            <div className="meta desk-analyst">{deskText(desk.match.analyst)}</div>
          )}
          {(assistants || !isThisWeek) && (
            <div className="muted" style={{ marginTop: 6 }}>
              {assistants ? t('home.assistantTakesIt') : t('home.noMatchWeek')}
            </div>
          )}
        </div>
      ) : null} />
      <div className="card-grid">
      {/* The Championship panel, in whichever game this career is in: the id and
          the window both differ between the two, and naming the men's flat meant
          a women's manager played a Northern Championship her home screen never
          mentioned. */}
      {(() => { const snId = snIdFor(genderOf(game)); const snWks = snWeeksFor(genderOf(game)); return (
      game.comps[snId] && game.week >= snWks[0] - 1 && game.week <= snWks[snWks.length - 1] && (() => {
        const rows = sortTable(game.comps[snId].table).slice(0, 3)
        const thisWk = game.fixtures.filter(f => f.compId === snId && f.week === game.week)
        return (
          <div className="card" onClick={() => go('nations')}
            style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div className="fact-label" style={{ color: 'var(--gold)' }}>{t('home.snLabel', { comp: (compLabel(game.comps[snId]?.name) ?? t('home.theChampionship')).toUpperCase() })}</div>
            {thisWk.map(f => (
              <div key={f.id} style={{ fontSize: 13, marginTop: 3 }}>
                <Flag code={f.homeId} /> {nationName(f.homeId)} {f.played ? <b>{f.homeScore}–{f.awayScore}</b> : t('common.v')} {nationName(f.awayId)} <Flag code={f.awayId} />
              </div>
            ))}
            {rows.length > 0 && rows[0].p > 0 && (
              <div className="meta" style={{ color: 'var(--text-muted)', marginTop: 5 }}>
                {t('home.snTable', { rows: rows.map((r, i) => `${i + 1}. ${nationName(r.teamId)} (${r.pts})`).join(' · ') })}
              </div>
            )}
            <div className="meta" style={{ color: 'var(--gold)', marginTop: 3 }}>{t('home.snTap')}</div>
          </div>
        )
      })()) })()}
      {/* THE CARD SAYS "TAP TO SET YOUR TEAM", SO IT OPENS THE TEAM SHEET.
          It opened Tactics - the roles pitch, which is HOW the side plays, not
          WHO plays - so the one instruction on the home screen sent you to the
          wrong screen (owner, v1.1.17: "when you click tap to set your team on
          the home page it takes you to the roles page, it should take you to
          the selection page"). 'squad' is the team sheet the submenu's Team
          entry opens. */}
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
            <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
              {t('home.headCoach')} · {nationName(game.natTeam)}{rank > 0 ? t('home.worldNo', { rank }) : ''}{game.natConfidence != null ? t('home.unionPct', { pct: Math.round(game.natConfidence) }) : ''}
            </div>
            {next ? (
              <>
                <h3 className="fx-line">
                  <Flag code={next.homeId} size={17} /> {nationName(next.homeId)} {t('common.v')} <Flag code={next.awayId} size={17} /> {nationName(next.awayId)}
                </h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  {testWeek ? t('home.testWeek') : t('home.nextTest', { date: weekDate(game.season, next.week) })}
                </div>
                {/* DAYS UNTIL THE SQUAD (owner: "could we have days til squad
                    work"). The window calendar always knew this and never said
                    it, so a Test job spent most of a season looking like
                    nothing was happening between fixtures. Three states, in
                    order of urgency: camp open with places to fill, the week
                    the party is named, and the countdown to the next one. */}
                {(() => {
                  const w = natWindow(game)
                  if (w) {
                    return (
                      <div className="muted" style={{ marginTop: 4, fontWeight: 700, color: 'var(--gold)' }}>
                        {t('home.campOpen', { n: (game.natSquads[game.natTeam!] ?? []).length, size: w.size })}
                      </div>
                    )
                  }
                  const wks = weeksToSquad(game)
                  if (wks == null) return null
                  return (
                    <div className="muted" style={{ marginTop: 4, fontWeight: 700, color: wks <= 1 ? 'var(--gold)' : undefined }}>
                      {wks <= 0
                        ? t('home.squadThisWeek', { nat: nationName(game.natTeam!) })
                        : t('home.squadIn', { n: wks * 7 })}
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="muted">{t('home.noTest')}</div>
            )}
          </div>
        )
      })()}
      {/* THE STORE, above the Dream because that is where the owner asked for
          it (27 Aug) and because the Dream is the only other card on this
          screen that is about the save rather than about this week. Everything
          else here is a job: the fixture, the deadlines, the objectives, the
          press. A shelf is not a job, so it does not get a badge, it never
          counts anything, and it sits at the top precisely so it can be
          ignored on the way past rather than met three taps down inside
          Finances when somebody finally goes looking.

          The row is tillOpen() like every purchase surface in the game, so the
          web build renders nothing at all here - the card cannot appear on a
          page with no bridge, which is the promise storeprobe holds. */}
      {/* The word, and one line under it. It was the word alone (owner,
          v1.1.4: 'just "STORE", nothing else') until a friend of his could not
          find it (v1.2.5: "this needs to be more obvious - and an 'Upgrade
          your team' next to store"). The line says what the shelf is FOR, in
          the player's language; the store itself still does the explaining. */}
      {/* THE OLD PLAY APP IS BEING REPLACED (v1.2.9). Its saves live in
          Chrome and the new app cannot see them, so anyone the site can tell
          is inside the old wrapper is asked, once, to back up before they
          update. Never shown on the website, in the PWA or in the new app. */}
      {isOldPlayApp() && !dismissed('rm-twa-warned') && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="fact-label">{t('home.handoverTitle')}</div>
          <div className="meta" style={{ marginTop: 3 }}>{t('home.handoverBody')}</div>
          <div className="btn-row" style={{ margin: '10px 0 0' }}>
            <button className="btn ghost" onClick={() => { dismiss('rm-twa-warned'); touch() }}>{t('home.handoverLater')}</button>
            <button className="btn gold" style={{ flex: 1.6 }} onClick={() => go('saves')}>{t('home.handoverGo')}</button>
          </div>
        </div>
      )}
      {tillOpen() && (
        <button className="card store-card" onClick={() => go('supporter')}>
          <div className="store-word">{t('home.storeLabel')}</div>
          <div className="store-sub">{t('home.storeSub')} ›</div>
        </button>
      )}
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
            {/* the label and the note share a line, so the desk above it
                costs the page nothing (1.8.2) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span className="fact-label">{t(d.progress.done ? 'home.dreamDone' : 'home.dream')}</span>
              <span className="meta">{dreamNote(d.progress)}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{dreamTitle(d.def, d.ctx)}</div>
            <div style={{ height: 6, background: 'var(--border-strong)', borderRadius: 3, overflow: 'hidden', margin: '6px 0 2px' }}>
              <div className="grow-x" style={{ width: `${pct}%`, height: '100%', background: d.progress.done ? 'var(--primary)' : 'var(--gold-fill)' }} />
            </div>
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
        // one line per label, at its nearest week: three league meetings with the
        // same derby rival read "Derby: Leicester" three times over otherwise
        const soon = seasonTentpoles(game).filter(tp => tp.week >= game.week)
          .filter((tp, i, all) => all.findIndex(o => o.label === tp.label) === i).slice(0, 3)
        if (!soon.length) return null
        return (
          <button className="card" onClick={() => go('fixtures')}>
            <div className="fact-label">{t('home.seasonAhead')}</div>
            <div className="meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', marginTop: 2 }}>
              {soon.map(tp => (
                <span key={`${tp.week}-${tp.label}`}>
                  <Glyph name={tp.icon} /> {tp.label}
                  <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {tp.week === game.week ? t('home.tentpoleThisWeek') : t('home.tentpoleIn', { n: tp.week - game.week })}
                  </b>
                </span>
              ))}
            </div>
          </button>
        )
      })()}
      {/* THE SEASON OBJECTIVES stay on Home (owner, 1.8.2), one card, and the
          desk does not count them a second time. */}
      {(() => {
        const objs = (game.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
        if (!objs.length) return null
        return (
          <button className="card" onClick={() => go('finances')}>
            {/* A TICK MEANS DONE, AND DONE HAS TO MEAN DONE. An objective that
                is banked once achieved (six starts given, a derby won) is ticked
                the moment it happens; one that is merely true today reads as on
                course until the season is over - see ObjectiveDef.banked. */}
            <div className="fact-label">{t('home.objectives', { met: objs.filter(o => o!.met(game)).length, total: objs.length })}</div>
            <div className="meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
              {objs.map(o => {
                const met = o!.met(game)
                const done = met && o!.banked
                return (
                  <span key={o!.id} style={{ color: done ? 'var(--text-positive)' : met ? 'var(--info)' : 'var(--text-secondary)' }}>
                    {done ? '✓' : met ? '◍' : '○'} {t(o!.textKey(game))}
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
      {!fx && (hook.hook || hook.streak) && (
        <div className="card" style={{ borderLeft: `4px solid ${hook.winless ? 'var(--text-negative)' : 'var(--gold)'}`, display: 'flex', gap: 10, alignItems: 'center' }}>
          {hook.hook && <b style={{ fontSize: 13 }}>{hook.hook}</b>}
          {hook.streak && <span className="chip" style={{ marginLeft: 'auto', fontWeight: 700 }}>{hook.streak}</span>}
        </div>
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
      <div className="hub-row three">
        <button className="hub-widget" data-w="form" onClick={() => go('fixtures')}>
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
        <button className="hub-widget" data-w="board" onClick={() => go('report')}>
          <label>{t('home.wBoard')}</label>
          {/* rule 4: a key number renders in text-primary - colour belongs on
              the delta beside it, never on the figure itself */}
          <b>{Math.round(club.boardConfidence)}%</b>
          <span>{t('home.confidence')}</span>
        </button>
        <button className="hub-widget" data-w="fans" onClick={() => go('club', club.id)}>
          <label>{t('home.wFans')}</label>
          {(() => {
            const m = game.fanMood ?? 60
            const word = t(m >= 80 ? 'home.fanBouncing' : m >= 62 ? 'home.fanBehind' : m >= 45 ? 'home.fanWatching' : m >= 30 ? 'home.fanRestless' : 'home.fanMutinous')
            // a drawn face, five of them from angry to delighted (owner, round
            // 6), never an emoji (27 Sep 2026); the word under it says it too
            return <>
              <b><FanFace mood={m} label={word} className="hub-face" /></b>
              <span>{word}</span>
            </>
          })()}
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
            {/* medical and the rival share the second column, so three panels
                make two columns at phone width rather than leaving one alone */}
            <div className="dash-stack">
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
      {/* Renders nothing at all unless a packaged shell has attached an ad
          provider, which the web build never does (game/monetise.ts). Here
          rather than higher up because the foot of the dashboard is the one
          place on this screen nobody is mid-decision. */}
      {/* THE COMMUNITY, AT THE FOOT OF HOME (owner, 1.8.1). It sat on the
          title screen, where it is the last thing a player about to start a
          career wants and where nobody playing one ever goes back. Here it is
          found by anyone who scrolls the dashboard, and it is below the week's
          business so it never pushes a job down the page. A plain link opened
          outside the game (game/community.ts); the manager's menu carries it
          too. */}
      <a className="btn ghost block home-community" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">
        <Glyph name="gossip" /> {t('menu.community')}
      </a>
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

/**
 * THE SAME ROUND, FOR A ROW RATHER THAN A HEADLINE.
 *
 * A fixtures row is competition, then round, then the score, and the score is
 * the thing being looked for. "Continental Cup Quarter-Final" spent the whole
 * width before the score was reached, so on a phone the result was off the
 * right-hand edge and the row had to be scrolled to be read at all - reported
 * with a screenshot of exactly that.
 *
 * The long names stay where they belong, on the match card and the draw, where
 * a semi-final should be called a semi-final. This is only for the list.
 */
export function stageShort(s: string): string {
  const key = { QF: 'common.stageQFShort', SF: 'common.stageSFShort', F: 'common.stageFShort', BAR: 'common.stageBARShort' }[s]
  return key ? t(key) : s
}

/** Why THIS week matters, and the run the club is on: the line that used to
 *  be a card of its own above the fixture and now rides inside it. */
function weekHook(game: GameState, fx: Fixture | undefined): { hook: string | null; streak: string | null; winless: boolean } {
  const club = game.clubs[game.userClubId]
  const grudge = fx ? grudgeBetween(game, fx.homeId, fx.awayId) : null
  const derby = fx ? derbyName(fx.homeId, fx.awayId) : null
  const hook = derby ? t('home.derbyWeek', { derby: derby.toUpperCase() })
    : grudge ? t('home.grudge', { reason: grudgeReason(grudge) })
    : fx?.stage ? t('home.knockout', { stage: stageName(fx.stage) })
    : isDeadlineWeek(game.week) ? t('home.deadlineWeek')
    : null
  if (!club) return { hook, streak: null, winless: false }
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
  return { hook, streak, winless: winless >= 3 }
}
