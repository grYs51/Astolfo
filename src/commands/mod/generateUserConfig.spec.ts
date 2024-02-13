
import GenerateUserConfigCommand from './generateUserConfig';
import { mockClient } from '../../__mocks__/client';
import { mockMessage } from '../../__mocks__/message';
import { Message } from 'discord.js';

jest.mock('discord.js');

describe('GenerateUserconfigCommand', () => {
  let client: any;
  let message: Message;
  let command: GenerateUserConfigCommand;

  beforeEach(() => {
    client = mockClient
    message = mockMessage;
    command = new GenerateUserConfigCommand();

    // Mock the client's guilds and members
  
  });

  it('should react with ⛔ if the message author is not the client owner', async () => {
    message.author.id = 'not-owner';

    const reactSpy = jest.spyOn(message, 'react');

    await command.run(client, message, []);

    expect(reactSpy).toHaveBeenCalledWith('⛔');
  });

  it('should react with ✅ if the message author is the client owner', async () => {
    message.author.id = 'test-owner-id';

    client.guilds.cache =  new Map([
      ['guild1', {
        members: {
          cache: new Map([
            ['member1', {
              id: 'member1',
            }],
          ]),
        },
      }],
    ]);

    const reactSpy = jest.spyOn(message, 'react');

    await command.run(client, message, []);

    expect(reactSpy).toHaveBeenCalledWith('✅');
  });

  // Add more tests here for other scenarios and edge cases
});