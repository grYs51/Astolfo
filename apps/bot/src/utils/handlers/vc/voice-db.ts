import { client } from '../../..';
import { voice_stats } from '@prisma/client';
import { VOICE_TYPE } from './voice-utils';

const voiceKey = (guildId: string, memberId: string) => `${guildId}:${memberId}`;

export const saveAllUserVoiceStatsToDb = async (
  memberId: string,
  guildId: string,
  date: Date
) => {
  const k = voiceKey(guildId, memberId);
  const voiceUsersStats = client.voiceUsers.get(k) ?? [];

  if (voiceUsersStats.length === 0) return;

  const savePromises = voiceUsersStats.map(async (voiceUser) => {
    voiceUser.ended_on = date;
    await client.dataSource.voiceStats.create({
      data: voiceUser as voice_stats,
    });
  });

  await Promise.all(savePromises);
  client.voiceUsers.delete(k);
};

export const saveTypeUserVoiceStats = async (
  memberId: string,
  guildId: string,
  date: Date,
  type: VOICE_TYPE
) => {
  const k = voiceKey(guildId, memberId);
  const stats = client.voiceUsers.get(k);

  if (!stats) return;

  const idx = stats.findIndex((v) => v.type === type);
  if (idx === -1) return;

  const voiceUser = stats[idx];
  voiceUser.ended_on = date;

  await client.dataSource.voiceStats.create({ data: voiceUser as voice_stats });

  stats.splice(idx, 1);
  if (stats.length === 0) {
    client.voiceUsers.delete(k);
  }
};
