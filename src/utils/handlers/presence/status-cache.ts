import { Presence } from 'discord.js';
import { client } from '../../..';
import { user_statuses } from '@prisma/client';

export const cacheStatus = (newPresence: Presence, date: Date) => {
  const status: Partial<user_statuses> = {
    user_id: newPresence.userId,
    user_name: newPresence.user?.username,
    status: newPresence.status,
    created_at: date,
    ended_at: null,
  };

  client.userStatus.set(newPresence.userId, status);
};
