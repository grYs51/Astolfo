import schedule, { Job } from 'node-schedule';
import { GuildMember } from 'discord.js';
import { client } from '../..';

const scheduledJobs = new Map<string, Job>();

export const schedule5hrVoiceChannelJob = (
  member: GuildMember,
  channel_id: string,
  date: Date
) => {
  scheduleJob(member.id, new Date(date.getTime() + 5 * 60 * 60 * 1000), () => {
    const channel = client.channels.cache.get(channel_id);
    if (channel?.isSendable()) {
      channel.send(
        `${member.displayName} has been in the voice channel for 5 hours straight!`
      );
    }
  });
};

const scheduleJob = (
  userId: string,
  date: Date,
  callback: () => void
) => {
  const job = schedule.scheduleJob(date, callback);
  scheduledJobs.set(userId, job);
};

export const cancelJob = (userId: string): void => {
  const job = scheduledJobs.get(userId);
  if (job) {
    job.cancel();
    scheduledJobs.delete(userId);
  }
};
