import { Message, PermissionResolvable } from 'discord.js';
import DiscordClient from '../../client/client';
import { commandsCount } from '../../api/utils.ts/counter';
import { MessageUtils } from '../message-utils';

export default abstract class BaseCommand {
  /**
   * @param _permissions guild permissions the invoking member must hold
   *   (all of them), e.g. `PermissionFlagsBits.ManageGuild` for config commands
   */
  constructor(
    private readonly _name: string,
    private readonly _category: string,
    private readonly _aliases: Array<string>,
    private readonly _permissions: PermissionResolvable[] = []
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
    if (
      this._permissions.length > 0 &&
      !message.member?.permissions.has(this._permissions)
    ) {
      return MessageUtils.reply(
        message,
        "You don't have permission to use this command."
      );
    }

    commandsCount(this.name);
    return this.command(client, message, args);
  }

  protected abstract command(
    client: DiscordClient,
    message: Message,
    args: Array<string> | null
  ): void;
}
