// /setup: build the server from config.js. It only ever ADDS: a channel, role
// or forum tag that is already there (matched by name) is left as it is, so
// running it again after a change to the layout is safe and running it twice
// by accident does nothing.
import { ChannelType, PermissionFlagsBits } from 'discord.js'
import { LANGUAGES, LAYOUT, PICK_CHANNEL, PICK_PANEL, RULES, STAFF_ROLES, WELCOME } from './config.js'
import { pickChannelButtons } from './menus.js'
import { ensureRole } from './roles.js'

export async function runSetup(guild, log) {
  const made = []
  await guild.channels.fetch()

  for (const r of STAFF_ROLES) {
    const had = guild.roles.cache.some(x => x.name === r.name)
    const role = await ensureRole(guild, r.name, r.colour)
    if (!had) { await role.setHoist(r.hoist); made.push(`role ${r.name}`) }
  }
  for (const l of LANGUAGES) {
    const had = guild.roles.cache.some(x => x.name === l.role)
    await ensureRole(guild, l.role)
    if (!had) made.push(`role ${l.role}`)
  }
  const staff = STAFF_ROLES.filter(r => r.name !== 'Tester')
    .map(r => guild.roles.cache.find(x => x.name === r.name)).filter(Boolean)
  const me = guild.members.me

  // read-only for everyone; staff and the bot may post
  const readOnly = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions] },
    ...staff.map(r => ({ id: r.id, allow: [PermissionFlagsBits.SendMessages] })),
    { id: me.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
  ]

  const byName = (name, type) => guild.channels.cache.find(c => c.name === name && c.type === type)
  const created = {}
  for (const group of LAYOUT) {
    let cat = byName(group.category, ChannelType.GuildCategory)
    if (!cat) { cat = await guild.channels.create({ name: group.category, type: ChannelType.GuildCategory }); made.push(`category ${group.category}`) }
    for (const ch of group.channels) {
      const type = ch.forum ? ChannelType.GuildForum : ch.voice ? ChannelType.GuildVoice : ChannelType.GuildText
      let chan = byName(ch.name, type)
      if (!chan) {
        chan = await guild.channels.create({
          name: ch.name,
          type,
          parent: cat.id,
          ...(ch.topic && !ch.voice ? { topic: ch.topic } : {}),
          ...(ch.readOnly ? { permissionOverwrites: readOnly } : {}),
          ...(ch.forum ? { availableTags: ch.tags.map(name => ({ name })) } : {}),
        })
        made.push(`#${ch.name}`)
        created[ch.name] = chan
      } else if (ch.forum) {
        // a tag added to config.js since the last run
        const have = new Set(chan.availableTags.map(t => t.name))
        const missing = ch.tags.filter(t => !have.has(t))
        if (missing.length) {
          await chan.setAvailableTags([...chan.availableTags, ...missing.map(name => ({ name }))])
          made.push(`${missing.length} tag(s) on #${ch.name}`)
        }
      }
    }
  }

  // the three posts, written once into the channels this run created
  const pick = byName(PICK_CHANNEL, ChannelType.GuildText)
  if (created.welcome) await created.welcome.send({ content: WELCOME.replace('{PICK}', pick?.id ?? ''), allowedMentions: { parse: [] } })
  if (created.rules) await created.rules.send({ content: RULES })
  if (created[PICK_CHANNEL]) await created[PICK_CHANNEL].send({ content: PICK_PANEL, components: pickChannelButtons() })

  log?.(`setup in ${guild.name}: ${made.length ? made.join(', ') : 'nothing to add'}`)
  return made
}
