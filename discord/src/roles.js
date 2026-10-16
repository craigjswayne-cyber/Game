// Giving and taking team and language roles.
//
// A team role is created the first time somebody picks that team, not all at
// once by /setup: 187 teams against Discord's 250-role ceiling would leave
// little room for anything else, and most clubs will never be picked. The role
// takes the club's first kit colour, so a Leicester manager's name is green.
import { LANGUAGES } from './config.js'
import { CLUB_ROLES, LANGUAGE_ROLES, NATION_ROLES } from './menus.js'

// WHICH ROLES THE PICKERS MAY HAND OUT. A member chooses a club or a language
// and the bot gives them the role with that name. Matching by name alone would
// let anyone who can make a role called "Leicester" or "Français", and give it
// Manage Server, have the bot hand that power to whoever picks Leicester. So a
// role is only given out when it carries no permissions at all and sits below
// the bot's own highest role, and every role the bot creates has none.

/** Roles this process created, per guild: name to role id. Not saved anywhere;
 *  after a restart the name lookup and the safety check below still apply. */
const createdRoles = new Map()

function remember(guild, role) {
  if (!createdRoles.has(guild.id)) createdRoles.set(guild.id, new Map())
  createdRoles.get(guild.id).set(role.name, role.id)
}

/** Forget what this process created (for tests). */
export function forgetCreatedRoles() { createdRoles.clear() }

/** A role the pickers may give: no permissions, and below the bot. */
export function isAssignable(guild, role) {
  if (!role || role.managed || role.id === guild.id) return false
  if (role.permissions?.bitfield !== 0n) return false
  const top = guild.members?.me?.roles?.highest
  return Boolean(top) && role.position < top.position
}

/** Raised when the only role with a picked name is one the bot will not give. */
export class UnsafeRoleError extends Error {
  constructor(name) {
    super(`Refusing to hand out role "${name}": it has permissions or sits above the bot`)
    this.code = 'UNSAFE_ROLE'
    this.roleName = name
  }
}

async function createRole(guild, name, colour) {
  const role = await guild.roles.create({
    name,
    permissions: [],
    ...(colour != null ? { colors: { primaryColor: typeof colour === 'string' ? parseInt(colour.slice(1), 16) : colour } } : {}),
    mentionable: false,
    hoist: false,
    reason: 'Picked in the PHASE club picker',
  })
  remember(guild, role)
  return role
}

/** A role by exact name, created (with no permissions) if it is not there yet.
 *  An existing role is returned as it is: /setup uses this for the staff roles,
 *  which the owner gives out and may well give permissions to. Anything a
 *  member picks for themselves goes through assignableRole instead. */
export async function ensureRole(guild, name, colour = null) {
  await guild.roles.fetch()
  const found = guild.roles.cache.find(r => r.name === name)
  if (found) return found
  return createRole(guild, name, colour)
}

/** The role a picker gives for this name: the one this process created, or
 *  else any role of that name that is safe to give, or else a new one. A role
 *  of that name that is not safe is never given; the member is told why. */
export async function assignableRole(guild, name, colour = null) {
  await guild.roles.fetch()
  const ours = createdRoles.get(guild.id)?.get(name)
  const tracked = ours ? guild.roles.cache.get(ours) : null
  if (tracked && tracked.name === name && isAssignable(guild, tracked)) return tracked
  const named = guild.roles.cache.filter(r => r.name === name)
  const safe = named.find(r => isAssignable(guild, r))
  if (safe) return safe
  if (named.size) throw new UnsafeRoleError(name)
  return createRole(guild, name, colour)
}

/** Wear this team, and take off the one it replaces: one club and one
 *  national team at a time. Returns the role given. */
export async function setTeam(member, team) {
  const pool = team.kind === 'nation' ? NATION_ROLES : CLUB_ROLES
  const role = await assignableRole(member.guild, team.role, team.colour)
  const stale = member.roles.cache.filter(r => pool.has(r.name) && r.id !== role.id)
  if (stale.size) await member.roles.remove([...stale.keys()], 'Picked a different team')
  if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Picked in the club picker')
  return role
}

export async function clearTeams(member) {
  const worn = member.roles.cache.filter(r => CLUB_ROLES.has(r.name) || NATION_ROLES.has(r.name))
  if (worn.size) await member.roles.remove([...worn.keys()], 'Removed their team tags')
  return worn.size
}

/** Exactly these languages, no more and no fewer. */
export async function setLanguages(member, ids) {
  const want = new Set(LANGUAGES.filter(l => ids.includes(l.id)).map(l => l.role))
  const roles = []
  for (const l of LANGUAGES) if (want.has(l.role)) roles.push(await assignableRole(member.guild, l.role))
  const add = roles.filter(r => !member.roles.cache.has(r.id))
  const remove = member.roles.cache.filter(r => LANGUAGE_ROLES.has(r.name) && !want.has(r.name))
  if (remove.size) await member.roles.remove([...remove.keys()], 'Changed their languages')
  if (add.length) await member.roles.add(add, 'Chose their languages')
  return [...want]
}

export function languagesOf(member) {
  return LANGUAGES.filter(l => member.roles.cache.some(r => r.name === l.role)).map(l => l.id)
}

/** The one error an owner will meet on day one, said in words they can act on. */
export function explainRoleError(err) {
  const code = err?.code ?? err?.rawError?.code
  if (code === 'UNSAFE_ROLE') {
    return `The bot will not give out the "${err.roleName}" role because it has permissions or sits above the bot. Ask a moderator to clear its permissions or move it below the bot's role.`
  }
  if (code === 50013) {
    return 'The bot is not allowed to give that role. In Server Settings > Roles, drag the bot\'s role above the club roles and make sure it has Manage Roles.'
  }
  if (code === 30005) return 'The server has reached Discord\'s limit of 250 roles. Remove some unused club roles.'
  return 'Something went wrong giving that role. Try again, and tell a moderator if it keeps happening.'
}
