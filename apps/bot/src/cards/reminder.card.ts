import { escapeXml } from './render';
import { header, PAD, panel, svgCard, text, W } from './svg';
import { CardTheme } from './themes';

export interface ReminderCardData {
  memberName: string;
  avatar?: string;
  channelName: string;
  hours: number;
  /** The joke word after the hours, e.g. "gay" */
  word: string;
}

const PANEL_Y = 136;
const PANEL_H = 132;

/** The long voice session reminder */
export const reminderCard = (d: ReminderCardData, t: CardTheme) =>
  svgCard(PANEL_Y + PANEL_H + 32, t, [
    header({ name: d.memberName, avatar: d.avatar, title: d.memberName, subtitle: `in #${d.channelName}` }, t),
    panel(PAD, PANEL_Y, W - 2 * PAD, PANEL_H, t),
    text(W / 2, PANEL_Y + 40, 16, t.muted, 'has been in the voice channel for', 'text-anchor="middle"'),
    text(W / 2, PANEL_Y + 96, 44, t.accent, escapeXml(`${d.hours} hours ${d.word}!`), 'text-anchor="middle" font-weight="700"'),
  ]);
