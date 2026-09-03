import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, fmtWage } from '../../game/model'
import { counterIncomingOffer, respondToOffer } from '../../game/ai'
import { CrestT, PosBadge, Stars, TwoStep } from '../components'
import { statusOf, STATUS_BY_ID } from '../../game/gametime'
import { t } from '../../game/i18n'

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
  // KEYED TO THE OFFER THAT WAS ANSWERED. As a bare string this rendered inside
  // EVERY offer card at once (the line lives in the per-offer body), so
  // rejecting the second bid printed "you turned it down" under the first and
  // third as well - three clubs appearing to have been answered by one tap.
  const [msg, setMsg] = useState<{ key: number; text: string } | null>(null)

  const pending = game.offers.filter(o => o.status === 'pending' && o.forUser)
  const o = pending[0]

  // The desk is clear: press on with the week that was interrupted. This is the
  // only way out of the screen, which is the point of it.
  if (!o) {
    return (
      <div style={{ padding: 14 }}>
        <div className="card">
          <h3>{t('world.ofDeskClear')}</h3>
          <div className="meta">{msg?.text ?? t('world.ofNothingWaiting')}</div>
          <button className="btn gold block" style={{ marginTop: 10 }} onClick={() => continueWeek()}>
            {t('world.ofGetOn')}
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

  const answer = (key: number, fn: () => string) => { setMsg({ key, text: fn() }); touch() }

  return (
    <>
      <div style={{ padding: '10px 14px 0' }}>
        <div className="filter-note">
          {pending.length === 1 ? t('world.ofOneBid') : t('world.ofNBids', { n: pending.length })}{t('world.ofWeekWaits')}
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="offer-head">
            <CrestT g={game} teamId={bidder.id} size={34} />
            <div>
              <h3 style={{ margin: 0 }}>{t('world.ofBidLine', { club: bidder.name, fee: fmtMoney(o.fee) })}</h3>
              <div className="meta">{t('world.ofForPlayer', { player: p.name })}</div>
            </div>
          </div>

          <table className="dtable"><tbody>
            <tr>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name}</td>
              <td><Stars ca={p.ca} /></td>
              <td className="num">{t('world.ofYrs', { n: p.age })}</td>
            </tr>
          </tbody></table>

          <div className="meta" style={{ marginTop: 6 }}>
            {t('world.ofValuedAt', { value: fmtMoney(p.value) })}
            <b style={{ color: over > 0 ? 'var(--text-positive)' : 'var(--danger)' }}>
              {over > 0 ? t('world.ofOver', { amount: fmtMoney(over) }) : over < 0 ? t('world.ofUnder', { amount: fmtMoney(-over) }) : t('world.ofExactly')}
            </b>{t('world.ofTheValuation')}
            <b>{t(`squad.status${st[0].toUpperCase()}${st.slice(1)}`).toLowerCase()}</b>
            {t('world.ofOnWage', { wage: fmtWage(p.wage), year: 2026 + p.contractEnds - game.season - 1 })}
          </div>
          <div className="meta">
            {cover.length === 0
              ? t('world.ofNoCover', { pos: p.pos })
              : t('world.ofCover', {
                  names: cover.slice(0, 2).map(x => x.name).join(', '),
                  more: cover.length > 2 ? t('world.ofAndMore', { n: cover.length - 2 }) : '',
                })}
          </div>
          {deadline && (
            <div className="meta" style={{ color: 'var(--danger)', fontWeight: 700 }}>
              {t('world.ofDeadline')}
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 10 }}>
            <TwoStep className="btn gold" label={t('world.ofAccept', { fee: fmtMoney(o.fee) })} confirm={t('common.confirmSell')}
              onConfirm={() => answer(o.id, () => respondToOffer(game, o.id, true))} />
            <button className="btn ghost" disabled={!!o.countered}
              title={t(o.countered ? 'world.ofAskedTitle' : 'world.ofDemandTitle')}
              onClick={() => answer(o.id, () => counterIncomingOffer(game, o.id))}>
              {t(o.countered ? 'world.ofAlreadyAsked' : 'world.ofDemandMore')}
            </button>
            <button className="btn danger" onClick={() => answer(o.id, () => respondToOffer(game, o.id, false))}>
              {t('transfers.reject')}
            </button>
          </div>
          {msg?.key === o.id && <div className="meta sheet-log" style={{ marginTop: 8 }}>{msg.text}</div>}
        </div>

        <button className="btn ghost block" onClick={() => go('player', p.id)}>
          {t('world.ofViewProfile', { player: p.name })}
        </button>
      </div>
      <div className="spacer" />
    </>
  )
}
