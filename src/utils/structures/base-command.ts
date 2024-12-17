import { Message, MessageReaction } from 'discord.js';
import DiscordClient from '../../client/client';
import { commandsCount } from '../../api/utils.ts/counter';

export default abstract class BaseCommand {
  constructor(
    private readonly _name: string,
    private readonly _category: string,
    private readonly _aliases: Array<string>
  ) {}

  get name(): string {
    return this._name;
  }

  get category(): string {
    return this._category;
  }

  get aliases(): Array<string> {
    return this._aliases;
  }

  run(client: DiscordClient, message: Message, args: Array<string> | null) {
    commandsCount(this.name);
    return this.command(client, message, args).catch((error) => {
      client.logger.error(error);
      return message.react('⛔');
    });
  }

  protected abstract command(
    client: DiscordClient,
    message: Message,
    args: Array<string> | null
  ): Promise<Message | MessageReaction>;
}
