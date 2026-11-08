import { randomUUID } from 'crypto';
import { user_statuses } from '@prisma/client';
import { client } from '../../client/instance';
import { openAllStatuses } from '../handlers/presence/status-save';

export const setStatusCache = async () => {
  const date = new Date();
  const opened: Partial<user_statuses>[] = [];
  client.guilds.cache.forEach((guild) => {
    guild.members.cache.forEach((member) => {
      // Skip bots, and members already seen (in several guilds, or through a
      // presence event that arrived first and opened its own row)
      if (member.user.bot || client.userStatus.has(member.id)) return;
      const userStatus: Partial<user_statuses> = {
        id: randomUUID(),
        status: member.presence?.status ?? 'offline',
        created_at: date,
        user_id: member.id,
      };

      client.userStatus.set(member.id, userStatus);
      opened.push(userStatus);
    });
  });
  await openAllStatuses(opened);
};
