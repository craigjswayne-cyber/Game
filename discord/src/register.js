// Tells Discord about the slash commands. Run once, and again whenever
// commands.js changes. With GUILD_ID set they appear in that server at once;
// without it they are global and can take up to an hour to show.
import { REST, Routes } from 'discord.js'
import { COMMANDS } from './commands.js'

const { DISCORD_TOKEN: token, CLIENT_ID: app, GUILD_ID: guild } = process.env
if (!token || !app) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID (and GUILD_ID for instant commands) in .env first.')
  process.exit(1)
}
const rest = new REST().setToken(token)
const route = guild ? Routes.applicationGuildCommands(app, guild) : Routes.applicationCommands(app)
const body = COMMANDS.map(c => c.toJSON())
await rest.put(route, { body })
console.log(`Registered ${body.length} commands ${guild ? `in server ${guild}` : 'globally'}: ${body.map(c => '/' + c.name).join(' ')}`)
