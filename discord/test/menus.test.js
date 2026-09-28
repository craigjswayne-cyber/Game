// Every menu, form and command checked against Discord's limits, offline.
// A menu over 25 options or a label over 100 characters is refused by Discord
// at the moment a member taps, so it is cheaper to find here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { LAYOUT, LANGUAGES, AREAS, STATUSES, TEAMS } from '../src/config.js'
import { clubMenu, leagueMenu, startPanel, languagePanel, pickChannelButtons, findTeam, CLUB_ROLES, NATION_ROLES, LIMITS } from '../src/menus.js'
import { bugModal, bugPost } from '../src/bug.js'
import { COMMANDS } from '../src/commands.js'
import { BOT_PERMISSIONS } from '../src/invite.js'

const json = msg => msg.components.map(r => r.toJSON())
const selects = rows => rows.flatMap(r => r.components).filter(c => c.type === 3)

test('every club and nation menu fits Discord', () => {
  const menus = [leagueMenu('m'), leagueMenu('w'), clubMenu('nat'),
    ...TEAMS.men.map(l => clubMenu('m', l.id)), ...TEAMS.women.map(l => clubMenu('w', l.id))]
  for (const m of menus) {
    for (const s of selects(json(m))) {
      assert.ok(s.options.length >= 1 && s.options.length <= LIMITS.selectOptions, `${s.custom_id}: ${s.options.length} options`)
      for (const o of s.options) assert.ok(o.label.length <= LIMITS.labelLength && o.value.length <= 100, o.label)
      assert.equal(new Set(s.options.map(o => o.value)).size, s.options.length, `${s.custom_id}: duplicate values`)
    }
  }
})

test('every team a member can pick resolves back to a role', () => {
  for (const w of ['m', 'w']) for (const l of w === 'm' ? TEAMS.men : TEAMS.women) for (const c of l.clubs) {
    const t = findTeam(w, c.id)
    assert.ok(t && t.kind === 'club' && CLUB_ROLES.has(t.role), c.id)
  }
  for (const n of TEAMS.nations) assert.ok(NATION_ROLES.has(findTeam('nat', n.id).role), n.id)
  assert.equal(findTeam('m', 'not-a-club'), null)
})

test('the role count leaves room under the 250 ceiling', () => {
  const total = CLUB_ROLES.size + NATION_ROLES.size + LANGUAGES.length + 3
  assert.ok(total <= 230, `${total} roles`)
  for (const r of [...CLUB_ROLES, ...NATION_ROLES]) assert.ok(r.length <= 100, r)
})

test('buttons and the language menu build', () => {
  for (const rows of [json(startPanel()), pickChannelButtons().map(r => r.toJSON()), json(languagePanel(['fr']))]) {
    for (const c of rows.flatMap(r => r.components)) assert.ok((c.custom_id ?? '').length <= LIMITS.customIdLength)
  }
  const lang = selects(json(languagePanel(['fr', 'ja'])))[0]
  assert.deepEqual(lang.options.filter(o => o.default).map(o => o.value), ['fr', 'ja'])
})

test('the bug form fits in one modal', () => {
  const m = bugModal().toJSON()
  assert.ok(m.title.length <= 45)
  assert.ok(m.components.length <= 5, `${m.components.length} questions`)
  for (const label of m.components) assert.ok(label.label.length <= 45 && (label.description ?? '').length <= 100, label.label)
})

test('forums fit the tag limits and a report is tagged', () => {
  for (const f of LAYOUT.flatMap(g => g.channels).filter(c => c.forum)) {
    assert.ok(f.tags.length <= 20, `${f.name}: ${f.tags.length} tags`)
    for (const t of f.tags) assert.ok(t.length <= 20, t)
  }
  const bugTags = LAYOUT.flatMap(g => g.channels).find(c => c.name === 'bug-reports').tags
  const forumTags = bugTags.map((name, i) => ({ id: String(i), name }))
  for (const l of LANGUAGES) for (const a of AREAS) {
    const post = bugPost({ lang: l.id, area: a.id, title: 'x'.repeat(120), what: 'w', reporter: '1', forumTags })
    assert.equal(post.appliedTags.length, 3, `${l.id}/${a.id}`)
    assert.ok(post.name.length <= 100)
  }
  assert.ok(STATUSES.includes('Open'))
})

test('commands and the invite build', () => {
  for (const c of COMMANDS) { const j = c.toJSON(); assert.ok(j.name.length <= 32 && j.description.length <= 100) }
  assert.ok(BOT_PERMISSIONS.bitfield > 0n)
  assert.ok(!BOT_PERMISSIONS.has('Administrator'))
})

test('nothing a member reads has an em dash', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  for (const f of readdirSync(new URL('../src/', import.meta.url))) {
    assert.ok(!readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').includes('—'), f)
  }
})
