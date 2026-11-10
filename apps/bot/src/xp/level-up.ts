import type DiscordClient from '../client/client';
import { Logger } from '../utils/logger';
import { grantXp, totalXp } from './grant';
import { currentRules, levelFor } from './rules';
import { isRecalculating, xpLookups } from './recalculate';
import { runSerialized } from '../utils/handlers/vc/voice-utils';

/** The live path only looks this far back; the hourly sweep catches anything older */
const LIVE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Grant a member's new XP after something they did (a message, leaving voice, a game) and post in the
 * server's level-up channel when it took them up a level. Never throws: it runs beside the handler.
 */
export const awardAndAnnounce = (client: DiscordClient, guildId: string, memberId: string, now = new Date()) =>
  // One member's grants one at a time: two at once (a message as a session closes) would each compare
  // the level against a total that already holds the other's XP, and post twice or not at all
  runSerialized(`xp:${guildId}:${memberId}`, () => award(client, guildId, memberId, now));

const award = async (client: DiscordClient, guildId: string, memberId: string, now: Date) => {
  if (isRecalculating(guildId)) return;
  try {
    const rules = currentRules();
    const { xp: added } = await grantXp(client.dataSource, {
      guildId,
      memberId,
      since: new Date(now.getTime() - LIVE_WINDOW_MS),
      rules,
      now,
      ...xpLookups(client, guildId),
    });
    const channelId = client.guildConfigs.get(guildId)?.level_up_channel_id;
    if (!added || !channelId) return;

    const total = await totalXp(client.dataSource, guildId, memberId);
    const level = levelFor(total, rules);
    if (level <= levelFor(total - added, rules)) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isSendable()) {
      Logger.warn(`Level-up channel ${channelId} in guild ${guildId} is missing or not sendable`);
      return;
    }
    // The mention shows who it is without pinging them
    await channel.send({ content: `🎉 <@${memberId}> reached **level ${level}**!`, allowedMentions: { parse: [] } });
  } catch (error) {
    Logger.error(`XP grant failed for ${memberId} in guild ${guildId}`, error);
  }
};
