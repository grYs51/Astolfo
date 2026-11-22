import type { WrappedStats } from '@nx-stolfo/api-interfaces';
import { formatDuration, plural } from '../stats/messages';
import type { CardMember } from './members';
import { escapeXml, truncate } from './render';
import { header, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

export interface WrappedCardData {
  wrapped: WrappedStats;
  member: CardMember;
  serverName: string;
  favouriteChannelName?: string;
  /** The top duo partner's name */
  duoName?: string;
}

const HOUR = 60 * 60 * 1000;
const HERO_Y = 136;
const HERO_H = 128;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "312 hours" reads better than "13d 0h" for a year; short totals keep minutes */
export const formatHours = (ms: number) => (ms >= 10 * HOUR ? plural(Math.round(ms / HOUR), 'hour') : formatDuration(ms));

const levelTile = (xp: WrappedStats['xp']) => {
  if (xp.gained <= 0) return { value: xp.levelTo ? `Level ${xp.levelTo}` : '–', sub: 'no XP this year' };
  const sub = `+${xp.gained.toLocaleString('en-GB')} XP`;
  return { value: xp.levelFrom === xp.levelTo ? `Level ${xp.levelTo}` : `Level ${xp.levelFrom} → ${xp.levelTo}`, sub };
};

/** /wrapped: one member's year on a server, Spotify Wrapped style */
export const wrappedCard = (d: WrappedCardData, t: CardTheme) => {
  const w = d.wrapped;
  const right = PAD + TILE_W + 16;
  const row = (i: number) => HERO_Y + HERO_H + 16 + i * (TILE_H + 16);
  const level = levelTile(w.xp);
  const footerY = row(4);

  return svgCard(footerY + 40, t, [
    header({ name: d.member.name, avatar: d.member.avatar, title: `${w.year} Wrapped`, subtitle: `${d.member.name} on ${d.serverName}` }, t),
    panel(PAD, HERO_Y, W - 2 * PAD, HERO_H, t),
    text(PAD + 24, HERO_Y + 36, 16, t.muted, 'Time in voice'),
    text(PAD + 24, HERO_Y + 92, 52, t.accent, escapeXml(formatHours(w.voiceMs)), 'font-weight="700"'),
    text(PAD + 24, HERO_Y + 116, 14, t.muted, escapeXml(plural(w.sessions, 'session'))),
    ...(w.voiceRank
      ? [
          text(W - PAD - 24, HERO_Y + 92, 40, t.text, escapeXml(`Top ${w.voiceRank.topPercent}%`), 'text-anchor="end" font-weight="700"'),
          text(W - PAD - 24, HERO_Y + 116, 14, t.muted, escapeXml(`#${w.voiceRank.rank} of ${w.voiceRank.members} voice members`), 'text-anchor="end"'),
        ]
      : []),
    tile(PAD, row(0), 'Longest session', w.longestSessionMs ? formatDuration(w.longestSessionMs) : '–', undefined, t),
    tile(right, row(0), 'Favourite channel', d.favouriteChannelName ? `#${truncate(d.favouriteChannelName, 18)}` : '–', undefined, t),
    tile(PAD, row(1), 'Top duo', d.duoName && w.topDuo ? truncate(d.duoName, 18) : '–', w.topDuo ? `${formatHours(w.topDuo.togetherMs)} together` : undefined, t),
    tile(right, row(1), 'Peak month', w.peakMonth ? MONTHS[w.peakMonth.month - 1] : '–', w.peakMonth ? `${formatHours(w.peakMonth.voiceMs)} in voice` : undefined, t),
    tile(PAD, row(2), 'Longest streak', w.longestStreak ? plural(w.longestStreak, 'day') : '–', w.longestStreak ? 'in a row with 10+ min in voice' : undefined, t),
    tile(right, row(2), 'Messages sent', w.messages.toLocaleString('en-GB'), undefined, t),
    tile(PAD, row(3), 'Milestones', w.milestones.length ? w.milestones.map((h) => `${h}h`).join(' · ') : '–', w.milestones.length ? 'lifetime voice hours passed' : 'none this year', t),
    tile(right, row(3), 'Level', level.value, level.sub, t),
    text(PAD, footerY + 18, 13, t.muted, escapeXml(`${truncate(d.serverName, 40)} · ${w.year} in UTC · open sessions count live`)),
  ]);
};
