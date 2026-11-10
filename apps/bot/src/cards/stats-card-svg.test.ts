import { activityCalendar } from '../api/routes/features/voice-stats/calendar-sql';
import { getMemberHabits, getMemberOnline, getMemberSummary, getVoiceNeighbours } from '../stats/queries';
import { statsCardSvg } from './stats-card-svg';
import { THEMES } from './themes';

jest.mock('../stats/queries', () => ({
  getMemberSummary: jest.fn(),
  getMemberHabits: jest.fn(),
  getMemberOnline: jest.fn(),
  getVoiceNeighbours: jest.fn(),
}));
jest.mock('../api/routes/features/voice-stats/calendar-sql', () => ({ activityCalendar: jest.fn() }));
jest.mock('../api/utils/discord-directory', () => ({
  discordDirectory: () => ({
    members: async (_guildId: string, ids: string[]) =>
      new Map(
        ids
          .filter((id) => id !== 'gone')
          .map((id) => [id, { id, username: `${id}-user`, displayName: id === 'me' ? 'Astolfo' : null, avatar: null }])
      ),
    // 'stranger' shares no server with the bot
    isMember: async (_guildId: string, id: string) => id !== 'stranger',
    guild: () => ({ name: 'Paladins', icon: null }),
  }),
}));

const H = 60 * 60 * 1000;

const summary = (overrides = {}) => ({
  voiceMs: H, previousVoiceMs: null, sessions: 1, messages: 0, previousMessages: null,
  streak: { current: 0, longest: 0 }, lifetimeMs: H, companions: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (getVoiceNeighbours as jest.Mock).mockResolvedValue([]);
});

test('draws the summary the viewer may see, with names from the Discord directory', async () => {
  (getMemberSummary as jest.Mock).mockResolvedValue(
    summary({ companions: [{ memberId: 'roland', togetherMs: H }, { memberId: 'gone', togetherMs: H }] })
  );
  (getVoiceNeighbours as jest.Mock).mockResolvedValue([
    { memberId: 'kai', voiceMs: 2 * H, rank: 1, members: 2 },
    { memberId: 'me', voiceMs: H, rank: 2, members: 2 },
  ]);
  const svg = await statsCardSvg({ db: {} as never, guildId: 'g', memberId: 'me', viewerId: 'viewer', period: 'all', theme: THEMES.dark });

  expect(getMemberSummary).toHaveBeenCalledWith({}, 'g', 'me', 'all', 'viewer');
  expect(getVoiceNeighbours).toHaveBeenCalledWith({}, 'g', 'me', 'all', 'viewer');
  for (const text of ['Astolfo', 'Paladins', 'roland-user', 'Unknown member', 'Hangs out most with', 'Voice ranking · #2 of 2', 'kai-user']) {
    expect(svg).toContain(text);
  }
});

test('runs only the picked sections’ queries, with the viewer’s time zone', async () => {
  (getMemberSummary as jest.Mock).mockResolvedValue(summary());
  (getMemberHabits as jest.Mock).mockResolvedValue({ voice: H, muted: 0, deafened: 0, video: H / 2, streaming: 0 });
  (getMemberOnline as jest.Mock).mockResolvedValue({ ms: 2 * H, share: 0.25 });
  (activityCalendar as jest.Mock).mockResolvedValue({ start: '2025-11-10', end: '2026-11-10', days: [] });
  const $queryRaw = jest.fn().mockResolvedValue([{ hour: 20, day_of_week: 1, total_minutes: 60 }]);
  const card = (sections?: ('habits' | 'calendar' | 'heatmap')[]) =>
    statsCardSvg({ db: { $queryRaw } as never, guildId: 'g', memberId: 'me', viewerId: 'me', period: 'week', theme: THEMES.dark, sections, tz: 'Europe/Brussels' });

  await card();
  expect(getMemberHabits).not.toHaveBeenCalled();
  expect(getMemberOnline).not.toHaveBeenCalled();
  expect(activityCalendar).not.toHaveBeenCalled();
  expect($queryRaw).not.toHaveBeenCalled();

  jest.clearAllMocks();
  const svg = await card(['habits', 'calendar', 'heatmap']);
  expect(getVoiceNeighbours).not.toHaveBeenCalled();
  expect(getMemberHabits).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'week');
  expect(getMemberOnline).toHaveBeenCalledWith(expect.anything(), 'me', 'week');
  expect(activityCalendar).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'Europe/Brussels');
  expect(($queryRaw.mock.calls[0][0] as { values: unknown[] }).values).toEqual(expect.arrayContaining(['g', 'Europe/Brussels', 'me']));
  for (const text of ['Voice habits', '>Online<', '>25%<', 'Past year', 'When you’re in voice']) expect(svg).toContain(text);
  expect(svg).not.toContain('Sessions');
});

test('never reads the statuses of someone who isn’t in the server', async () => {
  (getMemberSummary as jest.Mock).mockResolvedValue(summary());
  (getMemberHabits as jest.Mock).mockResolvedValue({ voice: H, muted: 0, deafened: 0, video: 0, streaming: 0 });
  const svg = await statsCardSvg({
    db: {} as never, guildId: 'g', memberId: 'stranger', viewerId: 'me', period: 'week', theme: THEMES.dark, sections: ['habits'],
  });

  expect(getMemberOnline).not.toHaveBeenCalled();
  expect(svg).toContain('Voice habits');
  expect(svg).not.toContain('>Online<');
});
