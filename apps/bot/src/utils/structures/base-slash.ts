import DiscordClient from '../../client/client';
import {
  CommandInteraction,
  CacheType,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  InteractionResponse,
} from 'discord.js';
import { slashCount } from '../../api/utils/counter';

export abstract class BaseSlash {
  constructor(
    private readonly _name: string,
    private readonly _description: string,
    // Opt-in: a deferred command must answer through InterActionUtils.send /
    // editReply (not interaction.reply) and can't show a modal
    private readonly _deferType: SlashDeferTypes = SlashDeferTypes.NONE
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

  async run(client: DiscordClient, interaction: CommandInteraction<CacheType>) {
    slashCount(this.name);
    // Acknowledge first so slow commands (DB queries) don't miss Discord's
    // 3-second reply deadline ("The application did not respond")
    if (this._deferType !== SlashDeferTypes.NONE) {
      await interaction.deferReply({
        ephemeral: this._deferType === SlashDeferTypes.HIDDEN,
      });
    }
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
