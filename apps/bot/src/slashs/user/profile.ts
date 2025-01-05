import { CacheType, CommandInteraction, EmbedBuilder, Interaction, SlashCommandBuilder } from 'discord.js';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { VOICE_TYPE } from '../../utils/handlers/vc';
import { game_player, voice_stats } from '@prisma/client';
import { GAME_TYPES, SCORING } from '../../utils/handlers/games-handler';
import humanizeDuration from 'humanize-duration';
import { createDetailedBar } from '../../utils/functions/create-bar';

const getDuration = (voiceStat: voice_stats) =>
  new Date(voiceStat.ended_on!).getTime() -
  new Date(voiceStat.issued_on).getTime();

const voiceStatSum = (sum: number, curr: voice_stats) =>
  sum + getDuration(curr);

export default class ProfileSlash extends BaseSlash {
  constructor() {
    super('profile', 'Show my profile', SlashDeferTypes.PUBLIC);
  }

  createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addMentionableOption((option) =>
        option
          .setName('user')
          .setDescription("Get other user's profile (optional)")
          .setRequired(false)
      );
  }

  async slash(client, interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.options.get('user')?.user?.id || interaction.user.id;

    const { _min: firstVoiceStat } =
      await client.dataSource.voiceStats.aggregate({
        where: {
          guild_id: guildId,
        },
        _min: {
          issued_on: true,
        },
      });

    const allVoiceStats: voice_stats[] =
      await client.dataSource.voiceStats.findMany({
        where: {
          guild_id: guildId,
          member_id: userId,
        },
      });

    const voiceSessions = allVoiceStats.filter(
      (stat) => stat.type == VOICE_TYPE.VOICE
    );

    const totalTimeSpentInVC = voiceSessions.reduce(voiceStatSum, 0);
    const recordingVsTotalTimePercentage =
      (totalTimeSpentInVC /
        (new Date().getTime() - new Date(firstVoiceStat.issued_on).getTime())) *
      100;

    const timeSpentInVC_muted = allVoiceStats
      .filter((stat) => stat.type == VOICE_TYPE.MUTED)
      .reduce(voiceStatSum, 0);
    const mutedVsTotalTimePercentage =
      (timeSpentInVC_muted / totalTimeSpentInVC) * 100;

    const timeSpentInVC_streaming = allVoiceStats
      .filter((stat) => stat.type == VOICE_TYPE.STREAMING)
      .reduce(voiceStatSum, 0);
    const streamingVsTotalTimePercentage =
      (timeSpentInVC_streaming / totalTimeSpentInVC) * 100;

    const maxDurationInOneSession = allVoiceStats.reduce(
      (max, curr) => (getDuration(curr) > max ? getDuration(curr) : max),
      0
    );

    const totalTimePerChannel = allVoiceStats.reduce((dict, curr) => {
      dict[curr.channel_id] = (dict[curr.channel_id] || 0) + getDuration(curr);
      return dict;
    }, {} as Record<string, number>);
    const favouriteChannelId = Object.entries(totalTimePerChannel).reduce(
      (max, [id, time]) => (time > max[1] ? [id, time] : max)
    )[0];

    const favouriteChannel = client.channels.cache.get(favouriteChannelId);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const timeSpentInVcThisWeek = allVoiceStats
      .filter(
        (stat) =>
          stat.type == VOICE_TYPE.VOICE &&
          stat.issued_on.getTime() >= sevenDaysAgo.getTime()
      )
      .reduce(voiceStatSum, 0);

    const rockpaperscissorsResults: game_player[] =
      await client.dataSource.gamePlayers.findMany({
        where: {
          user_id: userId,
          game_result: { game_type_id: GAME_TYPES.ROCK_PAPER_SCISSORS },
        },
        include: {
          game_result: true,
        },
      });

    const winsLosses: Partial<Record<SCORING, game_player[]>> = Object.groupBy(
      rockpaperscissorsResults,
      (gamePlayer: game_player) => gamePlayer.result
    );

    const RpsWins = winsLosses[SCORING.WIN]?.length || 0;
    const RpsLosses = winsLosses[SCORING.LOSS]?.length || 0;
    const RpsTies = winsLosses[SCORING.TIE]?.length || 0;

    const gameBar = createDetailedBar({
      max: RpsLosses + RpsWins + RpsTies,
      size: 10,
      emptyIcon: '⬜',
      values: [
        { value: RpsLosses, icon: '🟥', end: true },
        { value: RpsWins, icon: '🟩' },
      ],
    });

    const embed = new EmbedBuilder()
      .setColor(interaction.member.displayHexColor ?? '#800815')
      // .setAuthor({
      //   name: client.user.username,
      //   iconURL: interaction.user.defaultAvatarUrl,
      // })
      .setTitle(
        `${interaction.member.displayName}'s ${client.user.username} Profile`
      )
      .setDescription(
        `Measuring since ${new Date(
          firstVoiceStat?.issued_on
        ).toLocaleDateString()}\n
         Measured ${voiceSessions.length} voice sessions for you.
         with **${humanizeDuration(maxDurationInOneSession, {
           round: true,
         })}** as your longest session in VC.\n
        `
      )
      .addFields(
        {
          name: `Total Time in VC`,
          value: `${humanizeDuration(totalTimeSpentInVC, {
            round: true,
          })} (${recordingVsTotalTimePercentage.toFixed(2)}% of bot time)`,
        },
        {
          name: `Favourite Channel`,
          value: `${favouriteChannel ?? 'No channel found'}`,
        },
        {
          name: `Total Time **MUTED** in VC`,
          value: `${humanizeDuration(timeSpentInVC_muted, {
            round: true,
          })} (${mutedVsTotalTimePercentage.toFixed(2)}% of your VC time)`,
        },
        {
          name: `Total Time Streamed in VC`,
          value: `${humanizeDuration(timeSpentInVC_streaming, {
            round: true,
          })} (${streamingVsTotalTimePercentage.toFixed(2)}% of your VC time)`,
        },
        {
          name: `Time spent in VC in the last 7 days`,
          value: `${humanizeDuration(timeSpentInVcThisWeek, { round: true })}`,
        },
        {
          name: `Rock Paper Scissors games`,
          value: `${RpsWins} Wins, ${RpsTies} Ties, ${RpsLosses} Losses\n
          ${gameBar}`,
        }
      )
      .setFooter({
        text: 'note: these stats will not include your current VC session',
        // iconURL: client.user.defaultAvatarUrl
      });
    await InterActionUtils.send(interaction, embed);
  }
}
