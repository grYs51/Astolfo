import {
  CacheType,
  CommandInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import DiscordInteractions from 'slash-commands';
import DiscordClient from '../../client/client';

export default abstract class BaseSlash {
  constructor(private name: string) {}

  getName(): string {
    return this.name;
  }

  abstract createInteraction(
    client: DiscordClient,
    interaction: DiscordInteractions,
  ): Promise<void>;

  abstract run(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void>;
}
