import {
  ChatInputCommandInteraction,
  CacheType,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  InteractionContextType,
  User,
} from 'discord.js';
import { BaseSlash } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import Client from '../../client/client';
import { Logger } from '../../utils/logger';
import { GAME_TYPES, SCORING } from '../../utils/handlers/games-handler';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
import { rpsCard } from '../../cards/rps.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';
import { awardAndAnnounce } from '../../xp/level-up';

enum GameChoices {
  Rock = 'rock',
  Paper = 'paper',
  Scissors = 'scissors',
}

/** The move that beats each move */
const COUNTER: Record<string, GameChoices> = {
  [GameChoices.Rock]: GameChoices.Paper,
  [GameChoices.Paper]: GameChoices.Scissors,
  [GameChoices.Scissors]: GameChoices.Rock,
};

/**
 * Astolfo's move against a member: it always counters paper and scissors.
 * Rock gets a random move, except 10% of the time Astolfo wins anyway (it's Astolfo).
 */
export const astolfoMove = (userMove: string, random = Math.random): string =>
  userMove !== GameChoices.Rock || random() < 0.1
    ? COUNTER[userMove]
    : Object.values(GameChoices)[Math.floor(random() * 3)];

interface GameOutcome {
  winnerId?: string;
  loserId?: string;
  moves: {
    [userId: string]: string;
  };
  isTie: boolean;
}

export default class RockPaperScissors extends BaseSlash {
  constructor() {
    super('rockpaperscissors', 'Play a game of Rock Paper Scissors');
  }

  override createInteraction(client: Client) {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addUserOption((option) =>
        option
          .setName('opponent')
          .setDescription('The user you want to challenge (or me, if you dare)')
          .setRequired(true)
      )
      .setContexts(InteractionContextType.Guild);
  }

  async slash(
    client: Client,
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    const opponent = interaction.options.get('opponent')?.user;
    const vsBot = opponent?.id === client.user?.id;
    if (!opponent || opponent.id === interaction.user.id || (opponent.bot && !vsBot)) {
      await InterActionUtils.send(
        interaction,
        {
          content: 'Please choose a valid user to challenge!',
        },
        true
      );
      return;
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(GameChoices.Rock)
        .setLabel('🪨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(GameChoices.Paper)
        .setLabel('📄')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(GameChoices.Scissors)
        .setLabel('✂️')
        .setStyle(ButtonStyle.Primary)
    );

    await InterActionUtils.send(interaction, {
      content: vsBot
        ? `${interaction.user}, you challenged me to Rock Paper Scissors! Choose your move:`
        : `${opponent}, you have been challenged to a game of Rock Paper Scissors! Choose your move:`,
      components: [buttons],
    });

    if (!interaction.channel?.isSendable()) return;

    const collector = interaction.channel?.createMessageComponentCollector({
      filter: (i) =>
        i.isButton() &&
        (i.user.id === opponent.id || i.user.id === interaction.user.id) &&
        i.message.interactionMetadata!.id.endsWith(interaction.id),

      componentType: ComponentType.Button,
      time: 60000,
    });

    const choices: { [key: string]: string } = {};
    let outcome: GameOutcome | undefined;

    /** The result as text, for when the card can't be shown */
    const resultText = (o: GameOutcome) =>
      `${interaction.user} chose ${o.moves[interaction.user.id]}, ${opponent} chose ${o.moves[opponent.id]}. ` +
      (o.isTie ? "It's a tie!" : `<@${o.winnerId}> wins!`);

    collector?.on('collect', async (i) => {
      // Acknowledging can fail (Discord's 3s window missed under load); that mustn't lose the game
      const ack = () => i.deferUpdate().catch(() => undefined);

      // Decided before any await, so a re-click while the card renders can't play the game twice
      if (outcome) return void ack();
      choices[i.user.id] = i.customId;
      if (vsBot) choices[opponent.id] = astolfoMove(i.customId);
      if (!choices[interaction.user.id] || !choices[opponent.id]) return void ack();
      const played = (outcome = this.getGameOutcome(
        choices[interaction.user.id],
        choices[opponent.id],
        interaction.user,
        opponent
      ));
      collector.stop('played');

      try {
        await ack();
        // Saved before the card renders (saveGameResult logs its own errors)
        const saved = await this.saveGameResult(client, interaction, played, vsBot ? opponent.id : undefined);
        // Only a win against another member earns XP; not awaited, the card shouldn't wait on it
        if (saved && !vsBot && played.winnerId && interaction.guildId) void awardAndAnnounce(client, interaction.guildId, played.winnerId);

        // The mentions stay as text: an image can't ping
        const members = await cardMembers(interaction.guild, [interaction.user.id, opponent.id]);
        const svg = rpsCard(
          {
            players: [
              { ...members[interaction.user.id], move: played.moves[interaction.user.id] },
              { ...members[opponent.id], move: played.moves[opponent.id] },
            ],
            winner: played.isTie ? undefined : played.winnerId === interaction.user.id ? 0 : 1,
          },
          THEMES[DEFAULT_THEME]
        );
        await InterActionUtils.editReply(interaction, {
          content: `${interaction.user} vs ${opponent}`,
          files: [await cardFile(svg, 'rockpaperscissors.png')],
          components: [],
        });
      } catch (err) {
        Logger.error('Failed to show the rock-paper-scissors result', err);
        // Show the result as text rather than leaving the buttons up
        await InterActionUtils.editReply(interaction, { content: resultText(played), components: [] }).catch(
          () => undefined
        );
      }
    });

    collector?.on('end', async (collected, reason) => {
      if (reason === 'time') {
        await InterActionUtils.editReply(interaction, {
          content: 'Game cancelled - time limit reached!',
          components: [],
        });
      }
    });
  }

  private getGameOutcome(
    userChoice: string,
    opponentChoice: string,
    user: User,
    opponent: User
  ): GameOutcome {
    const moves = {
      [user.id]: userChoice,
      [opponent.id]: opponentChoice,
    };

    if (userChoice === opponentChoice) {
      return {
        isTie: true,
        moves,
      };
    }

    const winningMoves: Record<string, string> = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };

    const userWins = winningMoves[userChoice] === opponentChoice;
    const winner = userWins ? user : opponent;
    const loser = userWins ? opponent : user;

    return {
      winnerId: winner.id,
      loserId: loser.id,
      moves,
      isTie: false,
    };
  }

  private async saveGameResult(
    client: Client,
    interaction: ChatInputCommandInteraction,
    outcome: GameOutcome,
    botId?: string
  ) {
    const players = outcome.isTie
      ? Object.entries(outcome.moves).map(([userId, move]) => ({
          user_id: userId,
          result: SCORING.TIE,
          move,
        }))
      : [
          {
            user_id: outcome.winnerId!,
            result: SCORING.WIN,
            move: outcome.moves[outcome.winnerId!],
          },
          {
            user_id: outcome.loserId!,
            result: SCORING.LOSS,
            move: outcome.moves[outcome.loserId!],
          },
        ];

    return client.dataSource.gameResults
      .create({
        data: {
          game_type: {
            connect: { id: botId ? GAME_TYPES.ROCK_PAPER_SCISSORS_ASTOLFO : GAME_TYPES.ROCK_PAPER_SCISSORS },
          },
          guild_id: interaction.guildId!,
          // Against the bot only the member gets a row (so every row of that type is a member's); its move goes in metadata
          ...(botId && { metadata: { astolfoMove: outcome.moves[botId] } }),
          players: { create: players.filter((player) => player.user_id !== botId) },
        },
      })
      .catch((err) => {
        Logger.error('Failed to save game result', err);
      });
  }
}
