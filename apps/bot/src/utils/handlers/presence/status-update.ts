import { Presence } from 'discord.js';
import { cacheStatus } from './status-cache';
import { closeStatus, openStatus, statusKey } from './status-save';
import { runSerialized } from '../vc/voice-utils';
import { handleStatusMetrics } from './status-metrics';
import { client } from '../../../client/instance';

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
    if (previous) await closeStatus(previous, date);
    if (next) await openStatus(next);
  });
};
