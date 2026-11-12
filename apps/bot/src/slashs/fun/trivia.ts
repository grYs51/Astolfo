import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  ComponentType,
  InteractionContextType,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
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
import { CATEGORIES, nextQuestion, TriviaDifficulty, TriviaFilter, TriviaQuestion } from '../../trivia/opentdb';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
import { capitalise, LETTERS, ordinal, seconds, triviaQuestionCard, triviaResultCard, triviaScoreboardCard } from '../../cards/trivia.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

export const ANSWER_MS = 20_000;
const SECONDS = ANSWER_MS / 1000;
/** The pause between rounds, so everyone can read the result */
export const PAUSE_MS = 5_000;
export const MAX_ROUNDS = 10;
const SCOREBOARD_SIZE = 10;

/** One member's score in a question, or summed over a game: XP, correct answers, time spent on those */
export interface Score {
  xp: number;
  correct: number;
  ms: number;
}

/** By XP, then correct answers, then the least time on the right ones */
export const rankScores = (board: Map<string, Score>) => [...board].sort(([, a], [, b]) => b.xp - a.xp || b.correct - a.correct || a.ms - b.ms);

/** The first message edits the deferred reply; once that's done, every next one is a follow-up */
const say = (interaction: ChatInputCommandInteraction<CacheType>, options: InteractionEditReplyOptions) =>
  interaction.replied ? interaction.followUp(options as InteractionReplyOptions) : InterActionUtils.editReply(interaction, options);

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
export const resultText = (
  q: TriviaQuestion,
  answered: number,
  correctOrder: string[],
  xp: Map<string, number>,
  times = new Map<string, number>()
) => {
  // Answers come from Open Trivia DB and can hold Markdown ("*NSYNC")
  const head = `The answer was **${escapeMarkdown(q.correct)}**.`;
  if (!answered) return `${head} Nobody answered!`;
  if (!correctOrder.length) return `${head} Nobody got it right.`;
  const places = correctOrder.map((id, i) => {
    const ms = times.get(id);
    return `${ordinal(i + 1)} <@${id}>${ms !== undefined ? ` ${seconds(ms)}` : ''}${xp.get(id) ? ` +${xp.get(id)} XP` : ''}`;
  });
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
      .addIntegerOption((option) =>
        option.setName('category').setDescription('Only questions from this category').setRequired(false).setChoices(...CATEGORIES)
      )
      .addStringOption((option) =>
        option
          .setName('difficulty')
          .setDescription('Only questions this hard (harder earns more XP)')
          .setRequired(false)
          .setChoices({ name: 'Easy', value: 'easy' }, { name: 'Medium', value: 'medium' }, { name: 'Hard', value: 'hard' })
      )
      .addIntegerOption((option) =>
        option
          .setName('rounds')
          .setDescription(`Questions in a row, with a scoreboard at the end (1–${MAX_ROUNDS})`)
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(MAX_ROUNDS)
      )
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
    const filter: TriviaFilter = {
      category: interaction.options.getInteger('category') ?? undefined,
      difficulty: (interaction.options.getString('difficulty') as TriviaDifficulty | null) ?? undefined,
    };
    const rounds = interaction.options.getInteger('rounds') ?? 1;
    running.add(channelId);
    const board = new Map<string, Score>();
    let played = 0;
    let stopped = '';
    try {
      for (let round = 1; round <= rounds; round++) {
        if (round > 1) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        const result = await this.askQuestion(client, interaction, guildId, filter, rounds > 1 ? `Round ${round}/${rounds}. ` : '');
        if (!result) break;
        played = round;
        for (const [id, score] of result) {
          const total = board.get(id) ?? { xp: 0, correct: 0, ms: 0 };
          board.set(id, { xp: total.xp + score.xp, correct: total.correct + score.correct, ms: total.ms + score.ms });
        }
        if (!result.size && round < rounds) {
          stopped = `Nobody answered round ${round}, so the game stopped there.`;
          break;
        }
      }
    } catch (error) {
      Logger.error('Trivia question failed', error);
      await say(interaction, { content: 'Something went wrong with that question, sorry!', components: [] }).catch(() => undefined);
      stopped = 'Something went wrong, so the game stopped there.';
    }
    // After a failure too: the rounds before it were saved and their XP granted
    try {
      if (rounds > 1 && played > 0) await this.postScoreboard(interaction, board, played, stopped);
    } catch (error) {
      Logger.error('Trivia scoreboard failed', error);
    } finally {
      running.delete(channelId);
    }
  }

  /**
   * One question: ask it, collect the answers, close, save and grant, show the result. Returns each member's
   * score, or undefined when Open Trivia DB couldn't give a question (its message is already shown).
   */
  private async askQuestion(
    client: Client,
    interaction: ChatInputCommandInteraction<CacheType>,
    guildId: string,
    filter: TriviaFilter,
    roundLabel: string
  ): Promise<Map<string, Score> | undefined> {
    const channel = interaction.channel;
    const fetched = await nextQuestion(filter);
    if (!fetched.ok || !channel) {
      await say(interaction, { content: fetched.ok ? "I can't ask a question here." : fetched.message });
      return undefined;
    }
    const q = fetched.question;
    const factor = currentRules().trivia[q.difficulty];
    const intro = `🎲 Trivia! ${roundLabel}${capitalise(q.difficulty)} question: ×${factor} XP, ${SECONDS} seconds.`;
    const questionCard = await card(() => triviaQuestionCard({ ...q, factor, seconds: SECONDS }, THEMES[DEFAULT_THEME]), 'trivia.png');
    const message = await say(interaction, {
      content: questionCard ? intro : `${intro}\n**${escapeMarkdown(q.question)}**${ATTRIBUTION_LINE}`,
      // The question is third-party text: it must never ping anyone
      allowedMentions: { parse: [] },
      ...(questionCard && { files: [questionCard] }),
      components: [buttons(q, false)],
    });
    // Discord lost the interaction (an ignored error): nobody can see the question
    if (!message) return undefined;
    // Answer times count from when the question is on screen
    const shownAt = Date.now();
    // Round 1 is the deferred reply; later rounds are follow-ups, edited by id. Through InterActionUtils, so a
    // question deleted mid-round still saves its answers
    const edit = (options: InteractionEditReplyOptions) => InterActionUtils.editReply(interaction, { ...options, message });

    const answers = new Map<string, number>();
    const times = new Map<string, number>();
    const correctOrder: string[] = [];
    const collector = channel.createMessageComponentCollector({
      filter: (i) => i.isButton() && i.customId.startsWith('trivia:') && i.message.id === message.id,
      componentType: ComponentType.Button,
      time: ANSWER_MS,
    });
    collector.on('collect', (i: ButtonInteraction) => {
      const index = Number(i.customId.slice(7));
      // Recorded before any await, so the order of correct answers is the order of the clicks
      const already = answers.has(i.user.id);
      if (!already) {
        answers.set(i.user.id, index);
        times.set(i.user.id, Date.now() - shownAt);
        if (q.answers[index] === q.correct) correctOrder.push(i.user.id);
      }
      const content = already ? 'You already answered.' : `Locked in: ${label(q, index)}`;
      void i.reply({ content, ephemeral: true }).catch(() => undefined);
    });
    await new Promise((resolve) => collector.on('end', resolve));
    // Close the answers at once: saving and granting take a moment, and a click in that gap would fail
    await edit({ components: [buttons(q, true)] });

    const xp = await this.saveAndGrant(client, guildId, q, answers, times, correctOrder);
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
            winners: correctOrder.map((id) => ({ ...(members[id] ?? { name: 'Unknown member' }), xp: xp.get(id), ms: times.get(id) })),
          },
          THEMES[DEFAULT_THEME]
        ),
      'trivia-result.png'
    );
    await edit({
      content: resultText(q, answers.size, correctOrder, xp, times) + (resultCard ? '' : ATTRIBUTION_LINE),
      // The winners are named, but not pinged
      allowedMentions: { parse: [] },
      files: resultCard ? [resultCard] : [],
      components: [buttons(q, true)],
    });
    const right = new Set(correctOrder);
    return new Map(
      [...answers.keys()].map((id) => [id, right.has(id) ? { xp: xp.get(id) ?? 0, correct: 1, ms: times.get(id) ?? 0 } : { xp: 0, correct: 0, ms: 0 }])
    );
  }

  /** After 2+ rounds: everyone who answered, by XP, then correct answers, then the least time on them */
  private async postScoreboard(interaction: ChatInputCommandInteraction<CacheType>, board: Map<string, Score>, played: number, stopped: string) {
    const ranked = rankScores(board);
    const head = `🏁 Final scores after ${played} round${played === 1 ? '' : 's'}.${stopped ? ` ${stopped}` : ''}`;
    if (!ranked.length) {
      await say(interaction, { content: `${head} Nobody answered!` });
      return;
    }
    const shown = ranked.slice(0, SCOREBOARD_SIZE);
    const members = await cardMembers(interaction.guild, shown.map(([id]) => id)).catch(() => ({}) as Awaited<ReturnType<typeof cardMembers>>);
    const scoreboard = await card(
      () =>
        triviaScoreboardCard(
          { rounds: played, players: shown.map(([id, s]) => ({ ...(members[id] ?? { name: 'Unknown member' }), ...s })) },
          THEMES[DEFAULT_THEME]
        ),
      'trivia-scores.png'
    );
    await say(interaction, {
      content: `${head}\n${shown.map(([id, s], i) => `${ordinal(i + 1)} <@${id}> ${s.correct}/${played}${s.xp ? ` +${s.xp} XP` : ''}`).join(' · ')}`,
      // The players are named, but not pinged
      allowedMentions: { parse: [] },
      files: scoreboard ? [scoreboard] : [],
    });
  }

  /** Saves the question with everyone's answer, grants the XP and returns what each correct member earned */
  private async saveAndGrant(
    client: Client,
    guildId: string,
    q: TriviaQuestion,
    answers: Map<string, number>,
    times: Map<string, number>,
    correctOrder: string[]
  ): Promise<Map<string, number>> {
    if (!answers.size) return new Map();
    const saved = await client.dataSource.gameResults
      .create({
        data: {
          game_type: { connect: { id: GAME_TYPES.TRIVIA } },
          guild_id: guildId,
          // XP is rebuilt from this, so a recalculation keeps the places and the difficulty
          metadata: {
            question: q.question,
            category: q.category,
            difficulty: q.difficulty,
            correct: q.correct,
            correctOrder,
            // Milliseconds from the question showing to each member's click, for /trivia-stats
            answerMs: Object.fromEntries(times),
          },
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
