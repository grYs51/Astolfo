import { Message } from 'discord.js';
import { client } from '../../..';

export const saveMessage = async (message: Message) =>
  client.dataSource.messageStats.create({
    data: {
      guild_id: message.guildId!,
      channel_id: message.channelId,
      user_id: message.author.id,
      message_id: message.id,
    },
  });
