import { Presence } from 'discord.js';
import { client } from '../../..';
import { handleStatusUpdate } from '.';

export const handleUserPresenceChange = async (
  oldStatus: Presence | null,
  newStatus: Presence,
  date: Date
) => {
  if (oldStatus?.status === newStatus.status) return;

  // presenceUpdate fires once per mutual guild; the cache is per-user, so
  // skip events whose status we already recorded (avoids a save + a
  // "no cached entry" warning per additional guild)
  const cached = client.userStatus.get(newStatus.userId);
  if (cached?.status === newStatus.status) return;

  await handleStatusUpdate(oldStatus, newStatus, date);
};
