import {
  CacheType,
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import { buildLatestDigest } from '../../utils/schedulers/digest.scheduler';
import { digestChannelUpdate, saveGuildConfig } from '../../utils/functions/set-config';
import { POST_PERMISSIONS } from '../../api/utils/discord-directory';

const SCHEDULE = 'every Monday at 08:00 UTC';

/**
 * /digest channel <channel> | off | preview — configure the weekly digest
 * post (see utils/schedulers/digest.scheduler.ts). Needs Manage Server.
 */
export default class DigestSlash extends BaseSlash {
  constructor() {
    super('digest', 'Set up the weekly server recap post', SlashDeferTypes.HIDDEN);
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((sub) =>
        sub
          .setName('channel')
          .setDescription(`Post the weekly recap in a channel (${SCHEDULE})`)
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('Where to post it')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          )
      )
      .addSubcommand((sub) => sub.setName('off').setDescription('Stop posting the weekly recap'))
      .addSubcommand((sub) =>
        sub.setName('preview').setDescription('Show last week’s recap (only to you)')
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    const guild = interaction.guild;
    if (!interaction.isChatInputCommand() || !guild) return;

    const config = client.guildConfigs.get(guild.id);

    switch (interaction.options.getSubcommand()) {
      case 'channel': {
        const channel = await guild.channels.fetch(
          interaction.options.getChannel('channel', true).id
        );
        const me = guild.members.me ?? (await guild.members.fetchMe());
        if (!channel || !channel.permissionsFor(me).has(POST_PERMISSIONS)) {
          await InterActionUtils.send(
            interaction,
            `I can’t post in <#${interaction.options.getChannel('channel', true).id}>. I need View Channel, Send Messages and Embed Links there.`,
            true
          );
          return;
        }
        await saveGuildConfig(client, guild.id, digestChannelUpdate(config, channel.id));
        await InterActionUtils.send(
          interaction,
          `The weekly recap will be posted in <#${channel.id}> ${SCHEDULE}.`,
          true
        );
        return;
      }

      case 'off': {
        await saveGuildConfig(client, guild.id, digestChannelUpdate(config, null));
        await InterActionUtils.send(interaction, 'The weekly recap is off.', true);
        return;
      }

      case 'preview': {
        const message = await buildLatestDigest(client, guild.id);
        const status = config?.digest_channel_id
          ? `Posted in <#${config.digest_channel_id}> ${SCHEDULE}.`
          : 'Not posted anywhere yet. Turn it on with `/digest channel`.';
        await InterActionUtils.send(
          interaction,
          message
            ? { ...message, content: `Preview of last week’s recap. ${status}` }
            : `Nothing happened last week, so there’d be no recap. ${status}`,
          true
        );
        return;
      }
    }
  }
}
