import { useState } from 'react'
import { useStore } from '../store'
import { XV_SLOTS, type MatchEvent, type Player } from '../game/model'
import { luma } from './kit'
import { t } from '../game/i18n'
import { visitsTo22, shirtNumber, type LiveCtx, type SideCtx } from '../game/matchEngine'
import { moodOf } from './MoodTable'

/**
 * ---- THE MATCH MENU (1.8.0) ----
 *
 * The classic manager game lets you page through the match while it is on:
 * the line-ups with condition and ratings, how your players feel, who has done
 * what, where the game has been played and what each side made of its visits
 * (owner, 26 Sep 2026, with FM26 mobile screenshots: "in game menu screens
 * available").
 *
 * EVERY NUMBER HERE IS ONE THE MATCH ALREADY KNOWS. Condition and ratings are
 * the engine's own; tries, kicks and cards are counted off the commentary
 * lines revealed so far; territory is where the engine had the ball on each of
 * those lines (MatchEvent.fld). Nothing is invented for the look of it, and
 * nothing is read from lines the viewer has not seen yet.
 */
type Panel = 'lineups' | 'room' | 'players' | 'zones' | 'visits'
const PANELS: Panel[] = ['lineups', 'room', 'players', 'zones', 'visits']

export function MatchPanels({ onClose }: { onClose: () => void }) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const [i, setI] = useState(0)
  // whose 23 the telemetry strip shows: the manager's, or the other side's
  const [opp, setOpp] = useState(false)
  const ctx = live.ctx
  const shown = ctx.events.slice(0, live.cursor)
  const panel = PANELS[i]
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tap-outside-to-close veil, and Escape closes it (a11y.ts); the sheet has its own buttons
    <div className={`modal-veil${panel === 'lineups' ? ' mp-clear' : ''}`} onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- swallows taps inside the sheet so it stays open; not a control */}
      <div className={`modal mpanels${panel === 'lineups' ? ' tele-mode' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="mp-head">
          <button className="btn ghost tiny" aria-label={t('mpanel.prev')} disabled={i === 0} onClick={() => setI(i - 1)}>◀</button>
          <b>{t(`mpanel.${panel}`)}</b>
          <button className="btn ghost tiny" aria-label={t('mpanel.next')} disabled={i === PANELS.length - 1} onClick={() => setI(i + 1)}>▶</button>
        </div>
        <div className="mp-dots">
          {PANELS.map((p, k) => (
            <button key={p} className={k === i ? 'on' : ''} aria-label={t(`mpanel.${p}`)} onClick={() => setI(k)} />
          ))}
        </div>
        <div className="mp-body">
          {panel === 'lineups' && <Telemetry ctx={ctx} shown={shown} opp={opp} />}
          {panel === 'room' && <Room ctx={ctx} />}
          {panel === 'players' && <PlayerLines ctx={ctx} shown={shown} />}
          {panel === 'zones' && <Zones ctx={ctx} shown={shown} />}
          {panel === 'visits' && <Visits ctx={ctx} shown={shown} />}
        </div>
        {/* THE OTHER SIDE'S 23 RIDES BESIDE BACK (1.9.0), on the row that is
            already 44px tall, so the toggle costs the strip no height: the
            whole point of the strip is all 23 on one phone screen. */}
        {panel === 'lineups' ? (
          <div className="tele-foot">
            <button className="btn gold block" onClick={onClose}>{t('mpanel.back')}</button>
            <button className="btn ghost tele-toggle" aria-pressed={opp}
              aria-label={t('tele.showSide', { team: sideName(game, opp ? mineOf(ctx, game.userClubId) : theirsOf(ctx, game.userClubId)) })}
              onClick={() => setOpp(!opp)}>
              {sideName(game, opp ? mineOf(ctx, game.userClubId) : theirsOf(ctx, game.userClubId))}
            </button>
          </div>
        ) : (
          <button className="btn gold block" onClick={onClose}>{t('mpanel.back')}</button>
        )}
      </div>
    </div>
  )
}

const cond = (s: SideCtx, id: number) => Math.round(s.energy.get(id) ?? 100)
const rating = (s: SideCtx, id: number) => Math.min(10, Math.max(1, s.ratings.get(id) ?? 6)).toFixed(1)
const xv = (s: SideCtx, game: ReturnType<typeof useStore.getState>['game']) =>
  s.lineup.slice(0, 15).map((id, slot) => ({ slot, p: id != null ? game!.players[id] : undefined }))
    .filter((r): r is { slot: number; p: Player } => !!r.p)

type Game = NonNullable<ReturnType<typeof useStore.getState>['game']>
/** Which side is the manager's: the side whose team is the one he picked
 *  (ctx.userSideId, which is his country on a Test day), else his club. */
const mineOf = (ctx: LiveCtx, clubId: string) => ctx.away.teamId === (ctx.userSideId ?? clubId) ? ctx.away : ctx.home
const theirsOf = (ctx: LiveCtx, clubId: string) => mineOf(ctx, clubId) === ctx.home ? ctx.away : ctx.home
const sideName = (game: Game, s: SideCtx) => game.clubs[s.teamId]?.short ?? s.teamId

/** the three units a bar is coloured by: front row, the rest of the pack, backs */
type Unit = 'fr' | 'pk' | 'bk'
const unitOfPos = (pos: string | undefined): Unit =>
  pos === 'LP' || pos === 'HK' || pos === 'TP' ? 'fr' : pos === 'LK' || pos === 'FL' || pos === 'N8' ? 'pk' : 'bk'

/**
 * ---- THE TEAM SHEET AS TELEMETRY (1.9.0) ----
 *
 * The line-ups panel showed fifteen a side in two tables that a phone had to
 * scroll, and the bench not at all, which is the half of the 23 a manager is
 * actually deciding about at the hour. This is the broadcast strip instead: all
 * 23 of one side in 24px rows, on one phone screen, with the scoreboard still in
 * view above it (the veil is clear on this panel, theme.css .mp-clear).
 *
 * THE ROWS ARE THE LINEUP ARRAY IN ORDER, which is the shirt order: every
 * substitution swaps the replacement into the slot and the replaced man into
 * the replacement's seat (matchEngine.ts, the bench and injury cover code), so
 * slots 0-14 are who wears 1-15 now and 15-22 are 16-23, the replaced among
 * them. The shirt follows the slot, as it did in the old panel.
 *
 * EVERY STATE IS ONE THE MATCH ALREADY KNOWS, read the way the other panels
 * read it: energy and the raw ratings accumulator off the side (the settled
 * mark once full time has written finalR), the bin off `binned` and
 * yellowUntil against the clock, a head injury assessment off `hia`, and a red
 * card or an injury only once the commentary line saying so has been shown.
 *
 * Rows are not tap targets, as they were not before: the squad sheet is the
 * control for changes, one button away on the match screen.
 */
function Telemetry({ ctx, shown, opp }: { ctx: LiveCtx; shown: MatchEvent[]; opp: boolean }) {
  const game = useStore(s => s.game)!
  const s = opp ? theirsOf(ctx, game.userClubId) : mineOf(ctx, game.userClubId)
  // the kit: --club1 is the manager's club on the match screen (App.tsx), so
  // his own club reads the token and anybody else reads their own first colour
  const kit = game.clubs[s.teamId]?.colors
  const fill = s.teamId === game.userClubId ? 'var(--club1)' : kit?.[0] ?? 'var(--primary)'
  // white or near-black on the shirt, whichever reads: a club colour is data
  const ink = kit?.[0] ? (luma(kit[0]) > 150 ? 'var(--prop-ink-dark)' : 'var(--prop-ink)') : 'var(--on-primary)'
  const reds = new Set<number>(), hurt = new Set<number>()
  for (const e of shown) {
    if (e.playerId == null) continue
    if (e.type === 'RC') reds.add(e.playerId)
    if (e.type === 'INJ') hurt.add(e.playerId)
  }
  const captain = game.clubs[s.teamId]?.captain
  return (
    <table className="tele" data-side={opp ? 'them' : 'us'}>
      <colgroup>
        <col className="c-no" /><col className="c-pos" /><col /><col className="c-bar" /><col className="c-e" /><col className="c-r" /><col className="c-f" />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={3} className="tele-team">{sideName(game, s)}</th>
          <th colSpan={2}>{t('mpanel.cond')}</th>
          <th>{t('mpanel.rating')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {s.lineup.slice(0, 23).map((id, slot) => {
          const p = id != null ? game.players[id] : undefined
          // the number on his back (shirtNumber): a replacement keeps
          // his own, he does not take the shirt of the man he replaced
          const shirt = (p ? shirtNumber(s, p.id) : null) ?? (slot < 15 ? XV_SLOTS[slot].shirt : slot + 1)
          const pos = slot < 15 ? XV_SLOTS[slot].label : p?.pos ?? ''
          const unit: Unit = slot < 15 ? (slot < 3 ? 'fr' : slot < 8 ? 'pk' : 'bk') : unitOfPos(p?.pos)
          const e = p ? Math.max(0, Math.min(100, Math.round(s.energy.get(p.id) ?? 100))) : 0
          const raw = p ? (s.finalR?.get(p.id) ?? s.ratings.get(p.id)) : undefined
          const r = raw == null ? null : Math.min(10, Math.max(1, raw))
          const on = !!p && s.onPitch.has(p.id)
          const binned = !!p && !on && (s.binned.has(p.id) || (s.yellowUntil.get(p.id) ?? 0) > ctx.lastMin)
          const flag = !p || on ? null
            : binned ? 'yc'
            : reds.has(p.id) || s.sentOff?.has(p.id) ? 'rc'
            : s.hia?.pid === p.id ? 'hia'
            : hurt.has(p.id) ? 'inj'
            : null
          // off and done for the day: replaced, sent off or carried off. A
          // man in the bin is coming back, and a replacement not yet used has
          // played no part (no rating yet), so neither is greyed
          const gone = !!p && !on && !binned && s.ratings.has(p.id)
          const cls = [slot === 15 ? 'bench-first' : '', gone ? 'off' : '', binned ? 'binned' : ''].filter(Boolean).join(' ')
          return (
            <tr key={slot} className={cls || undefined} data-pid={p?.id}>
              <td className="tele-no"><span style={{ background: fill, color: ink }}>{shirt}</span></td>
              <td className="tele-pos">{pos}</td>
              <td className="tele-nm">
                {p ? p.name.split(' ').slice(-1)[0] : '-'}
                {p && captain === p.id && <span className="tele-c" title={t('tele.captain')}>C</span>}
              </td>
              <td className="tele-bar-c">
                <span className="tele-bar" data-u={unit}><i data-e={e} style={{ transform: `scaleX(${e / 100})` }} /></span>
              </td>
              <td className={`tele-e${p && e < 55 ? ' lo' : ''}`}>{p ? e : ''}</td>
              <td className={`tele-r${r == null ? '' : r >= 7 ? ' hi' : r < 5.5 ? ' lo' : ''}`}>{r == null ? '-' : r.toFixed(1)}</td>
              <td className="tele-f">
                {flag === 'yc' && <span className="tele-yc" role="img" aria-label={t('tele.binned')} title={t('tele.binned')} />}
                {flag === 'rc' && <span className="tele-rc" role="img" aria-label={t('tele.sent')} title={t('tele.sent')} />}
                {flag === 'hia' && <span className="tele-tag" title={t('tele.hiaTitle')}>{t('tele.hia')}</span>}
                {flag === 'inj' && <span className="tele-inj" role="img" aria-label={t('tele.injured')} title={t('tele.injured')}>+</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Room({ ctx }: { ctx: LiveCtx }) {
  const game = useStore(s => s.game)!
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  // once a talk has been given, the mood is how he took the latest one
  const heard = new Map((ctx.htReads ?? ctx.preReads ?? []).map(r => [r.pid, r]))
  return (
    <table className="dtable mp-table">
      <thead><tr><th /><th>{t('mood.name')}</th><th>{t('mood.mood')}</th><th>{t('mpanel.cond')}</th><th>{t('mpanel.rating')}</th></tr></thead>
      <tbody>
        {xv(mine, game).map(({ slot, p }) => {
          const r = heard.get(p.id)
          const m = r ? { k: r.k, tone: r.tone } : moodOf(p, true)
          return (
            <tr key={p.id}>
              <td className="num">{shirtNumber(mine, p.id) ?? XV_SLOTS[slot].shirt}</td>
              <td className="nm">{p.name}</td>
              <td><span className={`mood-chip ${m.tone}`}>{t(m.k)}</span></td>
              <td className="num">{cond(mine, p.id)}</td>
              <td className="num">{rating(mine, p.id)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Who has done what, counted off the lines revealed so far. */
function PlayerLines({ ctx, shown }: { ctx: LiveCtx; shown: MatchEvent[] }) {
  const game = useStore(s => s.game)!
  const count = new Map<number, { tries: number; kicks: number; cards: number; seen: number }>()
  for (const e of shown) {
    if (e.playerId == null) continue
    const c = count.get(e.playerId) ?? { tries: 0, kicks: 0, cards: 0, seen: 0 }
    c.seen++
    if (e.type === 'TRY' && e.fx !== 'TMO' && e.fx !== 'NOTRY') c.tries++
    if (e.type === 'PEN' || e.type === 'CON' || e.type === 'DG') c.kicks++
    if (e.type === 'YC' || e.type === 'RC') c.cards++
    count.set(e.playerId, c)
  }
  // TACKLES ARE THE ENGINE'S OWN COUNT (owner, 27 Sep 2026: "track the
  // tackles accurately"): every attempt is played and named in
  // matchEngine.ts countTackles, and a replacement has only the ones they made
  const side = (s: SideCtx) => {
    const tkl = s.tackles ?? new Map<number, number>()
    return (
      <table className="dtable mp-table mp-grid">
        <colgroup><col className="c-shirt" /><col /><col className="c-stat" /><col className="c-stat" /><col className="c-stat" /><col className="c-stat" /><col className="c-stat" /></colgroup>
        <thead><tr><th colSpan={2} className="mp-team">{game.clubs[s.teamId]?.short ?? s.teamId}</th>
          <th title={t('mpanel.triesTitle')}>{t('mpanel.tries')}</th>
          <th title={t('mpanel.kicksTitle')}>{t('mpanel.kicks')}</th>
          <th title={t('mpanel.cardsTitle')}>{t('mpanel.cards')}</th>
          <th title={t('mpanel.tacklesTitle')}>{t('mpanel.tackles')}</th>
          <th title={t('mpanel.seenTitle')}>{t('mpanel.seen')}</th></tr></thead>
        <tbody>
          {xv(s, game).map(({ slot, p }) => {
            const c = count.get(p.id) ?? { tries: 0, kicks: 0, cards: 0, seen: 0 }
            return (
              <tr key={p.id} className={s.onPitch.has(p.id) ? '' : 'off'}>
                <td className="num shirt">{shirtNumber(s, p.id) ?? XV_SLOTS[slot].shirt}</td>
                <td className="nm">{p.name.split(' ').slice(-1)[0]}</td>
                <td className="num">{c.tries}</td><td className="num">{c.kicks}</td>
                <td className="num">{c.cards}</td><td className="num">{tkl.get(p.id) ?? 0}</td>
                <td className="num">{c.seen}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
  return (
    <>
      <div className="mp-note">{t('mpanel.playersNote')}</div>
      <div className="mp-two">{side(ctx.home)}{side(ctx.away)}</div>
    </>
  )
}

/** The field in three: where the lines revealed so far were played, from each
 *  side's point of view (its own third, the middle, the opposition's). */
function Zones({ ctx, shown }: { ctx: LiveCtx; shown: MatchEvent[] }) {
  const game = useStore(s => s.game)!
  const f = shown.map(e => e.fld).filter((x): x is number => x != null)
  const n = f.length || 1
  const pct = (lo: number, hi: number) => Math.round(f.filter(x => x >= lo && x < hi).length / n * 100)
  const home = [pct(0, 33.4), pct(33.4, 66.7), pct(66.7, 101)]
  const label = [t('mpanel.zoneHomeThird', { team: game.clubs[ctx.home.teamId]?.short ?? '' }), t('mpanel.zoneMiddle'), t('mpanel.zoneAwayThird', { team: game.clubs[ctx.away.teamId]?.short ?? '' })]
  return (
    <>
      <div className="mp-note">{t('mpanel.zonesNote', { n: f.length })}</div>
      <div className="mp-zones">
        {home.map((v, k) => (
          <div key={k} className="mp-zone">
            <span>{label[k]}</span>
            <div className="bar"><i style={{ width: `${Math.max(2, v)}%` }} /></div>
            <b>{v}%</b>
          </div>
        ))}
      </div>
    </>
  )
}

/** Visits to the 22 and what each side made of them: the rugby version of
 *  "attack areas", and the number coaches actually quote. A visit starts on the
 *  first line inside the opposition 22 after a line outside it. */
function Visits({ ctx, shown }: { ctx: LiveCtx; shown: MatchEvent[] }) {
  const game = useStore(s => s.game)!
  // the engine's count, the same one the live stats read (visitsTo22)
  const tally = (home: boolean) => {
    const { visits, pts } = visitsTo22(shown, ctx.home.teamId, home)
    return { visits, pts, per: visits ? (pts / visits).toFixed(1) : '-' }
  }
  const h = tally(true), a = tally(false)
  const row = (label: string, x: string | number, y: string | number) => (
    <tr><td className="num">{x}</td><td className="mp-mid">{label}</td><td className="num">{y}</td></tr>
  )
  return (
    <>
      <div className="mp-note">{t('mpanel.visitsNote')}</div>
      <table className="dtable mp-table mp-vs">
        <thead><tr><th>{game.clubs[ctx.home.teamId]?.short}</th><th /><th>{game.clubs[ctx.away.teamId]?.short}</th></tr></thead>
        <tbody>
          {row(t('mpanel.visits22'), h.visits, a.visits)}
          {row(t('mpanel.pointsFrom22'), h.pts, a.pts)}
          {row(t('mpanel.perVisit'), h.per, a.per)}
        </tbody>
      </table>
    </>
  )
}
