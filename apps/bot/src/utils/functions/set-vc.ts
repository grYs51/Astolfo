import { voice_stats } from '@prisma/client';
import { client } from '../..';
import { GuildMember, VoiceBasedChannel } from 'discord.js';
import { Logger } from '../logger';
import { schedule5hrVoiceChannelJob } from '../schedulers/voice-channel.scheduler';
import {
  createVoiceStat,
  getActiveVoiceStates,
  runSerialized,
  voiceKey,
} from '../handlers/vc';

type OpenedMember = {
  key: string;
  channel: VoiceBasedChannel;
  member: GuildMember;
  stats: voice_stats[];
};

const processMember = (
  channel: VoiceBasedChannel,
  member: GuildMember,
  date: Date
): OpenedMember => {
  const voiceVoiceStat = createVoiceStat(
    channel.guild.id,
    channel.id,
    member.id,
    date
  );

  const otherVoiceStats = getActiveVoiceStates(member.voice).map((type) =>
    createVoiceStat(channel.guild.id, channel.id, member.id, date, type)
  );

  return {
    key: voiceKey(channel.guild.id, member.id),
    channel,
    member,
    stats: [voiceVoiceStat, ...otherVoiceStats],
  };
};

export const setVc = async () => {
  const date = new Date();
  const opened: OpenedMember[] = [];

  for (const channel of client.channels.cache.values()) {
    if (channel.isVoiceBased()) {
      for (const member of channel.members.values()) {
        opened.push(processMember(channel, member, date));
      }
    }
  }

  // Go through the same per-member queue as voiceStateUpdate: join events
  // replayed right after ready race this startup pass otherwise, and both
  // would open rows for the same session (double-counted)
  const results = await Promise.all(
    opened.map(({ key, channel, member, stats }) => {
      let added = false;
      return runSerialized(key, async () => {
        // A replayed join got there first — it already opened the session
        if (client.voiceUsers.has(key)) return;

        // Persist on open; cache only after the insert succeeds, so a failed
        // insert can't leave cache entries pointing at rows that don't exist
        await client.dataSource.voiceStats.createMany({ data: stats });
        client.voiceUsers.set(key, stats);
        schedule5hrVoiceChannelJob(member, channel.id, date);
        added = true;
      }).then(() => added);
    })
  );

  const totalMembers = results.filter(Boolean).length;
  if (totalMembers === 0) {
    Logger.info('No cutie patooties to add to the voice stats');
    return;
  }
  Logger.info(`Added ${totalMembers} cutie patooties to the voice stats`);
};

export const saveVc = async () => {
  const date = new Date();

  const allStats = Array.from(client.voiceUsers.values()).flat();
  if (allStats.length === 0) return;

  // Rows are already in the DB (inserted open on join) — closing them all is
  // a single update, which matters most on shutdown. ended_on: null keeps an
  // in-flight leave's end time from being overwritten with the shutdown time.
  await client.dataSource.voiceStats.updateMany({
    where: { id: { in: allStats.map((stat) => stat.id) }, ended_on: null },
    data: { ended_on: date },
  });
};
