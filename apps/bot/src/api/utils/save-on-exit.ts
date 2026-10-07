import { Logger } from '../../utils/logger';
import { getDb } from '../../db';
import { register } from 'prom-client';
import type { Prisma } from '@prisma/client';

/**
 * Persists the bot's own counters as structured JSON
 * (`[{ name, type, values: [{ labels, value }] }]`) — we control both the
 * save and restore sides, so there's no reason to round-trip through the
 * Prometheus text format (whose parsing was fragile).
 */
export async function SaveMetrics() {
  const allMetrics = await register.getMetricsAsJSON();
  const botMetrics = allMetrics.filter((metric) =>
    metric.name.startsWith('discord_')
  );

  const prisma = getDb();
  return prisma.metrics
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
    });
}
