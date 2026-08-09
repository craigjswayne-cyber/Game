import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore, type Screen } from '../store'
import { seasonLabel } from '../game/model'
import { dayLine, inInbox, nextStep } from '../game/days'
import { IcoClipboard, IcoHome, IcoInbox, IcoPress, IcoTrophy } from './icons'
import Menu from './screens/Menu'
import NewGame from './screens/NewGame'
import Home from './screens/Home'
import Inbox from './screens/Inbox'
import Offers from './screens/Offers'
import Squad from './screens/Squad'
import PlayerScreen from './screens/PlayerScreen'
import Tactics from './screens/Tactics'
import Fixtures from './screens/Fixtures'
import Tables from './screens/Tables'
import Transfers from './screens/Transfers'
import Training from './screens/Training'
import Finances from './screens/Finances'
import ClubScreen from './screens/ClubScreen'
import MatchDay from './screens/MatchDay'
import Press from './screens/Press'
import Nations from './screens/Nations'
import History from './screens/History'
import Legacy from './screens/Legacy'
import Handbook from './screens/Handbook'
import Jobs from './screens/Jobs'
import Feed from './screens/Feed'
import Wire from './screens/Wire'
import Medical from './screens/Medical'
import TeamReport from './screens/TeamReport'
import Profile from './screens/Profile'
import Saves from './screens/Saves'
import DayRoom from './screens/DayRoom'
import DrawRoom from './screens/DrawRoom'
import DreamTeam from './screens/DreamTeam'
import WeekResults from './screens/WeekResults'
import SeasonReview from './screens/SeasonReview'
import Agency from './screens/Agency'
import Infrastructure from './screens/Infrastructure'
import Academy from './screens/Academy'
import Tutorial from './Tutorial'

const TITLES: Record<string, string> = {
  home: 'Home', inbox: 'Inbox', offers: 'Bids For Your Players', results: 'Full-Time Round-Up', squad: 'Team', agency: 'Scouting Agency', tactics: 'Selection & Tactics', fixtures: 'Fixtures',
  tables: 'Competitions', transfers: 'Transfer Centre', training: 'Training & Coaching',
  finances: 'Finances', club: 'Club', press: 'Press Room', player: 'Player Profile',
  nations: 'International Rugby', history: 'Roll of Honour', legacy: 'Manager Legacy',
  jobs: 'Job Centre', feed: 'The Rugby Wire', medical: 'Medical Centre',
  report: 'Team Report', profile: 'Manager Profile', saves: 'Game Status', day: 'The Week', draw: 'The Draw',
  dreamteam: 'Team of the Week', wire: 'The Rugby Wire', infra: 'Club Infrastructure',
  handbook: "The Manager's Handbook",
}

const IcoMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
  </svg>
)
const IcoSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </svg>
)

/* There used to be a "turn your phone sideways" veil here, softened to a nudge
 * with a Play anyway escape (blocker A3). It is gone, because it was telling a
 * lie: portrait is now the orientation this game is designed and tuned for -
 * every table has a fitted colgroup, the headings pin properly, the masthead
 * drops its controls onto a second row, and there is a portrait QA harness that
 * fails the build if any of that regresses. A first-time player in portrait was
 * being met by a full-screen wall instructing them away from the layout that
 * actually gets the attention. Landscape still works; neither needs asking for.
 */

/** A save that fails in silence is the worst failure a management game has
 *  (blocker A4): you keep playing for two hours and lose all of it. */
function SaveWarning() {
  const fails = useStore(s => s.saveFail)
  const msg = useStore(s => s.saveFailMsg)
  if (!fails) return null
  return (
    <div className="save-warn">
      <div>
        <b>⚠ Save failed{fails > 1 ? ` (${fails} in a row)` : ''}.</b>{' '}
        Nothing since your last successful save is being written to this phone. Usually this is storage:
        clear some space, then press Continue. {msg ? <span className="save-warn-why">{msg}</span> : null}
      </div>
      <div className="save-warn-btns">
        <button className="btn tiny gold" onClick={() => void useStore.getState().persist()}>Try again</button>
        <button className="btn tiny ghost" onClick={() => useStore.getState().dismissSaveFail()}>Hide</button>
      </div>
    </div>
  )
}

