import { useState } from 'react'
import { useStore } from '../store'
import { XV_SLOTS, type MatchEvent, type Player } from '../game/model'
import { persName, t } from '../game/i18n'
import { persKnown } from '../game/scout'
import type { LiveCtx, SideCtx } from '../game/matchEngine'
import { moodOf } from './MoodTable'

/**
 * ---- THE MATCH MENU (PRM27) ----
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
  const ctx = live.ctx
  const shown = ctx.events.slice(0, live.cursor)
  const panel = PANELS[i]
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal mpanels" onClick={e => e.stopPropagation()}>
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
          {panel === 'lineups' && <Lineups ctx={ctx} />}
          {panel === 'room' && <Room ctx={ctx} />}
          {panel === 'players' && <PlayerLines ctx={ctx} shown={shown} />}
          {panel === 'zones' && <Zones ctx={ctx} shown={shown} />}
          {panel === 'visits' && <Visits ctx={ctx} shown={shown} />}
        </div>
        <button className="btn gold block" onClick={onClose}>{t('mpanel.back')}</button>
      </div>
    </div>
  )
}

const cond = (s: SideCtx, id: number) => Math.round(s.energy.get(id) ?? 100)
const rating = (s: SideCtx, id: number) => Math.min(10, Math.max(1, s.ratings.get(id) ?? 6)).toFixed(1)
const xv = (s: SideCtx, game: ReturnType<typeof useStore.getState>['game']) =>
  s.lineup.slice(0, 15).map((id, slot) => ({ slot, p: id != null ? game!.players[id] : undefined }))
    .filter((r): r is { slot: number; p: Player } => !!r.p)

function Lineups({ ctx }: { ctx: LiveCtx }) {
  const game = useStore(s => s.game)!
  const side = (s: SideCtx) => (
    <table className="dtable mp-table">
      <thead><tr><th colSpan={2}>{game.clubs[s.teamId]?.short ?? s.teamId}</th><th>{t('mpanel.cond')}</th><th>{t('mpanel.rating')}</th></tr></thead>
      <tbody>
        {xv(s, game).map(({ slot, p }) => (
          <tr key={p.id} className={s.onPitch.has(p.id) ? '' : 'off'}>
            <td className="num">{XV_SLOTS[slot].shirt}</td>
            <td className="nm">{p.name}{game.clubs[s.teamId]?.captain === p.id ? ' (C)' : ''}</td>
            <td className={`num ${cond(s, p.id) < 55 ? 'neg' : 'pos'}`}>{cond(s, p.id)}</td>
            <td className="num">{rating(s, p.id)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return <div className="mp-two">{side(ctx.home)}{side(ctx.away)}</div>
}

function Room({ ctx }: { ctx: LiveCtx }) {
  const game = useStore(s => s.game)!
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  return (
    <table className="dtable mp-table">
      <thead><tr><th /><th>{t('mood.name')}</th><th>{t('mood.personality')}</th><th>{t('mood.mood')}</th><th>{t('mpanel.cond')}</th><th>{t('mpanel.rating')}</th></tr></thead>
      <tbody>
        {xv(mine, game).map(({ slot, p }) => {
          const m = moodOf(p, true)
          return (
            <tr key={p.id}>
              <td className="num">{XV_SLOTS[slot].shirt}</td>
              <td className="nm">{p.name}</td>
              <td className="muted">{persKnown(game, p) ? persName(p.pers) : '?'}</td>
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
  const side = (s: SideCtx) => (
    <table className="dtable mp-table">
      <thead><tr><th colSpan={2}>{game.clubs[s.teamId]?.short ?? s.teamId}</th>
        <th title={t('mpanel.triesTitle')}>{t('mpanel.tries')}</th>
        <th title={t('mpanel.kicksTitle')}>{t('mpanel.kicks')}</th>
        <th title={t('mpanel.cardsTitle')}>{t('mpanel.cards')}</th>
        <th title={t('mpanel.seenTitle')}>{t('mpanel.seen')}</th></tr></thead>
      <tbody>
        {xv(s, game).map(({ slot, p }) => {
          const c = count.get(p.id) ?? { tries: 0, kicks: 0, cards: 0, seen: 0 }
          return (
            <tr key={p.id}>
              <td className="num">{XV_SLOTS[slot].shirt}</td>
              <td className="nm">{p.name.split(' ').slice(-1)[0]}</td>
              <td className="num">{c.tries}</td><td className="num">{c.kicks}</td>
              <td className="num">{c.cards}</td><td className="num">{c.seen}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
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
            <div className="bar"><i style={{ height: `${Math.max(3, v)}%` }} /></div>
            <b>{v}%</b>
            <span>{label[k]}</span>
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
  const tally = (home: boolean) => {
    let visits = 0, inside = false, pts = 0, lastScore = 0
    for (const e of shown) {
      if (e.fld == null) continue
      const up = home ? e.fld : 100 - e.fld
      const now = up >= 78
      if (now && !inside) visits++
      inside = now
      const score = home ? e.homeScore : e.awayScore
      if (score > lastScore && (inside || e.type === 'TRY')) pts += score - lastScore
      lastScore = score
    }
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
