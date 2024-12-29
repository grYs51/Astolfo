import { Presence } from 'discord.js';
import { handleStatusUpdate } from '.';

export const handleUserPresenceChange = async (
  oldStatus: Presence | null,
  newStatus: Presence,
  date: Date
) => {
  if (oldStatus?.status !== newStatus.status) {
    await handleStatusUpdate(oldStatus, newStatus, date);
  }
};
