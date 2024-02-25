import DiscordClient from '../../client/client';
import { CommandInteraction, CacheType, SlashCommandBuilder } from 'discord.js';
import { slashCount } from '../../api/utils.ts/counter';

export default abstract class BaseSlash {
  constructor(
    private _name: string,
    private _description: string
  ) {}

  get name(): string {
    return this._name.toLocaleLowerCase();
  }

  get description() {
    return this._description;
  }

  createInteraction(client: DiscordClient): SlashCommandBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  run(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    slashCount(this.name);
    return this.slash(client, interaction);
  }

  protected abstract slash(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>
  ): Promise<void>;
}
