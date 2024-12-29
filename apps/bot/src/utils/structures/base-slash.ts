import DiscordClient from '../../client/client';
import {
  CommandInteraction,
  CacheType,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  InteractionResponse,
} from 'discord.js';
import { slashCount } from '../../api/utils.ts/counter';

export abstract class BaseSlash {
  constructor(
    private readonly _name: string,
    private readonly _description: string,
    private readonly _deferType: SlashDeferTypes = SlashDeferTypes.PUBLIC
  ) {}

  get name(): string {
    return process.env.DEV
      ? `dev-${this._name.toLocaleLowerCase()}`
      : this._name.toLocaleLowerCase();
  }

  get description() {
    return this._description;
  }

  get deferType() {
    return this._deferType;
  }

  createInteraction(
    client: DiscordClient
  ):
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  run(client: DiscordClient, interaction: CommandInteraction<CacheType>) {
    slashCount(this.name);
    return this.slash(client, interaction);
  }

  protected abstract slash(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>
  ): Promise<InteractionResponse<boolean>> | Promise<void>;
}

export enum SlashDeferTypes {
  PUBLIC,
  HIDDEN,
  NONE,
}
