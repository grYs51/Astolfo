import { activityCalendar } from '../api/routes/features/voice-stats/calendar-sql';
import { getMemberHabits, getMemberSummary } from '../stats/queries';
import { statsCardSvg } from './stats-card-svg';
import { THEMES } from './themes';

jest.mock('../stats/queries', () => ({ getMemberSummary: jest.fn(), getMemberHabits: jest.fn() }));
jest.mock('../api/routes/features/voice-stats/calendar-sql', () => ({ activityCalendar: jest.fn() }));
jest.mock('../api/utils/discord-directory', () => ({
  discordDirectory: () => ({
    members: async (_guildId: string, ids: string[]) =>
      new Map(
        ids
          .filter((id) => id !== 'gone')
          .map((id) => [id, { id, username: `${id}-user`, displayName: id === 'me' ? 'Astolfo' : null, avatar: null }])
      ),
    guild: () => ({ name: 'Paladins', icon: null }),
    channel: () => ({ id: 'vc', name: 'Lobby', type: 'GuildVoice' }),
  }),
}));

const H = 60 * 60 * 1000;

beforeEach(() => jest.clearAllMocks());

test('draws the summary the viewer may see, with names from the Discord directory', async () => {
  (getMemberSummary as jest.Mock).mockResolvedValue({
    voiceMs: H, previousVoiceMs: null, sessions: 1, messages: 0, previousMessages: null,
    rankedMembers: 2, favouriteChannelId: 'vc', streak: { current: 0, longest: 0 }, lifetimeMs: H,
    companions: [{ memberId: 'roland', togetherMs: H }, { memberId: 'gone', togetherMs: H }],
  });
  const svg = await statsCardSvg({ db: {} as never, guildId: 'g', memberId: 'me', viewerId: 'viewer', period: 'all', theme: THEMES.dark });

  expect(getMemberSummary).toHaveBeenCalledWith({}, 'g', 'me', 'all', 'viewer');
  for (const text of ['Astolfo', 'Paladins', '#Lobby', 'roland-user', 'Unknown member', 'Hangs out most with']) {
    expect(svg).toContain(text);
  }
});

test('runs only the picked sections’ queries, with the viewer’s time zone', async () => {
  (getMemberSummary as jest.Mock).mockResolvedValue({
    voiceMs: H, previousVoiceMs: null, sessions: 1, messages: 0, previousMessages: null,
    rankedMembers: 1, streak: { current: 0, longest: 0 }, lifetimeMs: H, companions: [],
  });
  (getMemberHabits as jest.Mock).mockResolvedValue({ voice: H, muted: 0, deafened: 0, video: H / 2, streaming: 0 });
  (activityCalendar as jest.Mock).mockResolvedValue({ start: '2025-11-10', end: '2026-11-10', days: [] });
  const $queryRaw = jest.fn().mockResolvedValue([{ hour: 20, day_of_week: 1, total_minutes: 60 }]);
  const card = (sections?: ('habits' | 'calendar' | 'heatmap')[]) =>
    statsCardSvg({ db: { $queryRaw } as never, guildId: 'g', memberId: 'me', viewerId: 'me', period: 'week', theme: THEMES.dark, sections, tz: 'Europe/Brussels' });

  await card();
  expect(getMemberHabits).not.toHaveBeenCalled();
  expect(activityCalendar).not.toHaveBeenCalled();
  expect($queryRaw).not.toHaveBeenCalled();

  const svg = await card(['habits', 'calendar', 'heatmap']);
  expect(getMemberHabits).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'week');
  expect(activityCalendar).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'Europe/Brussels');
  expect(($queryRaw.mock.calls[0][0] as { values: unknown[] }).values).toEqual(expect.arrayContaining(['g', 'Europe/Brussels', 'me']));
  for (const text of ['Voice habits', 'Past year', 'When you’re in voice']) expect(svg).toContain(text);
  expect(svg).not.toContain('Voice time');
});
