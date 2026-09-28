// Prints the link that adds the bot to a server, asking for exactly the
// permissions it uses and nothing more (no Administrator).
import { OAuth2Scopes, PermissionFlagsBits, PermissionsBitField } from 'discord.js'

export const BOT_PERMISSIONS = new PermissionsBitField([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ManageRoles, // create club roles, give and take them
  PermissionFlagsBits.ManageChannels, // /setup builds the channels and forum tags
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads, // a bug report is a forum post
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles, // screenshots on bug reports
  PermissionFlagsBits.ReadMessageHistory,
])

const app = process.env.CLIENT_ID
if (process.argv[1]?.endsWith('invite.js')) {
  if (!app) { console.error('Set CLIENT_ID in .env first.'); process.exit(1) }
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', app)
  url.searchParams.set('scope', [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join(' '))
  url.searchParams.set('permissions', BOT_PERMISSIONS.bitfield.toString())
  console.log(url.toString())
}
