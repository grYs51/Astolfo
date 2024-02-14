import { Message } from 'discord.js';
import { mockClient } from '../../../__mocks__/client';
import { mockMessage } from '../../../__mocks__/message';
import MessageEvent from './messageEvent';

describe('MessageEvent', () => {
  let client: typeof mockClient;
  let message: Message;
  let messageEvent: MessageEvent;

  beforeEach(() => {
    client = mockClient;
    message = mockMessage as unknown as Message;
    messageEvent = new MessageEvent();
  });

  test('should not run command if message is from bot', async () => {
    message.author.bot = true;
    await messageEvent.run(client as any, message as any);
    expect(client.commands.get).not.toHaveBeenCalled();
  });

  test('should not run command if no message', async () => {
    message = null as any;
    await messageEvent.run(client as any, message as any);
    expect(client.commands.get).not.toHaveBeenCalled();
  });

  test('should not run command if no guild config', async () => {
    message.content = '!test';
    message.author.bot = false;
    await messageEvent.run(client as any, message as any);
    expect(client.commands.get).not.toHaveBeenCalled();
  });

  test('should run command if message starts with prefix', async () => {
    message.content = '!test';
    message.author.bot = false;
    client.guildConfigs.get = jest.fn().mockReturnValue({ prefix: '!' });
    client.commands.get = jest.fn().mockReturnValue({ run: jest.fn() });
    await messageEvent.run(client as any, message as any);
    expect(client.commands.get).toHaveBeenCalledWith('test');
    expect(client.commands.get('test').run).toHaveBeenCalledWith(client, message, []);
  });
});