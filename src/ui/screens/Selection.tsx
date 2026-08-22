import { useState } from 'react'
import { useStore } from '../../store'
import { XV_SLOTS, type Player, type Pos } from '../../game/model'
import { assistantJudgement, autoSelect, availablePlayers } from '../../game/matchEngine'
import { effAt } from '../../game/attributes'
import { AvailTag, FormPill, PosBadge, SectionTitle, Stars } from '../components'
import { benchSeats, splitFor } from '../../game/bench'

const PORTFOLIOS = [
  { id: 'pack' as const, icon: '🐘', name: 'Leads the Pack', desc: 'Set piece and the breakdown, at the cost of the general lift.' },
  { id: 'defence' as const, icon: '🛡', name: 'Calls the Line', desc: 'The defensive system, taken off attacking shape.' },
  { id: 'attack' as const, icon: '⚡', name: 'Runs the Attack', desc: 'Attacking shape, taken off the defensive line.' },
  { id: 'culture' as const, icon: '🤝', name: 'Sets the Standards', desc: 'The room and the discipline. No unit moves.' },
]

/**
 * The team-picking pane: Starting XV, Replacements, Leadership.
 *
 * Lived for a long time as the first tab of Selection & Tactics, a screen away
 * from the Team button (user: "Selection should be the team section and
 * replace overview... The other tab should be called tactics"). Extracted so
 * the Team screen can open ON it - tap Team, land on the sheet - while the
 * Tactics screen keeps the how (roles, set piece, bench shape, prep, plan) and
 * stops needing the who. One component, one home, one team sheet.
 */
export default function SelectionPane() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)

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

  return (
    <>
      {/* One line, all of it (user: "starting xv and best xv should be all on
          one line"). The heading, the hint and the auto-pick share the row;
          .sub stays on one line and ellipsises. */}
      <SectionTitle
        sub={sel != null ? `moving ${game.players[t.lineup[sel] ?? -1]?.name ?? 'empty slot'}` : 'tap two to swap'}
        right={
          /* One auto-pick, not two. In-Form XV is gone at the user's request:
             two buttons that both silently rewrite the whole team sheet is one
             too many, and the difference between them (form weighted over
             class) was never visible on the button. Best XV already weighs
             form; the Form column is there for anyone who wants to argue.

             The button is the ASSISTANT'S draft, not an answer key: it runs
             through assistantJudgement, the same imperfect eye that names the
             side when the manager never opens this screen. One tap a week was
             the honest optimiser for free, which is no game at all. Correct
             his shirts by hand and the corrections are yours; hire a better
             assistant and his drafts sharpen. */
          <button className="btn gold tiny" onClick={() => {
            const pool = availablePlayers(game, club.players)
            club.tactic.lineup = autoSelect(game, pool, splitFor(club), assistantJudgement(game))
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
      {/* an unclaimed sheet is the assistant's, and the manager deserves to be
          told so BEFORE match day - the moment he touches a shirt this line
          goes away, because the sheet is his from then on */}
      {!t.userPicked && (
        <div className="muted" style={{ padding: '4px 2px 0' }}>
          Untouched sheet: your assistant named this side, with his eye for it, not yours - and nobody is updating it for form or fitness. Change a shirt and it becomes your team.
        </div>
      )}
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
                  // A MAN CAN HOLD MORE THAN ONE JOB (user: "players can play
                  // multiple roles"). This used to clear his other portfolio on
                  // appointment. There is no exploit in allowing it: each
                  // portfolio is a trade in the engine - it lifts one unit and
                  // taxes another - so a second job is a second trade, not a
                  // second helping.
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
          only XV men with real authority carry one, and a real leader can carry more than one.
        </div>
      </div>
      </div>
      </div>
      </div>
      {picker()}
    </>
  )
}
