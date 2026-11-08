import { randomUUID } from 'crypto';
import { Presence } from 'discord.js';
import { client } from '../../../client/instance';
import { user_statuses } from '@prisma/client';

/**
 * Caches the new open status. The id is made here, synchronously, so the row
 * inserted for it later and the cache entry always agree.
 */
export const cacheStatus = (newPresence: Presence, date: Date) => {
  const status: Partial<user_statuses> = {
    id: randomUUID(),
    user_id: newPresence.userId,
    status: newPresence.status,
    created_at: date,
  };

  client.userStatus.set(newPresence.userId, status);
  return status;
};
