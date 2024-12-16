import { InteractionResponse, CacheType, ModalSubmitInteraction, AnySelectMenuInteraction } from 'discord.js';
import DiscordClient from '../../client/client';

export default abstract class BaseInteraction {
  constructor(private readonly _name: string) {}

    get name(): string {
        return this._name;
    }

  abstract run(
    client: DiscordClient,
    interaction:  ModalSubmitInteraction<CacheType> | AnySelectMenuInteraction<CacheType>
  ): Promise<InteractionResponse<boolean>> | Promise<void>;
}
