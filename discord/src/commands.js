// The slash commands, as data. register.js sends these to Discord once; the
// bot answers them in index.js.
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

export const COMMANDS = [
  new SlashCommandBuilder().setName('club')
    .setDescription('Choose the club or national team you manage in PHASE: Rugby Manager'),
  new SlashCommandBuilder().setName('language')
    .setDescription('Say which languages you play the game in'),
  new SlashCommandBuilder().setName('bug')
    .setDescription('Report a problem with the game, in any language'),
  new SlashCommandBuilder().setName('setup')
    .setDescription('Build or top up the server layout (admins only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
]

// The default permission above only hides /setup in the command list: a server
// owner can override it under Integrations, and Discord applies it, not the bot.
// So the bot checks again itself before it builds anything.
export const SETUP_PERMISSION = PermissionFlagsBits.ManageGuild
export const SETUP_REFUSAL = 'Only members who can manage this server can run /setup.'

/** True when the member behind this interaction may run /setup. */
export function canRunSetup(i) {
  return Boolean(i?.guild && i.memberPermissions?.has(SETUP_PERMISSION))
}
