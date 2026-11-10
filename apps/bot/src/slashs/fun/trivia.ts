import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  ComponentType,
  InteractionContextType,
  SlashCommandBuilder,
  escapeMarkdown,
} from 'discord.js';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import Client from '../../client/client';
import { Logger } from '../../utils/logger';
import { GAME_TYPES, SCORING } from '../../utils/handlers/games-handler';
import { awardAndAnnounce } from '../../xp/level-up';
import { currentRules } from '../../xp/rules';
import { nextQuestion, TriviaQuestion } from '../../trivia/opentdb';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
import { capitalise, LETTERS, ordinal, triviaQuestionCard, triviaResultCard } from '../../cards/trivia.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

export const ANSWER_MS = 20_000;
const SECONDS = ANSWER_MS / 1000;

/** Channels with a question running: one at a time per channel */
const running = new Set<string>();

const label = (q: TriviaQuestion, i: number) => (q.answers.length === 2 ? q.answers[i] : `${LETTERS[i]}: ${q.answers[i]}`).slice(0, 80);

const buttons = (q: TriviaQuestion, over: boolean) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    q.answers.map((answer, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia:${i}`)
        .setLabel(label(q, i))
        .setStyle(over && answer === q.correct ? ButtonStyle.Success : over ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(over)
    )
  );

/** The result as text: it goes next to the card (names there can't be clicked) and stands alone if the card fails */
export const resultText = (q: TriviaQuestion, answered: number, correctOrder: string[], xp: Map<string, number>) => {
  // Answers come from Open Trivia DB and can hold Markdown ("*NSYNC")
  const head = `The answer was **${escapeMarkdown(q.correct)}**.`;
  if (!answered) return `${head} Nobody answered!`;
  if (!correctOrder.length) return `${head} Nobody got it right.`;
  const places = correctOrder.map((id, i) => `${ordinal(i + 1)} <@${id}>${xp.get(id) ? ` +${xp.get(id)} XP` : ''}`);
  return `${head}\n${places.join(' · ')}`;
};

/** The licence asks for attribution: the card carries it, a text-only message needs it written out */
const ATTRIBUTION_LINE = '\n-# Question from Open Trivia DB (opentdb.com), CC BY-SA 4.0';

/** A card as a Discord attachment, or undefined when it can't be drawn (the message then falls back to text) */
const card = (svg: () => string, name: string) =>
  cardFile(svg(), name).catch((error) => {
    Logger.error(`Failed to draw ${name}`, error);
    return undefined;
  });

export default class Trivia extends BaseSlash {
  constructor() {
    // Deferred in public: fetching the question can take longer than Discord's 3 s, and a "down" reply should be seen
    super('trivia', 'Answer a trivia question: the quickest right answers earn the most XP', SlashDeferTypes.PUBLIC);
  }

  override createInteraction(client: Client) {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: Client, interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const { guildId, channelId } = interaction;
    if (!guildId || !interaction.channel?.isSendable()) {
      await InterActionUtils.editReply(interaction, { content: "I can't ask a question here." });
      return;
    }
    if (running.has(channelId)) {
      await InterActionUtils.editReply(interaction, { content: 'A question is already running here. Answer that one first!' });
      return;
    }
    running.add(channelId);
    try {
      const fetched = await nextQuestion();
      if (!fetched.ok) {
        await InterActionUtils.editReply(interaction, { content: fetched.message });
        return;
      }
      const q = fetched.question;
      const factor = currentRules().trivia[q.difficulty];
      const intro = `🎲 Trivia! ${capitalise(q.difficulty)} question: ×${factor} XP, ${SECONDS} seconds.`;
      const questionCard = await card(() => triviaQuestionCard({ ...q, factor, seconds: SECONDS }, THEMES[DEFAULT_THEME]), 'trivia.png');
      await InterActionUtils.editReply(interaction, {
        content: questionCard ? intro : `${intro}\n**${escapeMarkdown(q.question)}**${ATTRIBUTION_LINE}`,
        // The question is third-party text: it must never ping anyone
        allowedMentions: { parse: [] },
        ...(questionCard && { files: [questionCard] }),
        components: [buttons(q, false)],
      });

      const answers = new Map<string, number>();
      const correctOrder: string[] = [];
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) =>
          i.isButton() && i.customId.startsWith('trivia:') && i.message.interactionMetadata?.id.endsWith(interaction.id) === true,
        componentType: ComponentType.Button,
        time: ANSWER_MS,
      });
      collector.on('collect', (i: ButtonInteraction) => {
        const index = Number(i.customId.slice(7));
        // Recorded before any await, so the order of correct answers is the order of the clicks
        const already = answers.has(i.user.id);
        if (!already) {
          answers.set(i.user.id, index);
          if (q.answers[index] === q.correct) correctOrder.push(i.user.id);
        }
        const content = already ? 'You already answered.' : `Locked in: ${label(q, index)}`;
        void i.reply({ content, ephemeral: true }).catch(() => undefined);
      });
      await new Promise((resolve) => collector.on('end', resolve));
      // Close the answers at once: saving and granting take a moment, and a click in that gap would fail
      await InterActionUtils.editReply(interaction, { components: [buttons(q, true)] });

      const xp = await this.saveAndGrant(client, guildId, q, answers, correctOrder);
      const members = await cardMembers(interaction.guild, correctOrder.slice(0, 5)).catch(() => ({}) as Awaited<ReturnType<typeof cardMembers>>);
      const picks = q.answers.map((_, i) => [...answers.values()].filter((picked) => picked === i).length);
      const resultCard = await card(
        () =>
          triviaResultCard(
            {
              question: q.question,
              answers: q.answers,
              correct: q.correct,
              picks,
              winners: correctOrder.map((id) => ({ ...(members[id] ?? { name: 'Unknown member' }), xp: xp.get(id) })),
            },
            THEMES[DEFAULT_THEME]
          ),
        'trivia-result.png'
      );
      await InterActionUtils.editReply(interaction, {
        content: resultText(q, answers.size, correctOrder, xp) + (resultCard ? '' : ATTRIBUTION_LINE),
        // The winners are named, but not pinged
        allowedMentions: { parse: [] },
        files: resultCard ? [resultCard] : [],
        components: [buttons(q, true)],
      });
    } catch (error) {
      Logger.error('Trivia question failed', error);
      await InterActionUtils.editReply(interaction, { content: 'Something went wrong with that question, sorry!', components: [] }).catch(
        () => undefined
      );
    } finally {
      running.delete(channelId);
    }
  }

  /** Saves the question with everyone's answer, grants the XP and returns what each correct member earned */
  private async saveAndGrant(
    client: Client,
    guildId: string,
    q: TriviaQuestion,
    answers: Map<string, number>,
    correctOrder: string[]
  ): Promise<Map<string, number>> {
    if (!answers.size) return new Map();
    const saved = await client.dataSource.gameResults
      .create({
        data: {
          game_type: { connect: { id: GAME_TYPES.TRIVIA } },
          guild_id: guildId,
          // XP is rebuilt from this, so a recalculation keeps the places and the difficulty
          metadata: { question: q.question, category: q.category, difficulty: q.difficulty, correct: q.correct, correctOrder },
          players: {
            create: [...answers].map(([user_id, index]) => ({
              user_id,
              result: q.answers[index] === q.correct ? SCORING.WIN : SCORING.LOSS,
              move: q.answers[index],
            })),
          },
        },
      })
      .catch((error) => {
        Logger.error('Failed to save trivia result', error);
      });
    if (!saved || !correctOrder.length) return new Map();

    // The SQL grant applies the places, difficulty and daily cap; read back what it gave
    await Promise.all(correctOrder.map((memberId) => awardAndAnnounce(client, guildId, memberId, ['TRIVIA'])));
    const rows = await client.dataSource.xpEvents.findMany({
      where: { key: { in: correctOrder.map((memberId) => `trivia:${saved.id}:${memberId}`) } },
      select: { member_id: true, amount: true },
    });
    return new Map(rows.map((row) => [row.member_id, row.amount]));
  }
}
