import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Status } from 'discord.js';
import { register } from 'prom-client';
import { AdminHealth } from '@nx-stolfo/api-interfaces';
import { client } from '../../../client/instance';
import { startupStats } from '../../../utils/startup-stats';

type TableRow = { name: string; rows: bigint };

const eventLoopLag = async () => {
  const metric = await register.getSingleMetric('nodejs_eventloop_lag_p99_seconds')?.get();
  return metric?.values[0]?.value ?? null;
};

export const getAdminHealth: RequestHandler<unknown, AdminHealth> = asyncHandler(
  async (req, res) => {
    const [[size], tables, lag] = await Promise.all([
      req.db.$queryRaw<[{ size: bigint }]>`SELECT pg_database_size(current_database()) AS size`,
      // Planner estimates: cheap, and close enough for a health view
      req.db.$queryRaw<TableRow[]>`
        SELECT relname AS name, n_live_tup AS rows
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC`,
      eventLoopLag(),
    ]);

    res.send({
      uptimeSeconds: Math.round(process.uptime()),
      commit: startupStats.commit,
      gateway: {
        status: Status[client.ws.status] ?? 'Unknown',
        pingMs: client.ws.ping >= 0 ? client.ws.ping : null, // -1 or NaN before the first heartbeat
      },
      memoryRssBytes: process.memoryUsage().rss,
      eventLoopLagSeconds: lag,
      openVoiceSessions: client.voiceUsers.size,
      currentStatuses: client.userStatus.size,
      danglingAtStartup: {
        voiceSessions: startupStats.danglingVoiceSessions,
        statuses: startupStats.danglingStatuses,
      },
      database: {
        sizeBytes: Number(size.size),
        tables: tables.map(({ name, rows }) => ({ name, rows: Number(rows) })),
      },
    });
  }
);
