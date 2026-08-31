import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore, type Screen } from '../store'
import { celebrationHeadline, celebrationSub, seasonLabel } from '../game/model'
import { t } from '../game/i18n'
import { dayLine, deskBlock, deskGates, inInbox, nextStep, pressBlock } from '../game/days'
import { natSquadHold } from '../game/country'
import { tillOpen } from '../game/monetise'
import { IcoClipboard, IcoGlobe, IcoHome, IcoInbox, IcoPress, IcoTrophy } from './icons'
import { natWindow } from '../game/country'
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
import BugReport from './screens/BugReport'
import About from './screens/About'
import Supporter from './screens/Supporter'
import Jobs from './screens/Jobs'
import Wire from './screens/Wire'
import Medical from './screens/Medical'
import TeamReport from './screens/TeamReport'
import Profile from './screens/Profile'
import Saves from './screens/Saves'
import DayRoom from './screens/DayRoom'
import DrawRoom from './screens/DrawRoom'
import Annual from './screens/Annual'
import DreamTeam from './screens/DreamTeam'
import WeekResults from './screens/WeekResults'
import SeasonReview from './screens/SeasonReview'
import Agency from './screens/Agency'
import Country from './screens/Country'
import Infrastructure from './screens/Infrastructure'
import Academy from './screens/Academy'
import Tutorial from './Tutorial'

/* The masthead title for every screen that is not Home (Home shows the club).
 *
 * These are i18n keys rather than the strings themselves, because the map is
 * built once at module load and the language can change after that: a table of
 * English text would go stale the moment somebody used the picker on the title
 * screen. The keys and the English wording both live in src/locales/en.json. */
const TITLES: readonly string[] = [
  'home', 'inbox', 'offers', 'results', 'squad', 'agency', 'tactics', 'fixtures',
  'tables', 'transfers', 'training', 'finances', 'club', 'press', 'player',
  'nations', 'country', 'history', 'legacy', 'jobs', 'medical',
  'report', 'profile', 'saves', 'day', 'draw', 'annual',
  'dreamteam', 'wire', 'infra', 'handbook', 'bug', 'about', 'supporter',
]

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
        <b>{fails > 1 ? t('common.saveFailedN', { n: fails }) : t('common.saveFailed')}</b>{' '}
        {t('common.saveFailBody')} {msg ? <span className="save-warn-why">{msg}</span> : null}
      </div>
      <div className="save-warn-btns">
        <button className="btn tiny gold" onClick={() => void useStore.getState().persist()}>{t('common.tryAgain')}</button>
        <button className="btn tiny ghost" onClick={() => useStore.getState().dismissSaveFail()}>{t('common.hide')}</button>
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
          background: ['var(--gold-fill)', 'var(--info)', 'var(--prop-red)', 'var(--text-positive)', 'var(--primary-hover)'][i % 5],
        }} />
      ))}
      <div className="celebrate-box">
        <div style={{ fontSize: 64, lineHeight: 1 }}>{cel.icon}</div>
        {/* THE KEYS, and the English only when a save predates them. This was
            filed English-only and rendered raw, so the biggest moment the game
            has - promotion, a title, an unbeaten season - arrived in English
            for a manager who had chosen French. */}
        <h1>{celebrationHeadline(cel)}</h1>
        <div className="sub">{celebrationSub(cel)}</div>
        <div className="muted" style={{ marginTop: 14 }}>{t('common.partyOn')}</div>
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

/* There used to be a hard landscape lock here (screen.orientation, from the
 * same era as the departed sideways veil). In a browser tab the lock silently fails,
 * which is why nobody missed it; in exactly the installed contexts a store
 * package means, it would have WON, and opened the game sideways into the
 * layout the project stopped tuning. The release audit caught it
 * (docs/release-readiness.md, Part 1.2); the manifest's orientation is now
 * "any" to match, and scripts/shelllint.ts keeps a landscape lock from ever
 * coming back. */

/** Every font size in this UI is in px, so OS text scaling does nothing on its
 *  own (release audit, Part 2.3). This is the game's answer: a zoom on the
 *  document root, chosen on the title screen, persisted like night mode.
 *  Viewport-unit lengths are exempt from zoom by spec, so the app shell stays
 *  screen-sized while the type and controls inside it grow. */
