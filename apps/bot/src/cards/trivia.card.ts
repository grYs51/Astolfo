import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { header, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import type { TriviaStats } from '../trivia/stats';
import type { GeoInfo } from '../trivia/opentdb';
import { CardTheme } from './themes';

export interface TriviaQuestionCardData {
  category: string;
  /** easy, medium or hard */
  difficulty: string;
  /** The XP multiplier for that difficulty */
  factor: number;
  question: string;
  /** Empty for a GeoGuess map round: the guess is a pin on the dashboard */
  answers: string[];
  seconds: number;
  /** GeoGuess: the photo is the question. No credit: a Mapillary username can name the place */
  geo?: Pick<GeoInfo, 'image'>;
}

export interface TriviaPlayer {
  name: string;
  avatar?: string;
  /** XP earned; undefined when none was granted */
  xp?: number;
  /** How long they took to answer; undefined for questions saved before times were kept */
  ms?: number;
  /** GeoGuess map round: how far their pin was */
  km?: number;
}

export interface TriviaResultCardData {
  question: string;
  answers: string[];
  correct: string;
  /** How many members picked each answer, in the order of `answers` */
  picks: number[];
  /** The members who were right, quickest first */
  winners: TriviaPlayer[];
  /** GeoGuess: the photo, and the answers that were a near miss */
  geo?: Pick<GeoInfo, 'image' | 'credit' | 'near'>;
  /** GeoGuess map round: no answer grid, the winners are the pins inside the radius */
  map?: { radiusKm: number; answered: number };
}

export interface TriviaScoreboardCardData {
  /** The game's name; Trivia when unset */
  title?: string;
  /** How many rounds were played */
  rounds: number;
  /** Ranked already: XP, then correct answers, then time */
  players: (TriviaPlayer & { correct: number })[];
}

export const LETTERS = ['A', 'B', 'C', 'D'];
const ATTRIBUTION = 'Question from Open Trivia DB (opentdb.com) · CC BY-SA 4.0';
const PHOTO_W = W - 2 * PAD;

/** The licence line: Open Trivia DB, or the GeoGuess photo and, once the round is over, who took it */
const attribution = (geo?: Pick<GeoInfo, 'credit'>) =>
  geo ? `Photo ${geo.credit ? `by @${truncate(geo.credit, 40)} ` : ''}on Mapillary · CC BY-SA 4.0` : ATTRIBUTION;

/** A GeoGuess photo across the card, cropped to fill `h` with rounded corners (the data URI comes from fetchImage) */
const photo = (image: string, y: number, h: number) =>
  `<clipPath id="photo"><rect x="${PAD}" y="${y}" width="${PHOTO_W}" height="${h}" rx="16"/></clipPath>` +
  `<image href="${image}" x="${PAD}" y="${y}" width="${PHOTO_W}" height="${h}" clip-path="url(#photo)" preserveAspectRatio="xMidYMid slice"/>`;
const SHOWN_WINNERS = 5;
const ANSWER_H = 64;
const GAP = 16;
const ANSWER_W = (W - 2 * PAD - GAP) / 2;

/** 2300 → "2.3 s" */
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st */
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

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
  const photoH = d.geo ? 440 : 0;
  const q = questionText(d.question, 72 + (photoH && photoH + 12), 28, t);
  const gridY = q.end + 36;
  const footerY = d.answers.length ? gridY + gridHeight(d.answers) + 40 : q.end + 40;
  const howTo = d.answers.length
    ? `Everyone can answer: the quicker you're right, the more XP. ${d.seconds} seconds!`
    : `Drop a pin on the dashboard: the closer, the more XP. ${d.seconds} seconds!`;
  return svgCard(footerY + 52, t, [
    text(PAD, 52, 16, t.muted, escapeXml(truncate(d.category, 48))),
    text(W - PAD, 52, 16, t.accent, escapeXml(badge), 'text-anchor="end" font-weight="700"'),
    d.geo ? photo(d.geo.image, 72, photoH) : '',
    q.svg,
    answerGrid(d.answers, gridY, t),
    text(PAD, footerY, 16, t.text, escapeXml(howTo)),
    text(PAD, footerY + 26, 12, t.muted, escapeXml(attribution(d.geo && {}))),
  ]);
};

const ROW_H = 56;

/** A place, avatar, name, a muted note and the XP, one row of `ROW_H` from `y` */
const playerRow = (p: TriviaPlayer, i: number, y: number, t: CardTheme, note: string) =>
  text(PAD + 8, y + 28, 18, i === 0 ? t.accent : t.muted, ordinal(i + 1), 'dy="0.35em" font-weight="700"') +
  avatarSvg({ id: `p${i}`, x: PAD + 64, y: y + 8, size: 40, name: p.name, image: p.avatar, theme: t }) +
  text(PAD + 120, y + 28, 18, t.text, escapeXml(truncate(p.name, 36)), 'dy="0.35em" font-weight="600"') +
  (note ? text(W - PAD - 130, y + 28, 16, t.muted, escapeXml(note), 'dy="0.35em" text-anchor="end"') : '') +
  (p.xp ? text(W - PAD - 8, y + 28, 18, t.accent, `+${p.xp} XP`, 'dy="0.35em" text-anchor="end" font-weight="700"') : '');

