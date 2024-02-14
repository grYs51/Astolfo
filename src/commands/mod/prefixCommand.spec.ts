import { Message } from "discord.js";
import { mockClient } from "../../../__mocks__/client";
import { mockMessage } from "../../../__mocks__/message";
import PrefixCommand from "./prefixCommand";

describe('PrefixCommand', () => {
  let client: typeof mockClient;
  let message: typeof mockMessage;
  let command: PrefixCommand;

  beforeEach(() => {
    client = mockClient;
    message = mockMessage;
    command = new PrefixCommand();
  });

  it('should return a message with usage if no prefix is provided', async () => {
    const replySpy = jest.spyOn(message, 'reply');

    await command.run(client as any, message as any, []);

    expect(replySpy).toHaveBeenCalledWith(
      `Please provide an prefix\nUsage: \`!prefix <new prefix>\``,
    );
  });

  it('should update the prefix and react with ✅', async () => {
    const updateSpy = jest.spyOn(client.dataSource.guildConfigurations, 'update');
    const reactSpy = jest.spyOn(message, 'react');

    await command.run(client as any, message as any, ['new-prefix']);

    expect(updateSpy).toHaveBeenCalledWith({
      data: {
        prefix: 'new-prefix',
      },
      where: {
        guild_id: 'guild1',
      },
    });
    expect(reactSpy).toHaveBeenCalledWith('✅');
  });

  it('should react with ❌ if the update fails', async () => {
    jest.spyOn(client.dataSource.guildConfigurations, 'update').mockRejectedValue(new Error("Test error message"));
    const reactSpy = jest.spyOn(message, 'react');

    await command.run(client as any, message as any, ['new-prefix']);

    expect(reactSpy).toHaveBeenCalledWith('❌');
  });
});