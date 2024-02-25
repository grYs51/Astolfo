import { voice_stats } from '@prisma/client';
import { client } from '../..';

const createVoiceStat = (channel, member, date) => {
  return {
    channel_id: channel.id,
    guild_id: channel.guild.id,
    issued_on: date,
    member_id: member.id,
    type: 'VOICE',
  };
};

export const setVc = async () => {
  const date = new Date();
  client.channels.cache.forEach(async (channel) => {
    if (channel.isVoiceBased()) {
      const members = channel.members;
      if (!members) return;
      members.forEach(async (member) => {
        const voiceStat = createVoiceStat(channel, member, date);
        client.voiceUsers.push(voiceStat);
      });
    }
  });
};
