import {
  CommandInteraction,
  DiscordAPIError,
  InteractionResponse,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTJSONErrorCodes as DiscordApiErrors,
  ApplicationCommandOptionChoiceData,
  AutocompleteInteraction,
  EmbedBuilder,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  Message,
  WebhookMessageEditOptions,
} from 'discord.js';
import logger from './logger';

const IGNORED_ERRORS = [
  DiscordApiErrors.UnknownMessage,
  DiscordApiErrors.UnknownChannel,
  DiscordApiErrors.UnknownGuild,
  DiscordApiErrors.UnknownUser,
  DiscordApiErrors.UnknownInteraction,
  DiscordApiErrors.CannotSendMessagesToThisUser, // User blocked bot or DM disabled
  DiscordApiErrors.ReactionWasBlocked, // User blocked bot or DM disabled
  DiscordApiErrors.MaximumActiveThreads,
];

type InteractionType =
  | CommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;

function createReplyOptions(
  content: string | EmbedBuilder | InteractionReplyOptions
): InteractionReplyOptions {
  if (typeof content === 'string') {
    return { content };
  } else if (content instanceof EmbedBuilder) {
    return { embeds: [content] };
  }
  return content;
}
export class InterActionUtils {
  public static async deferReply(
    interAction: InteractionType,
    hidden = false
  ): Promise<InteractionResponse> {
    try {
      return await interAction.deferReply({ ephemeral: hidden });
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        typeof error.code == 'number' &&
        IGNORED_ERRORS.includes(error.code)
      ) {
        return await interAction.reply({
          content: 'An error occurred while processing your command.',
          ephemeral: hidden,
        });
      } else {
        logger.error('Failed to defer reply', error);
        throw error;
      }
    }
  }

  public static async deferUpdate(
    intr: MessageComponentInteraction | ModalSubmitInteraction
  ): Promise<InteractionResponse> {
    try {
      return await intr.deferUpdate();
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        typeof error.code == 'number' &&
        IGNORED_ERRORS.includes(error.code)
      ) {
        return;
      } else {
        throw error;
      }
    }
  }

  public static async send(
    intr: InteractionType,
    content: string | EmbedBuilder | InteractionReplyOptions,
    hidden: boolean = false
  ): Promise<Message | void> {
    try {
      let options: InteractionReplyOptions;
      if (typeof content === 'string') {
        options = { content };
      } else if (content instanceof EmbedBuilder) {
        options = { embeds: [content] };
      } else {
        options = content;
      }
      if (intr.deferred || intr.replied) {
        return await intr.followUp({
          ...options,
          ephemeral: hidden,
        });
      } else {
        return await intr.reply({
          ...options,
          ephemeral: hidden,
          fetchReply: true,
        });
      }
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        typeof error.code == 'number' &&
        IGNORED_ERRORS.includes(error.code)
      ) {
        return;
      } else {
        throw error;
      }
    }
  }

  public static async respond(
    intr: AutocompleteInteraction,
    choices: ApplicationCommandOptionChoiceData[] = []
  ): Promise<void> {
    try {
      return await intr.respond(choices);
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        typeof error.code == 'number' &&
        IGNORED_ERRORS.includes(error.code)
      ) {
        return;
      } else {
        throw error;
      }
    }
  }

  public static async editReply(
    intr: InteractionType,
    content: string | EmbedBuilder | WebhookMessageEditOptions
  ): Promise<Message | void> {
    try {
      let options: WebhookMessageEditOptions;
      if (typeof content === 'string') {
        options = { content };
      } else if (content instanceof EmbedBuilder) {
        options = { embeds: [content] };
      } else {
        options = content;
      }
      return await intr.editReply(options);
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        typeof error.code == 'number' &&
        IGNORED_ERRORS.includes(error.code)
      ) {
        return;
      } else {
        throw error;
      }
    }
  }

  public static async update(
    intr: MessageComponentInteraction,
    content: string | EmbedBuilder | InteractionUpdateOptions
  ): Promise<Message | void> {
    try {
      let options: InteractionUpdateOptions;
      if (typeof content === 'string') {
        options = { content };
      } else if (content instanceof EmbedBuilder) {
        options = { embeds: [content] };
      } else {
        options = content;
      }
      return await intr.update({
        ...options,
        fetchReply: true,
      });
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        typeof error.code == 'number' &&
        IGNORED_ERRORS.includes(error.code)
      ) {
        return;
      } else {
        throw error;
      }
    }
  }
}
