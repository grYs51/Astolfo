import type DiscordClient from '../client/client';
import { discordDirectory } from '../api/utils/discord-directory';
import { Logger } from '../utils/logger';
import { grantXp } from './grant';
import { currentRules } from './rules';

const DAY = 24 * 60 * 60 * 1000;
/** How far back each sweep looks before the previous one: late-closed sessions and the day before for streaks */
const SWEEP_OVERLAP_MS = 2 * DAY;

/** What the grants need from Discord. shortcut: a bot the cache doesn't know counts as a person; store bot ids if music bots that left ever inflate old XP */
export const xpLookups = (client: DiscordClient, guildId: string) => ({
  isBot: (id: string) => client.users.cache.get(id)?.bot ?? false,
  channelName: (channelId: string) => discordDirectory().channel(guildId, channelId)?.name,
});

// shortcut: the lock is in memory, fine while API and bot are one process; move it to the database if they split
const recalculating = new Set<string>();

/** While true, live grants and the sweep leave the guild alone, so no level-up compares against a half-rebuilt total */
export const isRecalculating = (guildId: string) => recalculating.has(guildId);

/**
 * Rebuild a guild's XP ledger with the current rules, posting nothing. In one transaction, so a failure
 * keeps the old ledger and readers see the old totals until the new ones are complete.
 */
export const recalculateXp = async (client: DiscordClient, guildId: string) => {
  if (recalculating.has(guildId)) throw new Error(`XP for guild ${guildId} is already being recalculated`);
  recalculating.add(guildId);
  const start = Date.now();
  try {
    const granted = await client.dataSource.$transaction(
      async (tx) => {
        await tx.$executeRaw`DELETE FROM xp_events WHERE guild_id = ${guildId}`;
        return grantXp(tx, { guildId, rules: currentRules(), ...xpLookups(client, guildId) });
      },
      { timeout: 10 * 60 * 1000 }
    );
    return { ...granted, ms: Date.now() - start };
  } finally {
    recalculating.delete(guildId);
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
    if (isRecalculating(guildId)) continue;
    const start = Date.now();
    const last = lastSweep.get(guildId);
    try {
      const granted = await grantXp(client.dataSource, {
        guildId,
        since: last ? new Date(last - SWEEP_OVERLAP_MS) : undefined,
        rules: currentRules(),
        ...xpLookups(client, guildId),
      });
      lastSweep.set(guildId, start);
      if (granted.rows || !last) {
        Logger.info(`XP sweep for guild ${guildId}: ${granted.rows} rows, ${granted.xp} XP in ${Date.now() - start} ms`);
      }
    } catch (error) {
      Logger.error(`XP sweep failed for guild ${guildId}`, error);
    }
  }
};