/** The trophy moment, the promotion, the challenge completed.
 *
 *  This block used to sit in App's function body as an orphaned statement
 *  rather than inside the returned tree, so it was parsed, type-checked, and
 *  never rendered: four systems wrote state.celebration and nothing ever showed
 *  it or cleared it (blocker A5). */
function Celebration() {
  const game = useStore(s => s.game)
  useStore(s => s.tick)
  if (!game?.celebration) return null
  const cel = game.celebration
  return (
    <div className="celebrate-veil" onClick={() => { game.celebration = null; useStore.getState().touch() }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <i key={i} className="confetti" style={{
          left: `${(i * 137) % 100}%`,
          animationDelay: `${(i * 0.23) % 2.4}s`,
          animationDuration: `${2.6 + (i % 5) * 0.5}s`,
          background: ['#e3b92e', '#2e57ab', '#c0392f', '#2f7d4f', '#9fc2e8'][i % 5],
        }} />
      ))}
      <div className="celebrate-box">
        <div style={{ fontSize: 64, lineHeight: 1 }}>{cel.icon}</div>
        <h1>{cel.headline}</h1>
        <div className="sub">{cel.sub}</div>
        <div className="muted" style={{ marginTop: 14 }}>Tap anywhere - the party carries on without you.</div>
      </div>
    </div>
  )
}

/** Everything that floats above whatever screen you happen to be on. One
 *  component so the five return paths through App cannot disagree about it. */
function Overlays() {
  return (
    <>
      <SaveWarning />
      <Tutorial />
      <Celebration />
    </>
  )
}

/** Best-effort hard lock where the platform allows it (installed PWA). */
function useOrientationLock() {
  useEffect(() => {
    const tryLock = () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      o?.lock?.('landscape').catch(() => { /* browser tabs refuse - the veil handles it */ })
    }
    tryLock()
    window.addEventListener('click', tryLock, { once: true })
    return () => window.removeEventListener('click', tryLock)
  }, [])
}

/** A reload lands you back where you were, not on the title screen.
 *
 *  Runs once, and only from a cold start with no game in memory, so it can never
 *  interrupt a session in progress. Strict mode double-invokes effects in
 *  development, which the in-memory guard also covers. */
let resumeTried = false
function useResume() {
  useEffect(() => {
    if (resumeTried) return
    resumeTried = true
    if (useStore.getState().game) return
    void useStore.getState().resume()
  }, [])
}

interface MenuItem {
  ico: string
  label: string
  /** doubles as the react key, so it stays required even for action items */
  screen: Screen
  badge?: number
  /** opens something in place instead of navigating (How to play) */
  action?: () => void
}

/**
 * The only three Hub screens a manager has to visit before a first match.
 *
 * Pick a side, know who is in it, tell the coaches what to work on. Everything
 * else in the Hub is either a readout or a job for a week when there is one, and
 * a first-timer cannot tell which from a list of eleven equal rows.
 */
const FIRST_JOBS = new Set<Screen>(['tactics', 'squad', 'training'])