/** The answer and who got it: the right answer filled, picks per answer, the quickest right members with their XP */
export const triviaResultCard = (d: TriviaResultCardData, t: CardTheme) => {
  const answered = d.map?.answered ?? d.picks.reduce((a, b) => a + b, 0);
  const photoH = d.geo ? 240 : 0;
  const isNear = (i: number) => !!d.geo?.near.includes(d.answers[i]);
  const nearCount = d.picks.reduce((sum, n, i) => sum + (isNear(i) ? n : 0), 0);
  const q = questionText(d.geo ? `It was ${d.correct}` : d.question, 28 + (photoH && photoH + 12), 20, t);
  const gridY = q.end + 28;
  const listY = d.answers.length ? gridY + gridHeight(d.answers) + 40 : gridY;
  const shown = d.winners.slice(0, SHOWN_WINNERS);
  const rows = shown.map((p, i) => playerRow(p, i, listY + i * ROW_H, t, p.km !== undefined ? `${Math.round(p.km)} km` : p.ms !== undefined ? seconds(p.ms) : ''));
  const more = d.winners.length - shown.length;
  const wrong = answered - d.winners.length - nearCount;
  const nearNote = nearCount ? `${nearCount} near miss${nearCount === 1 ? '' : 'es'}` : '';
  const right = d.map ? `within ${d.map.radiusKm} km` : 'got it right';
  const summary = !answered
    ? 'Nobody answered!'
    : !d.winners.length
      ? d.map
        ? `Nobody was within ${d.map.radiusKm} km (${answered} tried).`
        : `Nobody got it right (${answered} tried).${nearNote ? ` ${nearNote}.` : ''}`
      : [more ? `+${more} more ${right}` : '', nearNote, wrong ? (d.map ? `${wrong} further away` : `${wrong} got it wrong`) : ''].filter(Boolean).join(' · ');
  const summaryY = listY + shown.length * ROW_H + (shown.length ? 24 : 8);
  return svgCard(summaryY + 56, t, [
    d.geo ? photo(d.geo.image, 28, photoH) : '',
    q.svg,
    answerGrid(
      d.answers,
      gridY,
      t,
      (i) => d.answers[i] === d.correct,
      (i) => [isNear(i) ? 'near' : '', d.picks[i] ? `${d.picks[i]}` : ''].filter(Boolean).join(' · ')
    ),
    ...rows,
    summary ? text(PAD, summaryY, 16, t.muted, escapeXml(summary)) : '',
    text(PAD, summaryY + 28, 12, t.muted, escapeXml(attribution(d.geo))),
  ]);
};

/** After a game of 2+ rounds: everyone ranked, with how many they got right and the XP they earned */
export const triviaScoreboardCard = (d: TriviaScoreboardCardData, t: CardTheme) => {
  const listY = 84;
  return svgCard(listY + d.players.length * ROW_H + 32, t, [
    text(PAD, 52, 24, t.text, escapeXml(`${d.title ?? 'Trivia'} · final scores after ${d.rounds} round${d.rounds === 1 ? '' : 's'}`), 'font-weight="700"'),
    ...d.players.map((p, i) => playerRow(p, i, listY + i * ROW_H, t, `${p.correct}/${d.rounds} right`)),
  ]);
};

export interface TriviaStatsCardData {
  name: string;
  avatar?: string;
  serverName: string;
  stats: TriviaStats;
}

/** /trivia-stats: one member's answers, accuracy, 1st places, XP, quickest answer and best category */
export const triviaStatsCard = (d: TriviaStatsCardData, t: CardTheme) => {
  const s = d.stats;
  const pct = (part: number, whole: number) => `${Math.round((100 * part) / whole)}%`;
  const y = 136;
  const tiles: [string, string, string | undefined][] = [
    ['Right answers', `${s.correct}`, `${pct(s.correct, s.answered)} of ${s.answered} answered`],
    ['1st places', `${s.firsts}`, 'the quickest right answer'],
    ['Trivia XP', `${s.xp}`, undefined],
    ['Quickest right answer', s.fastestMs !== undefined ? seconds(s.fastestMs) : '–', undefined],
  ];
  const parts = tiles.map(([label, value, sub], i) => tile(PAD + (i % 2) * (TILE_W + 16), y + Math.floor(i / 2) * (TILE_H + 16), label, value, sub, t));
  const best = s.bestCategory
    ? `Best category: ${s.bestCategory.name}, ${s.bestCategory.correct} of ${s.bestCategory.answered} right`
    : 'Best category: not enough answers in one category yet';
  const bestY = y + 2 * TILE_H + 16 + 44;
  return svgCard(bestY + 60, t, [
    header({ name: d.name, avatar: d.avatar, title: d.name, subtitle: `Trivia in ${d.serverName}` }, t),
    ...parts,
    text(PAD, bestY, 18, t.text, escapeXml(truncate(best, 70))),
    text(PAD, bestY + 30, 12, t.muted, escapeXml('Questions from Open Trivia DB (opentdb.com) · photos from Mapillary · CC BY-SA 4.0')),
  ]);
};
