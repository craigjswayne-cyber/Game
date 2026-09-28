// The club picker and the language picker, as plain component builders. No
// network in here, so test/menus.test.js can check every menu against
// Discord's limits without a bot token.
//
// custom ids carry the whole state of the flow, because an ephemeral message
// is all the bot has to remember a member by between taps:
//   club:world:<m|w|nat>   the three buttons
//   club:league:<m|w>      the league menu for that world
//   club:pick:<m|w|nat>    the club (or nation) menu, value = team id
//   club:clear             take my team tags off
//   lang:open / lang:pick  the language menu
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} from 'discord.js'
import { LANGUAGES, TEAMS } from './config.js'

/** Discord's own ceilings, checked by the tests. */
export const LIMITS = { selectOptions: 25, labelLength: 100, customIdLength: 100 }

export const worldOf = w => (w === 'm' ? TEAMS.men : w === 'w' ? TEAMS.women : null)

/** Every team role the bot hands out, so it knows which roles are "team"
 *  roles when it swaps one for another. */
export const CLUB_ROLES = new Set([...TEAMS.men, ...TEAMS.women].flatMap(l => l.clubs.map(c => c.role)))
export const NATION_ROLES = new Set(TEAMS.nations.map(n => n.role))
export const LANGUAGE_ROLES = new Set(LANGUAGES.map(l => l.role))

export function findTeam(world, id) {
  if (world === 'nat') {
    const n = TEAMS.nations.find(x => x.id === id)
    return n ? { ...n, kind: 'nation', colour: null } : null
  }
  for (const league of worldOf(world) ?? []) {
    const c = league.clubs.find(x => x.id === id)
    if (c) return { ...c, kind: 'club', league: league.name }
  }
  return null
}

export function startPanel() {
  return {
    content: 'Who do you manage? Pick a club in the men\'s or women\'s game, or a national team. You can hold one club and one national team.',
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('club:world:m').setLabel('Men\'s club').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('club:world:w').setLabel('Women\'s club').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('club:world:nat').setLabel('National team').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('club:clear').setLabel('Remove my team tags').setStyle(ButtonStyle.Danger),
    )],
  }
}

export function leagueMenu(world) {
  const leagues = worldOf(world)
  return {
    content: world === 'm' ? 'Which league is your club in?' : 'Which league is your club in? (women\'s game)',
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`club:league:${world}`)
        .setPlaceholder('Choose a league')
        .addOptions(leagues.map(l => ({ label: l.name, value: l.id, description: `${l.clubs.length} clubs` }))),
    ), backRow()],
  }
}

export function clubMenu(world, leagueId) {
  if (world === 'nat') {
    return {
      content: 'Which national team do you manage?',
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('club:pick:nat')
          .setPlaceholder('Choose a national team')
          .addOptions(TEAMS.nations.map(n => ({ label: n.name, value: n.id }))),
      ), backRow()],
    }
  }
  const league = worldOf(world)?.find(l => l.id === leagueId)
  if (!league) return { content: 'That league is not in the game any more. Start again with /club.', components: [] }
  return {
    content: `${league.name}: which club?`,
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`club:pick:${world}`)
        .setPlaceholder('Choose your club')
        .addOptions(league.clubs.map(c => ({ label: c.name, value: c.id }))),
    ), backRow()],
  }
}

export function languagePanel(current = []) {
  return {
    content: 'Which languages do you play the game in? Pick every one you use. It tells us who can check a translation.',
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('lang:pick')
        .setPlaceholder('Choose your languages')
        .setMinValues(0)
        .setMaxValues(LANGUAGES.length)
        .addOptions(LANGUAGES.map(l => ({
          label: l.role === l.name ? l.name : `${l.role} (${l.name})`,
          value: l.id,
          default: current.includes(l.id),
        }))),
    )],
  }
}

/** The two buttons pinned in #pick-your-club, which start each flow. */
export function pickChannelButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('club:open').setLabel('Choose my club').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('lang:open').setLabel('My languages').setStyle(ButtonStyle.Secondary),
  )]
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('club:open').setLabel('Back').setStyle(ButtonStyle.Secondary),
  )
}
