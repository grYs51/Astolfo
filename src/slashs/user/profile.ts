import { EmbedBuilder } from 'discord.js';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { VOICE_TYPE } from '../../utils/handlers/vc';
import { game_player, voice_stats } from '@prisma/client';
import { GAME_TYPES, SCORING } from '../../utils/handlers/games-handler';
import humanizeDuration from 'humanize-duration';

const getDuration = (voiceStat: voice_stats) =>
  new Date(voiceStat.ended_on!).getTime() -
  new Date(voiceStat.issued_on).getTime();

const voiceStatSum = (sum: number, curr: voice_stats) =>
  sum + getDuration(curr);

export default class ProfileSlash extends BaseSlash {
  constructor() {
    super('profile', 'Show my profile', SlashDeferTypes.PUBLIC);
  }
  async slash(client, interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

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

    const totalTimeSpentInVC = allVoiceStats
      .filter((stat) => stat.type == VOICE_TYPE.VOICE)
      .reduce(voiceStatSum, 0);
    const recordingVsTotalTimePercentage = (
      (totalTimeSpentInVC /
        (new Date().getTime() - new Date(firstVoiceStat.issued_on).getTime())) *
      100
    ).toFixed(2);

    const timeSpentInVC_muted = allVoiceStats
      .filter((stat) => stat.type == VOICE_TYPE.MUTED)
      .reduce(voiceStatSum, 0);
    const mutedVsTotalTimePercentage = (
      (timeSpentInVC_muted / totalTimeSpentInVC) *
      100
    ).toFixed(2);

    const timeSpentInVC_streaming = allVoiceStats
      .filter((stat) => stat.type == VOICE_TYPE.STREAMING)
      .reduce(voiceStatSum, 0);

    const maxDurationInOneSession = allVoiceStats.reduce(
      (max, curr) => (getDuration(curr) > max ? getDuration(curr) : max),
      0
    );

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

    const winsLosses: Record<SCORING, game_player[]> = Object.groupBy(
      rockpaperscissorsResults,
      (gamePlayer: game_player) => gamePlayer.result
    );

    const RpsWins = winsLosses[SCORING.WIN]?.length || 0;
    const RpsLosses = winsLosses[SCORING.LOSS]?.length || 0;
    const RpsTies = winsLosses[SCORING.TIE]?.length || 0;

    const embed = new EmbedBuilder()
      .setColor('#800851')
      .setTitle('Your Astolfo Profile')
      .setDescription(
        `Measuring since ${new Date(firstVoiceStat?.issued_on).toLocaleDateString()}`
      )
      .addFields(
        {
          name: `Total Time in VC`,
          value: `${humanizeDuration(totalTimeSpentInVC, { round: true })} (${recordingVsTotalTimePercentage}% of bot time)`,
        },
        {
          name: `Total Time **MUTED** in VC`,
          value: `${humanizeDuration(timeSpentInVC_muted, { round: true })} (${mutedVsTotalTimePercentage}% of total VC time)`,
        },
        //TODO: fill in other stats
      );
    await InterActionUtils.send(interaction, embed);
  }
}
