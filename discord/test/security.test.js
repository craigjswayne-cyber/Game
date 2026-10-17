// Who may run /setup, and which roles the pickers may hand out, checked
// offline against stand-ins for Discord's objects.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js'
import { canRunSetup, SETUP_REFUSAL } from '../src/commands.js'
import { assignableRole, explainRoleError, forgetCreatedRoles, isAssignable, setLanguages, setTeam } from '../src/roles.js'

const perms = (...flags) => new PermissionsBitField(flags)

test('/setup runs only for members who can manage the server', () => {
  const guild = { id: 'g' }
  assert.equal(canRunSetup({ guild, memberPermissions: perms(PermissionFlagsBits.ManageGuild) }), true)
  assert.equal(canRunSetup({ guild, memberPermissions: perms(PermissionFlagsBits.Administrator) }), true)
  assert.equal(canRunSetup({ guild, memberPermissions: perms(PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageRoles) }), false)
  assert.equal(canRunSetup({ guild, memberPermissions: perms() }), false)
  // a DM, or an interaction Discord sent without permissions
  assert.equal(canRunSetup({ guild: null, memberPermissions: null }), false)
  assert.equal(canRunSetup({ guild, memberPermissions: null }), false)
  assert.ok(SETUP_REFUSAL.length > 0 && SETUP_REFUSAL.length <= 2000)
})

test('/setup is checked in the handler, not only by the default permission', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  const at = src.indexOf("i.commandName === 'setup'")
  assert.ok(at > 0)
  const body = src.slice(at, src.indexOf('runSetup(', at))
  assert.match(body, /canRunSetup\(i\)/)
  assert.match(body, /SETUP_REFUSAL[^)]*ephemeral/)
})

/** A guild with the bot's top role at position 10 and the given roles. */
function fakeGuild(roles = []) {
  let next = 100
  const cache = new Collection()
  const guild = {
    id: 'g1',
    created: [],
    roles: {
      cache,
      fetch: async () => cache,
      create: async opts => {
        const role = { id: String(next++), name: opts.name, position: 1, managed: false, permissions: new PermissionsBitField(opts.permissions ?? 0n) }
        guild.created.push(opts)
        cache.set(role.id, role)
        return role
      },
    },
    members: { me: { roles: { highest: { position: 10 } } } },
  }
  for (const r of roles) cache.set(r.id, { managed: false, position: 1, permissions: perms(), ...r })
  return guild
}

function fakeMember(guild) {
  const worn = new Collection()
  return {
    guild,
    roles: {
      cache: worn,
      add: async rs => { for (const r of [rs].flat()) worn.set(r.id, r) },
      remove: async ids => { for (const id of [ids].flat()) worn.delete(id) },
    },
  }
}

test('a role with no permissions below the bot is assignable, and nothing else is', () => {
  const g = fakeGuild()
  assert.equal(isAssignable(g, { id: 'a', position: 3, permissions: perms() }), true)
  assert.equal(isAssignable(g, { id: 'b', position: 3, permissions: perms(PermissionFlagsBits.ManageGuild) }), false)
  assert.equal(isAssignable(g, { id: 'c', position: 3, permissions: perms(PermissionFlagsBits.SendMessages) }), false)
  assert.equal(isAssignable(g, { id: 'd', position: 10, permissions: perms() }), false)
  assert.equal(isAssignable(g, { id: 'e', position: 12, permissions: perms() }), false)
  assert.equal(isAssignable(g, { id: 'f', position: 3, managed: true, permissions: perms() }), false)
  assert.equal(isAssignable(g, { id: 'g1', position: 0, permissions: perms() }), false, '@everyone')
})

test('the picker never hands out a privileged role that shares a club name', async () => {
  forgetCreatedRoles()
  const g = fakeGuild([{ id: 'admin', name: 'Leicester', position: 5, permissions: perms(PermissionFlagsBits.Administrator) }])
  await assert.rejects(assignableRole(g, 'Leicester'), err => err.code === 'UNSAFE_ROLE')
  assert.equal(g.created.length, 0)
  const member = fakeMember(g)
  await assert.rejects(setTeam(member, { kind: 'club', role: 'Leicester', colour: '#00ff00' }))
  assert.equal(member.roles.cache.size, 0)
  assert.match(explainRoleError({ code: 'UNSAFE_ROLE', roleName: 'Leicester' }), /Leicester/)
})

test('a role above the bot is refused even with no permissions', async () => {
  forgetCreatedRoles()
  const g = fakeGuild([{ id: 'high', name: 'Français', position: 11 }])
  await assert.rejects(assignableRole(g, 'Français'), err => err.code === 'UNSAFE_ROLE')
})

test('a safe role of the same name is preferred over a privileged one', async () => {
  forgetCreatedRoles()
  const g = fakeGuild([
    { id: 'bad', name: 'Français', position: 5, permissions: perms(PermissionFlagsBits.ManageRoles) },
    { id: 'ok', name: 'Français', position: 4 },
  ])
  assert.equal((await assignableRole(g, 'Français')).id, 'ok')
})

test('new roles are created with no permissions and remembered by id', async () => {
  forgetCreatedRoles()
  const g = fakeGuild()
  const member = fakeMember(g)
  const role = await setTeam(member, { kind: 'club', role: 'Leicester', colour: '#00ff00' })
  assert.equal(g.created.length, 1)
  assert.deepEqual(g.created[0].permissions, [])
  assert.equal(role.permissions.bitfield, 0n)
  assert.ok(member.roles.cache.has(role.id))
  // a second role of the same name appearing later does not displace ours
  g.roles.cache.set('other', { id: 'other', name: 'Leicester', position: 2, managed: false, permissions: perms() })
  assert.equal((await assignableRole(g, 'Leicester')).id, role.id)
  // and if ours is later given permissions, it stops being handed out
  role.permissions = perms(PermissionFlagsBits.KickMembers)
  assert.equal((await assignableRole(g, 'Leicester')).id, 'other')
})

test('languages go through the same check', async () => {
  forgetCreatedRoles()
  const { LANGUAGES } = await import('../src/config.js')
  const [first, second] = LANGUAGES
  const g = fakeGuild([{ id: 'bad', name: second.role, position: 5, permissions: perms(PermissionFlagsBits.BanMembers) }])
  const member = fakeMember(g)
  await setLanguages(member, [first.id])
  assert.ok(member.roles.cache.some(r => r.name === first.role))
  await assert.rejects(setLanguages(member, [first.id, second.id]), err => err.code === 'UNSAFE_ROLE')
  assert.ok(!member.roles.cache.has('bad'))
})

import { BUG_COOLDOWN_MS, bugWait, noteBug } from '../src/cooldown.js'
import { COMMANDS } from '../src/commands.js'
import { InteractionContextType } from 'discord.js'

test('a member may report once, then waits out the window', () => {
  const t0 = 1_000_000
  assert.equal(bugWait('u-cool', t0), 0)
  noteBug('u-cool', t0)
  assert.ok(bugWait('u-cool', t0 + 1000) > 0)
  assert.equal(bugWait('u-cool', t0 + BUG_COOLDOWN_MS), 0)
  assert.equal(bugWait('someone-else', t0 + 1000), 0)
})

test('every command is offered in servers only, never in DMs', () => {
  for (const c of COMMANDS) assert.deepEqual(c.toJSON().contexts, [InteractionContextType.Guild])
})
