import { CacheType, CommandInteraction } from 'discord.js';
import DiscordInteractions from 'slash-commands';
import DiscordClient from '../../client/client';

export default abstract class BaseSlash {
  constructor(private name: string, private description: string) {}

  getName(): string {
    return this.name;
  }

  getDescription() {
    return this.description;
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
