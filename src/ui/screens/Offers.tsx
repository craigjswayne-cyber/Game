import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, fmtWage } from '../../game/model'
import { counterIncomingOffer, respondToOffer } from '../../game/ai'
import { CrestT, PosBadge, Stars } from '../components'
import { statusOf, STATUS_BY_ID } from '../../game/gametime'

/** A bid for one of your players, and you are answering it now (feedback 10E).
 *
 *  Offers used to sit in a section of the transfer market and lapse in silence
 *  after two weeks. So the single most consequential decision in a season - is
 *  this man for sale - could be missed entirely by a manager who never opened that
 *  tab, and the game would quietly answer it for him.
 *
 *  Continue now stops here instead. One bid at a time, the context you need to
 *  judge it, and no way past without an answer. The week does not move until the
 *  desk is clear, which is also how a real director of rugby's week works. */
export default function Offers() {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const { touch, continueWeek, go } = useStore.getState()
  const [msg, setMsg] = useState<string | null>(null)

  const pending = game.offers.filter(o => o.status === 'pending' && o.forUser)
  const o = pending[0]

  // The desk is clear: press on with the week that was interrupted. This is the
  // only way out of the screen, which is the point of it.
  if (!o) {
    return (
      <div style={{ padding: 14 }}>
        <div className="card">
          <h3>Desk clear</h3>
          <div className="meta">{msg ?? 'Every bid has an answer. Nothing else is waiting on you.'}</div>
          <button className="btn gold block" style={{ marginTop: 10 }} onClick={() => continueWeek()}>
            ▸ Get On With The Week
          </button>
        </div>
      </div>
    )
  }

  const p = game.players[o.playerId]
  const bidder = game.clubs[o.fromClubId]
  const club = game.clubs[game.userClubId]
  if (!p || !bidder) {
    // a bid whose player or bidder has gone is not a decision, it is litter
    o.status = 'rejected'
    touch()
    return null
  }

  const st = statusOf(game, club, p)
  const cover = club.players
    .map(id => game.players[id])
    .filter(x => x && x.id !== p.id && (x.pos === p.pos || x.alt.includes(p.pos)))
    .sort((a, b) => b.ca - a.ca)
  const deadline = [7, 26, 27].includes(game.week)
  const over = o.fee - p.value

  const answer = (fn: () => string) => { setMsg(fn()); touch() }

  return (
    <>
      <div style={{ padding: '10px 14px 0' }}>
        <div className="filter-note">
          {pending.length === 1 ? 'One bid on the desk' : `${pending.length} bids on the desk`} · the week waits for your answer
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="offer-head">
            <CrestT g={game} teamId={bidder.id} size={34} />
            <div>
              <h3 style={{ margin: 0 }}>{bidder.name} bid {fmtMoney(o.fee)}</h3>
              <div className="meta">for {p.name}, and they want an answer</div>
            </div>
          </div>

          <table className="dtable"><tbody>
            <tr>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name}</td>
              <td><Stars ca={p.ca} /></td>
              <td className="num">{p.age} yrs</td>
            </tr>
          </tbody></table>

          <div className="meta" style={{ marginTop: 6 }}>
            Valued at {fmtMoney(p.value)}, so this is{' '}
            <b style={{ color: over > 0 ? 'var(--text-positive)' : 'var(--danger)' }}>
              {over > 0 ? `${fmtMoney(over)} over` : over < 0 ? `${fmtMoney(-over)} under` : 'exactly'}
            </b>{' '}the valuation. He is a <b>{STATUS_BY_ID[st].name.toLowerCase()}</b>, on {fmtWage(p.wage)}/wk
            until the end of {2026 + p.contractEnds - game.season - 1}.
          </div>
          <div className="meta">
            {cover.length === 0
              ? `Sell him and you have nobody else who plays ${p.pos}.`
              : `Cover behind him: ${cover.slice(0, 2).map(x => x.name).join(', ')}${cover.length > 2 ? ` and ${cover.length - 2} more` : ''}.`}
          </div>
          {deadline && (
            <div className="meta" style={{ color: 'var(--danger)', fontWeight: 700 }}>
              🚨 The window shuts within days. Refuse this and there may be no second bid.
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn gold" onClick={() => answer(() => respondToOffer(game, o.id, true))}>
              Accept {fmtMoney(o.fee)}
            </button>
            <button className="btn" disabled={!!o.countered}
              title={o.countered ? 'You have already been back to them once' : 'Ask for more, and risk them walking'}
              onClick={() => answer(() => counterIncomingOffer(game, o.id))}>
              {o.countered ? 'Already Asked' : 'Demand More'}
            </button>
            <button className="btn danger" onClick={() => answer(() => respondToOffer(game, o.id, false))}>
              Reject
            </button>
          </div>
          {msg && <div className="meta sheet-log" style={{ marginTop: 8 }}>{msg}</div>}
        </div>

        <button className="btn ghost block" onClick={() => go('player', p.id)}>
          View {p.name}'s profile ▸
        </button>
      </div>
      <div className="spacer" />
    </>
  )
}
