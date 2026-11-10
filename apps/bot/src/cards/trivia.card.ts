import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { PAD, panel, svgCard, text, W } from './svg';
import { CardTheme } from './themes';

export interface TriviaQuestionCardData {
  category: string;
  /** easy, medium or hard */
  difficulty: string;
  /** The XP multiplier for that difficulty */
  factor: number;
  question: string;
  answers: string[];
  seconds: number;
}

export interface TriviaPlayer {
  name: string;
  avatar?: string;
  /** XP earned; undefined when none was granted */
  xp?: number;
}

export interface TriviaResultCardData {
  question: string;
  answers: string[];
  correct: string;
  /** How many members picked each answer, in the order of `answers` */
  picks: number[];
  /** The members who were right, quickest first */
  winners: TriviaPlayer[];
}

const LETTERS = ['A', 'B', 'C', 'D'];
const ATTRIBUTION = 'Question from Open Trivia DB (opentdb.com) · CC BY-SA 4.0';
const SHOWN_WINNERS = 5;
const ANSWER_H = 64;
const GAP = 16;
const ANSWER_W = (W - 2 * PAD - GAP) / 2;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** Words into lines of at most `max` characters; the last line gets an ellipsis if there's more */
export const wrap = (s: string, max: number, maxLines: number) => {
  const lines: string[] = [];
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && [...`${last} ${word}`].length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(truncate(word, max));
  }
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), truncate(`${lines[maxLines - 1]} …`, max)];
};

/** The question, a few lines at most, from `y` down; returns the svg and where it ends */
const questionText = (q: string, y: number, size: number, t: CardTheme) => {
  const lines = wrap(q, Math.floor((W - 2 * PAD) / (size * 0.55)), 4);
  const lineH = Math.round(size * 1.3);
  const svg = lines.map((line, i) => text(PAD, y + size + i * lineH, size, t.text, escapeXml(line), 'font-weight="700"')).join('');
  return { svg, end: y + size + (lines.length - 1) * lineH };
};

/** Two answers per row: a letter badge and the answer; `highlight` fills the right one, `note` goes on the right */
const answerGrid = (answers: string[], y: number, t: CardTheme, highlight?: (i: number) => boolean, note?: (i: number) => string) =>
  answers
    .map((answer, i) => {
      const x = PAD + (i % 2) * (ANSWER_W + GAP);
      const top = y + Math.floor(i / 2) * (ANSWER_H + GAP);
      const on = highlight?.(i) ?? false;
      const fade = highlight && !on ? ' opacity="0.55"' : '';
      const letter = answers.length === 2 ? '' : LETTERS[i];
      const label = truncate(answer, letter ? 30 : 34);
      return (
        `<g${fade}>` +
        (on ? `<rect x="${x}" y="${top}" width="${ANSWER_W}" height="${ANSWER_H}" rx="16" fill="${t.accent}"/>` : panel(x, top, ANSWER_W, ANSWER_H, t)) +
        (letter
          ? `<circle cx="${x + 32}" cy="${top + ANSWER_H / 2}" r="16" fill="${on ? t.background : t.track}"/>` +
            text(x + 32, top + ANSWER_H / 2, 16, on ? t.accent : t.text, letter, 'dy="0.35em" text-anchor="middle" font-weight="700"')
          : '') +
        text(x + (letter ? 60 : 24), top + ANSWER_H / 2, 18, on ? t.background : t.text, escapeXml(label), 'dy="0.35em" font-weight="600"') +
        (note ? text(x + ANSWER_W - 20, top + ANSWER_H / 2, 15, on ? t.background : t.muted, escapeXml(note(i)), 'dy="0.35em" text-anchor="end"') : '') +
        `</g>`
      );
    })
    .join('');

const gridHeight = (answers: string[]) => Math.ceil(answers.length / 2) * (ANSWER_H + GAP) - GAP;

/** The question as it's asked: category and difficulty, the question, the answers */
export const triviaQuestionCard = (d: TriviaQuestionCardData, t: CardTheme) => {
  const badge = `${capitalise(d.difficulty)} · ×${d.factor} XP`;
  const q = questionText(d.question, 72, 28, t);
  const gridY = q.end + 36;
  const footerY = gridY + gridHeight(d.answers) + 40;
  return svgCard(footerY + 52, t, [
    text(PAD, 52, 16, t.muted, escapeXml(truncate(d.category, 48))),
    text(W - PAD, 52, 16, t.accent, escapeXml(badge), 'text-anchor="end" font-weight="700"'),
    q.svg,
    answerGrid(d.answers, gridY, t),
    text(PAD, footerY, 16, t.text, escapeXml(`Everyone can answer: the quicker you're right, the more XP. ${d.seconds} seconds!`)),
    text(PAD, footerY + 26, 12, t.muted, escapeXml(ATTRIBUTION)),
  ]);
};

/** The answer and who got it: the right answer filled, picks per answer, the quickest right members with their XP */
export const triviaResultCard = (d: TriviaResultCardData, t: CardTheme) => {
  const answered = d.picks.reduce((a, b) => a + b, 0);
  const q = questionText(d.question, 28, 20, t);
  const gridY = q.end + 28;
  const listY = gridY + gridHeight(d.answers) + 40;
  const shown = d.winners.slice(0, SHOWN_WINNERS);
  const rows = shown.map((p, i) => {
    const y = listY + i * 56;
    return (
      text(PAD + 8, y + 28, 18, i === 0 ? t.accent : t.muted, ordinal(i + 1), 'dy="0.35em" font-weight="700"') +
      avatarSvg({ id: `w${i}`, x: PAD + 64, y: y + 8, size: 40, name: p.name, image: p.avatar, theme: t }) +
      text(PAD + 120, y + 28, 18, t.text, escapeXml(truncate(p.name, 36)), 'dy="0.35em" font-weight="600"') +
      (p.xp ? text(W - PAD - 8, y + 28, 18, t.accent, `+${p.xp} XP`, 'dy="0.35em" text-anchor="end" font-weight="700"') : '')
    );
  });
  const more = d.winners.length - shown.length;
  const wrong = answered - d.winners.length;
  const summary = !answered
    ? 'Nobody answered!'
    : !d.winners.length
      ? `Nobody got it right (${answered} tried).`
      : [more ? `+${more} more got it right` : '', wrong ? `${wrong} got it wrong` : ''].filter(Boolean).join(' · ');
  const summaryY = listY + shown.length * 56 + (shown.length ? 24 : 8);
  return svgCard(summaryY + 56, t, [
    q.svg,
    answerGrid(
      d.answers,
      gridY,
      t,
      (i) => d.answers[i] === d.correct,
      (i) => (d.picks[i] ? `${d.picks[i]}` : '')
    ),
    ...rows,
    summary ? text(PAD, summaryY, 16, t.muted, escapeXml(summary)) : '',
    text(PAD, summaryY + 28, 12, t.muted, escapeXml(ATTRIBUTION)),
  ]);
};
