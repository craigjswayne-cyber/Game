// /bug: one form, one forum post, tagged so the developer can filter by
// language and by area and move it from Open to Fixed.
//
// Everything is asked in the one form (Discord allows five questions): the
// language and the area as menus, a one-line summary, what happened, and up
// to three screenshots. Asking in one go matters more than it looks: every
// extra step between "that is wrong" and "sent" loses reports, and the
// reports that are lost are the small wording ones this server most needs.
import {
  ChannelType, FileUploadBuilder, LabelBuilder, MessageFlags, ModalBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js'
import { AREAS, BUG_FORUM, LANGUAGES } from './config.js'

export function bugModal() {
  return new ModalBuilder()
    .setCustomId('bug:submit')
    .setTitle('Report a problem')
    .addLabelComponents(
      new LabelBuilder().setLabel('Game language').setDescription('The language the game was set to')
        .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('lang').setRequired(true)
          .addOptions(LANGUAGES.map(l => ({ label: l.role === l.name ? l.name : `${l.role} (${l.name})`, value: l.id })))),
      new LabelBuilder().setLabel('Where in the game').setDescription('Pick the closest')
        .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('area').setRequired(true)
          .addOptions(AREAS.map(a => ({ label: a.name, value: a.id, description: a.hint })))),
      new LabelBuilder().setLabel('Summary').setDescription('One line, e.g. "Press room question cut off on the Hub"')
        .setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short)
          .setRequired(true).setMinLength(5).setMaxLength(90)),
      new LabelBuilder().setLabel('What happened').setDescription('What you did, what you saw, what you expected. Game version and device help.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('what').setStyle(TextInputStyle.Paragraph)
          .setRequired(true).setMinLength(10).setMaxLength(1500)
          .setPlaceholder('Week 12, Leicester, iPhone 14, version 1.8.0. Opened Finances and the board tab was empty.')),
      new LabelBuilder().setLabel('Screenshots').setDescription('Optional, up to three')
        .setFileUploadComponent(new FileUploadBuilder().setCustomId('shots').setRequired(false).setMinValues(0).setMaxValues(3)),
    )
}

/** The forum post, from what the form sent. Pure, so the tests can read it. */
export function bugPost({ lang, area, title, what, reporter, forumTags }) {
  const language = LANGUAGES.find(l => l.id === lang)
  const where = AREAS.find(a => a.id === area)
  const tagId = name => forumTags.find(t => t.name === name)?.id
  const appliedTags = [tagId(language?.name), tagId(where?.tag), tagId('Open')].filter(Boolean)
  const content = [
    `**Language:** ${language?.name ?? lang}`,
    `**Area:** ${where?.name ?? area}`,
    `**Reported by:** <@${reporter}>`,
    '',
    what,
  ].join('\n')
  return { name: title.slice(0, 100), appliedTags, content }
}

export async function submitBug(interaction) {
  const f = interaction.fields
  const lang = f.getStringSelectValues('lang')[0]
  const area = f.getStringSelectValues('area')[0]
  const title = f.getTextInputValue('title').trim()
  const what = f.getTextInputValue('what').trim()
  const shots = f.getUploadedFiles('shots', false)

  const forum = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildForum && c.name === BUG_FORUM)
  if (!forum) {
    return interaction.reply({ content: `There is no #${BUG_FORUM} forum yet. An admin needs to run /setup.`, flags: MessageFlags.Ephemeral })
  }
  // the upload can take a moment; say we have it before Discord gives up waiting
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  const post = bugPost({ lang, area, title, what, reporter: interaction.user.id, forumTags: forum.availableTags })
  const thread = await forum.threads.create({
    name: post.name,
    appliedTags: post.appliedTags,
    message: {
      content: post.content,
      files: shots ? [...shots.values()].map(a => ({ attachment: a.url, name: a.name })) : [],
      allowedMentions: { users: [] },
    },
    reason: `Bug report from ${interaction.user.tag}`,
  })
  return interaction.editReply(`Thanks. Your report is here: ${thread.url}\nAdd screenshots or more detail in that post.`)
}
