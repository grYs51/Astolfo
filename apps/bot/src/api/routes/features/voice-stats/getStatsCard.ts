import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { getTimeZone, isHiddenFrom } from '../helpers';
import { statsCardSvg } from '../../../../cards/stats-card-svg';
import { DEFAULT_SECTIONS, STATS_CARD_SECTIONS, StatsCardSection } from '../../../../cards/stats.card';
import { DEFAULT_THEME, ThemeName, THEMES } from '../../../../cards/themes';
import { StatsPeriod } from '../../../../stats/windows';
import { sendPng } from '../../../utils/send-png';

const PERIODS: readonly StatsPeriod[] = ['week', 'month', 'year', 'all'];

const isSection = (s: string): s is StatsCardSection => (STATS_CARD_SECTIONS as readonly string[]).includes(s);

/**
 * A member's stats card as a PNG, as the viewer may see it: `?period=&theme=&sections=totals,heatmap&tz=`.
 * No sections means the /stats ones; a bad time zone falls back to UTC like the other endpoints.
 */
export const getStatsCard: RequestHandler<{ serverId: string; userId: string }> = asyncHandler(
  async (req, res) => {
    const { serverId, userId } = req.params;
    const viewerId = req.user?.id ?? '';
    const period = (req.query.period ?? 'month') as StatsPeriod;
    if (!PERIODS.includes(period)) {
      res.status(400).send({ error: '`period` must be week, month, year or all' });
      return;
    }
    const theme = String(req.query.theme ?? DEFAULT_THEME);
    if (!Object.hasOwn(THEMES, theme)) {
      res.status(400).send({ error: `\`theme\` must be one of ${Object.keys(THEMES).join(', ')}` });
      return;
    }
    const picked = req.query.sections ? String(req.query.sections).split(',') : [];
    if (!picked.every(isSection)) {
      res.status(400).send({ error: `\`sections\` must be a comma-separated list of ${STATS_CARD_SECTIONS.join(', ')}` });
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
      theme: THEMES[theme as ThemeName],
      // Drawn in the card's own order, whatever order they come in
      sections: picked.length ? STATS_CARD_SECTIONS.filter((section) => picked.includes(section)) : DEFAULT_SECTIONS,
      tz: getTimeZone(req.query.tz),
    });
    await sendPng(res, svg, 'stats.png');
  }
);
