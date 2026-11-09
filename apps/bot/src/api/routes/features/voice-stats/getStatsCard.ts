import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { isHiddenFrom } from '../helpers';
import { statsCardSvg } from '../../../../cards/stats-card-svg';
import { DEFAULT_THEME, THEMES } from '../../../../cards/themes';
import { StatsPeriod } from '../../../../stats/windows';
import { sendPng } from '../../../utils/send-png';

const PERIODS: readonly StatsPeriod[] = ['week', 'month', 'year', 'all'];

/** A member's /stats card as a PNG download, as the viewer may see it. */
export const getStatsCard: RequestHandler<{ serverId: string; userId: string }> = asyncHandler(
  async (req, res) => {
    const { serverId, userId } = req.params;
    const viewerId = req.user?.id ?? '';
    const period = (req.query.period ?? 'month') as StatsPeriod;
    if (!PERIODS.includes(period)) {
      res.status(400).send({ error: '`period` must be week, month, year or all' });
      return;
    }
    if (await isHiddenFrom(req.db, userId, viewerId)) {
      res.status(403).send({ error: 'private' });
      return;
    }

    const svg = await statsCardSvg({
      db: req.db,
      guildId: serverId,
      memberId: userId,
      viewerId,
      period,
      theme: THEMES[DEFAULT_THEME],
    });
    // Download even though the dashboard is on another origin, where <a download> is ignored
    res.attachment('stats.png');
    await sendPng(res, svg);
  }
);
