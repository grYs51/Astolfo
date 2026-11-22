import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { VoiceStatsWrapped } from '@nx-stolfo/api-interfaces';
import { getMemberWrapped } from '../../../../stats/queries';
import { discordDirectory } from '../../../utils/discord-directory';
import { getChannelData, memberOrUnknown } from '../helpers';

/** A member's year on the server (`?year=`, the current UTC year by default), the same numbers as /wrapped */
export const getWrapped: RequestHandler<{ serverId: string; userId: string }, VoiceStatsWrapped | { error: string }> =
  asyncHandler(async (req, res) => {
    const { serverId, userId } = req.params;
    const now = new Date();
    const year = req.query.year === undefined ? now.getUTCFullYear() : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2020 || year > now.getUTCFullYear()) {
      res.status(400).send({ error: '`year` must be a year from 2020 to this one' });
      return;
    }

    const wrapped = await getMemberWrapped(req.db, serverId, userId, year, now);
    const directory = discordDirectory();
    const members = await directory.members(serverId, [userId, ...wrapped.buddies.map((b) => b.memberId)]);
    res.send({
      ...wrapped,
      serverName: directory.guild(serverId)?.name ?? 'Unknown server',
      member: memberOrUnknown(members, userId),
      topChannels: wrapped.topChannels.map((c) => ({ channel: getChannelData(serverId, c.channelId), voiceMs: c.voiceMs })),
      buddies: wrapped.buddies.map((b) => ({ member: memberOrUnknown(members, b.memberId), togetherMs: b.togetherMs })),
    });
  });
