import { useState } from 'react'
import { useStore } from '../../store'
import { XV_SLOTS, type Player, type Pos } from '../../game/model'
import { autoSelect, availablePlayers } from '../../game/matchEngine'
import { effAt } from '../../game/attributes'
import { PRESETS, SLIDER_INFO, sliderReadout } from '../../game/tactics'
import { ROLE_BY_ID, rolesForSlot } from '../../game/roles'
import { AvailTag, FormPill, PosBadge, SectionTitle, Stars } from '../components'
import { analystForm, analystRead, PREP_LABEL, UNIT_LABEL } from '../../game/analyst'
import { assistantAdvice } from '../../game/analysis'
import { userFixtureThisWeek } from '../../game/season'
import { counterTo, dialLine, philosophyOf } from '../../game/philosophy'
import { ROUTINES, DEFAULT_LINEOUT, DEFAULT_SCRUM, routineEffect } from '../../game/playbook'
import { BRIEFS, SPLITS, actualSplit, benchFrontRow, benchSeats, briefForSeat, refillBench, splitFor, type BenchSplit, type Brief } from '../../game/bench'

const PORTFOLIOS = [
  { id: 'pack' as const, icon: '🐘', name: 'Leads the Pack', desc: 'Set piece and the breakdown, at the cost of the general lift.' },
  { id: 'defence' as const, icon: '🛡', name: 'Calls the Line', desc: 'The defensive system, taken off attacking shape.' },
  { id: 'attack' as const, icon: '⚡', name: 'Runs the Attack', desc: 'Attacking shape, taken off the defensive line.' },
  { id: 'culture' as const, icon: '🤝', name: 'Sets the Standards', desc: 'The room and the discipline. No unit moves.' },
]

/** The tactics area, split into proper pages (8C feedback): Selection,
 *  In-Form XV, Tactics (formation & roles), Match Prep and Game Plan. */
