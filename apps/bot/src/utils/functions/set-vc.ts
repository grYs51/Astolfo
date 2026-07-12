import { voice_stats } from '@prisma/client';
import { client } from '../..';
import { GuildMember, VoiceBasedChannel } from 'discord.js';
import { Logger } from '../logger';
import { schedule5hrVoiceChannelJob } from '../schedulers/voice-channel.scheduler';
import { createVoiceStat, getActiveVoiceStates, voiceKey } from '../handlers/vc';

const processMember = (
  channel: VoiceBasedChannel,
  member: GuildMember,
  date: Date
): voice_stats[] => {
  const voiceVoiceStat = createVoiceStat(
    channel.guild.id,
    channel.id,
    member.id,
    date
  );

  const otherVoiceStats = getActiveVoiceStates(member.voice).map((type) =>
    createVoiceStat(channel.guild.id, channel.id, member.id, date, type)
  );

  const newStats = [voiceVoiceStat, ...otherVoiceStats];
  const k = voiceKey(channel.guild.id, member.id);
  const existing = client.voiceUsers.get(k) ?? [];
  client.voiceUsers.set(k, [...existing, ...newStats]);
  schedule5hrVoiceChannelJob(member, channel.id, date);
  return newStats;
};

export const setVc = async () => {
  const date = new Date();
  const allNewStats: voice_stats[] = [];
  let totalMembers = 0;

  for (const channel of client.channels.cache.values()) {
    if (channel.isVoiceBased()) {
      for (const member of channel.members.values()) {
        allNewStats.push(...processMember(channel, member, date));
        totalMembers++;
      }
    }
  }

  if (totalMembers === 0) {
    Logger.info('No cutie patooties to add to the voice stats');
    return;
  }

  // Persist on open: one round trip for everyone currently in voice
  await client.dataSource.voiceStats.createMany({ data: allNewStats });
  Logger.info(`Added ${totalMembers} cutie patooties to the voice stats`);
};

export const saveVc = async () => {
  const date = new Date();

  const allStats = Array.from(client.voiceUsers.values()).flat();
  if (allStats.length === 0) return;

  // Rows are already in the DB (inserted open on join) — closing them all is
  // a single update, which matters most on shutdown
  await client.dataSource.voiceStats.updateMany({
    where: { id: { in: allStats.map((stat) => stat.id) } },
    data: { ended_on: date },
  });
};
