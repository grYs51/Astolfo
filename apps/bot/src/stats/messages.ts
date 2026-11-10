import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ServerDigest } from './queries';
import type { StatsPeriod } from './windows';

/** Text helpers the image cards and the Discord replies share. Pure functions, easy to test. */

export const PERIOD_LABEL: Record<StatsPeriod, string> = {
  week: 'the past week',
  month: 'the past month',
  year: 'the past year',
  all: 'all time',
};

/** The period option of /stats and /duo */
export const PERIOD_CHOICES: { name: string; value: StatsPeriod }[] = [
  { name: 'Past week', value: 'week' },
  { name: 'Past month', value: 'month' },
  { name: 'Past year', value: 'year' },
  { name: 'All time', value: 'all' },
];

export const PREVIOUS_LABEL: Record<Exclude<StatsPeriod, 'all'>, string> = {
  week: 'the week before',
  month: 'the month before',
  year: 'the year before',
};

/** "17h 45m" / "2d 3h" / "45m" / "30s" — the two largest units */
export const formatDuration = (ms: number) => {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60_000);
  const parts = [
    [Math.floor(minutes / 1440), 'd'],
    [Math.floor((minutes % 1440) / 60), 'h'],
    [minutes % 60, 'm'],
  ] as const;
  const first = parts.findIndex(([value]) => value > 0);
  return parts
    .slice(first, first + 2)
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value}${unit}`)
    .join(' ');
};

/** "↑ 16% vs the week before"; undefined when there's nothing to compare */
export const formatChange = (current: number, previous: number | null, label: string) => {
  if (previous === null) return undefined;
  if (previous === 0) return current > 0 ? `new vs ${label}` : undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return `same as ${label}`;
  return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs ${label}`;
};

export const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`;

export const dashboardButton = (url: string, label: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url)
  );

/** True when a digest has nothing worth posting */
export const isEmptyDigest = (d: ServerDigest) => d.voiceMs === 0 && d.messages === 0;

/**
 * Dashboard link for a server; undefined when CLIENT_URL isn't an absolute
 * http(s) URL (Discord rejects relative links, which would fail the reply)
 */
export const dashboardUrlFor = (guildId: string) => {
  const base = (process.env.CLIENT_URL ?? '').replace(/\/+$/, '');
  return /^https?:\/\//.test(base) ? `${base}/overview/detail/${guildId}` : undefined;
};
