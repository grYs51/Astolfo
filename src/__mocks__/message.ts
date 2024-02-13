import { Message } from "discord.js";

export const mockMessage = {
  react: jest.fn(),
  author: {
    id: 'test-owner-id'
  }
} as unknown as Message;