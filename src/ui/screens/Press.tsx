import { useStore } from '../../store'
import { SectionTitle } from '../components'
import { weekDate } from '../../game/model'

export default function Press() {
  const game = useStore(s => s.game)!
  const answer = useStore(s => s.answerPressOption)
  const go = useStore(s => s.go)

  const open = game.press.filter(p => !p.answered).reverse()
  const past = game.press.filter(p => p.answered).reverse().slice(0, 12)

  return (
    <>
      {open.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>
          The press room is quiet… for now. Journalists tend to appear when players hit form, lose it, or get linked with moves.
        </div>
      )}
      {open.map(item => (
        <div key={item.id}>
          <div className="press-outlet">{item.outlet} asks…</div>
          <div className="press-q">“{item.question}”</div>
          {item.playerId != null && game.players[item.playerId] && (
            <button className="muted" style={{ padding: '0 14px 8px', fontWeight: 600, color: 'var(--accent-ink)' }}
              onClick={() => go('player', item.playerId!)}>
              View {game.players[item.playerId].name} ›
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px' }}>
            {item.options.map((o, i) => (
              <button key={i} className="btn ghost" style={{ textAlign: 'left' }}
                onClick={() => answer(item.id, i)}>
                “{o.label}”
              </button>
            ))}
          </div>
          <hr style={{ border: 'none', borderTop: '2px solid var(--cream-3)', margin: '0 14px' }} />
        </div>
      ))}
      {past.length > 0 && (
        <>
          <SectionTitle>Recent Coverage</SectionTitle>
          {past.map(item => (
            <div key={item.id} className="news-item open">
              <div className="when">{item.outlet} · {weekDate(item.season, item.week)}</div>
              <div className="subj" style={{ fontWeight: 400 }}>“{item.question}”</div>
              <div className="body">You: “{item.answerLabel}” - {item.reaction}</div>
            </div>
          ))}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