export default function App() {
  const nav = useStore(s => s.nav)
  const game = useStore(s => s.game)
  const night = useStore(s => s.night)
  useStore(s => s.tick)
  const { back, go, home, continueWeek, toggleNight, openInbox } = useStore.getState()
  const [menu, setMenu] = useState<null | 'hub' | 'world' | 'manager'>(null)
  useOrientationLock()
  useResume()

  const cur = nav[nav.length - 1]
  const appClass = `app${night ? ' night' : ''}`

  if (cur.screen === 'menu') return <div className={`${appClass} no-rail`}><Menu /><Overlays /></div>
  if (cur.screen === 'newgame') return <div className={`${appClass} no-rail`}><NewGame /><Overlays /></div>
  if (!game) return <div className={`${appClass} no-rail`}><Menu /><Overlays /></div>

  if (cur.screen === 'matchday') {
    const mdClub = game.clubs[game.userClubId]
    return (
      <div className={`${appClass} no-rail`} style={{ '--club1': mdClub.colors[0], '--club2': mdClub.colors[1] } as CSSProperties}>
        <MatchDay />
        <Overlays />
      </div>
    )
  }

  const club = game.clubs[game.userClubId]
  // THE BADGE MUST COUNT WHAT THE SCREEN WILL SHOW.
  //
  // Reported from a first-ever session: "the inbox was blank, she went forward and
  // back and it was sorted". This counted every unread non-gossip story; the reader
  // shows days.inInbox, which also drops cleared stories and applies the five-day
  // recall window. So the rail could promise mail the reader had already filtered
  // out, and the reader fell through to its own "nothing in the inbox" text - which
  // on a phone reads as a blank screen, because you came here for something.
  //
  // One predicate now, in one place, for the dot and for the reader.
  const unread = game.news.filter(n => inInbox(game, n) && !n.read).length
  const wireUnread = game.news.filter(n => !n.read && n.type === 'gossip').length
  const pressOpen = game.press.filter(p => !p.answered).length
  const offersOpen = game.offers.filter(o => o.status === 'pending' && o.forUser).length
  const openJobs = game.vacancies.filter(v => !v.passed && !v.applied).length
  // GATED ON THE FIRST MATCH, NOT ON A WEEK COUNT.
  //
  // This was `week <= 3`, and the user was still being told "before your first
  // match, these three are the job" in week 3 with matches already played. The
  // note was lying about its own subject, which is worse than being unhelpful.
  // A manager who has taken charge of a game does not need to be told what to do
  // before his first one, so the marks now clear the moment he has.
  const firstWeeks = game.season === 0 && game.mgr.m === 0
  // NEW injuries, not injured men (13E). A ten-week layoff used to hold the red
  // dot for ten weeks, which trains the manager to ignore it. Medical.tsx marks
  // them seen when he stands on the page.
  const injuredCount = club.players.filter(id => {
    const inj = game.players[id]?.injury
    return inj && !inj.seen
  }).length
  const clubVars = {
    '--club1': club.colors[0],
    '--club2': club.colors[1],
  } as CSSProperties

  const screen = () => {
    switch (cur.screen) {
      case 'home': return <Home />
      case 'inbox': return <Inbox />
      case 'offers': return <Offers />
      case 'squad': return <Squad />
      case 'player': return <PlayerScreen playerId={cur.param as number} />
      case 'tactics': return <Tactics />
      case 'fixtures': return <Fixtures />
      case 'tables': return <Tables initial={cur.param as string | undefined} />
      case 'transfers': return <Transfers />
      case 'training': return <Training />
      case 'finances': return <Finances />
      case 'club': return <ClubScreen clubId={(cur.param as string) ?? game.userClubId} />
      case 'press': return <Press />
      case 'nations': return <Nations />
      case 'history': return <History />
      case 'legacy': return <Legacy />
      case 'handbook': return <Handbook />
      case 'jobs': return <Jobs />
      case 'feed': return <Feed />
      case 'wire': return <Wire />
      case 'medical': return <Medical />
      case 'report': return <TeamReport />
      case 'profile': return <Profile />
      case 'saves': return <Saves />
      case 'day': return <DayRoom />
      case 'draw': return <DrawRoom />
      case 'dreamteam': return <DreamTeam />
      case 'results': return <WeekResults param={cur.param as string} />
      case 'seasonreview': return <SeasonReview />
      case 'agency': return <Agency />
      case 'infra': return <Infrastructure />
      case 'academy': return <Academy />
      default: return <Home />
    }
  }

  /** The rail, rebuilt to the shape the user asked for.
   *
   *  It used to be seven buttons: Home, Inbox, Squad, Tactics, then Club, World
   *  and Manager groups. Squad and Tactics had their own rail slots while
   *  everything else was buried, so the rail was half shortcuts and half
   *  categories and there was no one place that meant "my team this week".
   *
   *  Now it reads top to bottom the way a matchday does: the news first,
   *  because that is what has happened since you last looked; Home; the
   *  Hub, which is everything about the team and the club you run
   *  - selection, the squad, fitness, fixtures, money, the academy, the staff;
   *  then the manager, then the wider world. Four groups, in the user's order,
   *  and nothing lost - the World group keeps the things that are nobody's club
   *  in particular. */
  const MENUS: Record<'hub' | 'world' | 'manager', { title: string; items: MenuItem[] }> = {
    hub: {
      // just "Hub" (user: "scrap the pre match"). It was never only pre-match -
      // finances, the academy and the infrastructure live here too - and on a
      // 412px screen the longer name wrapped the menu heading onto two lines.
      title: `${club.short} · Hub`,
      // The user's own order, given as a list (13D). It groups the three squad
      // pages together at the top - the team, the report on it, the academy
      // feeding it - then the weekly work, then the money, then the bricks. Squad
      // is "Team" because the page is the whole team including the academy men,
      // and Academy loses "& A League" because the A League is a thing on that
      // page rather than a second destination.
      items: [
        // Team, the report on it, then the sheet you pick from it: the user's
        // order, corrected on sight of it on a phone ("selection and tactics
        // should be below team report").
        { ico: '🏉', label: 'Team', screen: 'squad' },
        { ico: '📊', label: 'Team Report', screen: 'report' },
        { ico: '📋', label: 'Selection & Tactics', screen: 'tactics' },
        { ico: '🎓', label: 'Academy', screen: 'academy' },
        { ico: '🏋️', label: 'Training & Staff', screen: 'training' },
        { ico: '🏥', label: 'Medical Centre', screen: 'medical', badge: injuredCount },
        { ico: '📅', label: 'Fixtures & Results', screen: 'fixtures' },
        { ico: '💰', label: 'Finances', screen: 'finances' },
        { ico: '🔁', label: 'Transfer Centre', screen: 'transfers', badge: offersOpen },
        { ico: '🏗️', label: 'Club Infrastructure', screen: 'infra' },
        { ico: '🏟️', label: 'Club Information', screen: 'club' },
      ],
    },
    manager: {
      title: game.managerName,
      items: [
        { ico: '👤', label: 'Manager Profile', screen: 'profile' },
        // the manager is the one in front of the cameras, so the press room
        // belongs to him rather than to the team sheet
        { ico: '🎙️', label: 'Press Room', screen: 'press', badge: pressOpen },
        // Only the jobs he has not answered. It used to be vacancies.length, so
        // the red dot appeared because somebody somewhere got sacked and nothing
        // he could do would clear it (see GameState.vacancies).
        { ico: '🕴️', label: 'Job Centre', screen: 'jobs', badge: game.vacancies.filter(v => !v.passed && !v.applied).length },
        { ico: '📜', label: 'Manager Legacy', screen: 'legacy' },
        { ico: '📖', label: "The Manager's Handbook", screen: 'handbook' },
        // dismissing the welcome dialog used to be final and irreversible
        { ico: '❓', label: 'How to play', screen: 'home', action: () => useStore.getState().openTut() },
        { ico: '💾', label: 'Save / Load Game', screen: 'saves' },
        // A reload now resumes the career where it was left, so a refresh is no
        // longer the way back to the title screen - and without a deliberate
        // route there, starting a second career would be impossible.
        { ico: '🚪', label: 'Main Menu', screen: 'menu', action: () => useStore.getState().toTitle() },
      ],
    },
    world: {
      title: 'World',
      items: [
        { ico: '📰', label: 'The Rugby Wire', screen: 'feed', badge: wireUnread },
        { ico: '🏆', label: 'Competitions', screen: 'tables' },
        { ico: '🌍', label: 'International Rugby', screen: 'nations' },
        { ico: '🏉', label: 'Team of the Week', screen: 'dreamteam' },
        { ico: '🔭', label: 'Scouting Agency', screen: 'agency' },
        { ico: '📜', label: 'Roll of Honour', screen: 'history' },
      ],
    },
  }

  const navBtn = (s: string, ico: ReactNode, label: string, badge?: number) => (
    <button className={cur.screen === s ? 'active' : ''} title={label} aria-label={label}
      onClick={() => {
        setMenu(null)
        // the mail icon is a queue, not a link: each tap serves the next unread
        if (s === 'inbox') { openInbox(); return }
        if (s === 'home') { home(); return }
        go(s as Screen)
      }}>
      <span className="ico nbadge">{ico}{badge ? <span className="dot">{badge > 9 ? '9+' : badge}</span> : null}</span>
      <span className="nlbl">{label}</span>
    </button>
  )

  const groupBtn = (id: 'hub' | 'world' | 'manager', ico: ReactNode, label: string, badge?: number) => (
    <button className={menu === id ? 'active' : ''} title={label} aria-label={label}
      onClick={() => setMenu(menu === id ? null : id)}>
      <span className="ico nbadge">{ico}{badge ? <span className="dot">{badge > 9 ? '9+' : badge}</span> : null}</span>
      <span className="nlbl">{label} ▸</span>
    </button>
  )

  return (
    <div className={appClass} style={clubVars}>
      <header className="masthead">
        <div className="masthead-row">
          {nav.length > 1
            ? <button className="back-btn" onClick={back}>‹</button>
            : null}
          {/* named, not an inline style, so portrait can give it the whole width
              and drop the controls onto a second row - at 412px the back button,
              the moon and Matchday left the title about 200px and every club
              name and screen title arrived truncated */}
          <div className="mast-text">
            <h1>{cur.screen === 'home' ? (game.unemployed ? 'Unemployed' : club.name) : TITLES[cur.screen] ?? ''}</h1>
            {/* the real day, not the week's Saturday shown seven times. Continue
                walks Monday to Saturday now, so the date has to move with it. */}
            <div className="date">{dayLine(game).toUpperCase()} · {seasonLabel(game.season)} · Wk {game.week}</div>
          </div>
          {/* grouped, so portrait can drop both onto one row of their own and
              leave the first row to the back arrow, the title and the date */}
          <div className="mast-ctl">
            <button className="night-btn" onClick={toggleNight} aria-label="Toggle floodlit mode">
              {night ? <IcoSun /> : <IcoMoon />}
            </button>
            {/* One button, one label, one decision function. It used to read
                Matchday for the whole week of a match, so Monday's button
                promised a game that was five days away. */}
            {/* Not disabled while settling, deliberately: the main thread is busy
                for the whole settle so a disabled attribute never gets a chance to
                render. The guard is a debounce in continueWeek instead. */}
            <button className="continue-btn" onClick={continueWeek}>
              {nextStep(game).kind === 'match' ? 'Matchday ▸' : 'Continue ▸'}
            </button>
          </div>
        </div>
      </header>
      <main className="content">{screen()}</main>
      <nav className="bottom-nav">
        {/* The order the user asked for, top to bottom: news, home, the hub,
            the manager. World comes last because it is the only group that is
            about somebody else's club. */}
        {navBtn('inbox', <IcoInbox />, 'News', unread)}
        {navBtn('home', <IcoHome />, 'Home')}
        {game.unemployed ? (
          <>
            {/* openJobs, not vacancies.length: the same fix the Manager group badge
                got in 14B, and it matters more now that turning a job down takes it
                off the pile. A badge counting jobs that are no longer in the list is
                a red dot with nothing behind it. */}
            {navBtn('jobs', <IcoClipboard />, 'Jobs', openJobs)}
            {groupBtn('manager', <IcoPress />, 'Manager')}
            {groupBtn('world', <IcoTrophy />, 'World', wireUnread)}
          </>
        ) : (
          <>
            {groupBtn('hub', <IcoClipboard />, 'Hub', offersOpen + injuredCount)}
            {/* Vacancies the manager can still do something about, matching the Job
                Centre item's own count. Raw vacancies.length lit this dot because
                somebody somewhere had been sacked, and nothing he could do would
                clear it: the same bug the Job Centre item already fixed for itself,
                still living in the group badge above it. Reported as "says there is
                a notification but doesn't show anything". */}
            {groupBtn('manager', <IcoPress />, 'Manager', pressOpen + openJobs)}
            {groupBtn('world', <IcoTrophy />, 'World', wireUnread)}
          </>
        )}
      </nav>

      {menu && (
        <div className="submenu-veil" onClick={() => setMenu(null)}>
          <div className="submenu" onClick={e => e.stopPropagation()}>
            <div className="submenu-head">{MENUS[menu].title}</div>
            {/* ELEVEN ITEMS AND NO ORDER OF BUSINESS.
                The audit's read was that a new manager opens the Hub, finds
                eleven destinations and no clue which of them is a job this week.
                Its suggestion was to hide the bottom of the list until week four,
                and that is the wrong fix: pre-season is exactly when a manager
                wants the Transfer Centre, and a menu that grows behind your back
                is worse than a long one. So nothing is taken away. Three items
                are marked instead, for the same three weeks as the Home hint, and
                then the marks go. */}
            {menu === 'hub' && firstWeeks && (
              <div className="submenu-note">Before your first match, these three are the job.</div>
            )}
            {MENUS[menu].items.map(it => (
              <button key={it.label} className="submenu-item"
                onClick={() => { setMenu(null); if (it.action) it.action(); else go(it.screen) }}>
                <span className="mico">{it.ico}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {menu === 'hub' && firstWeeks && FIRST_JOBS.has(it.screen)
                  ? <span className="mstart">start here</span> : null}
                {it.badge ? <span className="mbadge">{it.badge > 9 ? '9+' : it.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      <Overlays />
    </div>
  )
}
