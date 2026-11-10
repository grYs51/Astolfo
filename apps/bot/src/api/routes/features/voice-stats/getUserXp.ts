import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { XpHistory, XpSegment, XpSource } from '@nx-stolfo/api-interfaces';
import { getChannelData, memberOrUnknown } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { totalXp } from '../../../../xp/grant';
import { currentRules, levelProgress } from '../../../../xp/rules';

const PAGE = 25;

/** `before` is `<ISO time>|<row id>` from the previous page's nextCursor */
const parseCursor = (raw: unknown) => {
  if (raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  const [iso, id] = raw.split('|');
  const at = new Date(iso);
  return id && !Number.isNaN(at.getTime()) ? { at, id } : undefined;
};

/**
 * GET …/users/:userId/xp?before=<cursor>: the member's level and XP ledger, newest first, a page at a
 * time. Voice rows carry their channel and step line, with everyone in it resolved in `people`.
 */
export const getUserXp: RequestHandler<{ serverId: string; userId: string }, XpHistory | { error: string }> =
  asyncHandler(async (req, res) => {
    const { serverId, userId } = req.params;
    const cursor = parseCursor(req.query.before);
    if (cursor === undefined) {
      res.status(400).send({ error: '`before` must be a cursor from nextCursor' });
      return;
    }

    const [total, rows] = await Promise.all([
      totalXp(req.db, serverId, userId),
      req.db.xpEvents.findMany({
        where: {
          guild_id: serverId,
          member_id: userId,
          ...(cursor && {
            OR: [{ created_at: { lt: cursor.at } }, { created_at: cursor.at, id: { lt: cursor.id } }],
          }),
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
      }),
    ]);
    const page = rows.slice(0, PAGE);

    // The ledger keeps the session id in the key, not the channel
    const sessionIds = page.filter((r) => r.source === 'VOICE').map((r) => r.key.slice('voice:'.length));
    const sessions = sessionIds.length
      ? await req.db.voiceStats.findMany({ where: { id: { in: sessionIds } }, select: { id: true, channel_id: true } })
      : [];
    const channelOf = new Map(sessions.map((s) => [s.id, s.channel_id]));

    const segmentsOf = (segments: unknown) => (Array.isArray(segments) ? (segments as XpSegment[]) : undefined);
    const ids = [...new Set(page.flatMap((r) => segmentsOf(r.segments)?.flatMap((s) => s.memberIds) ?? []))];
    const members = ids.length ? await discordDirectory().members(serverId, ids) : new Map();

    const last = page[page.length - 1];
    res.send({
      level: levelProgress(total, currentRules()),
      entries: page.map((r) => ({
        id: r.id,
        source: r.source as XpSource,
        amount: r.amount,
        note: r.note,
        at: r.created_at,
        ...(r.source === 'VOICE' && {
          channel: getChannelData(serverId, channelOf.get(r.key.slice('voice:'.length)) ?? ''),
          segments: segmentsOf(r.segments),
        }),
      })),
      people: Object.fromEntries(ids.map((id) => [id, memberOrUnknown(members, id)])),
      nextCursor: rows.length > PAGE ? `${last.created_at.toISOString()}|${last.id}` : null,
    });
  });
