import { Message, MessageReaction } from 'discord.js';
import DiscordClient from '../../client/client';

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

  abstract run(
    client: DiscordClient,
    message: Message,
    args: Array<string> | null,
  ): Promise<Message | MessageReaction>;
}
