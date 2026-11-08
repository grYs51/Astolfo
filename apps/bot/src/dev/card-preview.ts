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
import { leaderboardCard } from '../cards/leaderboard.card';
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
          },
          companions: [1, 2, 3].map((i) => ({ name: NAMES[i], avatar: avatar(i) })),
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
