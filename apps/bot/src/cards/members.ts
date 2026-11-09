import type { Guild } from 'discord.js';
import { Logger } from '../utils/logger';
import { CARD_IMAGE, fetchImage } from './avatars';

export interface CardMember {
  name: string;
  avatar?: string;
}

/**
 * Names and avatars of members for a card (<@id> doesn't resolve inside an
 * image). Large guilds leave offline members out of the cache, so the missing
 * ones are fetched in one batch; anyone still unknown shows as "Unknown member".
 */
export const cardMembers = async (guild: Guild | null | undefined, ids: string[]): Promise<Record<string, CardMember>> => {
  const unique = [...new Set(ids)];
  const missing = unique.filter((id) => !guild?.members.cache.has(id));
  if (guild && missing.length) {
    await guild.members
      .fetch({ user: missing })
      .catch((error) => Logger.warn(`Card members: batch fetch failed for guild ${guild.id}`, error));
  }
  const entries = await Promise.all(
    unique.map(async (id) => {
      const member = guild?.members.cache.get(id);
      const card: CardMember = {
        name: member?.displayName ?? 'Unknown member',
        avatar: await fetchImage(member?.displayAvatarURL(CARD_IMAGE)),
      };
      return [id, card] as const;
    })
  );
  return Object.fromEntries(entries);
};
