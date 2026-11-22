import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { VoiceStatsWrapped } from '@nx-stolfo/api-interfaces';
import { getMemberWrapped } from '../../../../stats/queries';
import { latestWrappedYear } from '../../../../stats/wrapped-year';
import { discordDirectory } from '../../../utils/discord-directory';
import { getChannelData, getTimeZone, memberOrUnknown } from '../helpers';

/**
 * A member's year on the server (`?year=`, the latest open one by default), the same numbers as /wrapped,
 * but the year, months, days and hours in the viewer's `?tz=` (the card is UTC)
 */
export const getWrapped: RequestHandler<{ serverId: string; userId: string }, VoiceStatsWrapped | { error: string }> =
  asyncHandler(async (req, res) => {
    const { serverId, userId } = req.params;
    const now = new Date();
    const latest = latestWrappedYear(now);
    const year = req.query.year === undefined ? latest : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2020 || year > latest) {
      res.status(400).send({ error: `\`year\` must be a year from 2020 to ${latest} (a year's Wrapped opens on 1 December)` });
      return;
    }

    const directory = discordDirectory();
    const wrapped = await getMemberWrapped(req.db, serverId, userId, year, {
      now,
      tz: getTimeZone(req.query.tz),
      botIds: directory.botIds(serverId),
    });
    const members = await directory.members(serverId, [userId, ...wrapped.buddies.map((b) => b.memberId)]);
    res.send({
      ...wrapped,
      serverName: directory.guild(serverId)?.name ?? 'Unknown server',
      member: memberOrUnknown(members, userId),
      topChannels: wrapped.topChannels.map((c) => ({ channel: getChannelData(serverId, c.channelId), voiceMs: c.voiceMs })),
      buddies: wrapped.buddies.map((b) => ({ member: memberOrUnknown(members, b.memberId), togetherMs: b.togetherMs })),
    });
  });
