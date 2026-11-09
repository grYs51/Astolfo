import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { AdminRouteStats, AdminUsage } from '@nx-stolfo/api-interfaces';
import { client } from '../../../client/instance';
import {
  apiRequestDuration,
  apiRequestsCounter,
  commandErrorsCounter,
  commandsCounter,
  slashCounter,
} from '../../utils/counter';

const PREFIX = 'discord_bot_commands_total';
const SLASH = 'discord_bot_slash_total';
const ERRORS = 'discord_bot_command_errors_total';

type UsedRow = { name: string; label: string; used: number };
type DayRow = { day: string; prefix: number; slash: number; errors: number };

/** Live counter totals by their single label */
const totals = async (counter: { get(): Promise<{ values: { labels: object; value: number }[] }> }) =>
  new Map(
    (await counter.get()).values.map(({ labels, value }) => [String(Object.values(labels)[0]), value])
  );

/** Upper bound (ms) of the bucket holding the 95th percentile; null for none or beyond the top bucket */
export const p95FromBuckets = (buckets: { le: number; count: number }[]) => {
  const total = buckets.find((b) => b.le === Infinity)?.count ?? 0;
  if (total === 0) return null;
  const bucket = buckets.find((b) => b.count >= total * 0.95);
  return bucket && bucket.le !== Infinity ? bucket.le * 1000 : null;
};

const routeStats = async (): Promise<AdminRouteStats[]> => {
  const [requests, durations] = await Promise.all([apiRequestsCounter.get(), apiRequestDuration.get()]);
  const routes = new Map<string, AdminRouteStats>();
  for (const { labels, value } of requests.values) {
    const key = `${labels.method} ${labels.route}`;
    const route = routes.get(key) ?? {
      method: String(labels.method),
      route: String(labels.route),
      requests: 0,
      errorRate: 0,
      p95Ms: null,
    };
    route.requests += value;
    if (Number(labels.status) >= 500) route.errorRate += value; // a count until divided below
    routes.set(key, route);
  }

  const buckets = new Map<string, { le: number; count: number }[]>();
  for (const { labels, value, metricName } of durations.values) {
    if (metricName !== 'api_request_duration_seconds_bucket') continue;
    const key = `${labels.method} ${labels.route}`;
    const { le: rawLe } = labels as { le?: string | number }; // bucket values carry `le` beyond the declared labels
    const le = rawLe === '+Inf' ? Infinity : Number(rawLe);
    buckets.set(key, [...(buckets.get(key) ?? []), { le, count: value }]);
  }

  return [...routes.entries()]
    .map(([key, route]) => ({
      ...route,
      errorRate: route.requests ? route.errorRate / route.requests : 0,
      p95Ms: p95FromBuckets(buckets.get(key) ?? []),
    }))
    .sort((a, b) => b.requests - a.requests);
};

export const getAdminUsage: RequestHandler<unknown, AdminUsage> = asyncHandler(
  async (req, res) => {
    // A day's usage is its running total minus the previous snapshot's. A label's first row
    // counts in full only after the first tracked day (before that it holds the lifetime total).
    const usage = Prisma.sql`
      WITH diffs AS (
        SELECT day, name, label,
          GREATEST(COALESCE(
            value - LAG(value) OVER (PARTITION BY name, label ORDER BY day),
            CASE WHEN day > MIN(day) OVER (PARTITION BY name) THEN value ELSE 0 END
          ), 0) AS used
        FROM metric_daily
        WHERE name IN (${PREFIX}, ${SLASH}, ${ERRORS})
      )
      SELECT * FROM diffs WHERE day > (NOW() AT TIME ZONE 'UTC')::date - 30`;

    const [rows, daily, prefixTotals, slashTotals, errorTotals, routes] = await Promise.all([
      req.db.$queryRaw<UsedRow[]>`
        SELECT name, label, SUM(used)::int AS used FROM (${usage}) u GROUP BY name, label`,
      req.db.$queryRaw<DayRow[]>`
      SELECT to_char(d, 'YYYY-MM-DD') AS day,
        COALESCE(SUM(u.used) FILTER (WHERE u.name = ${PREFIX}), 0)::int AS prefix,
        COALESCE(SUM(u.used) FILTER (WHERE u.name = ${SLASH}), 0)::int AS slash,
        COALESCE(SUM(u.used) FILTER (WHERE u.name = ${ERRORS}), 0)::int AS errors
      FROM generate_series((NOW() AT TIME ZONE 'UTC')::date - 29, (NOW() AT TIME ZONE 'UTC')::date, '1 day') d
      LEFT JOIN (${usage}) u ON u.day = d
      GROUP BY d
      ORDER BY d`,
      totals(commandsCounter),
      totals(slashCounter),
      totals(commandErrorsCounter),
      routeStats(),
    ]);

    const last30 = new Map(rows.map((row) => [`${row.name} ${row.label}`, row.used]));
    // Every registered command, so unused ones show up; aliases map to the same instance
    const prefixNames = new Set([...client.commands.values()].map((command) => command.name));
    const commands = [
      ...[...prefixNames].map((name) => ({
        name,
        kind: 'prefix' as const,
        total: prefixTotals.get(name) ?? 0,
        last30d: last30.get(`${PREFIX} ${name}`) ?? 0,
        errors: errorTotals.get(name) ?? 0,
      })),
      ...[...client.slashs.keys()].map((name) => ({
        name,
        kind: 'slash' as const,
        total: slashTotals.get(name) ?? 0,
        last30d: last30.get(`${SLASH} ${name}`) ?? 0,
        errors: errorTotals.get(name) ?? 0,
      })),
    ].sort((a, b) => b.total - a.total);

    res.send({ commands, daily, routes });
  }
);
