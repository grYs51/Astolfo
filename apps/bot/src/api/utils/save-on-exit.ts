import { Logger } from '../../utils/logger';
import { getDb } from '../../db';
import { register } from 'prom-client';
import type { Prisma } from '@prisma/client';

// What getMetricsAsJSON() returns at runtime (its typings say `type` is a numeric enum)
type BotMetric = {
  name: string;
  type: string;
  values: { value: number; labels: Record<string, string | number | undefined> }[];
};

// The counters the admin page charts per day; the rest only need their running total
export const DAILY_COUNTERS = [
  'discord_bot_commands_total',
  'discord_bot_slash_total',
  'discord_bot_command_errors_total',
];

/** One row per counter label set; several labels are joined in key order with `|`. */
export const dailyRows = (metrics: BotMetric[]) =>
  metrics
    .filter((metric) => metric.type === 'counter' && DAILY_COUNTERS.includes(metric.name))
    .flatMap((metric) =>
      metric.values.map(({ labels, value }) => ({
        name: metric.name,
        label: Object.keys(labels)
          .sort()
          .map((key) => String(labels[key]))
          .join('|'),
        value: Math.round(value),
      }))
    );

/** Today's (UTC) running total of every counter, so the admin page can show usage per day. */
export async function saveDailyMetrics(metrics: BotMetric[]) {
  const rows = dailyRows(metrics);
  if (rows.length === 0) return;
  await getDb().$executeRaw`
    INSERT INTO metric_daily (day, name, label, value)
    SELECT (NOW() AT TIME ZONE 'UTC')::date, name, label, value
    FROM UNNEST(
      ${rows.map((r) => r.name)}::text[],
      ${rows.map((r) => r.label)}::text[],
      ${rows.map((r) => r.value)}::bigint[]
    ) AS t(name, label, value)
    ON CONFLICT (day, name, label) DO UPDATE SET value = EXCLUDED.value`;
}

/**
 * Persists the bot's own counters as structured JSON
 * (`[{ name, type, values: [{ labels, value }] }]`) — we control both the
 * save and restore sides, so there's no reason to round-trip through the
 * Prometheus text format (whose parsing was fragile).
 */
export async function SaveMetrics() {
  const allMetrics = (await register.getMetricsAsJSON()) as unknown as BotMetric[];
  const botMetrics = allMetrics.filter((metric) =>
    metric.name.startsWith('discord_')
  );

  const prisma = getDb();
  return Promise.all([
    prisma.metrics
      .upsert({
        where: { id: 1 },
        update: {
          jsonb: botMetrics as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
        create: { jsonb: botMetrics as unknown as Prisma.InputJsonValue },
      })
      .catch((e) => {
        Logger.error('Error saving metrics to database', e);
      }),
    saveDailyMetrics(botMetrics).catch((e) => {
      Logger.error('Error saving daily metrics to database', e);
    }),
  ]);
}
