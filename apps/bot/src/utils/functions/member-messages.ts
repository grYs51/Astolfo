import { escapeMarkdown, MessageCreateOptions } from 'discord.js';

// split/join rather than replace: a name like `$&` must not be read as a replacement pattern
const fill = (template: string, value: string) => template.split('@member').join(value);

/** The welcome post; an empty message falls back to today's `Welcome @member` */
export const welcomePost = (template: string, memberId: string): MessageCreateOptions => ({
  content: fill(template || 'Welcome @member', `<@${memberId}>`),
  // Whoever wrote the message may not be allowed to ping @everyone or roles; the bot might be
  allowedMentions: { users: [memberId] },
});

/** The goodbye post, or undefined when the message is empty (goodbye off) */
export const goodbyePost = (
  template: string,
  displayName: string
): MessageCreateOptions | undefined =>
  template
    ? { content: fill(template, escapeMarkdown(displayName)), allowedMentions: { parse: [] } }
    : undefined;
