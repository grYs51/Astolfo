import { Presence } from 'discord.js';
import { cacheStatus, saveStatus } from '.';
import { handleStatusMetrics } from './status-metrics';
import { client } from '../../../client/instance';

export const handleStatusUpdate = async (
  oldPresence: Presence | null,
  newPresence: Presence,
  date: Date
) => {
  // Swap the cache entry synchronously — detach the open interval and install
  // the new one before the first await. `presenceUpdate` fires once per mutual
  // guild, so a second event lands while the write below is still in flight;
  // if the swap happened after it, that event would read the same open entry
  // and insert the interval a second time.
  const previous = client.userStatus.get(newPresence.userId);

  if (newPresence.status) {
    cacheStatus(newPresence, date);
  } else {
    client.userStatus.delete(newPresence.userId);
  }

  handleStatusMetrics();

  // No previous entry means we never saw this user start their current status
  // (they joined a guild after boot), so there is no duration to close — the
  // entry cached above starts the clock.
  if (previous) {
    await saveStatus(previous, date);
  }
};
