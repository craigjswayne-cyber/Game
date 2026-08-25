import { useState } from 'react'
import { useStore } from '../../store'
import { ATTR_KEYS, POS_ORDER, fmtMoney, type Club, type Player } from '../../game/model'
import { EDITOR_SKU, hasEntitlement } from '../../game/monetise'
import { attrName, posName, t } from '../../game/i18n'
import { Crest, SectionTitle } from '../components'

/**
 * The In-Game Editor (v1.1.0): the player's own world, rewritten by hand.
 *
 * The door to this screen only renders for an owner (Saves.tsx checks the
 * receipt, and the store actions check it again), and the first applied edit
 * stamps the save with 🔧 for good - the warning card says so before any
 * field is touched, because a permanent mark nobody warned you about is a
 * support ticket, not a feature. All writes go through game/editor.ts, which
 * clamps every value into the range the engine was balanced for.
 */
export default function Editor() {
  const game = useStore(s => s.game)!
  const [clubId, setClubId] = useState(game.userClubId)
  const [playerId, setPlayerId] = useState<number | null>(null)
  const club = game.clubs[clubId] ?? game.clubs[game.userClubId]

  if (!hasEntitlement(EDITOR_SKU)) {
    return (
      <div className="card">
        <div className="meta">{t('editor.locked')}</div>
      </div>
    )
  }

  const clubs = Object.values(game.clubs).sort((a, b) => a.name.localeCompare(b.name))
  const players = club.players.map(id => game.players[id]).filter((p): p is Player => !!p)
    .sort((a, b) => a.name.localeCompare(b.name))
  const player = playerId != null ? game.players[playerId] : null

  return (
    <>
      <div className="card" style={game.edited ? { borderLeft: '4px solid var(--gold)' } : undefined}>
        <div className="meta">{t(game.edited ? 'editor.stamped' : 'editor.warning')}</div>
      </div>

      <SectionTitle sub={t('editor.clubSub')}>{t('editor.clubTitle')}</SectionTitle>
      <div className="card">
        <select className="inline-input" style={{ width: '100%' }} value={club.id}
          onChange={e => { setClubId(e.target.value); setPlayerId(null) }}>
          {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <ClubEditor key={club.id} club={club} />

      <SectionTitle sub={t('editor.playerSub')}>{t('editor.playerTitle')}</SectionTitle>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crest club={club} size={26} mr={0} />
          <select className="inline-input" style={{ flex: 1 }} value={playerId ?? ''}
            onChange={e => setPlayerId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('editor.pickPlayer')}</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name} · {posName(p.pos)}</option>)}
          </select>
        </div>
      </div>
      {player && <PlayerEditor key={player.id} player={player} />}
      <div className="spacer" />
    </>
  )
}

const field = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } as const
const lab = { flex: '0 0 34%', fontSize: 12.5 } as const

