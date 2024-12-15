import { voice_stats } from '@prisma/client';
import { client } from '../..';
import { GuildMember, VoiceBasedChannel } from 'discord.js';
import logger from '../logger';

const createVoiceStat = (
  channel: VoiceBasedChannel,
  member: GuildMember,
  date: Date
) => {
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
  let amount = 0;
  client.channels.cache.forEach(async (channel) => {
    if (channel.isVoiceBased()) {
      const members = channel.members;
      if (!members) return;
      members.forEach(async (member) => {
        const voiceStat = createVoiceStat(channel, member, date);
        client.voiceUsers.push(voiceStat);
        amount++;
      });
    }
  });

  if (amount === 0) {
    logger.info('No cutie patooties to add to the voice stats');
    return;
  }
  logger.info(`Added ${amount} cutie patooties to the voice stats`);
};


export const saveVc = async () => {
  const date = new Date();
  for await (const voiceStat of client.voiceUsers) {
    voiceStat.ended_on = date;
    await client.dataSource.voiceStats.create({
      data: voiceStat as voice_stats,
    });
  }
};
