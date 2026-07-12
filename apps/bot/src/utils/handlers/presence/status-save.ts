import { Presence } from 'discord.js';
import { client } from '../../..';
import { user_statuses } from '@prisma/client';
import { Logger } from '../../logger';

export const saveStatus = async (oldStatus: Presence, date: Date) => {
  const status = client.userStatus.get(oldStatus.userId);
  if (!status) {
    Logger.warn(`saveStatus: no cached entry found for user ${oldStatus.userId} — status duration lost`);
    return;
  }

  const timeDiff = (date.getTime() - status.created_at!.getTime()) / 1000;

  if (timeDiff < 15) {
    client.userStatus.delete(oldStatus.userId);
    return;
  }

  status.ended_at = date;

  await client.dataSource.userStatus.create({
    data: status as user_statuses,
  });
  client.userStatus.delete(oldStatus.userId);
};

/**
 * Flushes every cached open status duration to the DB in one batch.
 * Called on shutdown so deploys don't silently drop them.
 */
export const saveAllStatuses = async (date: Date) => {
  const statuses = Array.from(client.userStatus.values())
    .filter(
      (status) =>
        status.created_at && date.getTime() - status.created_at.getTime() >= 15_000
    )
    .map((status) => ({ ...status, ended_at: date }) as user_statuses);

  client.userStatus.clear();

  if (statuses.length === 0) return;
  await client.dataSource.userStatus.createMany({ data: statuses });
};
