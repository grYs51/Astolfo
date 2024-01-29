import DiscordInteractions, {
  ApplicationCommand,
  PartialApplicationCommand,
} from 'slash-commands';
import DiscordClient from '../../client/client';
import { CommandInteraction, CacheType, SlashCommandBuilder } from 'discord.js';

export default abstract class BaseSlash {
  constructor(
    private name: string,
    private description: string,
  ) {}

  getName(): string {
    return this.name.toLocaleLowerCase();
  }

  getDescription() {
    return this.description;
  }

  createInteraction(client: DiscordClient): SlashCommandBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  abstract run(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void>;
}
