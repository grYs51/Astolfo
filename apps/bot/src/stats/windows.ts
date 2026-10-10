import { Prisma } from '@prisma/client';

/** Same periods as the dashboard's period picker */
export type StatsPeriod = 'week' | 'month' | 'year' | 'all';

/** A time range [from, to); no `from` means "since the beginning" */
export interface TimeWindow {
  from?: Date;
  to: Date;
}

const DAY = 24 * 60 * 60 * 1000;

/** Rolling lengths, matching the dashboard API (30-day month, 365-day year) */
const LENGTH: Record<Exclude<StatsPeriod, 'all'>, number> = {
  week: 7 * DAY,
  month: 30 * DAY,
  year: 365 * DAY,
};

/**
 * The period ending now, and the equally long one before it (for "↑ 12% vs
 * the week before"). 'all' has no previous period.
 */
export const periodWindows = (
  period: StatsPeriod,
  now = new Date()
): { current: TimeWindow; previous?: TimeWindow } => {
  if (period === 'all') return { current: { to: now } };
  const length = LENGTH[period];
  const from = new Date(now.getTime() - length);
  return {
    current: { from, to: now },
    previous: { from: new Date(from.getTime() - length), to: from },
  };
};

/** Timestamp columns a window can filter on */
type TimeColumn = 'issued_on' | 'created_at' | 'a.issued_on' | 'me.issued_on';

/** `AND <column> >= from AND <column> < to` */
export const windowFilter = (column: TimeColumn, window: TimeWindow) => {
  const col = Prisma.raw(column);
  const lower = window.from ? Prisma.sql`AND ${col} >= ${window.from}` : Prisma.empty;
  return Prisma.sql`${lower} AND ${col} < ${window.to}`;
};
