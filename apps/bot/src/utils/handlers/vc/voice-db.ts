import { client } from '../../..';
import { voice_stats } from '@prisma/client';
import { VOICE_TYPE } from './voice-utils';

export const saveAllUserVoiceStatsToDb = async (
  memberId: string,
  guildId: string,
  date: Date
) => {
  const voiceUsersStats = client.voiceUsers.filter(
    (voiceUser) =>
      voiceUser.member_id === memberId &&
      voiceUser.guild_id === guildId
  );

  if (voiceUsersStats.length === 0) return;

  const savePromises = voiceUsersStats.map(async (voiceUser) => {
    voiceUser.ended_on = date;
    await client.dataSource.voiceStats.create({
      data: voiceUser as voice_stats,
    });
  });

  await Promise.all(savePromises);
  client.voiceUsers = client.voiceUsers.filter(
    (voiceUser) =>
      voiceUser.member_id !== memberId || voiceUser.guild_id !== guildId
  );
};

export const saveTypeUserVoiceStats = async (
  memberId: string,
  guildId: string,
  date: Date,
  type: VOICE_TYPE
) => {
  const voiceUser = client.voiceUsers.find(
    (voiceUser) =>
      voiceUser.member_id === memberId &&
      voiceUser.type === type &&
      voiceUser.guild_id === guildId
  );

  if (!voiceUser) return;

  voiceUser.ended_on = date;

  await client.dataSource.voiceStats.create({ data: voiceUser as voice_stats });
  client.voiceUsers = client.voiceUsers.filter(
    (voiceUser) =>
      voiceUser.member_id !== memberId ||
      voiceUser.type !== type ||
      voiceUser.guild_id !== guildId
  );
};
