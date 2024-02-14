import { Collection, Message } from 'discord.js';
import { mockClient } from '../../../__mocks__/client';
import { mockMessage } from '../../../__mocks__/message';
import GenerateUserConfigCommand from './generateUserConfig';
import InitGuildConfigs from './initGuildConfig';

jest.mock('discord.js');

describe('InitGuildConfig', () => {
  let client: typeof mockClient;
  let message: Message;
  let command: InitGuildConfigs;

  beforeEach(() => {
    client = mockClient;
    message = mockMessage as unknown as Message;
    command = new GenerateUserConfigCommand();
  });

  it('should react with ⛔ if the message author is not the client owner', async () => {
    message.author.id = 'not-owner';

    const reactSpy = jest.spyOn(message, 'react');

    await command.run(client as any, message, []);

    expect(reactSpy).toHaveBeenCalledWith('⛔');
  });

  xit('should react with ✅ if the message author is the client owner', async () => {
    message.author.id = 'test-owner-id';

    const reactSpy = jest.spyOn(message, 'react');

    const loggerSpy = jest.spyOn(client.logger, 'info');

    await command.run(client as any, message, []);

    expect(reactSpy).toHaveBeenCalledWith('✅');
    expect(loggerSpy).toHaveBeenCalledWith('Initializing guild guild1 (guild1)');
  });
});
