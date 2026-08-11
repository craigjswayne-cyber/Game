import { useRef, useState } from 'react'
import { useStore } from '../../store'
import { ATTR_KEYS, ATTR_NAMES, POS_NAMES, TRAIT_INFO, fmtMoney, fmtWage, type Attrs, type GameState, type Player } from '../../game/model'
import { agreeFee, agreePreContract, askingPrice, floorPrice, sellerWillingness, offerRenewalAt, personalTermsDemand, renewalDemand, signOnTerms, talkToPlayer } from '../../game/ai'
import { FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { flagOf, nationByCode } from '../../game/nations'
import { fineAttr, playerWage } from '../../game/attributes'
import { attrRange, fuzzedCa, knowledge } from '../../game/scout'
import { loanOut, loanRecall } from '../../game/loans'
import { mulberry32 } from '../../game/rng'

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
  if (!p) return <div className="muted" style={{ padding: 14 }}>Player no longer in the game world (retired or released).</div>

  const club = p.clubId ? game.clubs[p.clubId] : null
  const mine = p.clubId === game.userClubId
  const avg = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
  const ask = club && !mine ? askingPrice(game, p) : 0
  const know = knowledge(game, p)
  const shortlisted = game.shortlist.includes(p.id)
  const toggleShortlist = useStore(s => s.toggleShortlist)

  const groups: [string, (keyof Attrs)[]][] = [
    ['Set Piece & Contact', ['scr', 'lin', 'ruc', 'tac', 'str', 'agg']],
    ['Skills', ['han', 'pas', 'kic', 'goa', 'vis', 'dec']],
    ['Physical & Mental', ['pac', 'agi', 'sta', 'pos', 'wor', 'lea']],
  ]

  // one-tap comparison: this man against your best in the same shirt
  const rival = !mine ? game.clubs[game.userClubId].players
    .map(id => game.players[id])
    .filter(q => q && !q.acad && (q.pos === p.pos || q.alt.includes(p.pos)))
    .sort((a, b) => b!.ca - a!.ca)[0] ?? null : null

  return (
    <>
      <div className="tab-bar">
        <button className={ptab === 'profile' ? 'active' : ''} onClick={() => setPtab('profile')}>Profile</button>
        <button className={ptab === 'attrs' ? 'active' : ''} onClick={() => setPtab('attrs')}>Attributes</button>
        <button className={ptab === 'career' ? 'active' : ''} onClick={() => setPtab('career')}>Career</button>
      </div>
      {ptab === 'profile' && <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 20 }}>{p.name}</h3>
            <div className="meta">
              <PosBadge pos={p.pos} /> {POS_NAMES[p.pos]}
              {p.alt.length > 0 && <span className="muted"> (also {p.alt.join(', ')})</span>}
            </div>
            <div className="meta" style={{ marginTop: 3 }}>
              {flagOf(p.nat)} {nationByCode(p.nat)?.name ?? p.nat} · {p.age} yrs
              {p.intl ? ' · International' : ''}{p.youth ? ' · Academy graduate' : ''}
            </div>
            {club && (
              <button className="meta" style={{ color: 'var(--accent-ink)', fontWeight: 600, marginTop: 2 }}
                onClick={() => go('club', club.id)}>
                {club.name} ›
              </button>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <Stars ca={fuzzedCa(game, p)} />{know < 95 && <span className="muted" title="Estimated - scout him for certainty"> ?</span>}
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
      <div className="card" style={{ borderLeft: `4px solid ${p.injury || p.bans > 0 ? 'var(--red)' : p.form >= 7 ? 'var(--win)' : 'var(--gold)'}` }}>
        <div className="meta" style={{ fontSize: 13, lineHeight: 1.5 }}>{verdictLine(game, p, mine)}</div>
      </div>

      <div className="chips">
        <span className="chip" title="his overall standard out of 100, and the one number that decides most matches">
          Overall <b style={{ fontSize: 13 }}>{Math.round(fuzzedCa(game, p))}</b><span className="muted">/100</span></span>
        <span className="chip" title="how he behaves: it drives contract talks, team talks and whether he mentors well">Character <b>{p.pers}</b></span>
        {(p.caps ?? 0) > 0 && <span className="chip">🌍 <b>{p.caps}</b> caps</span>}
        {p.trait && <span className="chip" title={TRAIT_INFO[p.trait]} style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>✨ {p.trait}</span>}
        {!mine && <span className="chip" style={know < 55 ? { color: '#a8841a' } : undefined}>
          Scouted <b>{Math.round(know)}%</b></span>}
        <span className="chip" title="what the market says he is worth, not what a club would accept">Value <b>{fmtMoney(p.value)}</b></span>
        <span className="chip" title="what he costs you every week of the year">Wage <b>{fmtWage(p.wage)}/wk</b></span>
        <span className="chip" title="the summer his deal runs out. Leave it too late and he can sign elsewhere for nothing">Contract to <b>{2026 + p.contractEnds}</b></span>
        {(p.wantsDeal ?? 0) > 0 && <span className="chip" style={{ borderColor: '#a8841a', color: '#a8841a', fontWeight: 700 }}>
          💼 Agent wants new terms</span>}
        <span className="chip" title="how happy he is here. Unhappy men play worse and ask to leave">Morale <b>{moraleWord(p.morale)}</b></span>
        <span className="chip" title="how fresh his legs are. Below 70% he tires badly in the last quarter">Fitness <b>{Math.round(p.cond)}%</b></span>
        <span className="chip" title="match rhythm. A man back from injury is fit but not sharp, and it shows">Sharpness <b>{Math.round(p.sharp)}%</b></span>
        {p.injury && <span className="chip" style={{ borderColor: '#9b2c2c', color: '#9b2c2c' }}>
          Injured: {p.injury.desc} (~{Math.max(0, p.injury.until - game.week)}w)</span>}
        {p.bans > 0 && <span className="chip" style={{ color: '#9b2c2c' }}>Suspended {p.bans} match{p.bans > 1 ? 'es' : ''}</span>}
        {p.acad && <span className="chip" style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>🎓 Academy squad</span>}
        {p.natSquad && <span className="chip">On international duty</span>}
        {p.onLoan && <span className="chip" style={{ color: '#a8841a' }}>Away on season loan</span>}
        {p.transferListed && <span className="chip" style={{ color: '#a8841a' }}>Transfer listed</span>}
      </div>
      </>}

      {ptab === 'attrs' && rival && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="fact-label">Compare</div>
            <div className="meta">
              Your best {p.pos}: <b>{rival.name}</b> ({Math.round(rival.ca)} overall, {rival.age} yrs, {fmtWage(rival.wage)}/wk)
              {compare ? ' - his numbers shown beside each bar.' : ''}
            </div>
          </div>
          <button className={`btn ${compare ? 'gold' : 'ghost'}`} onClick={() => setCompare(!compare)}>
            {compare ? '✓ Comparing' : '⚖ Compare'}
          </button>
        </div>
      )}
      {ptab === 'attrs' && <>
      <SectionTitle sub={compare && rival ? `${rival.name.split(' ').slice(-1)[0]}'s numbers beside each chip` : 'every attribute, rated 1 to 100'}>Attributes</SectionTitle>
      <div className="fm-attrs">
        {groups.map(([title, keys]) => (
          <div className="fm-col" key={title}>
            <div className="fm-col-head">{title}</div>
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
                  <span className="fm-name">{ATTR_NAMES[k]}</span>
                  {rv != null && (
                    <b className="fm-rival" style={{ color: v > rv ? '#2f7d4f' : v < rv ? '#9b2c2c' : 'var(--ink-faint)' }}>{rv}</b>
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
      <SectionTitle sub={`avg rating ${avg ? avg.toFixed(2) : '-'}`}>This Season</SectionTitle>
      <div className="chips">
        <span className="chip">Apps <b>{p.stats.apps}</b> ({p.stats.starts} starts)</span>
        <span className="chip">Tries <b>{p.stats.tries}</b></span>
        <span className="chip">Points <b>{p.stats.points}</b></span>
        <span className="chip">Cons <b>{p.stats.cons}</b></span>
        <span className="chip">Pens <b>{p.stats.pens}</b></span>
        {p.stats.drops > 0 && <span className="chip">Drop goals <b>{p.stats.drops}</b></span>}
        <span className="chip">Cards <b>{p.stats.yc}Y {p.stats.rc}R</b></span>
        {p.stats.motm > 0 && <span className="chip">⭐ MOTM <b>{p.stats.motm}</b></span>}
        {(p.lions ?? 0) > 0 && <span className="chip">🦁 Lions tourist{(p.lions ?? 0) > 1 ? <b> ×{p.lions}</b> : null}</span>}
        {(p.wcWins ?? 0) > 0 && <span className="chip">🏆 World Cup winner{(p.wcWins ?? 0) > 1 ? <b> ×{p.wcWins}</b> : null}</span>}
        {p.lastR != null && <span className="chip">Last match <b>{Math.min(10, Math.max(1, p.lastR)).toFixed(1)}</b></span>}
        {(p.ca - (p.ca0 ?? p.ca)) !== 0 && (
          <span className="chip">Development <b style={{ color: p.ca > (p.ca0 ?? p.ca) ? '#2f7d4f' : '#9b2c2c' }}>
            {p.ca > (p.ca0 ?? p.ca) ? '▲' : '▼'} {Math.abs(p.ca - (p.ca0 ?? p.ca))}
          </b></span>
        )}
        {p.age <= 21 && p.pa >= 86 && <span className="chip" style={{ borderColor: 'var(--gold-bright)' }}>🌟 <b>Wonderkid</b></span>}
        {(p.poty ?? 0) > 0 && (
          <span className="chip" style={{ borderColor: 'var(--gold-bright)' }}>
            🏅 <b>World POTY{(p.poty ?? 0) > 1 ? ` ×${p.poty}` : ''}</b>
          </span>
        )}
        {p.retiring && !p.farewell && (
          <span className="chip" style={{ borderColor: '#a12f2f' }} title="He has announced this season is his last">
            🎤 <b>Retiring in the summer</b>
          </span>
        )}
        {(game.pledges ?? []).some(pl => pl.playerId === p.id) && !(game.preContracts ?? []).some(x => x.playerId === p.id) && (
          <span className="chip" style={{ borderColor: 'var(--gold)' }} title="You made him a promise in the office - keep it or wear it">
            🤝 <b>Promise made</b>
          </span>
        )}
        {(() => {
          const pc = (game.preContracts ?? []).find(x => x.playerId === p.id)
          if (!pc) return null
          const to = game.clubs[pc.toClubId]
          const incoming = pc.toClubId === game.userClubId
          return (
            <span className="chip" style={{ borderColor: incoming ? 'var(--gold-bright)' : '#a12f2f' }}>
              🖊 <b>Pre-contract: {to?.short ?? '?'}</b>
            </span>
          )
        })()}
      </div>

      </>}
      {ptab === 'career' && (p.career.length > 0 || (p.hist?.apps ?? 0) > 0) && (
        <>
          <SectionTitle>Career</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Season</th><th>Club</th><th className="num">Apps</th><th className="num">Tries</th><th className="num">Pts</th></tr></thead>
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
                  <td>pre 2025</td>
                  <td>{p.exClub && game.clubs[p.exClub] ? `incl. ${game.clubs[p.exClub].short} (${p.exApps})` : 'earlier career'}</td>
                  <td className="num">{p.hist!.apps}</td>
                  <td className="num">{p.hist!.tries}</td>
                  <td className="num">{p.hist!.points}</td>
                </tr>
              )}
              <tr style={{ fontWeight: 700 }}>
                <td>TOTAL</td>
                <td className="muted">incl. this season</td>
                <td className="num">{p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)}</td>
              </tr>
            </tbody>
          </table></div>
        </>
      )}

      {msg && <div ref={msgRef} className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
        {msg}
        {counter != null && (
          <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => {
            const r = agreeFee(game, p.id, counter)
            setMsg(r.msg); setCounter(r.counter ?? null)
            if (r.ok) { setTermsFee(counter); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
            touch()
          }}>Meet their price ({fmtMoney(counter)})</button>
        )}
      </div>}

      {termsFee != null && (
        <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
          <h3 style={{ fontSize: 15 }}>✍️ Personal terms - fee agreed at {fmtMoney(termsFee)}</h3>
          <div className="meta" style={{ margin: '4px 0' }}>His camp opens at <b>£{personalTermsDemand(game, p).toLocaleString()}/wk</b>. A signing bonus or a first-team promise softens the wage.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span className="fact-label" style={{ width: 84 }}>Wage /wk</span>
            <button className="btn ghost" onClick={() => { setWage(Math.max(500, wage - 500)) }}>−</button>
            <b style={{ minWidth: 76, textAlign: 'center' }}>£{wage.toLocaleString()}</b>
            <button className="btn ghost" onClick={() => { setWage(wage + 500) }}>+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span className="fact-label" style={{ width: 84 }}>Sign-on</span>
            <button className="btn ghost" onClick={() => { setSignOn(Math.max(0, signOn - 25_000)) }}>−</button>
            <b style={{ minWidth: 76, textAlign: 'center' }}>{fmtMoney(signOn)}</b>
            <button className="btn ghost" onClick={() => { setSignOn(signOn + 25_000) }}>+</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
            <input type="checkbox" checked={promiseMin} onChange={e => setPromiseMin(e.target.checked)} />
            Promise first-team rugby (a real pledge - he will hold you to it)
          </label>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => { setTermsFee(null); setMsg('You walk away from the table. The fee agreement lapses.') }}>Walk away</button>
            <button className="btn gold" style={{ flex: 1.6 }} onClick={() => {
              const r = signOnTerms(game, p.id, termsFee, wage, signOn, promiseMin)
              setMsg(r.msg)
              if (r.ok) setTermsFee(null)
              touch()
            }}>✍️ Agree terms</button>
          </div>
        </div>
      )}

      {mine && !p.onLoan && p.age <= 23 && !game.clubs[game.userClubId].tactic.lineup.slice(0, 15).includes(p.id) && (
        <button className="btn ghost block" onClick={() => {
          setMsg(loanOut(game, p.id).msg)
          touch()
        }}>Send on Season Loan (develops faster)</button>
      )}
      {/* the loan is visible from here too (16B, user: "there should be a
          report on how they are doing... they should also be able to be
          recalled at any point"). The verdict mirrors the loan-watch postcard's
          own deterministic roll, so the page and the letters agree. */}
      {mine && p.onLoan && (() => {
        const boost = 2 + Math.floor(mulberry32(game.seed + p.id)() * 3)
        const verdict = p.ca >= p.pa
          ? 'Playing every week and doing his job. Their coaches like him; they also quietly think this is his level.'
          : boost >= 4
          ? 'The first name on their team sheet. Their coach says he is running games at that level.'
          : boost === 3
          ? 'Growing into it nicely. Good marks most weeks, and the education is clearly taking.'
          : 'Getting the minutes he went for. Steady rather than spectacular.'
        return (
          <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
            <div className="fact-label">🧳 Out on loan</div>
            <div className="meta" style={{ marginTop: 4 }}>{verdict}</div>
            <div className="meta" style={{ marginTop: 4 }}>
              He is due back next summer. Recall him early and he returns match-fit,
              but a cut-short season pays less of the development the loan promised.
            </div>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => {
              setMsg(loanRecall(game, p.id).msg)
              touch()
            }}>↩ Recall from Loan</button>
          </div>
        )
      })()}
      {mine && p.acad && (
        <button className="btn gold block" onClick={() => {
          p.acad = false
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
          setMsg(`${p.name} joins first-team training. He'll never forget today.`)
          touch()
        }}>🎓 Promote to First Team</button>
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
              ? `${p.name} loses marquee status - his wage counts against the cap again.`
              : `${p.name} designated a marquee player: his wage now sits outside the salary cap (${2 - marquee.length - 1} slot${2 - marquee.length - 1 === 1 ? '' : 's'} left).`)
            touch()
          }}>
            {isMarquee ? '⭐ Marquee Player - tap to remove' : `⭐ Designate Marquee (${2 - marquee.length} slot${2 - marquee.length === 1 ? '' : 's'} free)`}
          </button>
        )
      })()}
      {mine && !p.onLoan && (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => { setMsg(talkToPlayer(game, p.id, 'praise')); touch() }}>
            🗣 Praise His Form
          </button>
          <button className="btn ghost" onClick={() => { setMsg(talkToPlayer(game, p.id, 'word')); touch() }}>
            ⚠️ Have a Word
          </button>
        </div>
      )}
      {mine ? (
        <>
          {negotiating && (
            <div className="card">
              <h3>Contract talks with {p.name.split(' ').slice(-1)[0]}'s agent</h3>
              {/* THE TALKS ANSWER THEMSELVES, IN THE CARD.
                  The outcome used to go only to the message card at the top of
                  this page, so meeting a player's asking wage looked like nothing
                  at all: the panel closed and the sentence explaining that he had
                  signed was several screenfuls above the thumb that tapped. */}
              {talkOutcome ? (
                <>
                  <div className="sheet-casualty" style={{ borderLeftColor: talkSigned ? '#2f7d4f' : '#9b2c2c' }}>
                    {talkSigned ? '🖊 ' : '💬 '}{talkOutcome}
                  </div>
                  {talkSigned
                    ? <div className="meta">He is on {fmtWage(p.wage)}/wk until the summer of {2026 + p.contractEnds}.</div>
                    : null}
                  <div className="btn-row" style={{ margin: '10px 0 0' }}>
                    {!talkSigned && (
                      <button className="btn" onClick={() => setTalkOutcome(null)}>Keep talking</button>
                    )}
                    <button className="btn ghost" onClick={() => {
                      setNegotiating(false); setWageCounter(null); setTalkOutcome(null); setTalkSigned(false)
                    }}>{talkSigned ? 'Done' : 'Leave it there'}</button>
                  </div>
                  {!talkSigned && wageCounter != null && (
                    <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => {
                      const r = offerRenewalAt(game, p.id, wageCounter)
                      setMsg(r.msg); setTalkOutcome(r.msg); setTalkSigned(r.ok)
                      setWageCounter(r.counter ?? null); setWageText(String(wageCounter)); touch()
                    }}>Meet their number ({fmtWage(wageCounter)}/wk)</button>
                  )}
                </>
              ) : (
                <>
                  <div className="meta">His camp wants {fmtWage(renewalDemand(p))}/wk (he is on {fmtWage(p.wage)}). Lowball at your peril.</div>
                  <input className="inline-input" type="text" inputMode="numeric" value={wageText}
                    onChange={e => setWageText(e.target.value.replace(/[^0-9]/g, ''))} />
                  <div className="btn-row" style={{ margin: '10px 0 0' }}>
                    <button className="btn gold" onClick={() => {
                      const r = offerRenewalAt(game, p.id, wageOffer)
                      setMsg(r.msg); setTalkOutcome(r.msg); setTalkSigned(r.ok)
                      setWageCounter(r.counter ?? null); touch()
                    }}>Offer £{wageOffer.toLocaleString()}/wk</button>
                    <button className="btn ghost" onClick={() => { setNegotiating(false); setWageCounter(null) }}>Walk Away</button>
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
              }}>Open Contract Talks</button>
            )}
            <button className={`btn ${p.transferListed ? 'ghost' : 'danger'}`} onClick={() => {
              p.transferListed = !p.transferListed
              setMsg(p.transferListed ? `${p.name} placed on the transfer list.` : `${p.name} removed from the list.`)
              touch()
            }}>{p.transferListed ? 'Unlist' : 'Transfer List'}</button>
          </div>
        </>
      ) : club ? (
        <>
          <button className={`btn ${shortlisted ? '' : 'ghost'} block`} onClick={() => toggleShortlist(p.id)}>
            {shortlisted ? '★ On Shortlist - scouts filing reports' : '☆ Shortlist & Scout'}
          </button>
          {!bidding
            ? <>
              {p.contractEnds <= game.season && game.week >= 25 && !(game.preContracts ?? []).some(x => x.playerId === p.id) && (
                <button className="btn gold block" onClick={() => {
                  setMsg(agreePreContract(game, p.id).msg); touch()
                }}>
                  🖊 Agree pre-contract - free this summer
                </button>
              )}
              <button className="btn gold block" onClick={() => {
                const r = agreeFee(game, p.id, ask)
                setMsg(r.msg); setCounter(r.counter ?? null)
                if (r.ok) { setTermsFee(ask); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
                touch()
              }}>
                ⚡ Offer asking price ({fmtMoney(ask)})
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
                    <div className="fact-label">Where {club.short} Stand</div>
                    {w.discount > 0 ? (
                      <>
                        <div className="meta">
                          They would listen below the ask, down towards <b>{fmtMoney(floorPrice(game, p))}</b>.
                        </div>
                        {w.reasons.map((r, i) => <div className="meta muted" key={i}>· {r.charAt(0).toUpperCase()}{r.slice(1)}</div>)}
                      </>
                    ) : (
                      <div className="meta">
                        No reason to sell cheap: he is wanted, he is playing, and they are under no pressure. It is the asking price or nothing.
                      </div>
                    )}
                  </div>
                )
              })()}
              <button className="btn ghost block" style={{ marginTop: 4 }} onClick={() => { setBidding(true); setBid(ask) }}>
                Haggle a different fee…
              </button>
            </>
            : (
              <div className="card">
                <h3 style={{ fontSize: 15 }}>Your offer to {club.short}</h3>
                <div className="meta">Asking price {fmtMoney(ask)} · your budget {fmtMoney(game.clubs[game.userClubId].budget)}</div>
                {floorPrice(game, p) < ask - 50_000 && (
                  <div className="meta muted">They may go as low as {fmtMoney(floorPrice(game, p))}.</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0' }}>
                  <button className="btn ghost" onClick={() => setBid(Math.max(100_000, bid - 500_000))}>−500k</button>
                  <button className="btn ghost" onClick={() => setBid(Math.max(100_000, bid - 100_000))}>−100k</button>
                  <b style={{ minWidth: 88, textAlign: 'center', fontSize: 16 }}>{fmtMoney(bid)}</b>
                  <button className="btn ghost" onClick={() => setBid(bid + 100_000)}>+100k</button>
                  <button className="btn ghost" onClick={() => setBid(bid + 500_000)}>+500k</button>
                </div>
                <div className="btn-row">
                  <button className="btn ghost" onClick={() => setBidding(false)}>Cancel</button>
                  <button className="btn gold" style={{ flex: 1.6 }} onClick={() => {
                    const r = agreeFee(game, p.id, bid)
                    setMsg(r.msg); setCounter(r.counter ?? null); setBidding(false)
                    if (r.ok) { setTermsFee(bid); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
                    touch()
                  }}>Submit Bid</button>
                </div>
              </div>
            )}
        </>
      ) : (
        <button className="btn gold block" onClick={() => {
          const user = game.clubs[game.userClubId]
          const wage = renewalDemand(p)
          const squadWages = user.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)
          if (squadWages + wage > user.wageBudget) { setMsg('His wage demands would exceed your wage budget.'); return }
          p.clubId = user.id
          user.players.push(p.id)
          p.wage = wage
          p.contractEnds = game.season + 2
          setMsg(`${p.name} signs on a free transfer (£${wage.toLocaleString()}/wk).`)
          touch()
        }}>Sign Free Agent</button>
      )}
      <div className="spacer" />
    </>
  )
}

