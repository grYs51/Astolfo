import { client } from '../../..';
import { voice_stats } from '@prisma/client';
import { VOICE_TYPE } from './voice-utils';

export const saveAllUserVoiceStatsToDb = async (
  memberId: string,
  date: Date
) => {
  const voiceUsersStats = client.voiceUsers.filter(
    (voiceUser) => voiceUser.member_id === memberId
  );

  if (!voiceUsersStats.length) return;
  const savePromises = voiceUsersStats.map(async (voiceUser) => {
    voiceUser.ended_on = date;
    await client.dataSource.voiceStats.create({
      data: voiceUser as voice_stats,
    });
    client.voiceUsers = client.voiceUsers.filter(
      (voiceUser) => voiceUser.member_id !== memberId
    );
  });
  await Promise.all(savePromises);
};

export const saveTypeUserVoiceStats = async (
  memberId: string,
  date: Date,
  type: VOICE_TYPE
) => {
  const voiceUser = client.voiceUsers.find(
    (voiceUser) => voiceUser.member_id === memberId && type === voiceUser.type
  );

  if (voiceUser) {
    voiceUser.ended_on = date;
    await client.dataSource.voiceStats.create({
      data: voiceUser as voice_stats,
    });
    client.voiceUsers = client.voiceUsers.filter(
      (voiceUser) => voiceUser.member_id !== memberId
    );
  }
};
