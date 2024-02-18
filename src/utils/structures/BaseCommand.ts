import { Message, MessageReaction } from 'discord.js';
import DiscordClient from '../../client/client';
import { commandsCount } from '../../metrics/utils.ts/counter';

export default abstract class BaseCommand {
  constructor(
    private _name: string,
    private _category: string,
    private _aliases: Array<string>,
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
    return this.command(client, message, args);
  }

  protected abstract command(
    client: DiscordClient,
    message: Message,
    args: Array<string> | null,
  ): Promise<Message | MessageReaction>;
}
