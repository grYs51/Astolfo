import { Message } from 'discord.js';
import { client } from '../../../client/instance';

export const saveMessage = async (message: Message) => {
  if (message.channel.isDMBased()) return;

  return client.dataSource.messageStats.create({
    data: {
      guild_id: message.guildId!,
      channel_id: message.channelId,
      user_id: message.author.id,
      message_id: message.id,
      // Discord's send time, stored as UTC like voice_stats (the column's
      // now() default would depend on the DB session time zone)
      created_at: message.createdAt,
    },
  });
};
