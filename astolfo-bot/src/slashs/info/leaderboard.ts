import humanizeDuration from 'humanize-duration';
import { CommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import client from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';

export default class LeaderboardEvent extends BaseSlash {
  constructor() {
    super('leaderboard');
  }

  async createInteraction(
    client: client,
    interaction: DiscordInteractions,
  ): Promise<void> {
    const command: PartialApplicationCommand = {
      name: 'leaderboard',
      description: 'Leaderboard!',
    };

    await interaction
      .createApplicationCommand(command)
      .then(() => {
        client.logger.info('Leaderboard command created!');
      })
      .catch(client.logger.error);
  }
  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
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

    await interaction.deferReply().catch(client.logger.error);

    const stats = await client.dataSource.guildStats.find({
      where: {
        guildId: guild.id,
        type: 'VOICE',
      },
    });

    if (!stats.length) {
      await interaction.editReply({ content: 'No stats found!' });
      return;
    }

    const leaderboard = stats.reduce((acc, stat) => {
      const a = acc.find((x) => x.id === stat.memberId);

      if (a) {
        a.count += stat.endedOn!.getTime() - stat.issuedOn.getTime();
      } else {
        if (
          client.guilds.cache.get(guild.id)!.members.cache.get(stat.memberId)
        ) {
          acc.push({
            id: stat.memberId,
            count: stat.endedOn!.getTime() - stat.issuedOn.getTime(),
            name:
              client.guilds.cache
                .get(guild.id)!
                .members.cache.get(stat.memberId)?.user.username || 'Unknown',
            // stat.member.guildName,
          });
        }
      }
      return acc;
    }, [] as Leaderboard[]);

    const inChannel = client.voiceUsers.filter((x) => x.guildId === guild.id);

    if (inChannel) {
      inChannel.reduce((acc, stat) => {
        const a = acc.find((x) => x.id === stat.memberId);

        if (a) {
          a.count += new Date().getTime() - stat.issuedOn.getTime();
        } else {
          acc.push({
            id: stat.memberId,
            count: new Date().getTime() - stat.issuedOn.getTime(),
            name: client.guilds.cache
              .get(guild.id)!
              .members.cache.get(stat.memberId)!.user.username,
            // stat.member.guildName,
          });
        }
        return acc;
      }, leaderboard);
    }

    const sorted = leaderboard
      .sort((a, b) => {
        return b.count - a.count;
      })
      .map((x) => {
        return {
          ...x,
          time: humanizeDuration(x.count, { round: true }),
        };
      });

    const embed = new EmbedBuilder()
      .setColor('#000000')
      .setTitle('Leaderboard')
      .setDescription('Time spend in voice channels')
      .addFields(
        sorted.map((x, i) => {
          return {
            name: `${i + 1}. ${x.name}`,
            value: `${x.time}`,
          };
        }),
      );

    await interaction.editReply({ embeds: [embed] }).catch(client.logger.error);
  }
}

interface Leaderboard {
  id: string;
  name: string;
  count: number;
}
