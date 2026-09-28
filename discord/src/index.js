// The bot. Run with DISCORD_TOKEN set (see README.md). It needs only the
// Guilds intent: everything it does is answering buttons, menus, forms and
// slash commands, none of which require reading members' messages.
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js'
import { bugModal, submitBug } from './bug.js'
import { clubMenu, findTeam, languagePanel, leagueMenu, startPanel } from './menus.js'
import { clearTeams, explainRoleError, languagesOf, setLanguages, setTeam } from './roles.js'
import { runSetup } from './setup.js'

const token = process.env.DISCORD_TOKEN
if (!token) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env, fill it in, and start with: node --env-file=.env src/index.js')
  process.exit(1)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const ephemeral = { flags: MessageFlags.Ephemeral }

client.once(Events.ClientReady, c => console.log(`Ready as ${c.user.tag} in ${c.guilds.cache.size} server(s)`))

client.on(Events.InteractionCreate, async i => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === 'club') return i.reply({ ...startPanel(), ...ephemeral })
      if (i.commandName === 'language') return i.reply({ ...languagePanel(languagesOf(i.member)), ...ephemeral })
      if (i.commandName === 'bug') return i.showModal(bugModal())
      if (i.commandName === 'setup') {
        await i.deferReply(ephemeral)
        const made = await runSetup(i.guild, console.log)
        return i.editReply(made.length ? `Added: ${made.join(', ')}.` : 'Everything is already in place.')
      }
    }

    if (i.isButton()) {
      const [scope, action, arg] = i.customId.split(':')
      // the pinned buttons in #pick-your-club start a private flow; the
      // buttons inside that flow update it in place
      if (i.customId === 'club:open') {
        return i.message?.flags?.has(MessageFlags.Ephemeral) ? i.update(startPanel()) : i.reply({ ...startPanel(), ...ephemeral })
      }
      if (i.customId === 'lang:open') return i.reply({ ...languagePanel(languagesOf(i.member)), ...ephemeral })
      if (scope === 'club' && action === 'world') {
        return i.update(arg === 'nat' ? clubMenu('nat') : leagueMenu(arg))
      }
      if (i.customId === 'club:clear') {
        const n = await clearTeams(i.member)
        return i.update({ content: n ? 'Your team tags are off.' : 'You were not wearing any team tags.', components: [] })
      }
    }

    if (i.isStringSelectMenu()) {
      const [scope, action, arg] = i.customId.split(':')
      if (scope === 'club' && action === 'league') return i.update(clubMenu(arg, i.values[0]))
      if (scope === 'club' && action === 'pick') {
        const team = findTeam(arg, i.values[0])
        if (!team) return i.update({ content: 'That team is not in the game any more. Start again with /club.', components: [] })
        const role = await setTeam(i.member, team)
        const where = team.kind === 'nation' ? 'national team' : team.league
        return i.update({ content: `Done: you manage **${team.name}** (${where}). Your name now wears <@&${role.id}>.`, components: [], allowedMentions: { parse: [] } })
      }
      if (i.customId === 'lang:pick') {
        const worn = await setLanguages(i.member, i.values)
        return i.update({ content: worn.length ? `Saved: ${worn.join(', ')}.` : 'No languages set.', components: [] })
      }
    }

    if (i.isModalSubmit() && i.customId === 'bug:submit') return submitBug(i)
  } catch (err) {
    console.error(err)
    const content = explainRoleError(err)
    if (i.isRepliable()) {
      if (i.deferred || i.replied) await i.editReply({ content, components: [] }).catch(() => {})
      else await i.reply({ content, ...ephemeral }).catch(() => {})
    }
  }
})

client.login(token)
