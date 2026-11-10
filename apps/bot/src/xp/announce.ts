import type DiscordClient from '../client/client';
import { Logger } from '../utils/logger';

/** The last level posted per member. A live grant and the sweep can both see the same crossing; it posts once. shortcut: in memory, a restart forgets it, fine since only a real crossing gets here */
const posted = new Map<string, number>();

/** Post a level-up in the server's level-up channel, if it has one */
export const postLevelUp = async (client: DiscordClient, guildId: string, memberId: string, level: number) => {
  const channelId = client.guildConfigs.get(guildId)?.level_up_channel_id;
  const key = `${guildId}:${memberId}`;
  if (!channelId || posted.get(key) === level) return;
  posted.set(key, level);

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isSendable()) {
    Logger.warn(`Level-up channel ${channelId} in guild ${guildId} is missing or not sendable`);
    return;
  }
  // The mention shows who it is without pinging them
  await channel.send({ content: `🎉 <@${memberId}> reached **level ${level}**!`, allowedMentions: { parse: [] } });
};
