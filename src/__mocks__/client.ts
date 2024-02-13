import DiscordClient from "../client/client";
import logger from "../utils/logger";
import { mockCommands } from "./commands";
import { mockGuilds } from "./guilds";

export const mockClient  = {
  commands: mockCommands,
  events: undefined,
  interactions: undefined,
  slashs: undefined,
  guildConfigs: undefined,
  userConfigs: {
    has: jest.fn(),
    set: jest.fn(),
  },
  logger: logger,
  voiceUsers: [],
  dataSource: {
    userConfigs: {
      upsert: jest.fn().mockResolvedValue({ user_id: "test-user-id" }),
    }
  
  },
  guilds: mockGuilds,
  ownerId: "test-owner-id",
}