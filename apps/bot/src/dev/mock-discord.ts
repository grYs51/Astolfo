/**
 * Local-only mock of everything the dashboard API asks Discord for (login,
 * profile, servers, channels, members), so the whole dashboard can be shown
 * with seeded data and no Discord bot, server or OAuth app.
 *
 * Enable with MOCK_DISCORD=true in .env, seed with `yarn nx run bot:seed`.
 * Never active when NODE_ENV=production (validateEnv refuses to start).
 */

export const isMockDiscord = () =>
  process.env.MOCK_DISCORD === 'true' && process.env.NODE_ENV !== 'production';

export type MockChannel = {
  id: string;
  name: string;
  type: 'GuildVoice' | 'GuildStageVoice';
};

export type MockMember = {
  id: string;
  username: string;
  displayName: string;
};

export type MockGuild = {
  id: string;
  name: string;
  channels: MockChannel[];
  members: MockMember[];
};

/** The user every mock login signs in as. Shape matches Discord's /users/@me. */
export const MOCK_USER = {
  id: '200000000000000001',
  username: 'you',
  global_name: 'Mock User',
  discriminator: '0',
  avatar: null,
} as const;

const me: MockMember = {
  id: MOCK_USER.id,
  username: MOCK_USER.username,
  displayName: MOCK_USER.global_name,
};

const member = (n: number, username: string, displayName: string): MockMember => ({
  id: `2000000000000${String(n).padStart(5, '0')}`,
  username,
  displayName,
});

const members = {
  luna: member(101, 'luna.exe', 'Luna'),
  kai: member(102, 'kaiwaves', 'Kai'),
  mira: member(103, 'mira_draws', 'Mira'),
  theo: member(104, 'theodore', 'Theo'),
  nova: member(105, 'novastar', 'Nova'),
  rex: member(106, 'rexplays', 'Rex'),
  ivy: member(107, 'ivy.green', 'Ivy'),
  otto: member(108, 'ottomatic', 'Otto'),
  sage: member(109, 'sage.lofi', 'Sage'),
  finn: member(110, 'finnley', 'Finn'),
  zoe: member(111, 'zoe_z', 'Zoe'),
  milo: member(112, 'milo404', 'Milo'),
};

export const MOCK_GUILDS: MockGuild[] = [
  {
    id: '300000000000000001',
    name: 'Astolfo Café',
    channels: [
      { id: '300000000000000101', name: 'Lobby', type: 'GuildVoice' },
      { id: '300000000000000102', name: 'Gaming', type: 'GuildVoice' },
      { id: '300000000000000103', name: 'Study Room', type: 'GuildVoice' },
      { id: '300000000000000104', name: 'Music', type: 'GuildVoice' },
      { id: '300000000000000105', name: 'Friday Stage', type: 'GuildStageVoice' },
    ],
    members: [
      me,
      members.luna,
      members.kai,
      members.mira,
      members.theo,
      members.nova,
      members.rex,
      members.ivy,
      members.otto,
      members.sage,
    ],
  },
  {
    id: '300000000000000002',
    name: 'Night Owls',
    channels: [
      { id: '300000000000000201', name: 'Late Night', type: 'GuildVoice' },
      { id: '300000000000000202', name: 'Raid Night', type: 'GuildVoice' },
      { id: '300000000000000203', name: 'AFK', type: 'GuildVoice' },
    ],
    members: [me, members.rex, members.finn, members.zoe, members.milo, members.sage],
  },
];

export const findMockGuild = (guildId: string) =>
  MOCK_GUILDS.find((guild) => guild.id === guildId);

/** Discord's default avatar for a user id (same rule the dashboard uses). */
export const defaultAvatarUrl = (userId: string) =>
  `https://cdn.discordapp.com/embed/avatars/${Number(
    (BigInt(userId) >> BigInt(22)) % BigInt(6)
  )}.png`;
