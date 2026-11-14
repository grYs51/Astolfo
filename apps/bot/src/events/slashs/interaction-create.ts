import { Events, Interaction, RepliableInteraction } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';

const replyWithError = async (interaction: RepliableInteraction) => {
  const reply = {
    content: 'Something went wrong while handling this interaction.',
    ephemeral: true,
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  } catch {
    // Interaction may have expired — nothing more we can do
  }
};

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super(Events.InteractionCreate);
  }

  protected event(client: DiscordClient, interaction: Interaction) {
    // Slash commands only. Context-menu commands aren't registered, and
    // buttons are handled by collectors on the message that has them.
    if (!interaction.isChatInputCommand()) return;
    const slash = client.slashs.get(interaction.commandName);
    if (!slash) return;
    // Catch here so a throwing slash command doesn't leave the
    // interaction hanging ("The application did not respond")
    Promise.resolve(slash.run(client, interaction)).catch(async (error) => {
      Logger.error(`Slash command "${interaction.commandName}" failed`, error);
      await replyWithError(interaction);
    });
  }
}
