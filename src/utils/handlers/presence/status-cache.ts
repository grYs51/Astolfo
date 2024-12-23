import { Presence } from 'discord.js';
import { client } from '../../..';
import { user_statuses } from '@prisma/client';

export const cacheStatus = (newPresence: Presence, date: Date) => {
  const status: Partial<user_statuses> = {
    user_id: newPresence.userId,
    status: newPresence.status,
    created_at: date,
  };

  client.userStatus.set(newPresence.userId, status);
};
