import humanizeDuration from 'humanize-duration';
import {
  CommandInteraction,
  CacheType,
  EmbedBuilder,
  SlashCommandBuilder,
  InteractionContextType,
} from 'discord.js';
import client from '../../client/client';
import BaseSlash from '../../utils/structures/base-slash';
import {
  getLeaderboard,
  getLonerBoard,
} from '../../utils/functions/leaderboard';
import { voice_stats } from '@prisma/client';
import { createBar } from '../../utils/functions/create-bar';

export default class LeaderboardEvent extends BaseSlash {
  constructor() {
    super('leaderboard', 'Shows a leaderboard of the most active users');
  }

  override createInteraction(client: client) {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommandGroup((group) =>
        group
          .setName('type')
          .setDescription('Type of leaderboard')
          .addSubcommand((sub) =>
            sub.setName('all-time').setDescription('All time leaderboard')
          )
          .addSubcommand((sub) =>
            sub.setName('current').setDescription('Current leaderboard')
          )
          .addSubcommand((sub) =>
            sub.setName('loner').setDescription('Loner leaderboard')
          )
      )
      .setContexts(InteractionContextType.Guild);
  }
  async slash(
    client: client,
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction
        .reply({
          content: 'This command can only be used in a server.',
        })
        .catch(client.logger.error);
      return;
    }

    const allTime =
      interaction.options.data[0].options?.[0].name === 'all-time';
    const current = interaction.options.data[0].options?.[0].name === 'current';
    const loner = interaction.options.data[0].options?.[0].name === 'loner';

    await interaction.deferReply().catch(client.logger.error);

    //set starting voiceStats list
    const dbVoiceStatsOfGuild = !current
      ? await client.dataSource.voiceStats.findMany({
          where: {
            guild_id: guild.id,
          },
        })
      : [];

    const inChannel = client.voiceUsers
      .filter((x) => x.guild_id === guild.id)
      .map((x) => ({ ...x, ended_on: new Date() })) as voice_stats[];

    const fullStats = inChannel.length
      ? [...dbVoiceStatsOfGuild, ...inChannel]
      : dbVoiceStatsOfGuild;

    if (!fullStats.length) {
      await interaction.editReply({
        content: !current ? 'No stats found!' : 'No one is in a voice channel!',
      });
      return;
    }

    const members = client.guilds.cache
      .get(guild.id)!
      .members.cache.map((x) => x);

    const leaderboard = !loner
      ? getLeaderboard(members, fullStats)
      : getLonerBoard(members, fullStats);

    const longestInVc = leaderboard
      .sort((a, b) => b.count - a.count)
      .slice(0, 1)[0].count;

    const sorted = leaderboard
      .sort((a, b) => {
        return b.count - a.count;
      })
      .map((x) => {
        return {
          ...x,
          time: humanizeDuration(x.count, { round: true }),
          bar: createBar(x.count, longestInVc, 20),
        };
      });

    const embed = new EmbedBuilder()
      .setColor('#000000')
      .setTitle(!loner ? 'Leaderboard' : 'Lonerboard')
      .setDescription(`Time spend ${loner ? 'alone' : ''} in voice channels`)
      .addFields(
        sorted.map((x, i) => {
          return {
            name: `${i + 1}. ${x.name}`,
            value: `${x.time}\n${x.bar}`,
          };
        })
      );

    await interaction.editReply({ embeds: [embed] }).catch(client.logger.error);
  }
}
