/**
 * Renders every image card in every theme from fixture data, so templates
 * and themes can be tweaked without Discord:
 *
 *   yarn nx run bot:card-preview      → tmp/cards/<card>-<theme>.png
 *
 * Avatars come from Discord's default-avatar CDN; offline, the cards show
 * initials instead.
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fetchImage } from '../cards/avatars';
import { digestCard } from '../cards/digest.card';
import { leaderboardCard } from '../cards/leaderboard.card';
import { profileCard } from '../cards/profile.card';
import { reminderCard } from '../cards/reminder.card';
import { rpsCard } from '../cards/rps.card';
import { renderPng } from '../cards/render';
import { statsCard } from '../cards/stats.card';
import { THEMES, ThemeName } from '../cards/themes';
import { Logger } from '../utils/logger';

const OUT_DIR = path.join(process.cwd(), 'tmp/cards');

const NAMES = [
  'Astolfo',
  'Bradamante, Knight of the Silver Lance',
  'Roland',
  'Oliver',
  'Ruggiero',
  'Angelica',
  'Charlemagne',
  'Rinaldo',
  'Ferraù',
  'Medoro',
];

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const avatars = await Promise.all(
    [0, 1, 2, 3, 4, 5].map((i) => fetchImage(`https://cdn.discordapp.com/embed/avatars/${i}.png`))
  );
  // Every third member has no avatar, to show the initial fallback
  const avatar = (i: number) => (i % 3 === 2 ? undefined : avatars[i % avatars.length]);

  const cards: Record<string, (theme: ThemeName) => string> = {
    leaderboard: (theme) =>
      leaderboardCard(
        {
          serverName: 'Paladins of France',
          title: 'Most active',
          subtitle: 'Last 7 days',
          footer: 'Page 1/2 · voice time without deafened time',
          empty: 'No one was in voice',
          rows: NAMES.map((name, i) => ({
            rank: i + 1,
            name,
            value: `${20 - 2 * i}h ${(i * 7) % 60}m`,
            fraction: (20 - 2 * i) / 20,
            avatar: avatar(i),
          })),
        },
        THEMES[theme]
      ),
    stats: (theme) =>
      statsCard(
        {
          period: 'month',
          memberName: 'Astolfo',
          avatar: avatar(0),
          serverName: 'Paladins of France',
          favouriteChannelName: 'round-table',
          summary: {
            voiceMs: 63_900_000,
            previousVoiceMs: 55_000_000,
            sessions: 23,
            messages: 1284,
            previousMessages: 1500,
            voiceRank: 2,
            rankedMembers: 14,
            favouriteChannelId: '1',
            companions: [
              { memberId: '2', togetherMs: 30_000_000 },
              { memberId: '3', togetherMs: 18_500_000 },
              { memberId: '4', togetherMs: 4_000_000 },
            ],
            streak: { current: 12, longest: 31 },
            lifetimeMs: 317_000_000, // 88h
          },
          companions: [1, 2, 3].map((i) => ({ name: NAMES[i], avatar: avatar(i) })),
        },
        THEMES[theme]
      ),
    profile: (theme) =>
      profileCard(
        {
          memberName: 'Astolfo',
          avatar: avatar(0),
          serverName: 'Paladins of France',
          favouriteChannelName: 'round-table',
          now: new Date('2026-11-09T12:00:00Z'),
          profile: {
            trackingSince: new Date('2026-07-11T13:27:02Z'),
            sessions: 84,
            voiceMs: 587_962_176,
            longestSessionMs: 67_082_066,
            mutedMs: 74_006_026,
            streamingMs: 61_191_293,
            lastWeekMs: 104_576_295,
            favouriteChannelId: '1',
            rps: { wins: 4, ties: 10, losses: 10 },
          },
        },
        THEMES[theme]
      ),
    rps: (theme) =>
      rpsCard(
        {
          players: [
            { name: NAMES[0], avatar: avatar(0), move: 'paper' },
            { name: NAMES[1], avatar: avatar(1), move: 'rock' },
          ],
          winner: 0,
        },
        THEMES[theme]
      ),
    reminder: (theme) =>
      reminderCard({ memberName: NAMES[2], avatar: avatar(2), channelName: 'round-table', hours: 5, word: 'gay' }, THEMES[theme]),
    digest: (theme) =>
      digestCard(
        {
          serverName: 'Paladins of France',
          weekStart: new Date('2026-11-02T00:00:00Z'),
          members: Object.fromEntries(NAMES.map((name, i) => [`${i}`, { name, avatar: avatar(i) }])),
          digest: {
            voiceMs: 412_000_000,
            previousVoiceMs: 355_000_000,
            messages: 2_841,
            previousMessages: 3_102,
            activeMembers: 14,
            topVoice: [0, 1, 2].map((i) => ({ memberId: `${i}`, ms: 90_000_000 - i * 20_000_000 })),
            topMessages: [3, 4, 5].map((i) => ({ memberId: `${i}`, count: 900 - i * 100 })),
            bestDuo: { a: '0', b: '1', togetherMs: 52_000_000 },
            busiestDay: { day: new Date('2026-11-06T00:00:00Z'), ms: 96_000_000 },
            topStreaks: [6, 0, 7].map((i, rank) => ({ memberId: `${i}`, days: 21 - rank * 6 })),
            milestones: [{ memberId: '1', hours: 250 }, { memberId: '8', hours: 50 }],
          },
        },
        THEMES[theme]
      ),
  };

  for (const [card, svgFor] of Object.entries(cards)) {
    for (const theme of Object.keys(THEMES) as ThemeName[]) {
      const file = path.join(OUT_DIR, `${card}-${theme}.png`);
      writeFileSync(file, new Uint8Array(await renderPng(svgFor(theme))));
      Logger.info(`Wrote ${path.relative(process.cwd(), file)}`);
    }
  }
};

main().catch((error) => {
  Logger.error('Card preview failed', error);
  process.exit(1);
});
