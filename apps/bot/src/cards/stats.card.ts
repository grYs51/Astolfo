import { formatChange, formatDuration, formatNextMilestone, formatStreak, PERIOD_LABEL, plural, PREVIOUS_LABEL } from '../stats/messages';
import type { MemberSummary } from '../stats/queries';
import type { StatsPeriod } from '../stats/windows';
import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { header, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
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
  /** false when someone else looks at the card, so it doesn't say "you" */
  self?: boolean;
}

const COMPANION_H = 52;

/** The /stats summary as an SVG */
export const statsCard = (d: StatsCardData, t: CardTheme) => {
  const s = d.summary;
  const previous = d.period === 'all' ? '' : PREVIOUS_LABEL[d.period];
  const parts: string[] = [];
  let y = 136;

  if (s.sessions === 0 && s.messages === 0) {
    parts.push(
      panel(PAD, y, W - 2 * PAD, 72, t),
      text(W / 2, y + 36, 17, t.muted, escapeXml(d.self === false ? `No voice or messages over ${PERIOD_LABEL[d.period]}.` : `You haven’t been in voice or sent messages over ${PERIOD_LABEL[d.period]}.`), 'dy="0.35em" text-anchor="middle"')
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

    // Plain text: resvg only has Inter, so no 🔥
    const streak = formatStreak(s.streak);
    const milestone = formatNextMilestone(s.lifetimeMs);
    const line = [streak && `Voice streak: ${streak}`, milestone && `Next milestone: ${milestone}`].filter(Boolean).join(' · ');
    if (line) {
      y += 36;
      parts.push(text(PAD, y, 16, t.text, escapeXml(line)));
    }

    const companions = s.companions.slice(0, 3);
    if (companions.length) {
      y += 40;
      parts.push(text(PAD, y, 14, t.muted, d.self === false ? 'Hangs out most with' : 'You hang out most with'));
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

  return svgCard(y + 56, t, [
    header({ name: d.memberName, avatar: d.avatar, title: d.memberName, subtitle: `${d.serverName} · over ${PERIOD_LABEL[d.period]}` }, t),
    ...parts,
    text(PAD, y + 34, 13, t.muted, 'Open sessions count live'),
  ]);
};
