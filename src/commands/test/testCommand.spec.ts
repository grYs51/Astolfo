import { Message } from "discord.js";
import { mockMessage } from "../../../__mocks__/message";
import TestCommand from "./testCommand";

describe('testCommand', () => {
  let message: Message;
  let command: TestCommand;

  beforeEach(() => {
    message = mockMessage as unknown as Message;
    command = new TestCommand();
  });

  it('should return a message with "Test command works!"', async () => {
    const replySpy = jest.spyOn(message, 'reply');

    await command.run({} as any, message, []);

    expect(replySpy).toHaveBeenCalledWith({
      content: 'Test command works!',
      allowedMentions: {
        repliedUser: false,
      },
    });
  });
});