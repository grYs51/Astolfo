import logger from '../../utils/logger';
import { getDb } from '../../db';
import { register } from 'prom-client';

export async function SaveMetrics() {
  const metrics = await register.metrics();
  const prisma = getDb();
  return prisma.metrics
    .upsert({
      where: { id: 1 },
      update: { jsonb: metrics, updated_at: new Date() },
      create: { jsonb: metrics },
    })
    .catch((e) => {
      logger.error('Error saving metrics to database', e);
    });
}
