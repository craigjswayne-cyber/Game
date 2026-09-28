// Giving and taking team and language roles.
//
// A team role is created the first time somebody picks that team, not all at
// once by /setup: 187 teams against Discord's 250-role ceiling would leave
// little room for anything else, and most clubs will never be picked. The role
// takes the club's first kit colour, so a Leicester manager's name is green.
import { LANGUAGES } from './config.js'
import { CLUB_ROLES, LANGUAGE_ROLES, NATION_ROLES } from './menus.js'

/** A role by exact name, created if it is not there yet. */
export async function ensureRole(guild, name, colour = null) {
  await guild.roles.fetch()
  const found = guild.roles.cache.find(r => r.name === name)
  if (found) return found
  return guild.roles.create({
    name,
    ...(colour != null ? { colors: { primaryColor: typeof colour === 'string' ? parseInt(colour.slice(1), 16) : colour } } : {}),
    mentionable: false,
    hoist: false,
    reason: 'Picked in the PHASE club picker',
  })
}

/** Wear this team, and take off the one it replaces: one club and one
 *  national team at a time. Returns the role given. */
export async function setTeam(member, team) {
  const pool = team.kind === 'nation' ? NATION_ROLES : CLUB_ROLES
  const role = await ensureRole(member.guild, team.role, team.colour)
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
  for (const l of LANGUAGES) if (want.has(l.role)) await ensureRole(member.guild, l.role)
  const byName = name => member.guild.roles.cache.find(r => r.name === name)
  const add = [...want].map(byName).filter(r => r && !member.roles.cache.has(r.id))
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
  if (code === 50013) {
    return 'The bot is not allowed to give that role. In Server Settings > Roles, drag the bot\'s role above the club roles and make sure it has Manage Roles.'
  }
  if (code === 30005) return 'The server has reached Discord\'s limit of 250 roles. Remove some unused club roles.'
  return 'Something went wrong giving that role. Try again, and tell a moderator if it keeps happening.'
}
