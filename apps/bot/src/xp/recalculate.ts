import type DiscordClient from '../client/client';
import { discordDirectory } from '../api/utils/discord-directory';
import { Logger } from '../utils/logger';
import { grantXp, guildTotals } from './grant';
import { currentRules, levelFor } from './rules';
import { postLevelUp } from './announce';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';

const DAY = 24 * 60 * 60 * 1000;
/** How far back each sweep looks before the previous one: late-closed sessions and the day before for streaks */
const SWEEP_OVERLAP_MS = 2 * DAY;

/** What the grants need from Discord. shortcut: a bot the cache doesn't know counts as a person; store bot ids if music bots that left ever inflate old XP */
export const xpLookups = (client: DiscordClient, guildId: string) => ({
  isBot: (id: string) => client.users.cache.get(id)?.bot ?? false,
  channelName: (channelId: string) => discordDirectory().channel(guildId, channelId)?.name,
});

// shortcut: the lock is in memory, fine while API and bot are one process; move it to the database if they split
const busy = new Map<string, 'recalculating' | 'sweeping'>();

/** While true, live grants leave the guild alone, so no level-up compares against a half-rebuilt total */
export const isRecalculating = (guildId: string) => busy.get(guildId) === 'recalculating';

/** A recalculation or a sweep holds the guild. Never both at once: their inserts on the same keys can deadlock. */
export const isXpBusy = (guildId: string) => busy.has(guildId);

/**
 * Rebuild a guild's XP ledger with the current rules, posting nothing. In one transaction, so a failure
 * keeps the old ledger and readers see the old totals until the new ones are complete.
 */
export const recalculateXp = async (client: DiscordClient, guildId: string) => {
  const held = busy.get(guildId);
  if (held) throw new Error(`XP for guild ${guildId} is already ${held === 'sweeping' ? 'being swept' : 'being recalculated'}`);
  busy.set(guildId, 'recalculating');
  const start = Date.now();
  try {
    const granted = await client.dataSource.$transaction(
      async (tx) => {
        // Calls still going keep their voice and starter rows: the rebuild skips open sessions (only the member's
        // own checkpoint grades them), and the next checkpoint reprices them with the current rules
        await tx.$executeRaw`
          DELETE FROM xp_events x
          WHERE x.guild_id = ${guildId}
            AND NOT EXISTS (
              SELECT 1 FROM voice_stats v
              WHERE v.guild_id = ${guildId} AND v.type = ${VOICE_TYPE.VOICE} AND v.ended_on IS NULL
                AND x.key IN ('voice:' || v.id, 'starter:' || v.id)
            )
        `;
        return grantXp(tx, { guildId, rules: currentRules(), ...xpLookups(client, guildId) });
      },
      { timeout: 10 * 60 * 1000 }
    );
    return { ...granted, ms: Date.now() - start };
  } finally {
    busy.delete(guildId);
  }
};

/** When each guild's last sweep started. The first sweep after a start covers all history, which is also the backfill. */
const lastSweep = new Map<string, number>();

let sweeping = false;

/** Grant whatever the live path missed (sessions closed by shutdown, crash recovery or the missed-leave cleanup) and the weekly top 3 */
export const sweepXp = async (client: DiscordClient) => {
  // A first sweep over a long history can outlast the hour; the next tick mustn't start a second one
  if (sweeping) return;
  sweeping = true;
  try {
    await sweepGuilds(client);
  } finally {
    sweeping = false;
  }
};

const sweepGuilds = async (client: DiscordClient) => {
  for (const { id: guildId } of discordDirectory().guilds()) {
    if (busy.has(guildId)) continue;
    busy.set(guildId, 'sweeping');
    try {
      await sweepGuild(client, guildId);
    } catch (error) {
      Logger.error(`XP sweep failed for guild ${guildId}`, error);
    } finally {
      busy.delete(guildId);
    }
  }
};

const sweepGuild = async (client: DiscordClient, guildId: string) => {
  const start = Date.now();
  const last = lastSweep.get(guildId);
  const rules = currentRules();
  // The sweep's level-ups (the weekly top 3, sessions closed at shutdown) are posted too, but not on a
  // guild without XP yet: that's the backfill. shortcut: a backfill that fails halfway posts the rest's
  // level-ups on the next sweep (without pings); mark guilds as backfilled if that ever happens
  const before = client.guildConfigs.get(guildId)?.level_up_channel_id ? await guildTotals(client.dataSource, guildId) : undefined;
  const granted = await grantXp(client.dataSource, {
    guildId,
    since: last ? new Date(last - SWEEP_OVERLAP_MS) : undefined,
    rules,
    ...xpLookups(client, guildId),
  });
  lastSweep.set(guildId, start);
  if (granted.rows || !last) {
    Logger.info(`XP sweep for guild ${guildId}: ${granted.rows} rows, ${granted.xp} XP in ${Date.now() - start} ms`);
  }
  if (!before?.size || !granted.rows) return;
  for (const [memberId, total] of await guildTotals(client.dataSource, guildId)) {
    const level = levelFor(total, rules);
    if (level <= levelFor(before.get(memberId) ?? 0, rules)) continue;
    // One failed post shouldn't drop the rest
    await postLevelUp(client, guildId, memberId, level).catch((error) =>
      Logger.error(`Level-up post failed for ${memberId} in guild ${guildId}`, error)
    );
  }
};
