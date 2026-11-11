import type DiscordClient from '../client/client';
import { Logger } from '../utils/logger';
import { VOICE_TYPE, runSerialized, voiceKey } from '../utils/handlers/vc/voice-utils';
import { VOICE_SOURCES, awardAndAnnounce } from './level-up';
import { isXpBusy } from './recalculate';

/** How often a call still going is graded up to now; the schedule in digest.scheduler.ts runs on this */
export const CHECKPOINT_EVERY_MIN = 5;
const SLOW_MS = 10_000;

let running = false;

/**
 * Grade every open voice session up to now, so XP and level-ups land during the call instead of after it.
 * Open sessions come from the database, not `client.voiceUsers`, so this also works right after a start
 * and in demo mode. Each member runs in their voice queue, so a checkpoint never interleaves with the close.
 * shortcut: one grantXp per member in voice per tick, including the streak, milestone and welcome (`firsts`)
 * scans over history, and the open-session query has no partial index. Each tick also grades an open session
 * again from its start (its channel's rows since then, and the whole `segments` JSON rewritten), so a member
 * idling in voice for days costs more every tick. If the slow-tick warning shows up, suspect long sessions
 * first; then batch per guild, index `ended_on IS NULL`, or grade only from the last checkpoint.
 */
export const checkpointXp = async (client: DiscordClient) => {
  // A slow tick mustn't overlap the next one
  if (running) return;
  running = true;
  const start = Date.now();
  try {
    const open = await client.dataSource.$queryRaw<{ guild_id: string; member_id: string }[]>`
      SELECT DISTINCT guild_id, member_id FROM voice_stats WHERE type = ${VOICE_TYPE.VOICE} AND ended_on IS NULL
    `;
    for (const { guild_id, member_id } of open) {
      // A sweep or a recalculation holds the guild: their inserts on the same keys could deadlock with ours
      if (isXpBusy(guild_id)) continue;
      // Each member graded up to the moment their turn comes, not the start of the tick
      await runSerialized(voiceKey(guild_id, member_id), () => awardAndAnnounce(client, guild_id, member_id, VOICE_SOURCES));
    }
    const ms = Date.now() - start;
    if (ms > SLOW_MS) Logger.warn(`XP checkpoint took ${ms} ms for ${open.length} members in voice`);
  } catch (error) {
    Logger.error('XP checkpoint failed', error);
  } finally {
    running = false;
  }
};
