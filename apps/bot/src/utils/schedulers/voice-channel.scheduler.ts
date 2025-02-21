import schedule, { Job } from 'node-schedule';
import { GuildMember } from 'discord.js';
import { client } from '../..';
import { isEnabled, SETTING_FLAGS } from '../handlers/settings-handler';

const scheduledJobs = new Map<string, Job>();

export const schedule5hrVoiceChannelJob = (
  member: GuildMember,
  channel_id: string,
  date: Date
) => {
  scheduleJob(member.id, new Date(date.getTime() + 5 * 60 * 60 * 1000), () => {
    const guildConfig = client.guildConfigs.get(member.guild.id);
    if (
      guildConfig?.toggles === undefined ||
      !isEnabled(guildConfig.toggles, SETTING_FLAGS.VOICE_CHANNEL_REMINDER)
    ) {
      return;
    }
    const channel = client.channels.cache.get(channel_id);
    if (channel?.isSendable()) {
      //member.toString() makes it a mention (pinging the user)
      const straightOrGay = Math.random() < 0.9 ? 'straight' : 'gay';
      channel.send(
        `${member} has been in the voice channel for 5 hours ${straightOrGay}!`
      );
    }
  });
};

const scheduleJob = (userId: string, date: Date, callback: () => void) => {
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
