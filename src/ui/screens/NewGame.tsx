import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { CHALLENGES, LEAGUE_DEFS, mediaVerdict } from '../../game/newgame'
import { dreamsFor, type DreamContext } from '../../game/dream'
import { COACHING_STYLES } from '../../game/tactics'
import type { RawClub } from '../../data/types'
import { Crest, Jersey } from '../components'
import { playerValue } from '../../game/attributes'
import { fmtMoney } from '../../game/model'

// FM Mobile-style guided setup: STEP x OF 4, breadcrumbs, tile grids,
// a club detail panel, and a persistent bottom action bar.

const STEPS = ['Competition', 'Club', 'Manager', 'Summary']

const finances = (budget: number) =>
  budget >= 4_000_000 ? ['Rich', 'var(--text-positive)']
    : budget >= 2_000_000 ? ['Secure', 'var(--text-positive)']
    : budget >= 1_000_000 ? ['Okay', 'var(--border-strong)']
    : ['Tight', 'var(--danger)']

// judged inside the club's own league (mediaVerdict) - absolute reputation
// thresholds branded every English National One club "Relegation-zone rated",
// in a division that has no relegation

export default function NewGame() {
  const start = useStore(s => s.start)
  const back = useStore(s => s.back)
  const defs = useMemo(() => LEAGUE_DEFS(), [])
  const [step, setStep] = useState(0)
  const [leagueIdx, setLeagueIdx] = useState<number | null>(null)
  const [clubId, setClubId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [styleId, setStyleId] = useState('balanced')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [dreamId, setDreamId] = useState<string | null>(null)

  const league = leagueIdx != null ? defs[leagueIdx] : null
  const club: RawClub | null = clubId
    ? defs.flatMap(d => d.clubs).find(c => c.id === clubId) ?? null
    : null
  const challenge = challengeId ? CHALLENGES.find(c => c.id === challengeId) : null

  /* THE DREAM (design review, wave 1): the last thing the wizard asks is the
     only thing it asks about YOU. What is offered depends on the club - a
     Championship side can dream of the top flight and a Premier Division side
     cannot - and the choice is required, because a career with no declared
     ambition is the exact hole this was built to close. */
  const dreamCtx: DreamContext | null = club && league
    ? { clubId: club.id, clubName: club.short ?? club.name, leagueId: league.id, rep: club.rep }
    : null
  const dreams = dreamCtx ? dreamsFor(dreamCtx) : []
  /* The first dream that applies is pre-selected rather than left blank: a
     required tap here would block the one button the whole wizard exists to
     reach, and a career with no ambition at all is the hole this closes. The
     default is club-appropriate (a Championship side is offered promotion
     first) and the tiles sit right under it, so changing it is one tap. */
  const dream = dreamId ?? dreams[0]?.id ?? null

  const pickChallenge = (id: string) => {
    const ch = CHALLENGES.find(c => c.id === id)!
    const li = defs.findIndex(d => d.clubs.some(c => c.id === ch.clubId))
    setChallengeId(id)
    setLeagueIdx(li)
    setClubId(ch.clubId)
    setStep(2)
  }

  const canNext = step === 0 ? leagueIdx != null : step === 1 ? clubId != null : step === 2 ? name.trim().length > 0 : true

  /* A GREYED BUTTON HAS TO SAY WHAT IT WANTS.
   *
   * Found by scripts/strangerpath.mjs, which walks the new-career path pressing
   * only the most obvious control on each screen and reports every point a
   * stranger would stall. On all three gated steps the forward button was
   * `disabled` with no title, no label and no message anywhere on the screen -
   * so a new player who scrolled past the name field met a dead Confirm on step
   * 3 of 4 with nothing telling them why. A gate is fine. A silent gate is
   * indistinguishable from a frozen game, and this one sits in the first minute
   * of the first session. */
  const needed = canNext ? null
    : step === 0 ? 'Pick a competition to carry on.'
    : step === 1 ? 'Pick the club you want to manage.'
    : 'Enter your name to carry on.'

  const next = () => {
    if (step < 3) { setStep(step + 1); return }
    if (!club) return
    // The origin tiles (18B's "Your Story") were cut at the user's request:
    // "this feature isnt too much of interest". Every career takes the
    // engine's default coach background.
    start(club.id, name.trim(), challengeId ?? undefined)
    // coaching philosophy shapes your starting game plan
    const g = useStore.getState().game
    const chosen = COACHING_STYLES.find(s => s.id === styleId)
    if (g && chosen) {
      Object.assign(g.clubs[g.userClubId].tactic, chosen.tactic)
    }
    // the ambition is stamped on the save the moment the career begins, and
    // never moves again: it is what this save is FOR
    if (g && dream) g.dream = { id: dream, clubId: g.userClubId, season: g.season }
  }
  const prev = () => {
    if (step === 0) { back(); return }
    if (challengeId && step === 2) { setChallengeId(null); setClubId(null); setLeagueIdx(null); setStep(0); return }
    setStep(step - 1)
  }

  const starPlayer = club ? [...club.players].sort((a, b) => b.q - a.q)[0] : null

  return (
    <>
      {/* The four steps used to sit on their own row under the title, and on a
          landscape phone that row cost the league list an entry - three leagues
          showed and the fourth was cut off by the action bar. Landscape now runs
          them alongside the title instead, where there was nothing but space.
          The step number drops the step NAME with them: the lit crumb says it. */}
      <header className="masthead wizard-head">
        <div className="masthead-row">
          <button className="back-btn" onClick={prev}>‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>New Career</h1>
            <div className="date">Step {step + 1} of 4<span className="step-name"> · {STEPS[step]}</span></div>
          </div>
          <div className="step-meter"><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        </div>
        {/* ---- the trail is what you have CHOSEN, not where you are ----
            It used to be four equal crumbs holding two different kinds of thing:
            the league and club you had picked, then the words MANAGER and
            SUMMARY, which are step names the line above already gives you. Four
            crumbs on 412px is about 76px each once the arrow notches are cut off
            them, and "Northampton" does not fit in 76px - so the one crumb
            carrying information you cannot get anywhere else was the one being
            truncated (user: "the team name dissapears at the top ... maybe remove
            the words manager from the list as not sure its needed. the step is").

            So the step names are gone. Step 3 of 4 - Manager and the meter beside
            it say where you are; these say what you have decided, and there are
            never more than three of them, which is what gives the club its room.
            Each one steps back to the screen that set it. */}
        {(() => {
          const trail = [
            league ? { label: league.short, at: 0 } : null,
            club ? { label: club.short, at: 1 } : null,
            name.trim() ? { label: name.trim(), at: 2 } : null,
          ].filter((x): x is { label: string; at: number } => !!x)
          if (!trail.length) return null
          return (
            <div className="crumbs">
              {trail.map((c, i) => (
                <span key={c.at} className={`crumb${i === trail.length - 1 ? ' on' : ' done'}`}
                  onClick={() => setStep(c.at)}>
                  {c.label}
                </span>
              ))}
            </div>
          )
        })()}
      </header>

      <main className="content" style={{ paddingBottom: 150 }}>
        {step === 0 && (
          <>
            {/* compact rows, not tiles: every league and challenge on one
                screen with no scrolling (8-batch feedback) */}
            <div className="wizard-hint">Choose the competition you'll manage in.</div>
            <div style={{ padding: '0 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6 }}>
              {defs.map((d, i) => (
                <button key={d.id} className={`club-pick${leagueIdx === i ? ' sel' : ''}`} style={{ margin: 0 }}
                  onClick={() => { setLeagueIdx(i); setClubId(null); setStep(1) }}>
                  <span style={{ fontSize: 15 }}>🏆</span>
                  <span className="cname">{d.name}</span>
                  <span className="muted">{d.clubs.length} clubs</span>
                </button>
              ))}
            </div>
            <div className="wizard-hint" style={{ marginTop: 10 }}>…or take on a Challenge.</div>
            <div style={{ padding: '0 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 6 }}>
              {CHALLENGES.map(ch => {
                const chClub = defs.flatMap(d => d.clubs).find(c => c.id === ch.clubId)
                return (
                  <button key={ch.id} className="card challenge-card" style={{ margin: 0 }} onClick={() => pickChallenge(ch.id)}>
                    {chClub && <Crest club={chClub} size={28} mr={10} />}
                    <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <b style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--text-primary)' }}>{ch.title}</b>
                      <span className="meta" style={{ fontSize: 11.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ch.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 1 && league && (
          <>
            {/* No hint line here. The breadcrumb above already reads
                PREMIERSHIP > CLUB, so the sentence was 38px of a content area
                that is only about 160px tall once the browser's own toolbar and
                the action bar have taken their share - which is what clipped the
                second row of clubs and made the step look broken. */}
            {/* the badges and the club's card sit side by side in landscape:
                stacked, picking a club pushed its own detail below the fold */}
            {/* The split only exists once there is something to put in the other
                half. Before that it reserved the right-hand column anyway, so the
                badges were crushed into four columns down the left with half the
                screen blank - which is why a ten-club league needed a scroll and
                why "Northampton" came out as "Northamp...". */}
            <div className={club ? 'wiz-split' : ''}>
            <div className={`tile-grid club-tiles${club ? '' : ' wide'}`}>
              {[...league.clubs].sort((a, b) => b.rep - a.rep).map(c => (
                <button key={c.id} className={`tile club-tile${clubId === c.id ? ' sel' : ''}`}
                  style={{ '--c1': c.colors[0], '--c2': c.colors[1] } as React.CSSProperties}
                  onClick={() => setClubId(c.id)}>
                  <Crest club={c} size={34} mr={0} />
                  <b>{c.short}</b>
                </button>
              ))}
            </div>
            {club && (
              <div className="card detail-panel">
                <div className="club-banner" style={{ background: club.colors[0], color: 'var(--prop-ink)' }}>
                  <Crest club={club} size={22} mr={8} />
                  <span style={{ flex: 1 }}>{club.name}</span>
                  <Jersey club={club} size={46} />
                </div>
                <div className="fact-grid">
                  <div><label>Reputation</label><span style={{ color: 'var(--gold)' }}>{'★'.repeat(Math.max(1, Math.round(club.rep / 20)))}<span style={{ opacity: .3 }}>{'★'.repeat(5 - Math.max(1, Math.round(club.rep / 20)))}</span></span></div>
                  <div><label>Finances</label><span style={{ color: finances(club.budget)[1], fontWeight: 700 }}>{finances(club.budget)[0]}</span></div>
                  <div><label>Star Player</label><span>⭐ {starPlayer?.name}</span></div>
                  <div><label>Stadium</label><span>{club.stadium} · {club.capacity.toLocaleString()}</span></div>
                  <div><label>Media Verdict</label><span>{mediaVerdict(club, league ?? defs.find(d => d.clubs.some(c => c.id === club.id))!)}</span></div>
                  <div><label>Transfer Budget</label><span>£{(club.budget / 1e6).toFixed(1)}m</span></div>
                  <div><label>Squad Value</label><span>{fmtMoney(club.players.reduce((s, p) => s + playerValue(p.q, p.age, p.q), 0))}</span></div>
                  <div><label>Squad Size</label><span>{club.players.length}</span></div>
                </div>
              </div>
            )}
            </div>
          </>
        )}

        {step === 2 && club && (
          <>
            <div className="wizard-hint">Your manager profile at {club.name}.</div>
            {challenge && (
              <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                <h3 style={{ fontSize: 15 }}>Challenge accepted: {challenge.title}</h3>
                <div className="meta">{challenge.desc}</div>
              </div>
            )}
            {/* the name field and the philosophy tiles were one 385px card, so
                the tiles at the bottom of it sat below the fold on a phone */}
            <div className="wiz-split narrow-left">
            <div className="card">
              <label className="fact-label">Your Name</label>
              <input className="inline-input" placeholder="e.g. A. Gaffer"
                value={name} onChange={e => setName(e.target.value)}
                onFocus={e => {
                  // keep the field visible above the software keyboard
                  const el = e.target
                  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
                }} />
              <label className="fact-label" style={{ marginTop: 10, display: 'block' }}>Club</label>
              <div className="meta">{club.name} · {league?.name}</div>
            </div>
            <div className="card">
              <label className="fact-label">Coaching Philosophy</label>
              <div className="speech-grid" style={{ padding: '6px 0 0' }}>
                {COACHING_STYLES.map(s => (
                  <button key={s.id} className={`speech-tile${styleId === s.id ? ' sel' : ''}`}
                    onClick={() => setStyleId(s.id)}>
                    <b>{s.name}</b>
                    <span className="d">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            </div>
          </>
        )}

        {step === 3 && club && league && (
          <>
            <div className="wizard-hint">Everything set. One tap from the dugout.</div>
            <div className="card detail-panel">
              <div className="club-banner" style={{ background: club.colors[0], color: 'var(--prop-ink)' }}>
                <Crest club={club} size={22} mr={8} />{club.name}
              </div>
              <div className="fact-grid">
                <div><label>Manager</label><span>{name.trim()}</span></div>
                <div><label>Competition</label><span>{league.name}</span></div>
                <div><label>Philosophy</label><span>{COACHING_STYLES.find(s => s.id === styleId)?.name}</span></div>
                <div><label>Season</label><span>2025-26</span></div>
                {challenge && <div><label>Challenge</label><span>{challenge.title}</span></div>}
                <div><label>Board Objective</label><span>{club.rep >= 87 ? 'Win the title' : club.rep >= 80 ? 'Reach the playoffs' : club.rep >= 72 ? 'Top half' : 'Avoid the bottom two'}</span></div>
              </div>
            </div>
            <div className="card">
              <label className="fact-label">Your Dream</label>
              <div className="meta" style={{ marginBottom: 2 }}>
                The board sets the season. You set the career - tap the one thing that would make this save worth finishing.
              </div>
              <div className="speech-grid" style={{ padding: '6px 0 0' }}>
                {dreams.map(d => (
                  <button key={d.id} className={`speech-tile${dream === d.id ? ' sel' : ''}`}
                    onClick={() => setDreamId(d.id)}>
                    <b>{d.title(dreamCtx!)}</b>
                    <span className="d">{d.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <div className="action-bar wiz-bar">
        {needed && <div className="wiz-need">{needed}</div>}
        <button className="btn ghost" onClick={prev}>{step === 0 ? 'Main Menu' : 'Back'}</button>
        <button className="btn gold" style={{ flex: 1.6, fontSize: 15 }} disabled={!canNext} onClick={next}
          title={needed ?? undefined}>
          {step === 3 ? '▸ Start Career' : 'Confirm'}
        </button>
      </div>
    </>
  )
}