export default function Tactics() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [ttab, setTtab] = useState<'xv' | 'tactics' | 'setp' | 'bench' | 'prep' | 'plan'>('xv')
  const [roleSlot, setRoleSlot] = useState<number | null>(null)

  const club = game.clubs[game.userClubId]
  const t = club.tactic

  /** This sheet is his now.
   *
   *  The engine used to re-pick a "stale" team sheet on the way to the pitch,
   *  which is how a manager ended up watching a side he had not chosen ("I'm not
   *  sure if you make changes to the match day 23 it's actually putting those
   *  players on the pitch"). Every edit on this screen stamps the sheet as the
   *  manager's, and the engine leaves a manager's sheet alone. */
  const claim = () => { t.userPicked = true }

  /** Why a man in a leadership list cannot play this week. The armband is a
   *  season-long appointment, so a captain away with his country stays captain
   *  and the vice leads in his place - but the list should say so rather than
   *  leave the manager wondering ("petti hasn't been part of the squad for ages
   *  because of international duty but still captain"). */
  const awayNote = (p: Player) =>
    p.injury ? ' - injured' : p.bans > 0 ? ' - suspended'
      : p.natSquad ? ' - on Test duty' : p.onLoan ? ' - out on loan' : ''

  const setSlot = (slot: number, pid: number | null) => {
    // remove pid from any other slot first
    if (pid != null) {
      const other = t.lineup.indexOf(pid)
      if (other >= 0) t.lineup[other] = t.lineup[slot]
    }
    t.lineup[slot] = pid
    claim()
    setPickSlot(null)
    setSel(null)
    touch()
  }

  // FM Mobile interaction: tap a player to pick him up, tap another slot
  // to swap the two; tap the same slot again for the full squad picker.
  const tapSlot = (slot: number) => {
    if (sel == null) { setSel(slot); return }
    if (sel === slot) { setSel(null); setPickSlot(slot); return }
    const a = t.lineup[sel]
    t.lineup[sel] = t.lineup[slot]
    t.lineup[slot] = a
    claim()
    setSel(null)
    touch()
  }

  // the bench seats depend on the split the manager named (F4)
  const seats = benchSeats(club)
  /** The position a slot is asking for. An open bench seat asks for whatever the
   *  man in it plays (user: "use players positions"), so a winger in the 21 shirt
   *  reads WG rather than being mislabelled a scrum-half. The front-row three are
   *  never open: Law 3 wants them covered. */
  const slotPos = (slot: number): Pos => {
    if (slot < 15) return XV_SLOTS[slot].pos
    const seat = seats[slot - 15]
    if (seat.open) {
      const id = t.lineup[slot]
      const p = id != null ? game.players[id] : null
      if (p) return p.pos
    }
    return seat.pos[0]
  }

  const renderSlot = (slot: number) => {
    const shirt = slot < 15 ? XV_SLOTS[slot].shirt : seats[slot - 15].shirt
    const pos = slotPos(slot)
    const pid = t.lineup[slot]
    const p = pid != null ? game.players[pid] : null
    const problem = p && (p.injury || p.bans > 0 || p.natSquad || p.clubId !== club.id)
    return (
      <tr key={slot} onClick={() => tapSlot(slot)}
        className={`${problem ? 'prob-row' : ''}${sel === slot ? ' held-row' : ''}`}>
        <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{shirt}</td>
        <td><PosBadge pos={pos} /></td>
        <td className="name">{p ? p.name : <span className="muted">- tap to select -</span>}
          {p && club.captain === p.id && <b style={{ color: '#a8841a' }}> (C)</b>}
          {p && <> <AvailTag p={p} g={game} /></>}</td>
        <td>{p && <Stars ca={effAt(p, pos)} />}</td>
        <td>{p && <FormPill v={p.form} />}</td>
        <td className="num">{p ? `${Math.round(p.cond)}%` : ''}</td>
      </tr>
    )
  }

  const picker = () => {
    if (pickSlot == null) return null
    const pos = slotPos(pickSlot)
    // an open bench seat will take anybody, so it is ranked on each man's own
    // best position rather than on a shirt number's opinion
    const openSeat = pickSlot >= 15 && !!seats[pickSlot - 15].open
    const pool = availablePlayers(game, club.players)
      .sort((a, b) => (openSeat ? effAt(b, b.pos) - effAt(a, a.pos) : effAt(b, pos) - effAt(a, pos)))
    return (
      <div className="modal-veil" onClick={() => setPickSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <div style={{ padding: '0 12px 10px' }}>
            <SectionTitle sub={`slot ${pickSlot < 15 ? XV_SLOTS[pickSlot].shirt : seats[pickSlot - 15].shirt}`}>
              {openSeat ? 'Pick anybody - the shirt takes his position' : `Pick a ${pos}`}
            </SectionTitle>
            <table className="dtable">
              <tbody>
                {pool.map(p => (
                  <tr key={p.id} onClick={() => setSlot(pickSlot, p.id)}
                    style={t.lineup.includes(p.id) ? { opacity: .55 } : undefined}>
                    <td><PosBadge pos={p.pos} /></td>
                    <td className="name">{p.name}{t.lineup.includes(p.id) ? ' (selected)' : ''}</td>
                    <td><Stars ca={effAt(p, pos)} /></td>
                    <td><FormPill v={p.form} /></td>
                    <td className="num">{Math.round(p.cond)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn ghost block" onClick={() => setSlot(pickSlot, null)}>Clear Slot</button>
          </div>
        </div>
      </div>
    )
  }

  const slider = (info: typeof SLIDER_INFO[number]) => (
    <div className="slider-row" key={info.key}>
      <div className="lbls"><span>{info.lo}</span><b style={{ color: 'var(--accent-ink)' }}>{info.label}</b><span>{info.hi}</span></div>
      <input type="range" min={0} max={100} value={t[info.key]}
        onChange={e => { t[info.key] = Number(e.target.value); touch() }} />
      <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{sliderReadout(info.key, t[info.key])}</div>
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
  const SPOTS: [number, number][] = [
    [22, 9], [50, 7], [78, 9],
    [36, 20], [64, 20],
    [14, 32], [86, 32], [50, 33],
    [50, 46], [30, 57],
    [12, 68], [50, 66], [70, 76], [90, 60], [50, 88],
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
        <button className={ttab === 'xv' ? 'active' : ''} onClick={() => setTtab('xv')}>Selection</button>
        <button className={ttab === 'tactics' ? 'active' : ''} onClick={() => setTtab('tactics')}>Tactics</button>
        <button className={ttab === 'setp' ? 'active' : ''} onClick={() => setTtab('setp')}>Set Piece</button>
        <button className={ttab === 'bench' ? 'active' : ''} onClick={() => setTtab('bench')}>Bench</button>
        <button className={ttab === 'prep' ? 'active' : ''} onClick={() => setTtab('prep')}>Prep</button>
        <button className={ttab === 'plan' ? 'active' : ''} onClick={() => setTtab('plan')}>Game Plan</button>
      </div>

      {ttab === 'xv' && <>
        {/* Auto-Pick rode its own row for one short button. It belongs to the
            Starting XV, so it sits on the Starting XV's heading. */}
        {/* One line, all of it (user: "starting xv and best xv should be all on
            one line"). The heading, the hint and the two auto-picks were three
            lines tall on the phone, because the hint was a long sentence in a row
            with no wrap rule: flex could not put it on one line, so the sentence
            wrapped inside its own span and pushed the row to 40-odd pixels. Short
            hint, and .sub now stays on one line and ellipsises. */}
        <SectionTitle
          sub={sel != null ? `moving ${game.players[t.lineup[sel] ?? -1]?.name ?? 'empty slot'}` : 'tap two to swap'}
          right={
            /* One auto-pick, not two. In-Form XV is gone at the user's request:
               two buttons that both silently rewrite the whole team sheet is one
               too many, and the difference between them (form weighted over
               class) was never visible on the button. Best XV already weighs
               form; the Form column is there for anyone who wants to argue. */
            <button className="btn gold tiny" onClick={() => {
              const pool = availablePlayers(game, club.players)
              club.tactic.lineup = autoSelect(game, pool, splitFor(club))
              // he asked for this side, so it is his: the engine must not
              // second-guess a sheet the manager put there on purpose
              claim()
              touch()
            }}>Best XV</button>
          }>Starting XV</SectionTitle>
        {/* forwards left, backs right in landscape: 23 rows in one column was four
            swipes deep. They do NOT "stack identically" in portrait, which is what
            this comment used to claim: see the fixed .xv-split columns in theme.css
            for the step that assumption put in the list from number 9 down. */}
        <div className="xv-split">
          <table className="dtable"><tbody>{XV_SLOTS.slice(0, 8).map((_, i) => renderSlot(i))}</tbody></table>
          <table className="dtable"><tbody>{XV_SLOTS.slice(8).map((_, i) => renderSlot(8 + i))}</tbody></table>
        </div>
        {/* the bench and the armband sit side by side in landscape: stacked,
            they were a screenful of scrolling below a team sheet that already
            filled the screen. Portrait keeps them in order. */}
        <div className="sel-split">
        <div>
        <SectionTitle>Replacements</SectionTitle>
        <div className="xv-split">
          <table className="dtable"><tbody>{seats.slice(0, 4).map((_, i) => renderSlot(15 + i))}</tbody></table>
          <table className="dtable"><tbody>{seats.slice(4).map((_, i) => renderSlot(19 + i))}</tbody></table>
        </div>
        </div>
        <div>
        <SectionTitle sub="the armband, and who takes responsibility for what">Leadership</SectionTitle>
        {/* one card, two rows. As two cards in a half-width column each one
            wrapped its select onto a second line and the pair came to 447px,
            taller than the bench it was meant to sit beside. */}
        <div className="card-grid one">
        <div className="card">
          <div className="lead-row">
            <span className="lead-tag">©</span>
            <span className="fact-label">Captain</span>
            <select className="inline-input"
              value={club.captain ?? ''}
              onChange={e => { club.captain = e.target.value ? Number(e.target.value) : null; touch() }}>
              {club.players.map(id => game.players[id]).filter(Boolean)
                .sort((a, b) => b.a.lea - a.a.lea)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Ldr {p.a.lea}){awayNote(p)}</option>
                ))}
            </select>
          </div>
          <div className="lead-row">
            <span className="lead-tag">VC</span>
            <span className="fact-label">Vice</span>
            <select className="inline-input"
              value={club.vice ?? ''}
              onChange={e => { club.vice = e.target.value ? Number(e.target.value) : null; touch() }}>
              {club.players.map(id => game.players[id]).filter(p => p && p.id !== club.captain)
                .sort((a, b) => b.a.lea - a.a.lea)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Ldr {p.a.lea}){awayNote(p)}</option>
                ))}
            </select>
          </div>
          {/* The leadership group (F11) shares the skipper's card rather than
              taking a section of its own. As a separate block below the split it
              pushed the Selection page to 3.2 screenfuls, which is the same
              complaint as having too many squad pages. */}
          <div className="lead-grid">
          {PORTFOLIOS.map(pf => {
            const cur = club.leaders?.[pf.id] ?? null
            /**
             * The whole senior squad, not this week's XV.
             *
             * Reported from live play: "the attack and standards holders reset
             * each match but the rest don't". Nothing was resetting. The options
             * were drawn from the starting XV, so when a portfolio holder was left
             * out - rested, injured, away with his country - the select had no
             * option matching its own value and the browser drew the first one
             * instead: "Nobody has it". The appointment was still there; the screen
             * was lying about it, and only for the men who happened to be out.
             *
             * A portfolio is a season-long job in a dressing room, not a match-day
             * label, so the list is the squad and the men who cannot play this week
             * are marked rather than hidden.
             */
            const squad = club.players
              .map(id => game.players[id])
              .filter((x): x is Player => !!x && !x.acad)
            return (
              <div className="lead-row" key={pf.id}>
                <span className="lead-tag">{pf.icon}</span>
                <span className="fact-label">{pf.name}</span>
                <select className="inline-input" value={cur ?? ''}
                  onChange={e => {
                    club.leaders = { ...(club.leaders ?? {}) }
                    const v = e.target.value ? Number(e.target.value) : null
                    // one man, one portfolio: taking a second job is not leadership
                    for (const k of Object.keys(club.leaders) as (keyof NonNullable<typeof club.leaders>)[]) {
                      if (v != null && club.leaders[k] === v) club.leaders[k] = null
                    }
                    club.leaders[pf.id] = v
                    touch()
                  }}>
                  <option value="">Nobody has it</option>
                  {[...squad].sort((a, b) => b.a.lea - a.a.lea).map(p => {
                    const away = p.injury ? 'injured' : p.bans > 0 ? 'suspended'
                      : p.natSquad ? 'on Test duty' : p.onLoan ? 'out on loan' : null
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} (Ldr {p.a.lea}){away ? ` - ${away}` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            )
          })}
          </div>
          <div className="meta" style={{ marginTop: 5 }}>
            The skipper lifts attack and defence and calms tempers; the vice leads at half effect
            when he is missing. A portfolio below that does not add strength, it concentrates it:
            only XV men with real authority carry one, and one man holds one job.
          </div>
        </div>
        </div>
        </div>
        </div>
      </>}

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
        <SectionTitle>Game Plan</SectionTitle>
        {SLIDER_INFO.map(slider)}
      </>}

      {picker()}
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
