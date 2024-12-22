import { voice_stats } from '@prisma/client';
import { client } from '../..';
import { GuildMember, VoiceBasedChannel } from 'discord.js';
import { Logger } from '../logger';
import { schedule5hrVoiceChannelJob } from '../schedulers/voice-channel.scheduler';
import { createVoiceStat, getActiveVoiceStates } from '../handlers/vc';

const processMember = async (
  channel: VoiceBasedChannel,
  member: GuildMember,
  date: Date
) => {
  const voiceVoiceStat = createVoiceStat(
    channel.guild.id,
    channel.id,
    member.id,
    date
  );

  const otherVoiceStats = getActiveVoiceStates(member.voice).map((type) =>
    createVoiceStat(channel.guild.id, channel.id, member.id, date, type)
  );

  client.voiceUsers.push(voiceVoiceStat, ...otherVoiceStats);
  schedule5hrVoiceChannelJob(member, channel.id, date);
};

const processChannel = async (channel: VoiceBasedChannel, date: Date) => {
  const members = channel.members;
  if (!members) return 0;

  let count = 0;
  for (const member of members.values()) {
    await processMember(channel, member, date);
    count++;
  }
  return count;
};

export const setVc = async () => {
  const date = new Date();
  let totalMembers = 0;

  for (const channel of client.channels.cache.values()) {
    if (channel.isVoiceBased()) {
      const count = await processChannel(channel, date);
      totalMembers += count;
    }
  }

  if (totalMembers === 0) {
    Logger.info('No cutie patooties to add to the voice stats');
  } else {
    Logger.info(`Added ${totalMembers} cutie patooties to the voice stats`);
  }
};

export const saveVc = async () => {
  const date = new Date();

  return Promise.all(
    client.voiceUsers.map(async (voiceStat) => {
      voiceStat.ended_on = date;
      await client.dataSource.voiceStats.create({
        data: voiceStat as voice_stats,
      });
    })
  );
};
