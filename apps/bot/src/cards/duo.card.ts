import { formatDuration, PERIOD_LABEL } from '../stats/messages';
import type { Duo } from '../stats/queries';
import type { StatsPeriod } from '../stats/windows';
import { avatarSvg } from './avatars';
import type { CardMember } from './members';
import { escapeXml, truncate } from './render';
import { PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

export interface DuoCardData {
  duo: Duo;
  period: StatsPeriod;
  /** a (who asked) and b, same order as the duo */
  members: [CardMember, CardMember];
  serverName: string;
  topChannelName?: string;
}

const AVATAR = 96;
const TOP = 40;
const NAMES_Y = TOP + AVATAR + 34;

/** "42%" of a member's voice time */
const share = (together: number, total: number) => (total > 0 ? `${Math.round((100 * together) / total)}%` : '–');

/** /duo: both avatars, the time together, each one's share of it and where they meet most */
export const duoCard = (d: DuoCardData, t: CardTheme) => {
  const { duo } = d;
  const xs = [W / 2 - 150, W / 2 + 150];
  const parts = d.members.flatMap((m, i) => [
    avatarSvg({ id: `m${i}`, x: xs[i] - AVATAR / 2, y: TOP, size: AVATAR, name: m.name, image: m.avatar, theme: t }),
    text(xs[i], NAMES_Y, 20, t.text, escapeXml(truncate(m.name, 24)), 'text-anchor="middle" font-weight="700"'),
  ]);
  parts.push(
    `<line x1="${xs[0] + AVATAR / 2 + 16}" y1="${TOP + AVATAR / 2}" x2="${xs[1] - AVATAR / 2 - 16}" y2="${TOP + AVATAR / 2}" stroke="${t.accent}" stroke-width="4" stroke-linecap="round"/>`
  );
  let y = NAMES_Y + 32;

  if (duo.togetherMs === 0) {
    parts.push(
      panel(PAD, y, W - 2 * PAD, 72, t),
      text(W / 2, y + 36, 17, t.muted, escapeXml(`No time together over ${PERIOD_LABEL[d.period]}.`), 'dy="0.35em" text-anchor="middle"')
    );
    y += 72;
  } else {
    parts.push(
      text(W / 2, y + 48, 48, t.accent, escapeXml(formatDuration(duo.togetherMs)), 'text-anchor="middle" font-weight="700"'),
      text(W / 2, y + 80, 16, t.muted, escapeXml(`together in voice over ${PERIOD_LABEL[d.period]}`), 'text-anchor="middle"')
    );
    y += 108;
    const totals = [duo.aVoiceMs, duo.bVoiceMs];
    d.members.forEach((m, i) =>
      parts.push(
        tile(PAD + i * (TILE_W + 16), y, `Share of ${truncate(m.name, 18)}’s voice time`, share(duo.togetherMs, totals[i]), `of ${formatDuration(totals[i])}`, t)
      )
    );
    y += TILE_H;
    if (d.topChannelName) {
      y += 36;
      parts.push(text(PAD, y, 16, t.text, escapeXml(`Most time together in #${truncate(d.topChannelName, 40)}`)));
    }
  }

  return svgCard(y + 56, t, [...parts, text(PAD, y + 34, 13, t.muted, escapeXml(`${truncate(d.serverName, 50)} · Open sessions count live`))]);
};
