import { register } from 'prom-client';
import logger from '../../utils/logger';
import { getDb } from '../../db';

export async function saveToDb(metrics: string) {
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
// Define shutdown function
async function shutdown() {
  const metrics = await register.metrics();
  await saveToDb(metrics);
  process.exit(0);
}

// Attach shutdown function to process exit events
process.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