function moraleWord(m: number): string {
  return m >= 8.5 ? 'Superb' : m >= 7.5 ? 'Very Good' : m >= 6 ? 'Good'
    : m >= 5 ? 'Fair' : m >= 3.5 ? 'Poor' : 'Very Poor'
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
  const standard = ca >= 85 ? 'a genuine star'
    : ca >= 75 ? 'a first-choice man at this level'
    : ca >= 65 ? 'a solid squad player'
    : ca >= 55 ? 'squad filler who can do a job'
    : 'one for the future or the second team'
  const bits: string[] = []
  bits.push(`${p.age}-year-old ${POS_NAMES[p.pos].toLowerCase()}, ${standard}${!mine && know < 60 ? ' on what little you have seen of him' : ''}.`)
  if (p.injury) {
    const wks = Math.max(0, p.injury.until - game.week)
    bits.push(`Out with ${p.injury.desc.toLowerCase()} for about ${wks} more week${wks === 1 ? '' : 's'}.`)
  } else if (p.bans > 0) {
    bits.push(`Suspended for ${p.bans} more match${p.bans > 1 ? 'es' : ''}.`)
  } else if (p.natSquad) {
    bits.push('Away with his country, so unavailable to you.')
  } else if (p.onLoan) {
    bits.push('Out on loan for the season.')
  } else if (p.cond < 72) {
    bits.push(`Available but only ${Math.round(p.cond)}% fit, so he will fade.`)
  } else {
    bits.push('Fit and available.')
  }
  if (mine) {
    if (p.contractEnds <= game.season) bits.push('His deal runs out this summer and he can walk for nothing.')
    else if ((p.wantsDeal ?? 0) > 0) bits.push('His agent is asking for improved terms.')
    else if (p.morale <= 4) bits.push('He is unhappy, and it will start showing on the pitch.')
    else if (p.form >= 7.5) bits.push('In the best form of anyone in the building.')
  } else if (p.transferListed) {
    bits.push('His club have listed him, so a fair offer would be heard.')
  }
  return bits.join(' ')
}
