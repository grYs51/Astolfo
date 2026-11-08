import { Presence } from 'discord.js';
import { cacheStatus } from './status-cache';
import { closeStatus, openStatus, statusKey } from './status-save';
import { runSerialized } from '../vc/voice-utils';
import { handleStatusMetrics } from './status-metrics';
import { client } from '../../../client/instance';
import { Logger } from '../../logger';

export const handleStatusUpdate = async (
  oldPresence: Presence | null,
  newPresence: Presence,
  date: Date
) => {
  // Swap the cache entry synchronously — detach the open interval and install
  // the new one before the first await. `presenceUpdate` fires once per mutual
  // guild, so a second event lands while the writes below are still in
  // flight; if the swap happened after them, that event would read the same
  // open entry and close it a second time.
  const previous = client.userStatus.get(newPresence.userId);

  let next: ReturnType<typeof cacheStatus> | undefined;
  if (newPresence.status) {
    next = cacheStatus(newPresence, date);
  } else {
    client.userStatus.delete(newPresence.userId);
  }

  handleStatusMetrics();

  // Serialized per user: a quick second change must not try to close a row
  // whose insert hasn't landed yet. No previous entry means we never saw this
  // user's current status start (they joined a guild after boot), so there is
  // nothing to close.
  await runSerialized(statusKey(newPresence.userId), async () => {
    // A failed close is logged and left to crash recovery; the new status
    // still gets its row
    if (previous) {
      await closeStatus(previous, date).catch((error) =>
        Logger.error(`Failed to close status ${previous.id}`, error)
      );
    }
    if (next) await openStatus(next);
  });
};
