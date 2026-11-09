import schedule, { Job } from 'node-schedule';
import { GuildMember } from 'discord.js';
import { client } from '../../client/instance';
import { isEnabled, SETTING_FLAGS } from '../handlers/settings-handler';
import { voiceKey } from '../handlers/vc/voice-utils';
import { Logger } from '../logger';
import { CARD_IMAGE, fetchImage } from '../../cards/avatars';
import { reminderCard } from '../../cards/reminder.card';
import { cardFile } from '../../cards/render';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

const REMINDER_HOURS = 5;

const scheduledJobs = new Map<string, Job>();

export const schedule5hrVoiceChannelJob = (
  member: GuildMember,
  channel_id: string,
  date: Date
) => {
  const jobKey = voiceKey(member.guild.id, member.id);
  scheduleJob(jobKey, new Date(date.getTime() + REMINDER_HOURS * 60 * 60 * 1000), () => {
    const guildConfig = client.guildConfigs.get(member.guild.id);
    if (
      guildConfig?.toggles === undefined ||
      !isEnabled(guildConfig.toggles, SETTING_FLAGS.VOICE_CHANNEL_REMINDER)
    ) {
      return;
    }
    const channel = client.channels.cache.get(channel_id);
    if (channel?.isSendable()) {
      const straightOrGay = Math.random() > 0.9 ? 'straight' : 'gay';
      const send = async () => {
        const svg = reminderCard(
          {
            memberName: member.displayName,
            avatar: await fetchImage(member.displayAvatarURL(CARD_IMAGE)),
            channelName: 'name' in channel && channel.name ? channel.name : 'voice',
            hours: REMINDER_HOURS,
            word: straightOrGay,
          },
          THEMES[DEFAULT_THEME]
        );
        // member.toString() is a mention: the text pings, the image can't
        await channel.send({ content: `${member}`, files: [await cardFile(svg, 'reminder.png')] });
      };
      // Runs from a node-schedule timer: nothing else would observe a
      // rejection (e.g. missing send permission, a failed render)
      send().catch((error) =>
        Logger.error(`Failed to send 5h voice reminder in ${channel_id}`, error)
      );
    }
  });
};

const scheduleJob = (jobKey: string, date: Date, callback: () => void) => {
  // Cancel any pending job for this key so it isn't orphaned in node-schedule
  scheduledJobs.get(jobKey)?.cancel();
  const job = schedule.scheduleJob(date, callback);
  scheduledJobs.set(jobKey, job);
};

export const cancelJob = (guildId: string, userId: string): void => {
  const jobKey = voiceKey(guildId, userId);
  const job = scheduledJobs.get(jobKey);
  if (job) {
    job.cancel();
    scheduledJobs.delete(jobKey);
  }
};
