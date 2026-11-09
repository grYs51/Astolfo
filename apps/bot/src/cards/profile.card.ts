import { formatDuration, plural } from '../stats/messages';
import type { MemberProfile } from '../stats/queries';
import { escapeXml } from './render';
import { header, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

export interface ProfileCardData {
  profile: MemberProfile;
  memberName: string;
  avatar?: string;
  serverName: string;
  favouriteChannelName?: string;
  /** For the share of tracked time */
  now: Date;
}

const RPS_H = 96;
const BAR_W = W - 2 * PAD - 48;

const percent = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%');

const sinceLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Wins, ties and losses as one rounded bar: accent, muted, track */
const rpsBar = (rps: MemberProfile['rps'], x: number, y: number, t: CardTheme) => {
  const games = rps.wins + rps.ties + rps.losses;
  if (games === 0) return '';
  let offset = x;
  const segments = [
    [rps.wins, t.accent],
    [rps.ties, t.muted],
    [rps.losses, t.track],
  ]
    .map(([count, fill]) => {
      const w = ((count as number) / games) * BAR_W;
      const rect = w > 0 ? `<rect x="${offset}" y="${y}" width="${w}" height="10" fill="${fill}"/>` : '';
      offset += w;
      return rect;
    })
    .join('');
  return `<clipPath id="rps"><rect x="${x}" y="${y}" width="${BAR_W}" height="10" rx="5"/></clipPath><g clip-path="url(#rps)">${segments}</g>`;
};

/** /profile: one member's all-time voice and game stats as an SVG */
export const profileCard = (d: ProfileCardData, t: CardTheme) => {
  const p = d.profile;
  const right = PAD + TILE_W + 16;
  const row = (i: number) => 136 + i * (TILE_H + 16);
  const trackedMs = p.trackingSince ? d.now.getTime() - p.trackingSince.getTime() : 0;
  const games = p.rps.wins + p.rps.ties + p.rps.losses;
  const rpsY = row(3);

  return svgCard(rpsY + RPS_H + 56, t, [
    header(
      {
        name: d.memberName,
        avatar: d.avatar,
        title: d.memberName,
        subtitle: p.trackingSince ? `${d.serverName} · tracking since ${sinceLabel(p.trackingSince)}` : d.serverName,
      },
      t
    ),
    tile(PAD, row(0), 'Voice time', formatDuration(p.voiceMs), `${percent(p.voiceMs, trackedMs)} of tracked time`, t),
    tile(right, row(0), 'Sessions', `${p.sessions}`, d.favouriteChannelName ? `most in #${d.favouriteChannelName}` : undefined, t),
    tile(PAD, row(1), 'Longest session', formatDuration(p.longestSessionMs), undefined, t),
    tile(right, row(1), 'Last 7 days', formatDuration(p.lastWeekMs), undefined, t),
    tile(PAD, row(2), 'Muted', percent(p.mutedMs, p.voiceMs), `${formatDuration(p.mutedMs)} of voice time`, t),
    tile(right, row(2), 'Streaming', percent(p.streamingMs, p.voiceMs), `${formatDuration(p.streamingMs)} of voice time`, t),
    panel(PAD, rpsY, W - 2 * PAD, RPS_H, t),
    text(PAD + 24, rpsY + 32, 14, t.muted, 'Rock paper scissors'),
    text(
      PAD + 24,
      rpsY + 60,
      20,
      t.text,
      escapeXml(games ? `${plural(p.rps.wins, 'win')} · ${plural(p.rps.ties, 'tie')} · ${p.rps.losses.toLocaleString('en-GB')} ${p.rps.losses === 1 ? 'loss' : 'losses'}` : 'No games yet'),
      'font-weight="700"'
    ),
    rpsBar(p.rps, PAD + 24, rpsY + 74, t),
    text(PAD, rpsY + RPS_H + 34, 13, t.muted, 'All time · open sessions count live'),
  ]);
};
