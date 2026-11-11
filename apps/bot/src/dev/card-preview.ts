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
import { duoCard } from '../cards/duo.card';
import { leaderboardCard } from '../cards/leaderboard.card';
import { profileCard } from '../cards/profile.card';
import { reminderCard } from '../cards/reminder.card';
import { rpsCard } from '../cards/rps.card';
import { triviaQuestionCard, triviaResultCard } from '../cards/trivia.card';
import { renderPng } from '../cards/render';
import { STATS_CARD_SECTIONS, statsCard, StatsCardData } from '../cards/stats.card';
import { THEMES, ThemeName } from '../cards/themes';
import { Logger } from '../utils/logger';
import { DEFAULT_RULES, setRules } from '../xp/rules';

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

  const stats: StatsCardData = {
      period: 'month',
      memberName: 'Astolfo',
      avatar: avatar(0),
      serverName: 'Paladins of France',
      summary: {
        voiceMs: 63_900_000,
        previousVoiceMs: 55_000_000,
        sessions: 23,
        messages: 1284,
        previousMessages: 1500,
        messageRank: 3,
        companions: [
          { memberId: '2', togetherMs: 30_000_000 },
          { memberId: '3', togetherMs: 18_500_000 },
          { memberId: '4', togetherMs: 4_000_000 },
        ],
        streak: { current: 12, longest: 31 },
        lifetimeMs: 317_000_000, // 88h
      },
      companions: [1, 2, 3].map((i) => ({ name: NAMES[i], avatar: avatar(i) })),
      xp: { xp: 3912, level: 11, levelXp: 3850, nextLevelXp: 4500 },
      // #2 of 14: Roland above, Oliver below
      ranking: {
        members: 14,
        rows: [
          { name: NAMES[2], avatar: avatar(2), xp: 5_410, level: 13, rank: 1, subject: false },
          { name: NAMES[0], avatar: avatar(0), xp: 3_912, level: 11, rank: 2, subject: true },
          { name: NAMES[3], avatar: avatar(3), xp: 2_960, level: 9, rank: 3, subject: false },
        ],
      },
    };

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
    stats: (theme) => statsCard(stats, THEMES[theme]),
    // An admin-set 2000h milestone at 1200h: past 1000h the grid shows 2h a square
    'stats-admin-milestone': (theme) => {
      setRules({ ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds, milestoneHours: [100, 1000, 2000] } });
      try {
        return statsCard({ ...stats, summary: { ...stats.summary, lifetimeMs: 1200 * 3_600_000 } }, THEMES[theme]);
      } finally {
        setRules(null);
      }
    },
    'stats-all-sections': (theme) =>
      statsCard(
        {
          ...stats,
          sections: STATS_CARD_SECTIONS,
          habits: { voice: 63_900_000, muted: 20_000_000, deafened: 6_000_000, video: 5_400_000, streaming: 12_600_000 },
          online: { ms: 690_000_000, share: 0.27 },
          calendar: {
            start: '2025-11-10',
            end: '2026-11-10',
            // A busy evening rhythm with quiet weeks, and some message-only days
            days: Array.from({ length: 366 }, (_, i) => ({
              date: new Date(Date.UTC(2025, 10, 10 + i)).toISOString().substring(0, 10),
              minutes: i % 7 < 2 || i % 45 < 9 ? 0 : (i * 37) % 300,
              messages: (i * 13) % 11,
            })).filter((day) => day.minutes > 0 || day.messages > 0),
          },
          heatmap: Array.from({ length: 7 * 24 }, (_, i) => ({
            day: Math.floor(i / 24),
            hour: i % 24,
            minutes: i % 24 >= 19 || i % 24 < 1 ? 20 + ((i * 17) % 40) : i % 24 >= 12 && i % 5 === 0 ? 10 : 0,
          })),
        },
        THEMES[theme]
      ),
    duo: (theme) =>
      duoCard(
        {
          period: 'month',
          serverName: 'Paladins of France',
          members: [
            { name: NAMES[0], avatar: avatar(0) },
            { name: NAMES[1], avatar: avatar(1) },
          ],
          topChannelName: 'round-table',
          duo: { togetherMs: 30_000_000, aVoiceMs: 63_900_000, bVoiceMs: 41_000_000, topChannelId: '1' },
        },
        THEMES[theme]
      ),
    'duo-empty': (theme) =>
      duoCard(
        {
          period: 'week',
          serverName: 'Paladins of France',
          members: [
            { name: NAMES[0], avatar: avatar(0) },
            { name: NAMES[2], avatar: avatar(2) },
          ],
          duo: { togetherMs: 0, aVoiceMs: 63_900_000, bVoiceMs: 0 },
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
    'trivia-question': (theme) =>
      triviaQuestionCard(
        {
          category: 'Entertainment: Video Games',
          difficulty: 'hard',
          factor: 2,
          question: 'In the game "Paladins: Champions of the Realm", which champion rides into battle on a giant mechanical horse named Bucket?',
          answers: ['Fernando', 'Astolfo the Unbreakable', 'Barik', 'Ruckus'],
          seconds: 20,
        },
        THEMES[theme]
      ),
    'trivia-result': (theme) =>
      triviaResultCard(
        {
          question: 'Which planet in our solar system has the most moons?',
          answers: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
          correct: 'Saturn',
          picks: [3, 6, 0, 1],
          winners: [0, 1, 2, 3, 4, 5].map((i) => ({ name: NAMES[i], avatar: avatar(i), xp: [30, 20, 14, 10, 6, 6][i] })),
        },
        THEMES[theme]
      ),
    'trivia-true-false': (theme) =>
      triviaQuestionCard(
        { category: 'Science & Nature', difficulty: 'easy', factor: 1, question: 'The human body has four lungs.', answers: ['True', 'False'], seconds: 20 },
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
