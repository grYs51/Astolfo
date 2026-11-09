import { getMemberSummary } from '../stats/queries';
import { statsCardSvg } from './stats-card-svg';
import { THEMES } from './themes';

jest.mock('../stats/queries', () => ({ getMemberSummary: jest.fn() }));
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

test('draws the summary the viewer may see, with names from the Discord directory', async () => {
  (getMemberSummary as jest.Mock).mockResolvedValue({
    voiceMs: H, previousVoiceMs: null, sessions: 1, messages: 0, previousMessages: null,
    rankedMembers: 2, favouriteChannelId: 'vc', streak: { current: 0, longest: 0 }, lifetimeMs: H,
    companions: [{ memberId: 'roland', togetherMs: H }, { memberId: 'gone', togetherMs: H }],
  });
  const svg = await statsCardSvg({ db: {} as never, guildId: 'g', memberId: 'me', viewerId: 'viewer', period: 'all', theme: THEMES.dark });

  expect(getMemberSummary).toHaveBeenCalledWith({}, 'g', 'me', 'all', 'viewer');
  for (const text of ['Astolfo', 'Paladins', '#Lobby', 'roland-user', 'Unknown member']) {
    expect(svg).toContain(text);
  }
});