function useTextScale() {
  const scale = useStore(s => s.textScale)
  useEffect(() => {
    try {
      const st = document.documentElement.style
      st.setProperty('zoom', String(scale))
      // read by theme.css to divide dvh-sized boxes back down to the real
      // viewport: zoom scales rendered dvh lengths along with everything else
      st.setProperty('--zoom', String(scale))
    } catch { /* very old engines */ }
  }, [scale])
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
  // subscribed, not read: t() is a plain function call, so without this the
  // tree would keep whatever language it was first painted in until something
  // else happened to re-render it
  useStore(s => s.lang)
  useStore(s => s.tick)
  const { back, go, home, continueWeek, toggleNight, openInbox } = useStore.getState()
  const [menu, setMenu] = useState<null | 'hub' | 'world' | 'manager'>(null)
  useTextScale()
  useResume()

  const cur = nav[nav.length - 1]
  const appClass = `app${night ? ' night' : ''}`

  // NO DESK, NO DESK SCREENS (19E). Resigning or getting sacked sets
  // unemployed but leaves the nav trail - and the resume-where feature
  // deliberately restores it - so the back arrow could walk a manager with no
  // job straight into his old club's Team and Fixtures pages, all still
  // wearing his ex-employer's data (user: "when ive resigned or fired from a
  // team i still see team information like fictures etc"). One guard at the
  // door: any club-desk screen redirects to the unemployed Home. World
  // screens stay open - the tables, other clubs, the scouting agency are
  // about the world, not his desk - and the day room stays because the
  // between-jobs week still walks through it.
  useEffect(() => {
    if (!game?.unemployed) return
    const DESK: Set<string> = new Set(['squad', 'report', 'tactics', 'academy',
      'training', 'medical', 'fixtures', 'finances', 'transfers', 'infra', 'matchday', 'offers'])
    if (DESK.has(cur.screen)) home()
  }, [game?.unemployed, cur.screen, home])

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
  const pressOpen = game.press.filter(p => !p.answered).length
  const offersOpen = game.offers.filter(o => o.status === 'pending' && o.forUser).length
  const openJobs = game.vacancies.filter(v => !v.passed && !v.applied).length
  // The Country button's badge is the one thing on that screen that is a JOB
  // this week: an open camp with places still to fill. A window that is open
  // and already full is not a red dot, it is a screen worth visiting.
  const campToDo = (() => {
    if (!game.natTeam) return 0
    const w = natWindow(game)
    if (!w) return 0
    return Math.max(0, w.size - (game.natSquads[game.natTeam]?.length ?? 0))
  })()
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

  // Home wears the club's own name, which is never translated; every other
  // screen wears its title from the dictionary.
  const mastheadTitle = cur.screen === 'home'
    ? (game.unemployed ? t('titles.unemployed') : club.name)
    : TITLES.includes(cur.screen) ? t(`titles.${cur.screen}`) : ''

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
      case 'bug': return <BugReport />
      case 'about': return <About />
      case 'supporter': return <Supporter />
      case 'jobs': return <Jobs />
      case 'wire': return <Wire />
      case 'medical': return <Medical />
      case 'report': return <TeamReport />
      case 'profile': return <Profile />
      case 'saves': return <Saves />
      case 'day': return <DayRoom />
      case 'draw': return <DrawRoom />
      case 'annual': return <Annual />
      case 'dreamteam': return <DreamTeam />
      case 'results': return <WeekResults param={cur.param as string} />
      case 'seasonreview': return <SeasonReview />
      case 'agency': return <Agency />
      case 'country': return <Country />
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
      title: t('groups.hub', { club: club.short }),
      // The user's own order, given as a list (13D). It groups the three squad
      // pages together at the top - the team, the report on it, the academy
      // feeding it - then the weekly work, then the money, then the bricks. Squad
      // is "Team" because the page is the whole team including the academy men,
      // and Academy loses "& A League" because the A League is a thing on that
      // page rather than a second destination.
      items: [
        // Team opens on the team sheet now (user: "Selection should be the
        // team section"), so the tactics screen is just Tactics - the how,
        // not the who.
        { ico: '🏉', label: t('groups.team'), screen: 'squad' },
        { ico: '📊', label: t('groups.teamReport'), screen: 'report' },
        { ico: '📋', label: t('groups.tactics'), screen: 'tactics' },
        { ico: '🎓', label: t('groups.academy'), screen: 'academy' },
        { ico: '🏋️', label: t('groups.trainingStaff'), screen: 'training' },
        { ico: '🏥', label: t('groups.medical'), screen: 'medical', badge: injuredCount },
        { ico: '📅', label: t('groups.fixturesResults'), screen: 'fixtures' },
        { ico: '💰', label: t('groups.finances'), screen: 'finances' },
        { ico: '🔁', label: t('groups.transfers'), screen: 'transfers', badge: offersOpen },
        { ico: '🏗️', label: t('groups.infra'), screen: 'infra' },
        { ico: '🏟️', label: t('groups.clubInfo'), screen: 'club' },
        // THE STORE HAD NO NAME ANYWHERE (owner, 27 Aug: "no shop showing").
        // Everything was reachable and nothing was findable: the door sat on
        // About & legal, under the manager's own menu, next to the privacy
        // policy - which is where a store REVIEWER looks for it and the last
        // place a player would. The Boardroom shelves were worse off again,
        // three taps down inside Finances. So the word the player is actually
        // looking for now exists, on the club's own menu, spelled Store.
        //
        // Gated on tillOpen() like every other purchase surface, which is what
        // keeps the web build honest: no bridge, no row, and the menu is the
        // same eleven items it has always been (storeprobe asserts exactly
        // this on a page with no bridge attached).
        ...(tillOpen() ? [{ ico: '🛒', label: t('groups.store'), screen: 'supporter' as Screen }] : []),
      ],
    },
    manager: {
      title: game.managerName,
      items: [
        { ico: '👤', label: t('groups.profile'), screen: 'profile' },
        // the manager is the one in front of the cameras, so the press room
        // belongs to him rather than to the team sheet
        { ico: '🎙️', label: t('groups.press'), screen: 'press', badge: pressOpen },
        // Only the jobs he has not answered. It used to be vacancies.length, so
        // the red dot appeared because somebody somewhere got sacked and nothing
        // he could do would clear it (see GameState.vacancies).
        { ico: '🕴️', label: t('groups.jobs'), screen: 'jobs', badge: game.vacancies.filter(v => !v.passed && !v.applied).length },
        { ico: '📜', label: t('groups.legacy'), screen: 'legacy' },
        { ico: '📖', label: t('groups.handbook'), screen: 'handbook' },
        { ico: '🐞', label: t('groups.bug'), screen: 'bug' },
        // what this is, who made it, and what it does with your data - the page
        // a store reviewer looks for and the page a player ends up on when they
        // want the privacy policy without leaving the game
        { ico: 'ℹ️', label: t('groups.about'), screen: 'about' },
        // dismissing the welcome dialog used to be final and irreversible
        { ico: '❓', label: t('groups.howToPlay'), screen: 'home', action: () => useStore.getState().openTut() },
        { ico: '💾', label: t('groups.saveLoad'), screen: 'saves' },
        // A reload now resumes the career where it was left, so a refresh is no
        // longer the way back to the title screen - and without a deliberate
        // route there, starting a second career would be impossible.
        { ico: '🚪', label: t('groups.mainMenu'), screen: 'menu', action: () => useStore.getState().toTitle() },
      ],
    },
    world: {
      title: t('groups.world'),
      items: [
        { ico: '🏆', label: t('groups.competitions'), screen: 'tables' },
        // the pinnacle gets a door of its own while you hold a Test job
        ...(game.natTeam ? [{ ico: '🌏', label: t('groups.country'), screen: 'country' as const }] : []),
        { ico: '🌍', label: t('groups.nations'), screen: 'nations' },
        { ico: '🏉', label: t('groups.dreamteam'), screen: 'dreamteam' },
        { ico: '🔭', label: t('groups.agency'), screen: 'agency' },
        { ico: '📜', label: t('groups.history'), screen: 'history' },
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
            <h1>{mastheadTitle}</h1>
            {/* the real day, not the week's Saturday shown seven times. Continue
                walks Monday to Saturday now, so the date has to move with it. */}
            <div className="date">{t('common.mastheadDate', { day: dayLine(game).toUpperCase(), season: seasonLabel(game.season), week: game.week })}</div>
          </div>
          {/* grouped, so portrait can drop both onto one row of their own and
              leave the first row to the back arrow, the title and the date */}
          <div className="mast-ctl">
            <button className="night-btn" onClick={toggleNight} aria-label={t('common.floodlitToggle')}>
              {night ? <IcoSun /> : <IcoMoon />}
            </button>
            {/* One button, one label, one decision function. It used to read
                Matchday for the whole week of a match, so Monday's button
                promised a game that was five days away. */}
            {/* Not disabled while settling, deliberately: the main thread is busy
                for the whole settle so a disabled attribute never gets a chance to
                render. The guard is a debounce in continueWeek instead. */}
            {/* THE ANNUAL HAS ITS OWN DOOR, AND ONLY ONE (Round 26, found by
                scripts/soakui.mjs: 60 taps without the week moving). While the
                between-seasons page is up, continueWeek early-returns - so this
                button sat there, in the place a thumb has pressed a thousand
                times, doing precisely nothing. A control that does nothing does
                not read as a gate; it reads as a frozen game.
                It is hidden rather than wired up, because wiring it up would
                hand the gate back its original problem: two quick taps at the
                end of a season would show the Annual and dismiss it in the same
                gesture, which is the accident the page exists to prevent. */}
            {cur.screen !== 'annual' && (() => {
              // THE LABEL READS THE GATE, so Continue never refuses in silence.
              // deskBlock is the one predicate: continueWeek acts on it and this
              // draws it, which is what stops a gated tap looking like a frozen
              // game - the failure this session has now fixed four times in
              // other shapes.
              const step = nextStep(game)
              // press holds on EVERY step now (v1.1.17), so the label has to
              // read it on every step too - a button that says Continue and
              // then refuses is the illegible gate all over again
              // three holds, one label. Press and squad apply on every step;
              // mail only on the way out of the week.
              const owed = natSquadHold(game)
              const desk = pressBlock(game)
                ?? (owed ? { kind: 'squad' as const, n: owed.n, label: t('dayroom.deskSquad', { n: owed.n }) } : null)
                ?? (deskGates(step) ? deskBlock(game) : null)
              return (
                <button className="continue-btn" onClick={continueWeek}
                  title={desk ? t('common.deskWaits') : undefined}>
                  {desk ? `${desk.label} ▸` : t(step.kind === 'match' ? 'common.matchdayBtn' : 'common.continueBtn')}
                </button>
              )
            })()}
          </div>
        </div>
      </header>
      <main className="content">{screen()}</main>
      <nav className="bottom-nav">
        {/* The order the user asked for, top to bottom: news, home, the hub,
            the manager. World comes last because it is the only group that is
            about somebody else's club. */}
        {navBtn('inbox', <IcoInbox />, t('nav.news'), unread)}
        {navBtn('home', <IcoHome />, t('nav.home'))}
        {game.unemployed ? (
          <>
            {/* openJobs, not vacancies.length: the same fix the Manager group badge
                got in 14B, and it matters more now that turning a job down takes it
                off the pile. A badge counting jobs that are no longer in the list is
                a red dot with nothing behind it. */}
            {navBtn('jobs', <IcoClipboard />, t('nav.jobs'), openJobs)}
            {groupBtn('manager', <IcoPress />, t('nav.manager'))}
            {groupBtn('world', <IcoTrophy />, t('nav.world'))}
          </>
        ) : (
          <>
            {groupBtn('hub', <IcoClipboard />, t('nav.hub'), offersOpen + injuredCount)}
            {/* THE COUNTRY DESK IS A JOB, SO IT IS A BUTTON (owner: "i thought
                we were adding international coach as a new button on the
                bottom when in charge? and remove when not? needs to be more of
                an option and clearer"). It appears the moment a Test job is
                held and disappears with it - a national side is the pinnacle
                of the career and it was three taps down inside a submenu. The
                badge is the one thing on that screen that is a job this week:
                an open camp with names still to call. */}
            {game.natTeam && navBtn('country', <IcoGlobe />, t('nav.country'), campToDo)}
            {/* Vacancies the manager can still do something about, matching the Job
                Centre item's own count. Raw vacancies.length lit this dot because
                somebody somewhere had been sacked, and nothing he could do would
                clear it: the same bug the Job Centre item already fixed for itself,
                still living in the group badge above it. Reported as "says there is
                a notification but doesn't show anything". */}
            {groupBtn('manager', <IcoPress />, t('nav.manager'), pressOpen + openJobs)}
            {groupBtn('world', <IcoTrophy />, t('nav.world'))}
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
              <div className="submenu-note">{t('groups.firstJobs')}</div>
            )}
            {MENUS[menu].items.map(it => (
              <button key={it.label} className="submenu-item"
                onClick={() => { setMenu(null); if (it.action) it.action(); else go(it.screen) }}>
                <span className="mico">{it.ico}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {menu === 'hub' && firstWeeks && FIRST_JOBS.has(it.screen)
                  ? <span className="mstart">{t('groups.startHere')}</span> : null}
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
