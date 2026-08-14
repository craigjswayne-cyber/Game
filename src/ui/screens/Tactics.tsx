import { useState } from 'react'
import { useStore } from '../../store'
import { XV_SLOTS, type Player } from '../../game/model'
import { DEF_SLIDER_INFO, PRESETS, SLIDER_INFO, defSliderReadout, sliderReadout } from '../../game/tactics'
import { ROLE_BY_ID, rolesForSlot } from '../../game/roles'
import { PosBadge, SectionTitle } from '../components'
import { analystForm, analystRead, PREP_LABEL, UNIT_LABEL } from '../../game/analyst'
import { assistantAdvice } from '../../game/analysis'
import { userFixtureThisWeek } from '../../game/season'
import { counterTo, dialLine, philosophyOf } from '../../game/philosophy'
import { ROUTINES, DEFAULT_LINEOUT, DEFAULT_SCRUM, routineEffect } from '../../game/playbook'
import { BRIEFS, SPLITS, actualSplit, benchFrontRow, benchSeats, briefForSeat, refillBench, splitFor, type BenchSplit, type Brief } from '../../game/bench'

/** The Tactics screen: HOW the side plays. Roles on a pitch, the set-piece
 *  playbook, the bench shape, the week's preparation and the game plan.
 *
 *  WHO plays moved out (user: "Selection should be the team section and
 *  replace overview... The other tab should be called tactics"): the team
 *  sheet is the Team screen's opening tab now (screens/Selection.tsx), and
 *  this screen dropped both the Selection tab and the "& Tactics" half of its
 *  old name. */
