import { escapeXml } from './render';
import { header, PAD, panel, svgCard, text, W } from './svg';
import { CardTheme } from './themes';

export interface LevelUpCardData {
  memberName: string;
  avatar?: string;
  serverName: string;
  level: number;
}

const PANEL_Y = 136;
const PANEL_H = 132;

/** Posted in the level-up channel when a member reaches a new level */
export const levelUpCard = (d: LevelUpCardData, t: CardTheme) =>
  svgCard(PANEL_Y + PANEL_H + 32, t, [
    header({ name: d.memberName, avatar: d.avatar, title: d.memberName, subtitle: `on ${d.serverName}` }, t),
    panel(PAD, PANEL_Y, W - 2 * PAD, PANEL_H, t),
    text(W / 2, PANEL_Y + 40, 16, t.muted, 'just reached', 'text-anchor="middle"'),
    text(W / 2, PANEL_Y + 96, 44, t.accent, escapeXml(`Level ${d.level}`), 'text-anchor="middle" font-weight="700"'),
  ]);
