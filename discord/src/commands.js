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
