import { Gauge } from 'prom-client';
import { client } from '../../..';

const gauge = new Gauge({
  name: 'discord_bot_cached_status_total',
  help: 'Total number of cached status',
  labelNames: ['status'],
});

const TRACKED_STATUSES = ['online', 'idle', 'dnd', 'offline'] as const;

export const handleStatusMetrics = () => {
  // Single pass — this runs on every presence change
  const counts: Record<string, number> = {
    online: 0,
    idle: 0,
    dnd: 0,
    offline: 0,
  };
  for (const status of client.userStatus.values()) {
    if (status.status && status.status in counts) {
      counts[status.status]++;
    }
  }

  for (const status of TRACKED_STATUSES) {
    gauge.set({ status }, counts[status]);
  }
};
