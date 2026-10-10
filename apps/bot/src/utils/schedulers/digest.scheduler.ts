import schedule from 'node-schedule';
import type DiscordClient from '../../client/client';
import { Logger } from '../logger';
import { getServerDigest } from '../../stats/queries';
import { buildDigestMessage, dashboardUrlFor, isEmptyDigest } from '../../stats/messages';

/**
 * Weekly digest: every Monday 08:00 UTC each server with a digest channel
 * gets a recap of the week before (Monday–Sunday, UTC). An hourly check posts
 * any digest that's due, so a restart or downtime on Monday morning only
 * delays it, and guild_configs.digest_last_sent_at keeps a week from posting
 * twice.
 */

const DIGEST_WEEKDAY = 1; // Monday
const DIGEST_HOUR_UTC = 8;
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** The most recent digest moment (Monday 08:00 UTC) at or before `now` */
export const lastDigestMoment = (now: Date): Date => {
  const moment = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DIGEST_HOUR_UTC)
  );
  const daysSinceMonday = (moment.getUTCDay() - DIGEST_WEEKDAY + 7) % 7;
  moment.setUTCDate(moment.getUTCDate() - daysSinceMonday);
  if (moment > now) moment.setUTCDate(moment.getUTCDate() - 7);
  return moment;
};

/** The full week (Monday 00:00 → Monday 00:00 UTC) the latest digest covers */
export const digestWeek = (now: Date) => {
  const to = new Date(lastDigestMoment(now).getTime() - DIGEST_HOUR_UTC * 60 * 60 * 1000);
  return { from: new Date(to.getTime() - WEEK), to };
};

/** Due when nothing was posted since the most recent digest moment */
export const isDigestDue = (lastSentAt: Date | null, now: Date) =>
  !lastSentAt || lastSentAt < lastDigestMoment(now);

/** Build the digest of the latest full week; undefined when nothing happened */
export const buildLatestDigest = async (
  client: DiscordClient,
  guildId: string,
  now = new Date()
) => {
  const week = digestWeek(now);
  const digest = await getServerDigest(client.dataSource, guildId, week, {
    from: new Date(week.from.getTime() - WEEK),
    to: week.from,
  });
  if (isEmptyDigest(digest)) return undefined;
  return buildDigestMessage({
    digest,
    guildName: client.guilds.cache.get(guildId)?.name ?? 'this server',
    dashboardUrl: dashboardUrlFor(guildId),
    weekStart: week.from,
  });
};

/** Post every digest that is due. Returns the guild ids it posted to. */
export const runDueDigests = async (client: DiscordClient, now = new Date()) => {
  const configs = await client.dataSource.guildConfigurations.findMany({
    where: { digest_channel_id: { not: null } },
  });
  const posted: string[] = [];

  for (const config of configs) {
    // Skip servers the bot has left; their config stays for if it's re-added
    if (!client.guilds.cache.has(config.guild_id)) continue;
    if (!isDigestDue(config.digest_last_sent_at, now)) continue;

    try {
      // A silent week isn't worth a post
      const message = await buildLatestDigest(client, config.guild_id, now);
      if (message) {
        const channel = await client.channels
          .fetch(config.digest_channel_id as string)
          .catch(() => null);
        if (channel?.isSendable()) {
          await channel.send(message);
          posted.push(config.guild_id);
        } else {
          Logger.warn(
            `Weekly digest: channel ${config.digest_channel_id} in guild ${config.guild_id} is missing or not sendable`
          );
        }
      }
    } catch (error) {
      Logger.error(`Weekly digest failed for guild ${config.guild_id}`, error);
    }

    // Marked even when posting failed: retrying every hour wouldn't fix a
    // deleted channel or missing permissions
    try {
      const updated = await client.dataSource.guildConfigurations.update({
        where: { guild_id: config.guild_id },
        data: { digest_last_sent_at: now },
      });
      client.guildConfigs.set(updated.guild_id, updated);
    } catch (error) {
      Logger.error(`Weekly digest: could not mark guild ${config.guild_id} as sent`, error);
    }
  }

  return posted;
};

let started = false;

export function startDigestScheduler(client: DiscordClient) {
  if (started) return;
  started = true;

  const run = () =>
    runDueDigests(client)
      .then((posted) => {
        if (posted.length) Logger.info(`Weekly digest posted to ${posted.length} server(s)`);
      })
      .catch((error) => Logger.error('Weekly digest run failed', error));

  // Hourly at :05, plus once now to catch up after downtime
  schedule.scheduleJob('5 * * * *', run);
  void run();
  Logger.info('Weekly digest scheduler started (Mondays 08:00 UTC)');
}
