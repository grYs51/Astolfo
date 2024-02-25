import { Counter, Gauge } from 'prom-client';
import { client } from '../../..';

const gauge = new Gauge({
  name: 'discord_bot_cached_status_total',
  help: 'Total number of cached status',
  labelNames: ['status'],
});

export const handleStatusMetrics = () => {
  const online = client.userStatus.filter(
    (status) => status.status === 'online'
  ).size;
  const idle = client.userStatus.filter(
    (status) => status.status === 'idle'
  ).size;
  const dnd = client.userStatus.filter(
    (status) => status.status === 'dnd'
  ).size;
  const offline = client.userStatus.filter(
    (status) => status.status === 'offline'
  ).size;

  gauge.set({ status: 'online' }, online);
  gauge.set({ status: 'idle' }, idle);
  gauge.set({ status: 'dnd' }, dnd);
  gauge.set({ status: 'offline' }, offline);
  return;
};
