import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { VoiceHabitMetric, VoiceHabitsLeaderboard } from '@nx-stolfo/api-interfaces';
import { memberOrUnknown, parsePeriod, periodFilter } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { HABIT_SUMS, HabitRow, toHabits } from '../../../../stats/habits-sql';

/**
 * What each metric ranks by; rows where it's 0 are left out. Listening and
 * muted share stay on the profile: listening ranks like the voice board, and a
 * public muted ranking reads as a shame list.
 */
const RANK_BY: Record<VoiceHabitMetric, Prisma.Sql> = {
  camera: Prisma.sql`video`,
  streaming: Prisma.sql`streaming`,
};

/** Members ranked by camera or streaming time. */
export const getVoiceHabits: RequestHandler<{ serverId: string }, VoiceHabitsLeaderboard> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const period = parsePeriod(req.query.period, ['week', 'month', 'year', 'all'], 'all');
    const metric = parsePeriod<VoiceHabitMetric>(req.query.metric, ['camera', 'streaming'], 'camera');
    const rankBy = RANK_BY[metric];

    // Up to 100 so the viewer's rank is known even outside the shown top
    const rows = await req.db.$queryRaw<(HabitRow & { member_id: string })[]>`
      SELECT * FROM (
        SELECT member_id, ${HABIT_SUMS}
        FROM voice_stats
        WHERE guild_id = ${serverId}
          ${periodFilter(period)}
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
