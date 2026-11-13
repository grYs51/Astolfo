import { DashboardPeriod } from '@nx-stolfo/data-access-voice-stats';
import { SegmentedControlOption } from '@nx-stolfo/components';

/**
 * The page period lives in the URL (`?period=week`) so a refresh, a shared
 * link, a link from the bot and links between dashboard pages all keep it.
 * Month is the default and stays out of the URL.
 */
export const DEFAULT_PERIOD: DashboardPeriod = 'month';

export const PERIOD_OPTIONS: SegmentedControlOption<DashboardPeriod>[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

/** Query param value to period; anything unknown is the default */
export const parsePeriod = (value: string | undefined): DashboardPeriod =>
  PERIOD_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_PERIOD;

/** Period to query param value; null drops it from the URL */
export const periodParam = (period: DashboardPeriod) =>
  period === DEFAULT_PERIOD ? null : period;