function ClubEditor({ club }: { club: Club }) {
  const editClub = useStore(s => s.editorClub)
  const [name, setName] = useState(club.name)
  const [short, setShort] = useState(club.short)
  const [stadium, setStadium] = useState(club.stadium)
  // Club.colors is a [string, string] tuple straight from data - club colours
  // are data, not theme (tokenlint's own words), so no fallback hex exists here
  const [c0, setC0] = useState(club.colors[0])
  const [c1, setC1] = useState(club.colors[1])
  const [budget, setBudget] = useState(String(club.budget))
  const [balance, setBalance] = useState(String(club.balance))
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="card">
      <div style={field}><span className="meta" style={lab}>{t('editor.fldName')}</span>
        <input className="inline-input" style={{ flex: 1 }} value={name} onChange={e => setName(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldShort')}</span>
        <input className="inline-input" style={{ flex: 1 }} value={short} onChange={e => setShort(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldStadium')}</span>
        <input className="inline-input" style={{ flex: 1 }} value={stadium} onChange={e => setStadium(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldColours')}</span>
        <input type="color" value={c0} onChange={e => setC0(e.target.value)} aria-label={t('editor.fldColours')} />
        <input type="color" value={c1} onChange={e => setC1(e.target.value)} aria-label={t('editor.fldColours')} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldBudget')}</span>
        <input className="inline-input" style={{ flex: 1 }} inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldBalance')}</span>
        <input className="inline-input" style={{ flex: 1 }} inputMode="numeric" value={balance} onChange={e => setBalance(e.target.value)} /></div>
      <button className="btn gold block" style={{ marginTop: 8 }} onClick={() => {
        const done = editClub(club.id, {
          name, short, stadium, colors: [c0, c1],
          budget: Number(budget), balance: Number(balance),
        })
        setMsg(done ? t('editor.applied', { what: club.name }) : t('editor.refused'))
      }}>{t('editor.apply')}</button>
      {msg && <div className="meta sheet-log" style={{ marginTop: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>
        {msg} <b>{t('editor.nowMoney', { budget: fmtMoney(club.budget), balance: fmtMoney(club.balance) })}</b>
      </div>}
    </div>
  )
}

function PlayerEditor({ player }: { player: Player }) {
  const editPlayer = useStore(s => s.editorPlayer)
  const [name, setName] = useState(player.name)
  const [age, setAge] = useState(String(player.age))
  const [pos, setPos] = useState(player.pos)
  const [ca, setCa] = useState(String(player.ca))
  const [pa, setPa] = useState(String(player.pa))
  const [attrs, setAttrs] = useState<Record<string, string>>(
    Object.fromEntries(ATTR_KEYS.map(k => [k, String(player.a[k])])))
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="card">
      <div style={field}><span className="meta" style={lab}>{t('editor.fldName')}</span>
        <input className="inline-input" style={{ flex: 1 }} value={name} onChange={e => setName(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldAge')}</span>
        <input className="inline-input" style={{ flex: 1 }} inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldPosition')}</span>
        <select className="inline-input" style={{ flex: 1 }} value={pos} onChange={e => setPos(e.target.value as typeof pos)}>
          {POS_ORDER.map(p => <option key={p} value={p}>{posName(p)}</option>)}
        </select></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldAbility')}</span>
        <input className="inline-input" style={{ flex: 1 }} inputMode="numeric" value={ca} onChange={e => setCa(e.target.value)} /></div>
      <div style={field}><span className="meta" style={lab}>{t('editor.fldPotential')}</span>
        <input className="inline-input" style={{ flex: 1 }} inputMode="numeric" value={pa} onChange={e => setPa(e.target.value)} /></div>
      <div className="meta" style={{ marginTop: 8, fontWeight: 700 }}>{t('editor.fldAttrs')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', marginTop: 4 }}>
        {ATTR_KEYS.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="meta" style={{ flex: 1, fontSize: 12 }}>{attrName(k)}</span>
            <input className="inline-input" style={{ width: 52 }} inputMode="numeric" value={attrs[k]}
              onChange={e => setAttrs(a => ({ ...a, [k]: e.target.value }))} />
          </div>
        ))}
      </div>
      <button className="btn gold block" style={{ marginTop: 10 }} onClick={() => {
        const done = editPlayer(player.id, {
          name, age: Number(age), pos, ca: Number(ca), pa: Number(pa),
          attrs: Object.fromEntries(ATTR_KEYS.map(k => [k, Number(attrs[k])])),
        })
        setMsg(done ? t('editor.applied', { what: player.name }) : t('editor.refused'))
        if (done) {
          // the clamps may have corrected what was typed: read the truth back,
          // so the form never shows a value the save does not hold
          setAge(String(player.age)); setCa(String(player.ca)); setPa(String(player.pa))
          setAttrs(Object.fromEntries(ATTR_KEYS.map(k => [k, String(player.a[k])])))
        }
      }}>{t('editor.apply')}</button>
      {msg && <div className="meta sheet-log" style={{ marginTop: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg}</div>}
    </div>
  )
}
