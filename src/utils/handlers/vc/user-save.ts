import { VoiceState } from 'discord.js';
import { client } from '../../..';
import { voice_stats } from '@prisma/client';

export const handleVoiceUserLog = async (oldState: VoiceState, date: Date) => {
  const voiceUser = client.voiceUsers.find(
    (voiceUser) => voiceUser.member_id === oldState.member!.id,
  );

  if (voiceUser) {
    voiceUser.ended_on = date;
    await client.dataSource.voiceStats.create({
      data: voiceUser as voice_stats,
    });
    client.voiceUsers = client.voiceUsers.filter(
      (voiceUser) => voiceUser.member_id !== oldState.member!.id,
    );
  }
};
