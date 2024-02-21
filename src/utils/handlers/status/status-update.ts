import { Presence } from 'discord.js';
import { cacheStatus, saveStatus } from '.';

export const handleStatusUpdate = async (
  oldPresence: Presence | null,
  newPresence: Presence,
  date: Date,
) => {
  if (oldPresence?.status) {
    await saveStatus(oldPresence, date);
  }

  // save new status to cache
  if (newPresence.status) {
    cacheStatus(newPresence, date);
  }

  return;
};
