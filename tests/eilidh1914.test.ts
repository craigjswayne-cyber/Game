// Player report (Eilidh, iPhone, 1.9.13): two of the five points are text.
//   1. a shortlisted woman wanted by a rival was still "Move now or lose him"
//   2. the close-season events' inbox story showed its placeholder instead of
//      the event's name (the story read {event}, the saved story carried event_k)
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ensureLang, setWorld, tIn } from '../src/game/i18n'
import { newGame } from '../src/game/newgame'
import { bookEvent, eventSlate } from '../src/game/closeseason'
import { SEASON_WEEKS } from '../src/game/model'

const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af'] as const

beforeAll(async () => { for (const l of LANGS) await ensureLang(l) })
afterEach(() => setWorld('m'))

describe('a rival after a shortlisted woman', () => {
  it('reads her, not him, in every language that genders it', () => {
    setWorld('w')
    const v = { player: 'Holly Phillips', pos: 'HK', short: 'Bristol', rival: 'Quins', alert_k: 'news.slRival_genuine' }
    const en = tIn('en', 'news.shortlistAlert', v)
    expect(en).toMatch(/lose her/)
    expect(en).not.toMatch(/\bhim\b/)
    expect(tIn('fr', 'news.slRival_genuine', v)).toMatch(/la perdrez/)
    expect(tIn('es', 'news.slRival_genuine', v)).toMatch(/la perderás/)
    expect(tIn('it', 'news.slRival_genuine', v)).toMatch(/la perderai/)
    expect(tIn('af', 'news.slRival_genuine', v)).toMatch(/haar/)
  })
  it('and the men\'s game is unchanged', () => {
    setWorld('m')
    expect(tIn('en', 'news.slRival_genuine', { rival: 'Quins' })).toMatch(/lose him/)
  })
})

describe('a close-season event in the inbox', () => {
  it('names the event in every language, with no placeholder left', () => {
    for (const lang of LANGS) {
      for (const k of ['close.news', 'close.newsSubj', 'close.newsBad', 'close.newsBadSubj']) {
        const out = tIn(lang, k, { event_k: 'close.golf', fee: '£1,000', club: 'Bedford', what_k: 'close.mishapGolf', bill: '£200' })
        expect(out, `${lang} ${k}`).not.toMatch(/\{/)
        expect(out, `${lang} ${k}`).toContain(tIn(lang, 'close.golf'))
      }
    }
  })
  it('a booked event files a story that names it, read in any language', () => {
    const g = newGame('bedford', 'Close Event', 7)
    g.week = SEASON_WEEKS - 2
    const ev = eventSlate(g)[0]
    expect(ev).toBeTruthy()
    const before = g.news.length
    bookEvent(g, ev.id)
    const n = g.news.slice(before).find(x => (x.k ?? '').startsWith('close.news'))
    expect(n).toBeTruthy()
    for (const lang of LANGS) {
      const body = tIn(lang, n!.k!, n!.v)
      expect(body, lang).not.toMatch(/\{/)
      expect(body, lang).toContain(tIn(lang, `close.${ev.id}`))
      expect(tIn(lang, `${n!.k!}Subj`, n!.v), lang).not.toMatch(/\{/)
    }
    expect(n!.subject).not.toMatch(/\{/)
    expect(n!.body).not.toMatch(/\{/)
  })
})