export default function Tactics() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [ttab, setTtab] = useState<'tactics' | 'setp' | 'bench' | 'prep' | 'plan'>('tactics')
  const [roleSlot, setRoleSlot] = useState<number | null>(null)

  const club = game.clubs[game.userClubId]
  const t = club.tactic

  // the bench seats depend on the split the manager named (F4)
  const seats = benchSeats(club)

  const slider = (info: typeof SLIDER_INFO[number]) => (
    <div className="slider-row" key={info.key}>
      <div className="lbls"><span>{info.lo}</span><b style={{ color: 'var(--accent-ink)' }}>{info.label}</b><span>{info.hi}</span></div>
      <input type="range" min={0} max={100} value={t[info.key]}
        onChange={e => { t[info.key] = Number(e.target.value); touch() }} />
      <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{sliderReadout(info.key, t[info.key])}</div>
    </div>
  )

  // The without-ball dials (18D). Same row shell, but these live off the
  // preset system and default to 50 when a save predates them.
  const defSlider = (info: typeof DEF_SLIDER_INFO[number]) => (
    <div className="slider-row" key={info.key}>
      <div className="lbls"><span>{info.lo}</span><b style={{ color: 'var(--accent-ink)' }}>{info.label}</b><span>{info.hi}</span></div>
      <input type="range" min={0} max={100} value={t[info.key] ?? 50}
        onChange={e => { t[info.key] = Number(e.target.value); touch() }} />
      <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{defSliderReadout(info.key, t[info.key] ?? 50)}</div>
    </div>
  )

  // The canonical layout is a vertical half-pitch: x across, y up the field.
  // Landscape swaps the axes in CSS (see .form-chip in theme.css) because a
  // vertical pitch on an 844x390 phone filled the entire screenful and pushed
  // every slider on the page below the fold. The numbers stay in one orientation
  // so there is only ever one formation to reason about.
  // Re-spaced because the chips overlapped on a portrait phone (user: "tactics
  // screen the formation is squashed"). A chip is a fixed 74px wide there, which
  // is 19% of the pitch, so two chips on the same line need 20% of x between
  // them and two chips in the same column need 9% of y. The old pairs that
  // failed both tests were tighthead/hooker (20% apart, and Rakete-Stones is a
  // wide name) and the two centres (14% and 7%). Every pair below clears both.
  // The back line reads as an attack shape: 10 flattest, the centres one deeper
  // each, the WINGS deeper and wider than both, fullback last. It used to put
  // the right wing at y=60 - shallower than either centre - so 14 floated above
  // 13 on the chart (user: "the right wing should be below the outside centre").
  // No real backline stands with a wing in front of his centres.
  // The hooker sat at y=7, two points above his props, and with Roles now the
  // screen's opening tab the tap probe finally measured him: the chip's top
  // third hid under the sticky tab bar and his hit area read 26px. A front row
  // stands level anyway.
  const SPOTS: [number, number][] = [
    [22, 9], [50, 9], [78, 9],
    [36, 20], [64, 20],
    [14, 32], [86, 32], [50, 33],
    [50, 46], [30, 57],
    [12, 78], [46, 64], [66, 72], [88, 80], [50, 90],
  ]
  const go = useStore.getState().go
  const roleSheet = () => {
    if (roleSlot == null) return null
    const pid = t.lineup[roleSlot]
    const p = pid != null ? game.players[pid] : null
    const roles = rolesForSlot(roleSlot)
    const current = t.roles?.[roleSlot] ?? null
    return (
      <div className="modal-veil" onClick={() => setRoleSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <div style={{ padding: '0 14px 10px' }}>
            <SectionTitle sub={`No. ${XV_SLOTS[roleSlot].shirt} · how should he play the position? · ${roles.length + 1} options`}>
              {p ? p.name : 'Empty slot'}
            </SectionTitle>
            <button className="club-pick" onClick={() => { (t.roles ??= [])[roleSlot] = null; setRoleSlot(null); touch() }}>
              <span style={{ fontSize: 16 }}>{current == null ? '●' : '○'}</span>
              <span className="cname">Natural</span>
              <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>No special instruction.</span>
            </button>
            {roles.map(r => (
              <button key={r.id} className="club-pick" onClick={() => { (t.roles ??= [])[roleSlot] = r.id; setRoleSlot(null); touch() }}>
                <span style={{ fontSize: 16 }}>{current === r.id ? '●' : '○'}</span>
                <span className="cname">{r.name}</span>
                <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>{r.desc}</span>
              </button>
            ))}
            {p && (
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => { setRoleSlot(null); go('player', p.id) }}>
                Open {p.name.split(' ').slice(-1)[0]}'s profile ›
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="tab-bar">
        {/* named for what is on it: role chips on a pitch (user: "change the
            tactics to roles") */}
        <button className={ttab === 'tactics' ? 'active' : ''} onClick={() => setTtab('tactics')}>Roles</button>
        <button className={ttab === 'setp' ? 'active' : ''} onClick={() => setTtab('setp')}>Set Piece</button>
        <button className={ttab === 'bench' ? 'active' : ''} onClick={() => setTtab('bench')}>Bench</button>
        <button className={ttab === 'prep' ? 'active' : ''} onClick={() => setTtab('prep')}>Prep</button>
        <button className={ttab === 'plan' ? 'active' : ''} onClick={() => setTtab('plan')}>Game Plan</button>
      </div>

      {ttab === 'tactics' && <>
        <div className="form-pitch">
          {SPOTS.map(([x, y], i) => {
            const pid = t.lineup[i]
            const p = pid != null ? game.players[pid] : null
            const role = t.roles?.[i] != null ? ROLE_BY_ID[t.roles![i]!] : null
            return (
              <button key={i} className="form-chip"
                style={{ '--fx': `${x}%`, '--fy': `${y}%` } as React.CSSProperties}
                onClick={() => setRoleSlot(i)}>
                <span className="fc-role">{role ? role.short : XV_SLOTS[i].pos}</span>
                <span className="fc-name">{p ? p.name.split(' ').slice(-1)[0] : '-'}</span>
                <span className="fc-num">{XV_SLOTS[i].shirt}</span>
              </button>
            )
          })}
        </div>
        <div className="meta" style={{ padding: '4px 16px' }}>
          Tap a shirt to set his role or open his profile. Roles are small, honest edges - the scrummager props up the set piece, the playmaker opens the game.
        </div>
      </>}

      {ttab === 'setp' && <>
        {/* ---- four questions, in the order a coach asks them ----
            This page had six blocks, two long explainer paragraphs and a stat
            line on every tile reading "62% drilled · called 4x this season ·
            worth +3%" (user: "set piece page feels too confusing - simplify").
            Three of those numbers say the same thing, so each tile now carries
            one: how well drilled the move is, and what that is worth today. The
            explainers are gone and the page states its own rule once, at the
            top. */}
        <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
          <div className="meta">
            <b>One rule runs this page.</b> Whatever you call gets sharper every week and everything
            else goes rusty, so pick moves you mean to keep calling. Set-Piece Work in Prep speeds it
            up and your scrum coach sets the ceiling.
          </div>
        </div>
        {([['lineout', 'Lineout Call', DEFAULT_LINEOUT, 'lineoutCall'],
           ['scrum', 'Scrum Call', DEFAULT_SCRUM, 'scrumCall']] as const).map(([kind, heading, dflt, key]) => (
          <div key={kind}>
            <SectionTitle>{heading}</SectionTitle>
            <div className="routine-grid">
              {ROUTINES.filter(r => r.kind === kind).map(r => {
                const on = (t[key] ?? dflt) === r.id
                const e = routineEffect(club, r.id)
                return (
                  <button key={r.id} className={`speech-tile${on ? ' sel' : ''}`}
                    onClick={() => { t[key] = r.id; touch() }}>
                    <b>{r.name}</b>
                    <span className="d">{r.desc}</span>
                    <span className="rt-bar"><i style={{ width: `${e.drilled}%` }} /></span>
                    <span className="d">
                      {Math.round(e.drilled)}% drilled
                      {e.mult >= 1.02 ? `, worth +${Math.round((e.mult - 1) * 100)}%`
                        : e.mult <= 0.98 ? `, costing ${Math.round((1 - e.mult) * 100)}%` : ', about level'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <SectionTitle>Goal Kickers</SectionTitle>
        <div className="card">
          {[0, 1].map(slot => {
            const cur = (t.kickers ?? [])[slot] ?? null
            const xv = t.lineup.slice(0, 15).map(id => id != null ? game.players[id] : null).filter((p): p is Player => !!p)
            return (
              <div key={slot} className="lead-row">
                <span className="fact-label">{slot === 0 ? 'First' : 'Second'}</span>
                <select className="inline-input" value={cur ?? ''}
                  onChange={ev => {
                    const v = ev.target.value === '' ? null : Number(ev.target.value)
                    const ks = [...(t.kickers ?? [null, null])]
                    ks[slot] = v
                    t.kickers = ks
                    touch()
                  }}>
                  <option value="">Assistant picks</option>
                  {[...xv].sort((a, b) => b.a.goa - a.a.goa).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.pos}) - goal kicking {p.a.goa}</option>
                  ))}
                </select>
              </div>
            )
          })}
          <div className="meta" style={{ marginTop: 5 }}>First choice takes everything; the second man steps up when he is off.</div>
        </div>

        <SectionTitle>Getting Out Of Your 22</SectionTitle>
        <div className="card">
          <div className="opt-2x2">
            {([
              ['box', '📦 Box Kick'],
              ['long', '🦶 Long Kick'],
              ['counter', '🏃 Run It'],
              ['fifty22', '🎯 50:22'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`preset-chip${(t.exit ?? 'long') === id ? ' on' : ''}`}
                onClick={() => { t.exit = id; touch() }}>{label}</button>
            ))}
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            {({
              box: 'Safest way out, and it hands the ball back.',
              long: 'Field position first. Solid and hard to punish.',
              counter: 'You keep the ball and take the risk in your own half.',
              fifty22: 'Huge if the boot is accurate, a gift if it is not.',
            })[t.exit ?? 'long']}
          </div>
        </div>

        <SectionTitle>Kickable Penalty</SectionTitle>
        <div className="card">
          <div className="opt-2x2">
            {([
              ['ask', '🤔 Ask Me'],
              ['posts', '🥅 Take Points'],
              ['corner', '🚩 To the Corner'],
              ['tap', '⚡ Tap and Go'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`preset-chip${(t.penaltyCall ?? 'ask') === id ? ' on' : ''}`}
                onClick={() => { t.penaltyCall = id; touch() }}>{label}</button>
            ))}
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            {({
              ask: 'You get asked every time. Fine for a big game, tiring on a wet Friday.',
              posts: 'Three points, every time. No drama and no big scores.',
              corner: 'Back the maul. Tries win knockouts.',
              tap: 'Play before they set. Chaos, in both directions.',
            })[t.penaltyCall ?? 'ask']}
          </div>
        </div>
        <div className="spacer" />
      </>}


      {ttab === 'bench' && <>
        {/* The bench economy (F4). Eight replacements used to be eight fixed
            seats whose only job was replacing tired men. A modern 23 is an
            argument about the last twenty minutes, so it is a page. */}
        {(() => {
          const want = splitFor(club)
          const got = actualSplit(game, club)
          const legal = benchFrontRow(game, club)
          if (legal && want === got) return null
          return (
            <div className="card" style={{ borderLeft: `4px solid ${legal ? 'var(--gold)' : 'var(--red)'}` }}>
              <div className="meta">
                {!legal && <b style={{ color: 'var(--red)' }}>No front-row cover on the bench. </b>}
                {!legal
                  ? 'Law 3 says the scrum goes uncontested if either side cannot cover hooker and both props, and both teams lose the weapon. The 16, 17 and 18 shirts exist for exactly this.'
                  : `You named a ${SPLITS.find(x => x.id === want)?.name.toLowerCase()}, and the men in the shirts make it a ${SPLITS.find(x => x.id === got)?.name.toLowerCase()}. The bench you actually pick is the one that plays.`}
              </div>
            </div>
          )
        })()}
        <SectionTitle sub="the first three shirts cover the front row - the rest is yours">The 23</SectionTitle>
        <div className="routine-grid">
          {SPLITS.map(sp => {
            const on = splitFor(club) === sp.id
            const fw = sp.seats.filter(x => ['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(x.pos[0])).length
            return (
              <button key={sp.id} className={`speech-tile${on ? ' sel' : ''}`}
                onClick={() => {
                  t.bench = sp.id as BenchSplit
                  // the seats changed shape, so the men in them are re-chosen
                  refillBench(game, club)
                  touch()
                }}>
                <b>{sp.name}</b>
                <span className="d">{sp.desc}</span>
                <span className="d">{fw} forwards, {8 - fw} backs on the bench</span>
              </button>
            )
          })}
        </div>
        <SectionTitle sub="the first three briefs to come on are the ones that land">Finisher Briefs</SectionTitle>
        <div className="brief-list">
          {seats.map((seat, i) => {
            const pid = t.lineup[15 + i]
            const p = pid != null ? game.players[pid] : null
            const cur = briefForSeat(club, i)
            return (
              <div className="brief-row" key={i}>
                <div className="brief-who">
                  <span className="num">{seat.shirt}</span>
                  <PosBadge pos={seat.pos[0]} />
                  <span className="nm">{p ? p.name : <span className="muted">- empty seat -</span>}</span>
                </div>
                <div className="preset-row">
                  {BRIEFS.map(b => (
                    <button key={b.id} className={`preset-chip${cur === b.id ? ' on' : ''}`} title={b.desc}
                      onClick={() => {
                        const arr = [...(t.briefs ?? new Array(8).fill(null))]
                        while (arr.length < 8) arr.push(null)
                        arr[i] = b.id as Brief
                        t.briefs = arr
                        touch()
                      }}>{b.icon} {b.short}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="spacer" />
      </>}

      {ttab === 'prep' && <>
        <AnalystCard />
        <SectionTitle sub="an edge next week, always with a cost">Match Preparation</SectionTitle>
        <div className="preset-row" style={{ padding: '0 14px', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['attack', '⚡ Attacking Shapes', 'Sharper attack (−1% defence)'],
            ['defence', '🛡 Defensive Drills', 'Meaner defence (−1% attack)'],
            ['setpiece', '🏗 Set-Piece Work', 'Scrum & lineout +4% (−1% attack)'],
            ['fitness', '🏃 Conditioning', 'Legs last longer on matchday'],
            ['recovery', '🧖 Recovery Week', 'Squad regains extra fitness this week'],
          ] as const).map(([k, label, desc]) => (
            <button key={k} className="preset-chip" title={desc}
              style={game.matchPrep === k ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
              onClick={() => { game.matchPrep = game.matchPrep === k ? undefined : k; touch() }}>
              {label}
            </button>
          ))}
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <div className="meta">
            {game.matchPrep ? {
              attack: 'The week is spent on strike moves and width. Attack +3.5%, defence −1%.',
              defence: 'Wall-building: line speed, spacing, scramble. Defence +3.5%, attack −1%.',
              setpiece: 'Live scrummaging and lineout reps. Scrum & lineout +4%, attack −1%.',
              fitness: 'Lung-busters. Your players tire ~8% slower in the next match.',
              recovery: 'Feet up, pool sessions, massage. Everyone recovers extra condition this week.',
            }[game.matchPrep] : 'No focus set this week - training runs on autopilot. Pick one above; every choice trades something away.'}
          </div>
        </div>
      </>}

      {ttab === 'plan' && <>
        <div className="card" style={{ marginTop: 4, borderLeft: '4px solid var(--stripe)' }}>
          <div className="meta">{assistantAdvice(game)}</div>
        </div>
        {/* F23: the opposition dugout has a standing instruction now, so the game
            plan tab is the place to answer it. Reading how they play is free;
            what to do about it is the assistant's job, and it is advice rather
            than an answer - he cannot see whether you have the pack to back it. */}
        {(() => {
          const fx = userFixtureThisWeek(game)
          if (!fx) return null
          const oppId = fx.homeId === game.userClubId ? fx.awayId : fx.homeId
          const opp = game.clubs[oppId]
          const ph = philosophyOf(opp)
          const ctr = counterTo(opp?.philosophy)
          if (!ph || !ctr) return null
          return (
            <>
              <SectionTitle sub={`${opp.short} play ${ph.name.toLowerCase()}`}>Answering Them</SectionTitle>
              <div className="card">
                <div className="meta"><b>{ph.name}.</b> {ph.blurb}</div>
                <div className="meta muted">{dialLine(opp.tactic)}</div>
                <div className="meta" style={{ marginTop: 6 }}>
                  <b>Assistant:</b> {ctr.line}
                </div>
                <button className="btn gold block tiny" style={{ marginTop: 6 }}
                  onClick={() => { Object.assign(t, ctr.dials); touch() }}>
                  Set the counter plan
                </button>
              </div>
            </>
          )
        })()}
        <SectionTitle sub="one tap sets all four sliders">Quick Game Plans</SectionTitle>
        <div className="preset-row" style={{ padding: '0 14px' }}>
          {PRESETS.map(p => (
            <button key={p.id} className="preset-chip" title={p.desc}
              onClick={() => { Object.assign(t, p.values); touch() }}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>
        <SectionTitle sub="how you attack when your fifteen have the ball">With the Ball</SectionTitle>
        {SLIDER_INFO.map(slider)}
        <SectionTitle sub="how the line defends when they have it">Without the Ball</SectionTitle>
        {DEF_SLIDER_INFO.map(defSlider)}
      </>}

      {roleSheet()}
      <div className="spacer" />
    </>
  )
}

/**
 * The analyst's read on the next opponent (8-batch feedback). He names a soft
 * spot and the week's work to exploit it. Follow him and a sound read is worth
 * a few percent on the day; he is right most of the time, not every time, and
 * his record is on the card so you can judge him yourself.
 */
function AnalystCard() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const fx = userFixtureThisWeek(game)
  if (!fx) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
        <div className="fact-label">The Analyst</div>
        <div className="meta">No match this week, so nothing to study. He will have a read on the next opponent as soon as one is in the diary.</div>
      </div>
    )
  }
  const oppId = fx.homeId === game.userClubId ? fx.awayId : fx.homeId
  const opp = game.clubs[oppId]
  const read = analystRead(game, oppId)
  if (!read || !opp) return null
  const followed = game.matchPrep === read.prep
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="fact-label">The Analyst on {opp.short}</div>
        <div className="meta" style={{ fontSize: 11 }}>{analystForm(game)}</div>
      </div>
      <div className="meta" style={{ marginTop: 2 }}>
        <b style={{ color: '#a8841a' }}>{UNIT_LABEL[read.unit]}.</b> {read.claim}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
        <button className="btn gold" style={{ padding: '5px 10px', fontSize: 11.5 }}
          disabled={followed}
          onClick={() => { game.matchPrep = read.prep; touch() }}>
          {followed ? `✓ Preparing ${PREP_LABEL[read.prep]}` : `Work on it: ${PREP_LABEL[read.prep]}`}
        </button>
        <span className="meta" style={{ fontSize: 11 }}>
          {followed
            ? 'The week is his. If he has read them right you will feel it in that area on Saturday.'
            : 'Ignore him and prepare as you see fit - he is wrong often enough to argue with.'}
        </span>
      </div>
    </div>
  )
}
