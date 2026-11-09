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

enum GameChoices {
  Rock = 'rock',
  Paper = 'paper',
  Scissors = 'scissors',
}

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
          .setDescription('The user you want to challenge')
          .setRequired(true)
      )
      .setContexts(InteractionContextType.Guild);
  }

  async slash(
    client: Client,
    interaction: ChatInputCommandInteraction<CacheType>
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
        await this.saveGameResult(client, interaction, played);

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
