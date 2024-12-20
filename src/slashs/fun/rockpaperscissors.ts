import {
  CommandInteraction,
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

enum GameChoices {
  Rock = 'rock',
  Paper = 'paper',
  Scissors = 'scissors',
}

interface GameOutcome {
  result: string;
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
          .setDescription('The user you want to challenge')
          .setRequired(true)
      )
      .setContexts(InteractionContextType.Guild);
  }

  async slash(
    client: Client,
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    const opponent = interaction.options.get('opponent')?.user;
    if (!opponent || opponent.id === interaction.user.id || opponent.bot) {
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
      content: `${opponent}, you have been challenged to a game of Rock Paper Scissors! Choose your move:`,
      components: [buttons],
    });

    const filter = (i: any) =>
      i.user.id === interaction.user.id || i.user.id === opponent.id;

    if (!interaction.channel?.isSendable()) return;

    const collector = interaction.channel?.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 60000,
    });

    const choices: { [key: string]: string } = {};

    collector?.on('collect', async (i) => {
      // Store player's choice
      choices[i.user.id] = i.customId;
      await i.deferUpdate();

      // Check if both players have made their choices
      if (choices[interaction.user.id] && choices[opponent.id]) {
        const userChoice = choices[interaction.user.id];
        const opponentChoice = choices[opponent.id];

        // Determine winner
        const outcome = this.getGameOutcome(
          userChoice,
          opponentChoice,
          interaction.user,
          opponent
        );

        // Show results
        await InterActionUtils.editReply(interaction, {
          content: `${interaction.user} chose ${userChoice}, ${opponent} chose ${opponentChoice}. ${outcome.result}`,
          components: [],
        });

        // Save game results
        await this.saveGameResult(client, interaction, outcome);

        collector.stop();
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
        result: "It's a tie!",
        isTie: true,
        moves,
      };
    }

    const winningMoves = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };

    const userWins = winningMoves[userChoice] === opponentChoice;
    const winner = userWins ? user : opponent;
    const loser = userWins ? opponent : user;

    return {
      result: `${winner} wins!`,
      winnerId: winner.id,
      loserId: loser.id,
      moves,
      isTie: false,
    };
  }

  private async saveGameResult(
    client: Client,
    interaction: CommandInteraction,
    outcome: GameOutcome
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
          game_type: { connect: { id: GAME_TYPES.ROCK_PAPER_SCISSORS } },
          guild_id: interaction.guildId!,
          players: { create: players },
        },
      })
      .catch((err) => {
        Logger.error('Failed to save game result', err);
      });
  }
}
