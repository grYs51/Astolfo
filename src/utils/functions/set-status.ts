import { user_statuses } from '@prisma/client';
import { client } from '../..';

export const setStatusCache = async () => {
  const date = new Date();
  // Status
  client.guilds.cache.forEach(async (guild) => {
    guild.members.cache.forEach(async (member) => {
      if (member.user.bot) return;
      const userStatus: Partial<user_statuses> = {
        status: member.presence?.status || 'offline',
        created_at: date,
        user_id: member.id,
      };

      client.userStatus.set(member.id, userStatus);
    });
  });

  return;
};