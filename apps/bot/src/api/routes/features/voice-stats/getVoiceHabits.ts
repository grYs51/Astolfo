import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { VoiceHabitMetric, VoiceHabitsLeaderboard } from '@nx-stolfo/api-interfaces';
import { memberOrUnknown, parsePeriod, periodFilter, visibleMembersOnly } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { HABIT_SUMS, HabitRow, toHabits } from './habits-sql';

/** Members need this much voice time to rank on "mostly muted", so one muted minute doesn't top it */
export const MUTED_MIN_VOICE_MS = 5 * 3_600_000;

/** What each metric ranks by; rows where it's 0 are left out */
const RANK_BY: Record<VoiceHabitMetric, Prisma.Sql> = {
  camera: Prisma.sql`video`,
  streaming: Prisma.sql`streaming`,
  listening: Prisma.sql`(voice - deafened)`,
  muted: Prisma.sql`(CASE WHEN voice >= ${MUTED_MIN_VOICE_MS} THEN muted::float / voice ELSE 0 END)`,
};

/** Members ranked by camera, streaming or listening time, or by muted share of voice. */
export const getVoiceHabits: RequestHandler<{ serverId: string }, VoiceHabitsLeaderboard> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const period = parsePeriod(req.query.period, ['week', 'month', 'year', 'all'], 'all');
    const metric = parsePeriod<VoiceHabitMetric>(
      req.query.metric,
      ['camera', 'streaming', 'listening', 'muted'],
      'camera'
    );
    const rankBy = RANK_BY[metric];

    // Up to 100 so the viewer's rank is known even outside the shown top
    const rows = await req.db.$queryRaw<(HabitRow & { member_id: string })[]>`
      SELECT * FROM (
        SELECT member_id, ${HABIT_SUMS}
        FROM voice_stats
        WHERE guild_id = ${serverId}
          ${periodFilter(period)}
          ${visibleMembersOnly('member_id', req.user?.id ?? '')}
        GROUP BY member_id
      ) habits
      WHERE ${rankBy} > 0
      ORDER BY ${rankBy} DESC, voice DESC
      LIMIT 100
    `;

    const members = await discordDirectory().members(
      serverId,
      rows.map((row) => row.member_id)
    );

    res.send({
      period,
      metric,
      leaderboard: rows.map((row) => ({
        member: memberOrUnknown(members, row.member_id),
        habits: toHabits(row),
      })),
    });
  });
