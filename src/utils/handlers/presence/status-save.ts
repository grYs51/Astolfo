import { Presence } from 'discord.js';
import { client } from '../../..';
import { user_statuses } from '@prisma/client';

export const saveStatus = async (oldStatus: Presence, date: Date) => {
  const status = client.userStatus.get(oldStatus.userId);
  if (!status) return;

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
