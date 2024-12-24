import { voice_stats } from '@prisma/client';
import { getVoiceStatsType } from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';

const voiceTypesToCheck = [
  VOICE_TYPE.VOICE,
  VOICE_TYPE.MUTED,
  VOICE_TYPE.DEAF,
  VOICE_TYPE.SERVER_DEAF,
  VOICE_TYPE.SERVER_MUTED,
];

export const getCurrentVoiceStats: getVoiceStatsType = (client, guildId) => {
  const stats = client.voiceUsers
    .filter(
      (x) =>
        x.guild_id === guildId &&
        voiceTypesToCheck.includes(x.type as VOICE_TYPE)
    )
    .map((x) => ({ ...x, ended_on: new Date() })) as voice_stats[];

  return Promise.resolve(stats);
};
