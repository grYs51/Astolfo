import { formatChange, formatDuration, plural } from '../stats/messages';
import type { ServerDigest } from '../stats/queries';
import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { header, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

export interface DigestMember {
  name: string;
  avatar?: string;
}

export interface DigestCardData {
  digest: ServerDigest;
  serverName: string;
  serverIcon?: string;
  /** Monday (00:00 UTC) the digest's week starts */
  weekStart: Date;
  /** Names and avatars of every member the digest names, by id */
  members: Record<string, DigestMember>;
}

interface ListRow {
  memberId: string;
  value: string;
}

const ROW_H = 44;
const GAP = 16;
const LABEL_H = 28;
const THIRD_W = (W - 2 * PAD - 2 * GAP) / 3;

const dayMonth = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** A titled panel of ranked members; its height is listHeight(rows) */
const listHeight = (rows: ListRow[]) => (rows.length ? LABEL_H + rows.length * ROW_H + 16 : 0);

const list = (key: string, x: number, y: number, title: string, rows: ListRow[], d: DigestCardData, t: CardTheme, ranked = true) => {
  if (!rows.length) return '';
  const top = y + LABEL_H;
  return [
    text(x, y + 16, 14, t.muted, escapeXml(title)),
    panel(x, top, TILE_W, rows.length * ROW_H + 16, t),
    ...rows.map((r, i) => {
      const m = d.members[r.memberId] ?? { name: 'Unknown member' };
      const rowY = top + 8 + i * ROW_H;
      const nameX = ranked ? x + 84 : x + 56;
      return [
        ranked ? text(x + 26, rowY + ROW_H / 2, 16, i < 3 ? t.accent : t.muted, `${i + 1}`, 'dy="0.35em" text-anchor="middle" font-weight="700"') : '',
        avatarSvg({ id: `${key}${i}`, x: nameX - 44, y: rowY + 6, size: 32, name: m.name, image: m.avatar, theme: t }),
        text(nameX, rowY + ROW_H / 2, 16, t.text, escapeXml(truncate(m.name, ranked ? 16 : 19)), 'dy="0.35em" font-weight="700"'),
        text(x + TILE_W - 20, rowY + ROW_H / 2, 15, t.text, escapeXml(r.value), 'dy="0.35em" text-anchor="end"'),
      ].join('');
    }),
  ].join('');
};

/** The weekly digest: totals, leaders, duo, streaks, milestones and the busiest day */
export const digestCard = (d: DigestCardData, t: CardTheme) => {
  const g = d.digest;
  const weekEnd = new Date(d.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const parts: string[] = [
    header(
      {
        name: d.serverName,
        avatar: d.serverIcon,
        title: `Last week in ${d.serverName}`,
        subtitle: `${dayMonth(d.weekStart)} – ${dayMonth(weekEnd)} (UTC)`,
      },
      t
    ),
  ];
  let y = 136;

  parts.push(
    tile(PAD, y, 'Voice time', formatDuration(g.voiceMs), formatChange(g.voiceMs, g.previousVoiceMs, 'the week before'), t, THIRD_W),
    tile(PAD + THIRD_W + GAP, y, 'Messages', g.messages.toLocaleString('en-GB'), formatChange(g.messages, g.previousMessages, 'the week before'), t, THIRD_W),
    tile(PAD + 2 * (THIRD_W + GAP), y, 'Active members', g.activeMembers.toLocaleString('en-GB'), undefined, t, THIRD_W)
  );
  y += TILE_H + 24;

  const right = PAD + TILE_W + GAP;
  const pairs: [ListRow[], string, ListRow[], string, boolean][] = [
    [
      g.topVoice.map((m) => ({ memberId: m.memberId, value: formatDuration(m.ms) })),
      'Most time in voice',
      g.topMessages.map((m) => ({ memberId: m.memberId, value: m.count.toLocaleString('en-GB') })),
      'Most messages',
      true,
    ],
    [
      g.topStreaks.map((m) => ({ memberId: m.memberId, value: plural(m.days, 'day') })),
      'Longest voice streaks',
      g.milestones.map((m) => ({ memberId: m.memberId, value: `passed ${m.hours}h` })),
      'Milestones reached',
      false,
    ],
  ];
  pairs.forEach(([leftRows, leftTitle, rightRows, rightTitle, ranked], i) => {
    const h = Math.max(listHeight(leftRows), listHeight(rightRows));
    if (!h) return;
    // Streaks are ranked, milestones aren't
    parts.push(
      list(`l${i}`, PAD, y, leftTitle, leftRows, d, t, true),
      list(`r${i}`, leftRows.length ? right : PAD, y, rightTitle, rightRows, d, t, ranked)
    );
    y += h + GAP;
  });

  if (g.bestDuo) {
    const a = d.members[g.bestDuo.a] ?? { name: 'Unknown member' };
    const b = d.members[g.bestDuo.b] ?? { name: 'Unknown member' };
    parts.push(
      text(PAD, y + 16, 14, t.muted, 'Duo of the week'),
      panel(PAD, y + LABEL_H, W - 2 * PAD, 64, t),
      avatarSvg({ id: 'duoA', x: PAD + 20, y: y + LABEL_H + 14, size: 36, name: a.name, image: a.avatar, theme: t }),
      avatarSvg({ id: 'duoB', x: PAD + 44, y: y + LABEL_H + 14, size: 36, name: b.name, image: b.avatar, theme: t }),
      text(PAD + 96, y + LABEL_H + 32, 17, t.text, escapeXml(`${truncate(a.name, 20)} & ${truncate(b.name, 20)}`), 'dy="0.35em" font-weight="700"'),
      text(W - PAD - 24, y + LABEL_H + 32, 16, t.text, escapeXml(`${formatDuration(g.bestDuo.togetherMs)} together`), 'dy="0.35em" text-anchor="end"')
    );
    y += LABEL_H + 64 + GAP;
  }

  if (g.busiestDay) {
    const day = g.busiestDay.day.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    y += 12;
    parts.push(text(PAD, y, 16, t.text, escapeXml(`Busiest day: ${day} · ${formatDuration(g.busiestDay.ms)} in voice`)));
    y += 12;
  }

  parts.push(text(PAD, y + 34, 13, t.muted, 'Members who hide their stats aren’t named'));
  return svgCard(y + 56, t, parts);
};
