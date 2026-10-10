import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
} from 'discord.js';
import type { MemberSummary, ServerDigest } from './queries';
import type { StatsPeriod } from './windows';

/**
 * Discord messages for /stats and the weekly digest. Pure functions (data in,
 * message out) so they're easy to test. Members are shown as <@id> mentions,
 * which embeds render as names without pinging anyone.
 */

const COLOR = '#FF69B4';

const PERIOD_LABEL: Record<StatsPeriod, string> = {
  week: 'the past week',
  month: 'the past month',
  year: 'the past year',
  all: 'all time',
};

const PREVIOUS_LABEL: Record<Exclude<StatsPeriod, 'all'>, string> = {
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

const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`;

const dashboardButton = (url: string, label: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url)
  );

/** The /stats reply (ephemeral) */
export const buildStatsMessage = (input: {
  summary: MemberSummary;
  period: StatsPeriod;
  guildName: string;
  dashboardUrl: string;
}): InteractionReplyOptions => {
  const { summary: s, period, guildName, dashboardUrl } = input;
  const previousLabel = period === 'all' ? '' : PREVIOUS_LABEL[period];

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`Your stats in ${guildName}`)
    .setURL(dashboardUrl)
    .setFooter({ text: `Over ${PERIOD_LABEL[period]} · open sessions count live` });

  if (s.sessions === 0 && s.messages === 0) {
    embed.setDescription(`You haven’t been in voice or sent messages over ${PERIOD_LABEL[period]}.`);
  } else {
    const voiceChange = formatChange(s.voiceMs, s.previousVoiceMs, previousLabel);
    const messageChange = formatChange(s.messages, s.previousMessages, previousLabel);
    embed.setDescription(
      `🎙️ **${formatDuration(s.voiceMs)}** in voice${voiceChange ? ` (${voiceChange})` : ''}\n` +
        `💬 **${plural(s.messages, 'message')}**${messageChange ? ` (${messageChange})` : ''}`
    );
    const fields = [];
    if (s.voiceRank) {
      fields.push({ name: 'Rank', value: `#${s.voiceRank} of ${s.rankedMembers} in voice time`, inline: true });
    }
    if (s.favouriteChannelId) {
      fields.push({ name: 'Favourite channel', value: `<#${s.favouriteChannelId}>`, inline: true });
    }
    fields.push({ name: 'Sessions', value: `${s.sessions}`, inline: true });
    if (s.companions.length > 0) {
      fields.push({
        name: 'You hang out most with',
        value: s.companions.map((c) => `<@${c.memberId}> · ${formatDuration(c.togetherMs)}`).join('\n'),
      });
    }
    embed.addFields(fields);
  }

  return { embeds: [embed], components: [dashboardButton(dashboardUrl, 'Open your dashboard')] };
};

const medal = (index: number) => ['🥇', '🥈', '🥉'][index] ?? `${index + 1}.`;

/** The weekly digest post */
export const buildDigestMessage = (input: {
  digest: ServerDigest;
  guildName: string;
  dashboardUrl: string;
  /** Monday (00:00 UTC) the digest's week starts */
  weekStart: Date;
}) => {
  const { digest: d, guildName, dashboardUrl, weekStart } = input;
  const voiceChange = formatChange(d.voiceMs, d.previousVoiceMs, 'the week before');
  const messageChange = formatChange(d.messages, d.previousMessages, 'the week before');
  const dayMonth = (date: Date) =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`Last week in ${guildName}`)
    .setURL(dashboardUrl)
    .setDescription(
      `🎙️ **${formatDuration(d.voiceMs)}** in voice${voiceChange ? ` (${voiceChange})` : ''}\n` +
        `💬 **${plural(d.messages, 'message')}**${messageChange ? ` (${messageChange})` : ''}\n` +
        `👥 **${plural(d.activeMembers, 'active member')}**`
    )
    .setFooter({
      text: `${dayMonth(weekStart)} – ${dayMonth(weekEnd)} (UTC) · members who hide their stats aren’t named`,
    });

  const fields = [];
  if (d.topVoice.length > 0) {
    fields.push({
      name: 'Most time in voice',
      value: d.topVoice.map((m, i) => `${medal(i)} <@${m.memberId}> · ${formatDuration(m.ms)}`).join('\n'),
      inline: true,
    });
  }
  if (d.topMessages.length > 0) {
    fields.push({
      name: 'Most messages',
      value: d.topMessages.map((m, i) => `${medal(i)} <@${m.memberId}> · ${m.count.toLocaleString('en-GB')}`).join('\n'),
      inline: true,
    });
  }
  if (d.bestDuo) {
    fields.push({
      name: 'Duo of the week',
      value: `<@${d.bestDuo.a}> & <@${d.bestDuo.b}> · ${formatDuration(d.bestDuo.togetherMs)} together`,
    });
  }
  if (d.busiestDay) {
    const day = d.busiestDay.day.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    fields.push({ name: 'Busiest day', value: `${day} · ${formatDuration(d.busiestDay.ms)} in voice` });
  }
  embed.addFields(fields);

  return {
    embeds: [embed],
    components: [dashboardButton(dashboardUrl, 'Open the dashboard')],
    // Mentions inside embeds never ping, but be explicit for the content too
    allowedMentions: { parse: [] as [] },
  };
};

/** True when a digest has nothing worth posting */
export const isEmptyDigest = (d: ServerDigest) => d.voiceMs === 0 && d.messages === 0;

/** Dashboard link for a server */
export const dashboardUrlFor = (guildId: string) =>
  `${(process.env.CLIENT_URL ?? '').replace(/\/+$/, '')}/overview/detail/${guildId}`;
