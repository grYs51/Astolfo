import type { XpSource } from '@nx-stolfo/api-interfaces';
import type DiscordClient from '../client/client';
import { Logger } from '../utils/logger';
import { grantXp, totalXp } from './grant';
import { currentRules, levelFor } from './rules';
import { isRecalculating, xpLookups } from './recalculate';
import { postLevelUp } from './announce';
import { runSerialized } from '../utils/handlers/vc/voice-utils';

/** What a closed voice session can earn; messages and games are granted by their own events */
export const VOICE_SOURCES: XpSource[] = ['VOICE', 'STARTER', 'RECONNECT', 'WELCOME', 'STREAK', 'MILESTONE'];

/** The live path only looks this far back; the hourly sweep catches anything older */
const LIVE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Grant a member's new XP from `sources` after something they did (a message, leaving voice, a game)
 * and post in the server's level-up channel when it took them up a level. Never throws: it runs beside
 * the handler.
 */
export const awardAndAnnounce = (
  client: DiscordClient,
  guildId: string,
  memberId: string,
  sources: XpSource[],
  now = new Date()
) =>
  // One member's grants one at a time: two at once (a message as a session closes) would each compare
  // the level against a total that already holds the other's XP, and post twice or not at all
  runSerialized(`xp:${guildId}:${memberId}`, () => award(client, guildId, memberId, sources, now));

const award = async (client: DiscordClient, guildId: string, memberId: string, sources: XpSource[], now: Date) => {
  if (isRecalculating(guildId)) return;
  try {
    const rules = currentRules();
    const { xp: added } = await grantXp(client.dataSource, {
      guildId,
      memberId,
      sources,
      since: new Date(now.getTime() - LIVE_WINDOW_MS),
      rules,
      now,
      ...xpLookups(client, guildId),
    });
    if (!added || !client.guildConfigs.get(guildId)?.level_up_channel_id) return;

    const total = await totalXp(client.dataSource, guildId, memberId);
    const level = levelFor(total, rules);
    if (level > levelFor(total - added, rules)) await postLevelUp(client, guildId, memberId, level);
  } catch (error) {
    Logger.error(`XP grant failed for ${memberId} in guild ${guildId}`, error);
  }
};
