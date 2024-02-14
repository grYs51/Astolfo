import { mockGuilds } from "./guilds";

export const mockClient  = {
  commands: {
    get: jest.fn(),
    set: jest.fn(),
  },
  events: undefined,
  interactions: undefined,
  slashs: undefined,
  guildConfigs: {
    get: jest.fn(),
    set: jest.fn(),
  },
  userConfigs: {
    has: jest.fn(),
    set: jest.fn(),
  },
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  voiceUsers: [],
  dataSource: {
    userConfigs: {
      upsert: jest.fn().mockResolvedValue({ user_id: "test-user-id" }),
    },
    guildConfigurations: {
      upsert: jest.fn().mockResolvedValue({ guild_id: "test-guild-id" }),
      update: jest.fn().mockResolvedValue({ guild_id: "test-guild-id" }),
    },
  },
  guilds: mockGuilds,
  ownerId: "test-owner-id",
}