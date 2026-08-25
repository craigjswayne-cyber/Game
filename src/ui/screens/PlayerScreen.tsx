import { useRef, useState } from 'react'
import { useStore } from '../../store'
import { ATTR_KEYS, SEASON_WEEKS, fmtMoney, fmtWage, type Attrs, type GameState, type Player } from '../../game/model'
import { agreeFee, agreePreContract, askingPrice, floorPrice, sellerWillingness, offerRenewalAt, personalTermsDemand, renewalDemand, signFreeAgent, signOnTerms, talkToPlayer } from '../../game/ai'
import { FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { flagOf, nationByCode } from '../../game/nations'
import { fineAttr, playerWage } from '../../game/attributes'
import { attrRange, fuzzedCa, knowledge, persKnown, reportStage } from '../../game/scout'
import { loanOut, loanRecall } from '../../game/loans'
import { canChat, chatBudget, praisePlayer, warnPlayer } from '../../game/chats'
import { mulberry32 } from '../../game/rng'
import { attrName, persName, posName, t, traitInfo, traitName } from '../../game/i18n'

export default function PlayerScreen({ playerId }: { playerId: number }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [msg, setMsgRaw] = useState<string | null>(null)
  /**
   * Say something back, WHERE THE MANAGER IS LOOKING.
   *
   * Reported from live play: "there was no conclusion to the negotiations when I
   * met him at his ask." The engine had concluded it perfectly - the player
   * signed - and the sentence saying so was rendered in a card near the top of a
   * page whose contract controls are at the bottom. He tapped Offer, the panel
   * closed, and nothing within a screenful of his thumb changed. Every action on
   * this page had the same fault: the answer arrived somewhere he could not see.
   */
  const msgRef = useRef<HTMLDivElement>(null)
  const setMsg = (text: string | null) => {
    setMsgRaw(text)
    if (text) requestAnimationFrame(() => msgRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }
  // the conclusion of the contract talks, shown inside the talks card
  const [talkOutcome, setTalkOutcome] = useState<string | null>(null)
  const [chatMsg, setChatMsg] = useState<string | null>(null)
  const [talkSigned, setTalkSigned] = useState(false)
  const [bidding, setBidding] = useState(false)
  const [bid, setBid] = useState(0)
  const [counter, setCounter] = useState<number | null>(null)
  // stage 2 of the 8D flow: fee agreed, personal terms on the table
  const [termsFee, setTermsFee] = useState<number | null>(null)
  const [wage, setWage] = useState(0)
  const [signOn, setSignOn] = useState(0)
  const [promiseMin, setPromiseMin] = useState(false)
  const [negotiating, setNegotiating] = useState(false)
  /** The wage box holds TEXT, not a number.
   *
   *  As a number it round-tripped through Number(e.target.value) on every
   *  keystroke, so clearing the box gave Number('') === 0, the input redrew as
   *  "0", and the next digit landed after it: type 4000 into an empty box and
   *  you got "04000" (user: "when i manually type a number, i remove the number
   *  and type and a 0 always comes up first"). Keeping the raw string means an
   *  empty box stays empty and only the offer button parses it. */
  const [wageText, setWageText] = useState('0')
  const wageOffer = Math.max(0, Math.round(Number(wageText) || 0))
  const [wageCounter, setWageCounter] = useState<number | null>(null)
  const [compare, setCompare] = useState(false)
  // three pages instead of one long scroll (user: fewer scrolls, more pages)
  const [ptab, setPtab] = useState<'profile' | 'attrs' | 'career'>('profile')

  const p = game.players[playerId]
  if (!p) return <div className="muted" style={{ padding: 14 }}>{t('player.gone')}</div>

  const club = p.clubId ? game.clubs[p.clubId] : null
  const mine = p.clubId === game.userClubId
  const avg = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
  const ask = club && !mine ? askingPrice(game, p) : 0
  const know = knowledge(game, p)
  const shortlisted = game.shortlist.includes(p.id)
  const toggleShortlist = useStore(s => s.toggleShortlist)

  const groups: [string, (keyof Attrs)[]][] = [
    ['player.grpSetPiece', ['scr', 'lin', 'ruc', 'tac', 'str', 'agg']],
    ['player.grpSkills', ['han', 'pas', 'kic', 'goa', 'vis', 'dec']],
    ['player.grpPhysical', ['pac', 'agi', 'sta', 'pos', 'wor', 'lea']],
  ]

  // one-tap comparison: this man against your best in the same shirt
  const rival = !mine ? game.clubs[game.userClubId].players
    .map(id => game.players[id])
    .filter(q => q && !q.acad && (q.pos === p.pos || q.alt.includes(p.pos)))
    .sort((a, b) => b!.ca - a!.ca)[0] ?? null : null

  return (
    <>
      <div className="tab-bar">
        <button className={ptab === 'profile' ? 'active' : ''} onClick={() => setPtab('profile')}>{t('player.tabProfile')}</button>
        <button className={ptab === 'attrs' ? 'active' : ''} onClick={() => setPtab('attrs')}>{t('player.tabAttributes')}</button>
        <button className={ptab === 'career' ? 'active' : ''} onClick={() => setPtab('career')}>{t('player.tabCareer')}</button>
      </div>
      {ptab === 'profile' && <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 20 }}>{p.name}</h3>
            <div className="meta">
              <PosBadge pos={p.pos} /> {posName(p.pos)}
              {p.alt.length > 0 && <span className="muted">{t('player.alsoPlays', { pos: p.alt.join(', ') })}</span>}
            </div>
            <div className="meta" style={{ marginTop: 3 }}>
              {t('player.natLine', { flag: flagOf(p.nat), country: nationByCode(p.nat)?.name ?? p.nat, age: p.age })}
              {p.intl ? t('player.international') : ''}{p.youth ? t('player.academyGrad') : ''}
            </div>
            {club && (
              <button className="meta club-link" style={{ color: 'var(--info)', fontWeight: 600, marginTop: 2 }}
                onClick={() => go('club', club.id)}>
                {club.name} ›
              </button>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <Stars ca={fuzzedCa(game, p)} />{know < 95 && <span className="muted" title={t('player.estimated')}> ?</span>}
            <div style={{ marginTop: 4 }}><FormPill v={p.form} /></div>
          </div>
        </div>
      </div>

      {/* ---- what this man is, in one sentence, before any numbers ----
          The profile opened with a wall of eighteen chips, all the same size and
          weight, so the two facts that actually decide whether you pick him -
          how good he is and whether he is fit - had no more prominence than his
          sign-on perks (user: "player profiles need work. they should be
          clearer"). The verdict line reads them out loud first, and every chip
          below now carries a plain-language title so a long-press explains it. */}
      <div className="card" style={{ borderLeft: `4px solid ${p.injury || p.bans > 0 ? 'var(--danger)' : p.form >= 7 ? 'var(--text-positive)' : 'var(--gold)'}` }}>
        <div className="meta" style={{ fontSize: 13, lineHeight: 1.5 }}>{verdictLine(game, p, mine)}</div>
      </div>

      <div className="chips">
        <span className="chip" title={t('player.overallTitle')}>
          {t('player.overall')} <b style={{ fontSize: 13 }}>{Math.round(fuzzedCa(game, p))}</b><span className="muted">/100</span></span>
        <span className="chip" title={t('player.characterTitle')}>{t('player.character')} <b>{persKnown(game, p) ? persName(p.pers) : t('player.unknown')}</b>{!persKnown(game, p) && <span className="muted" title={t('player.characterUnknownTitle')}> ?</span>}</span>
        {(p.caps ?? 0) > 0 && <span className="chip">🌍 <b>{p.caps}</b> {t('player.caps')}</span>}
        {p.trait && reportStage(game, p) >= 2 && <span className="chip" title={traitInfo(p.trait)} style={{ color: 'var(--info)', fontWeight: 700 }}>✨ {traitName(p.trait)}</span>}
        {!mine && <span className="chip" style={know < 55 ? { color: 'var(--gold)' } : undefined}>
          {t('player.scouted')} <b>{Math.round(know)}%</b></span>}
      </div>
      {!mine && (
        <div className="meta" style={{ padding: '2px 16px 4px', fontSize: 11.5 }}>
          🔍 {t(`scoutStage.${reportStage(game, p)}`)}
        </div>
      )}
      <div className="chips">
        <span className="chip" title={t('player.valueTitle')}>{t('player.value')} <b>{fmtMoney(p.value)}</b></span>
        <span className="chip" title={t('player.wageTitle')}>{t('player.wage')} <b>{fmtWage(p.wage)}{t('common.perWeek')}</b></span>
        <span className="chip" title={t('player.contractToTitle')}>{t('player.contractTo')} <b>{2026 + p.contractEnds}</b></span>
        {(p.wantsDeal ?? 0) > 0 && <span className="chip" style={{ borderColor: 'var(--gold)', color: 'var(--gold)', fontWeight: 700 }}>
          {t('player.agentWantsTerms')}</span>}
        {(p.wantsOut ?? 0) > 0 && <span className="chip" style={{ borderColor: 'var(--text-negative)', color: 'var(--text-negative)', fontWeight: 700 }}
          title={t('player.transferRequestTitle')}>
          {t('player.transferRequest')}</span>}
        <span className="chip" title={t('player.moraleTitle')}>{t('player.morale')} <b>{moraleWord(p.morale)}</b></span>
        <span className="chip" title={t('player.fitnessTitle')}>{t('player.fitness')} <b>{Math.round(p.cond)}%</b></span>
        <span className="chip" title={t('player.sharpnessTitle')}>{t('player.sharpness')} <b>{Math.round(p.sharp)}%</b></span>
        {p.injury && <span className="chip" style={{ borderColor: 'var(--text-negative)', color: 'var(--text-negative)' }}>
          {t('player.injuredChip', { desc: p.injury.desc, n: Math.max(0, p.injury.until - game.week) })}</span>}
        {p.bans > 0 && <span className="chip" style={{ color: 'var(--text-negative)' }}>{t(p.bans === 1 ? 'player.suspendedChipOne' : 'player.suspendedChip', { n: p.bans })}</span>}
        {p.acad && <span className="chip" style={{ color: 'var(--info)', fontWeight: 700 }}>{t('player.academySquad')}</span>}
        {p.natSquad && <span className="chip">{t('player.onIntlDuty')}</span>}
        {p.onLoan && <span className="chip" style={{ color: 'var(--gold)' }}>{t('player.awayOnLoan')}</span>}
        {p.transferListed && <span className="chip" style={{ color: 'var(--gold)' }}>{t('player.transferListed')}</span>}
      </div>

      {/* THE OFFICE (audit 20D). Players used to knock on the manager's door;
          the manager could never knock back. Two conversations a week, one per
          man: praise the form or have the quiet word. The outcome is his
          personality's, not a dice roll - see chats.ts. */}
      {mine && !p.onLoan && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="fact-label">{t('player.theOffice')}</div>
          {chatMsg
            ? <div className="meta" style={{ fontStyle: 'italic' }}>{chatMsg}</div>
            : canChat(game, p)
              ? <div className="meta muted">{t(chatBudget(game) === 1 ? 'player.callHimInOne' : 'player.callHimIn', { n: chatBudget(game) })}</div>
              : <div className="meta muted">{t(p.lastChatWk === game.season * SEASON_WEEKS + game.week ? 'player.spokenAlready' : 'player.noConversations')}</div>}
          {!chatMsg && canChat(game, p) && (
            <div className="btn-row" style={{ marginTop: 6 }}>
              <button className="btn ghost" style={{ flex: 1 }}
                title={t(p.form >= 6.8 ? 'player.praiseTitleGood' : 'player.praiseTitleBad')}
                onClick={() => { setChatMsg(praisePlayer(game, p)); touch() }}>{t('player.praiseForm')}</button>
              <button className="btn ghost" style={{ flex: 1 }}
                title={t(p.form < 6.8 ? 'player.warnTitleGood' : 'player.warnTitleBad')}
                onClick={() => { setChatMsg(warnPlayer(game, p)); touch() }}>{t('player.quietWord')}</button>
            </div>
          )}
        </div>
      )}
      </>}

      {ptab === 'attrs' && rival && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="fact-label">{t('player.compare')}</div>
            <div className="meta">
              {t('player.yourBest', { pos: p.pos })}<b>{rival.name}</b> {t('player.rivalMeta', { ca: Math.round(rival.ca), age: rival.age, wage: fmtWage(rival.wage) })}
              {compare ? t('player.shownBeside') : ''}
            </div>
          </div>
          <button className={`btn ${compare ? 'gold' : 'ghost'}`} onClick={() => setCompare(!compare)}>
            {t(compare ? 'player.comparing' : 'player.compareBtn')}
          </button>
        </div>
      )}
      {ptab === 'attrs' && <>
      <SectionTitle sub={compare && rival ? t('player.attrsSubCompare', { name: rival.name.split(' ').slice(-1)[0] }) : t('player.attrsSub')}>{t('player.attributes')}</SectionTitle>
      <div className="fm-attrs">
        {groups.map(([title, keys]) => (
          <div className="fm-col" key={title}>
            <div className="fm-col-head">{t(title)}</div>
            {keys.map(k => {
              const [lo, hi] = attrRange(game, p, k)
              const exact = lo === hi
              const mid = Math.round((lo + hi) / 2)
              const idx = ATTR_KEYS.indexOf(k)
              // the man's own rating out of 100, not the attribute times five -
              // see fineAttr for why the fifth is real rather than decoration
              const v = fineAttr(p.id, idx, mid)
              const rv = compare && rival ? fineAttr(rival.id, idx, rival.a[k]) : null
              return (
                <div className="fm-attr" key={k}>
                  <span className="fm-name">{attrName(k)}</span>
                  {rv != null && (
                    <b className="fm-rival" style={{ color: v > rv ? 'var(--text-positive)' : v < rv ? 'var(--text-negative)' : 'var(--text-muted)' }}>{rv}</b>
                  )}
                  <b className={`fm-chip ${exact ? (v >= 80 ? 'hi' : v >= 55 ? 'mid' : 'lo') : 'rng'}`}>
                    {exact ? v : `${fineAttr(p.id, idx, lo)}-${fineAttr(p.id, idx, hi)}`}
                  </b>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      </>}
      {ptab === 'profile' && <>
      <SectionTitle sub={t('player.avgRating', { n: avg ? avg.toFixed(2) : '-' })}>{t('player.thisSeason')}</SectionTitle>
      <div className="chips">
        <span className="chip">{t('player.apps')} <b>{p.stats.apps}</b> {t('player.appsStarts', { n: p.stats.starts })}</span>
        <span className="chip">{t('player.tries')} <b>{p.stats.tries}</b></span>
        <span className="chip">{t('player.points')} <b>{p.stats.points}</b></span>
        <span className="chip">{t('player.cons')} <b>{p.stats.cons}</b></span>
        <span className="chip">{t('player.pens')} <b>{p.stats.pens}</b></span>
        {p.stats.drops > 0 && <span className="chip">{t('player.drops')} <b>{p.stats.drops}</b></span>}
        <span className="chip">{t('player.cards')} <b>{p.stats.yc}{t('squad.colYC').slice(0, 1)} {p.stats.rc}{t('squad.colRC').slice(0, 1)}</b></span>
        {p.stats.motm > 0 && <span className="chip">{t('player.motm')} <b>{p.stats.motm}</b></span>}
        {(p.lions ?? 0) > 0 && <span className="chip">{t('player.lions')}{(p.lions ?? 0) > 1 ? <b> ×{p.lions}</b> : null}</span>}
        {(p.wcWins ?? 0) > 0 && <span className="chip">{t('player.wcWinner')}{(p.wcWins ?? 0) > 1 ? <b> ×{p.wcWins}</b> : null}</span>}
        {p.lastR != null && <span className="chip">{t('player.lastMatch')} <b>{Math.min(10, Math.max(1, p.lastR)).toFixed(1)}</b></span>}
        {(p.ca - (p.ca0 ?? p.ca)) !== 0 && (
          <span className="chip">{t('player.development')} <b style={{ color: p.ca > (p.ca0 ?? p.ca) ? 'var(--text-positive)' : 'var(--text-negative)' }}>
            {p.ca > (p.ca0 ?? p.ca) ? '▲' : '▼'} {Math.abs(p.ca - (p.ca0 ?? p.ca))}
          </b></span>
        )}
        {p.age <= 21 && p.pa >= 86 && <span className="chip" style={{ borderColor: 'var(--gold)' }}>🌟 <b>{t('player.wonderkid')}</b></span>}
        {(p.poty ?? 0) > 0 && (
          <span className="chip" style={{ borderColor: 'var(--gold)' }}>
            🏅 <b>{t('player.worldPoty')}{(p.poty ?? 0) > 1 ? ` ×${p.poty}` : ''}</b>
          </span>
        )}
        {p.retiring && !p.farewell && (
          <span className="chip" style={{ borderColor: 'var(--danger)' }} title={t('player.retiringTitle')}>
            🎤 <b>{t('player.retiringSummer')}</b>
          </span>
        )}
        {(game.pledges ?? []).some(pl => pl.playerId === p.id) && !(game.preContracts ?? []).some(x => x.playerId === p.id) && (
          <span className="chip" style={{ borderColor: 'var(--gold)' }} title={t('player.promiseTitle')}>
            🤝 <b>{t('player.promiseMade')}</b>
          </span>
        )}
        {(() => {
          const pc = (game.preContracts ?? []).find(x => x.playerId === p.id)
          if (!pc) return null
          const to = game.clubs[pc.toClubId]
          const incoming = pc.toClubId === game.userClubId
          return (
            <span className="chip" style={{ borderColor: incoming ? 'var(--gold)' : 'var(--danger)' }}>
              🖊 <b>{t('player.preContract', { club: to?.short ?? '?' })}</b>
            </span>
          )
        })()}
      </div>

      </>}
      {ptab === 'career' && (p.career.length > 0 || (p.hist?.apps ?? 0) > 0) && (
        <>
          <SectionTitle>{t('player.career')}</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>{t('player.colSeason')}</th><th>{t('player.colClub')}</th><th className="num">{t('club.colApps')}</th><th className="num">{t('club.colTries')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
            <tbody>
              {[...p.career].reverse().map((c, i) => (
                <tr key={i}>
                  <td>{2025 + c.season}-{String((2026 + c.season) % 100).padStart(2, '0')}</td>
                  <td>{game.clubs[c.clubId]?.short ?? c.clubId}</td>
                  <td className="num">{c.apps}</td>
                  <td className="num">{c.tries}</td>
                  <td className="num">{c.points}</td>
                </tr>
              ))}
              {(p.hist?.apps ?? 0) > 0 && (
                <tr className="muted">
                  <td>{t('player.pre2025')}</td>
                  <td>{p.exClub && game.clubs[p.exClub] ? t('player.inclClub', { club: game.clubs[p.exClub].short, apps: p.exApps ?? 0 }) : t('player.earlierCareer')}</td>
                  <td className="num">{p.hist!.apps}</td>
                  <td className="num">{p.hist!.tries}</td>
                  <td className="num">{p.hist!.points}</td>
                </tr>
              )}
              <tr style={{ fontWeight: 700 }}>
                <td>{t('player.total')}</td>
                <td className="muted">{t('player.inclThisSeason')}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)}</td>
              </tr>
            </tbody>
          </table></div>
        </>
      )}

      {msg && <div ref={msgRef} className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        {msg}
        {counter != null && (
          <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => {
            const r = agreeFee(game, p.id, counter)
            setMsg(r.msg); setCounter(r.counter ?? null)
            if (r.ok) { setTermsFee(counter); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
            touch()
          }}>{t('player.meetTheirPrice', { fee: fmtMoney(counter) })}</button>
        )}
      </div>}

      {termsFee != null && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 15 }}>{t('player.personalTerms', { fee: fmtMoney(termsFee) })}</h3>
          <div className="meta" style={{ margin: '4px 0' }}>{t('player.campOpensAt')}<b>£{personalTermsDemand(game, p).toLocaleString()}{t('common.perWeek')}</b>{t('player.campOpensRest')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span className="fact-label" style={{ width: 84 }}>{t('player.wagePerWeek')}</span>
            <button className="btn ghost" onClick={() => { setWage(Math.max(500, wage - 500)) }}>−</button>
            <b style={{ minWidth: 76, textAlign: 'center' }}>£{wage.toLocaleString()}</b>
            <button className="btn ghost" onClick={() => { setWage(wage + 500) }}>+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span className="fact-label" style={{ width: 84 }}>{t('player.signOn')}</span>
            <button className="btn ghost" onClick={() => { setSignOn(Math.max(0, signOn - 25_000)) }}>−</button>
            <b style={{ minWidth: 76, textAlign: 'center' }}>{fmtMoney(signOn)}</b>
            <button className="btn ghost" onClick={() => { setSignOn(signOn + 25_000) }}>+</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
            <input type="checkbox" checked={promiseMin} onChange={e => setPromiseMin(e.target.checked)} />
            {t('player.promiseFirstTeam')}
          </label>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => { setTermsFee(null); setMsg(t('player.walkedAway')) }}>{t('player.walkAway')}</button>
            <button className="btn gold" style={{ flex: 1.6 }} onClick={() => {
              const r = signOnTerms(game, p.id, termsFee, wage, signOn, promiseMin)
              setMsg(r.msg)
              if (r.ok) setTermsFee(null)
              touch()
            }}>{t('player.agreeTerms')}</button>
          </div>
        </div>
      )}

      {mine && !p.onLoan && p.age <= 23 && !game.clubs[game.userClubId].tactic.lineup.slice(0, 15).includes(p.id) && (
        <button className="btn ghost block" onClick={() => {
          setMsg(loanOut(game, p.id).msg)
          touch()
        }}>{t('player.sendOnLoan')}</button>
      )}
      {/* the loan is visible from here too (16B, user: "there should be a
          report on how they are doing... they should also be able to be
          recalled at any point"). The verdict mirrors the loan-watch postcard's
          own deterministic roll, so the page and the letters agree. */}
      {mine && p.onLoan && (() => {
        const boost = 2 + Math.floor(mulberry32(game.seed + p.id)() * 3)
        const verdict = t(p.ca >= p.pa ? 'player.loanHisLevel'
          : boost >= 4 ? 'player.loanFirstName'
          : boost === 3 ? 'player.loanGrowing'
          : 'player.loanSteady')
        return (
          <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
            <div className="fact-label">{t('player.outOnLoan')}</div>
            <div className="meta" style={{ marginTop: 4 }}>{verdict}</div>
            <div className="meta" style={{ marginTop: 4 }}>
              {t('player.loanRecallNote')}
            </div>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => {
              setMsg(loanRecall(game, p.id).msg)
              touch()
            }}>{t('player.recallFromLoan')}</button>
          </div>
        )
      })()}
      {mine && p.acad && (
        <button className="btn gold block" onClick={() => {
          p.acad = false
          // promoted by hand is still a graduate of your academy
          p.homegrown = true
          // a first-team player is paid like one: the rollover graduation path
          // has always re-priced the development deal, and this button did not,
          // which made hand-promotion a free-labour loophole (audit 16D)
          p.wage = playerWage(p.ca, p.age)
          p.morale = Math.min(10, p.morale + 1)
          game.news.push({
            id: game.nextId++, week: game.week, season: game.season, type: 'youth', read: true,
            subject: `${p.name} promoted to the first team`,
            body: `A big day at the training ground: ${p.name} (${p.age}) has been called up from the academy to full first-team duty. The academy coach shakes his hand at the door - his work here is done.`,
            playerId: p.id,
          })
          setMsg(t('player.promotedMsg', { name: p.name }))
          touch()
        }}>{t('player.promoteFirstTeam')}</button>
      )}
      {mine && !p.acad && (() => {
        const club = game.clubs[game.userClubId]
        const marquee = club.marquee ?? []
        const isMarquee = marquee.includes(p.id)
        if (!isMarquee && marquee.length >= 2) return null
        return (
          <button className={`btn ${isMarquee ? '' : 'ghost'} block`} onClick={() => {
            club.marquee = isMarquee ? marquee.filter(id => id !== p.id) : [...marquee, p.id]
            setMsg(isMarquee
              ? t('player.marqueeLost', { name: p.name })
              : t(2 - marquee.length - 1 === 1 ? 'player.marqueeGivenOne' : 'player.marqueeGiven', { name: p.name, n: 2 - marquee.length - 1 }))
            touch()
          }}>
            {isMarquee ? t('player.marqueeRemove') : t(2 - marquee.length === 1 ? 'player.marqueeDesignateOne' : 'player.marqueeDesignate', { n: 2 - marquee.length })}
          </button>
        )
      })()}
      {mine && !p.onLoan && (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => { setMsg(talkToPlayer(game, p.id, 'praise')); touch() }}>
            {t('player.praiseHisForm')}
          </button>
          <button className="btn ghost" onClick={() => { setMsg(talkToPlayer(game, p.id, 'word')); touch() }}>
            {t('player.haveAWord')}
          </button>
        </div>
      )}
      {mine ? (
        <>
          {negotiating && (
            <div className="card">
              <h3>{t('player.contractTalks', { name: p.name.split(' ').slice(-1)[0] })}</h3>
              {/* THE TALKS ANSWER THEMSELVES, IN THE CARD.
                  The outcome used to go only to the message card at the top of
                  this page, so meeting a player's asking wage looked like nothing
                  at all: the panel closed and the sentence explaining that he had
                  signed was several screenfuls above the thumb that tapped. */}
              {talkOutcome ? (
                <>
                  <div className="sheet-casualty" style={{ borderLeftColor: talkSigned ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                    {talkSigned ? '🖊 ' : '💬 '}{talkOutcome}
                  </div>
                  {talkSigned
                    ? <div className="meta">{t('player.heIsOn', { wage: fmtWage(p.wage), year: 2026 + p.contractEnds })}</div>
                    : null}
                  <div className="btn-row" style={{ margin: '10px 0 0' }}>
                    {!talkSigned && (
                      <button className="btn" onClick={() => setTalkOutcome(null)}>{t('player.keepTalking')}</button>
                    )}
                    <button className="btn ghost" onClick={() => {
                      setNegotiating(false); setWageCounter(null); setTalkOutcome(null); setTalkSigned(false)
                    }}>{t(talkSigned ? 'player.done' : 'player.leaveItThere')}</button>
                  </div>
                  {!talkSigned && wageCounter != null && (
                    <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => {
                      const r = offerRenewalAt(game, p.id, wageCounter)
                      setMsg(r.msg); setTalkOutcome(r.msg); setTalkSigned(r.ok)
                      setWageCounter(r.counter ?? null); setWageText(String(wageCounter)); touch()
                    }}>{t('player.meetTheirNumber', { wage: fmtWage(wageCounter) })}</button>
                  )}
                </>
              ) : (
                <>
                  <div className="meta">{t('player.campWants', { demand: fmtWage(renewalDemand(p)), wage: fmtWage(p.wage) })}</div>
                  <input className="inline-input" type="text" inputMode="numeric" value={wageText}
                    onChange={e => setWageText(e.target.value.replace(/[^0-9]/g, ''))} />
                  <div className="btn-row" style={{ margin: '10px 0 0' }}>
                    <button className="btn gold" onClick={() => {
                      const r = offerRenewalAt(game, p.id, wageOffer)
                      setMsg(r.msg); setTalkOutcome(r.msg); setTalkSigned(r.ok)
                      setWageCounter(r.counter ?? null); touch()
                    }}>{t('player.offerWage', { amount: wageOffer.toLocaleString() })}</button>
                    <button className="btn ghost" onClick={() => { setNegotiating(false); setWageCounter(null) }}>{t('player.walkAwayCaps')}</button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="btn-row">
            {!negotiating && (
              <button className="btn" onClick={() => {
                setNegotiating(true); setWageText(String(Math.round(renewalDemand(p) * 0.9 / 50) * 50))
                setWageCounter(null); setTalkOutcome(null); setTalkSigned(false)
              }}>{t('player.openContractTalks')}</button>
            )}
            <button className={`btn ${p.transferListed ? 'ghost' : 'danger'}`} onClick={() => {
              p.transferListed = !p.transferListed
              setMsg(t(p.transferListed ? 'player.listedMsg' : 'player.unlistedMsg', { name: p.name }))
              touch()
            }}>{t(p.transferListed ? 'player.unlist' : 'player.transferList')}</button>
          </div>
        </>
      ) : club ? (
        <>
          <button className={`btn ${shortlisted ? '' : 'ghost'} block`} onClick={() => toggleShortlist(p.id)}>
            {t(shortlisted ? 'player.onShortlist' : 'player.shortlistScout')}
          </button>
          {!bidding
            ? <>
              {p.contractEnds <= game.season && game.week >= 25 && !(game.preContracts ?? []).some(x => x.playerId === p.id) && (
                <button className="btn gold block" onClick={() => {
                  setMsg(agreePreContract(game, p.id).msg); touch()
                }}>
                  {t('player.agreePreContract')}
                </button>
              )}
              <button className="btn gold block" onClick={() => {
                const r = agreeFee(game, p.id, ask)
                setMsg(r.msg); setCounter(r.counter ?? null)
                if (r.ok) { setTermsFee(ask); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
                touch()
              }}>
                {t('player.offerAskingPrice', { fee: fmtMoney(ask) })}
              </button>
              {/* WHERE THE SELLING CLUB STANDS.
                  Asked in live play: "would they ever accept under?" They would,
                  but only when something weakens their hand, and there was no way
                  to know which players those were without bidding blind. So say
                  it: how far they might come down, and why. A club with no reason
                  to sell says so too, which saves a pointless negotiation. */}
              {(() => {
                const w = sellerWillingness(game, p)
                return (
                  <div className="card" style={{ marginTop: 4 }}>
                    <div className="fact-label">{t('player.whereTheyStand', { club: club.short })}</div>
                    {w.discount > 0 ? (
                      <>
                        <div className="meta">
                          {t('player.wouldListen')}<b>{fmtMoney(floorPrice(game, p))}</b>.
                        </div>
                        {w.reasons.map((r, i) => { const s = t(r.k, r.v); return <div className="meta muted" key={i}>· {s.charAt(0).toUpperCase()}{s.slice(1)}</div> })}
                      </>
                    ) : (
                      <div className="meta">
                        {t('player.noReasonToSell')}
                      </div>
                    )}
                  </div>
                )
              })()}
              <button className="btn ghost block" style={{ marginTop: 4 }} onClick={() => { setBidding(true); setBid(ask) }}>
                {t('player.haggle')}
              </button>
            </>
            : (
              <div className="card">
                <h3 style={{ fontSize: 15 }}>{t('player.yourOffer', { club: club.short })}</h3>
                <div className="meta">{t('player.askAndBudget', { ask: fmtMoney(ask), budget: fmtMoney(game.clubs[game.userClubId].budget) })}</div>
                {floorPrice(game, p) < ask - 50_000 && (
                  <div className="meta muted">{t('player.asLowAs', { floor: fmtMoney(floorPrice(game, p)) })}</div>
                )}
                {/* THE STEPPER IS A GRID, NOT A ROW (user, on a 412px phone:
                    "the reduce or plus 500 go off the screen and dont fit in
                    the box"). Five items on one nowrap flex line - two minus
                    buttons, the fee, two plus buttons - measured 398px of
                    content inside a 336px card, so -500k rendered at x=-19 and
                    +500k ran off the right. The fee gets its own line, where it
                    wants to be big anyway, and the four steps share four equal
                    columns that cannot outgrow the card. scripts/bidprobe.mjs
                    measures it at 360, the narrowest phone supported. */}
                <div className="bid-step">
                  <b className="bid-amt">{fmtMoney(bid)}</b>
                  <button className="btn ghost" onClick={() => setBid(Math.max(100_000, bid - 500_000))}>−500k</button>
                  <button className="btn ghost" onClick={() => setBid(Math.max(100_000, bid - 100_000))}>−100k</button>
                  <button className="btn ghost" onClick={() => setBid(bid + 100_000)}>+100k</button>
                  <button className="btn ghost" onClick={() => setBid(bid + 500_000)}>+500k</button>
                </div>
                <div className="btn-row">
                  <button className="btn ghost" onClick={() => setBidding(false)}>{t('player.cancel')}</button>
                  <button className="btn gold" style={{ flex: 1.6 }} onClick={() => {
                    const r = agreeFee(game, p.id, bid)
                    setMsg(r.msg); setCounter(r.counter ?? null); setBidding(false)
                    if (r.ok) { setTermsFee(bid); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
                    touch()
                  }}>{t('player.submitBid')}</button>
                </div>
              </div>
            )}
        </>
      ) : (
        <button className="btn gold block" onClick={() => {
          // one path with the engine's guards (cap, embargo, wage budget) -
          // the old inline version skipped the first two
          setMsg(signFreeAgent(game, p.id).msg)
          touch()
        }}>{t('player.signFreeAgent')}</button>
      )}
      <div className="spacer" />
    </>
  )
}

function moraleWord(m: number): string {
  return t(m >= 8.5 ? 'player.moraleSuperb' : m >= 7.5 ? 'player.moraleVeryGood' : m >= 6 ? 'player.moraleGood'
    : m >= 5 ? 'player.moraleFair' : m >= 3.5 ? 'player.moralePoor' : 'player.moraleVeryPoor')
}

/**
 * The one-sentence verdict at the top of a profile.
 *
 * Reads the same state the chips below do, but in the order a coach would say it
 * out loud: what he is, whether you can pick him, and the one thing about him
 * that matters this week. Nothing here is invented - every clause is a fact from
 * his own record.
 */
function verdictLine(game: GameState, p: Player, mine: boolean): string {
  const ca = Math.round(fuzzedCa(game, p))
  const know = knowledge(game, p)
  const standard = t(ca >= 85 ? 'player.vStar'
    : ca >= 75 ? 'player.vFirstChoice'
    : ca >= 65 ? 'player.vSolid'
    : ca >= 55 ? 'player.vFiller'
    : 'player.vFuture')
  const bits: string[] = []
  bits.push(t('player.vOpening', {
    age: p.age, pos: posName(p.pos).toLowerCase(), standard,
    caveat: !mine && know < 60 ? t('player.vCaveat') : '',
  }))
  if (p.injury) {
    const wks = Math.max(0, p.injury.until - game.week)
    bits.push(t(wks === 1 ? 'player.vInjuredOne' : 'player.vInjured', { desc: p.injury.desc.toLowerCase(), n: wks }))
  } else if (p.bans > 0) {
    bits.push(t(p.bans === 1 ? 'player.vSuspendedOne' : 'player.vSuspended', { n: p.bans }))
  } else if (p.natSquad) {
    bits.push(t('player.vAway'))
  } else if (p.onLoan) {
    bits.push(t('player.vOnLoan'))
  } else if (p.cond < 72) {
    bits.push(t('player.vUnfit', { pct: Math.round(p.cond) }))
  } else {
    bits.push(t('player.vFit'))
  }
  if (mine) {
    if (p.contractEnds <= game.season) bits.push(t('player.vExpiring'))
    else if ((p.wantsOut ?? 0) > 0) bits.push(t('player.vWantsOut'))
    else if ((p.wantsDeal ?? 0) > 0) bits.push(t('player.vWantsDeal'))
    else if (p.morale <= 4) bits.push(t('player.vUnhappy'))
    else if (p.form >= 7.5) bits.push(t('player.vInForm'))
  } else if (p.transferListed) {
    bits.push(t('player.vListed'))
  }
  return bits.join(' ')
}
