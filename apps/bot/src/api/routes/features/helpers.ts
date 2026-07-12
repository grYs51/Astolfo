import { ChannelType, Guild } from 'discord.js';

/** Splits a millisecond duration into whole hours and remaining minutes. */
export const toDurationParts = (ms: number) => ({
  hours: Math.floor(ms / (1000 * 60 * 60)),
  minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
});

/**
 * Maps a `period` query param to the start date of that period.
 * Returns `undefined` for 'all' / unknown values so callers can decide
 * their own default (no filter, beginning of time, last month, …).
 */
export const getStartDateForPeriod = (
  period: string | undefined
): Date | undefined => {
  const now = Date.now();
  switch (period) {
    case 'day':
      return new Date(now - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now - 365 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
};

/** Resolves a channel id to display data, with an "Unknown Channel" fallback. */
export const getChannelData = (
  guild: Guild | undefined,
  channelId: string
) => {
  const channel = guild?.channels.cache.get(channelId);
  return channel
    ? { id: channel.id, name: channel.name, type: ChannelType[channel.type] }
    : { id: channelId, name: 'Unknown Channel', type: 'VOICE' };
};
