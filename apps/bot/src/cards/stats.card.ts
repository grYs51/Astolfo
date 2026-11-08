import { formatChange, formatDuration, PERIOD_LABEL, plural, PREVIOUS_LABEL } from '../stats/messages';
import type { MemberSummary } from '../stats/queries';
import type { StatsPeriod } from '../stats/windows';
import { avatarSvg } from './avatars';
import { escapeXml, FONT_FAMILY, truncate } from './render';
import { CardTheme } from './themes';

export interface StatsCardData {
  summary: MemberSummary;
  period: StatsPeriod;
  memberName: string;
  avatar?: string;
  serverName: string;
  favouriteChannelName?: string;
  /** Same order as summary.companions */
  companions: { name: string; avatar?: string }[];
}

const W = 800;
const PAD = 32;
const TILE_W = (W - 2 * PAD - 16) / 2;
const TILE_H = 104;
const COMPANION_H = 52;

const text = (x: number, y: number, size: number, fill: string, content: string, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;

const panel = (x: number, y: number, w: number, h: number, t: CardTheme) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${t.surface}"/>`;

const tile = (x: number, y: number, label: string, value: string, sub: string | undefined, t: CardTheme) =>
  panel(x, y, TILE_W, TILE_H, t) +
  text(x + 24, y + 32, 14, t.muted, escapeXml(label)) +
  text(x + 24, y + 68, 30, t.text, escapeXml(value), 'font-weight="700"') +
  (sub ? text(x + 24, y + 90, 14, sub.startsWith('↑') ? t.accent : t.muted, escapeXml(truncate(sub, 38))) : '');

/** The /stats summary as an SVG */
export const statsCard = (d: StatsCardData, t: CardTheme) => {
  const s = d.summary;
  const previous = d.period === 'all' ? '' : PREVIOUS_LABEL[d.period];
  const parts: string[] = [];
  let y = 136;

  if (s.sessions === 0 && s.messages === 0) {
    parts.push(
      panel(PAD, y, W - 2 * PAD, 72, t),
      text(W / 2, y + 36, 17, t.muted, escapeXml(`You haven’t been in voice or sent messages over ${PERIOD_LABEL[d.period]}.`), 'dy="0.35em" text-anchor="middle"')
    );
    y += 72;
  } else {
    const right = PAD + TILE_W + 16;
    parts.push(
      tile(PAD, y, 'Voice time', formatDuration(s.voiceMs), formatChange(s.voiceMs, s.previousVoiceMs, previous), t),
      tile(right, y, 'Messages', s.messages.toLocaleString('en-GB'), formatChange(s.messages, s.previousMessages, previous), t),
      tile(PAD, y + TILE_H + 16, 'Rank in voice time', s.voiceRank ? `#${s.voiceRank}` : '–', s.voiceRank ? `of ${plural(s.rankedMembers, 'member')}` : undefined, t),
      tile(right, y + TILE_H + 16, 'Sessions', `${s.sessions}`, d.favouriteChannelName ? `most in #${d.favouriteChannelName}` : undefined, t)
    );
    y += 2 * TILE_H + 16;

    const companions = s.companions.slice(0, 3);
    if (companions.length) {
      y += 40;
      parts.push(text(PAD, y, 14, t.muted, 'You hang out most with'));
      y += 16;
      parts.push(panel(PAD, y, W - 2 * PAD, companions.length * COMPANION_H + 8, t));
      companions.forEach((c, i) => {
        const rowY = y + 4 + i * COMPANION_H;
        const name = d.companions[i]?.name ?? 'Unknown member';
        parts.push(
          avatarSvg({ id: `c${i}`, x: PAD + 20, y: rowY + 8, size: 36, name, image: d.companions[i]?.avatar, theme: t }),
          text(PAD + 72, rowY + 26, 17, t.text, escapeXml(truncate(name, 40)), 'dy="0.35em" font-weight="700"'),
          text(W - PAD - 24, rowY + 26, 17, t.text, escapeXml(formatDuration(c.togetherMs)), 'dy="0.35em" text-anchor="end"')
        );
      });
      y += companions.length * COMPANION_H + 8;
    }
  }

  const H = y + 56;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" rx="24" fill="${t.background}"/>`,
    avatarSvg({ id: 'me', x: PAD, y: 32, size: 72, name: d.memberName, image: d.avatar, theme: t }),
    text(124, 64, 28, t.text, escapeXml(truncate(d.memberName, 36)), 'font-weight="700"'),
    text(124, 94, 16, t.muted, escapeXml(truncate(`${d.serverName} · over ${PERIOD_LABEL[d.period]}`, 60))),
    ...parts,
    text(PAD, y + 34, 13, t.muted, 'Open sessions count live'),
    `</svg>`,
  ].join('');
};
