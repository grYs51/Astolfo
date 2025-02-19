import { RESTJSONErrorCodes as DiscordApiErrors } from 'discord-api-types/v9';
import {
  BaseMessageOptions,
  DiscordAPIError,
  EmbedBuilder,
  EmojiResolvable,
  Message,
  MessageEditOptions,
  MessageReaction,
  PartialGroupDMChannel,
  StartThreadOptions,
  TextBasedChannel,
  ThreadChannel,
  User,
} from 'discord.js';

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

export class MessageUtils {
  public static async send(
    target: User | TextBasedChannel,
    content: string | EmbedBuilder | BaseMessageOptions
  ): Promise<Message | void> {
    if (target instanceof PartialGroupDMChannel) return;
    try {
      let options: BaseMessageOptions;

      if (typeof content === 'string') {
        options = { content };
      } else if (content instanceof EmbedBuilder) {
        options = { embeds: [content] };
      } else {
        options = content;
      }
      return await target.send(options);
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

  public static async reply(
    msg: Message,
    content: string | EmbedBuilder | BaseMessageOptions
  ): Promise<Message | void> {
    try {
      let options: BaseMessageOptions;

      if (typeof content === 'string') {
        options = { content };
      } else if (content instanceof EmbedBuilder) {
        options = { embeds: [content] };
      } else {
        options = content;
      }
      return await msg.reply(options);
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

  public static async edit(
    msg: Message,
    content: string | EmbedBuilder | MessageEditOptions
  ): Promise<Message | void> {
    try {
      let options: MessageEditOptions;

      if (typeof content === 'string') {
        options = { content };
      } else if (content instanceof EmbedBuilder) {
        options = { embeds: [content] };
      } else {
        options = content;
      }
      return await msg.edit(options);
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

  public static async react(
    msg: Message,
    emoji: EmojiResolvable
  ): Promise<MessageReaction | void> {
    try {
      return await msg.react(emoji);
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

  public static async pin(
    msg: Message,
    pinned = true
  ): Promise<Message | void> {
    try {
      return pinned ? await msg.pin() : await msg.unpin();
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

  public static async startThread(
    msg: Message,
    options: StartThreadOptions
  ): Promise<ThreadChannel | void> {
    try {
      return await msg.startThread(options);
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

  public static async delete(msg: Message): Promise<Message | void> {
    try {
      return await msg.delete();
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
