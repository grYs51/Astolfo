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
  User,
} from 'discord.js';
import { BaseSlash } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import Client from '../../client/client';
import { Logger } from '../../utils/logger';
import { GAME_TYPES, SCORING } from '../../utils/handlers/games-handler';
import { awardAndAnnounce } from '../../xp/level-up';

export type Mark = 'X' | 'O';
export type Board = (Mark | null)[];
export type Difficulty = 'easy' | 'normal' | 'impossible';
export type Result = { mark: Mark; line: number[] } | 'draw' | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const EMOJI: Record<Mark, string> = { X: '❌', O: '⭕' };
const other = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X');
const free = (board: Board) => board.flatMap((cell, i) => (cell ? [] : [i]));
const played = (board: Board, cell: number, mark: Mark) => board.map((c, i) => (i === cell ? mark : c));

/** The winning mark and line, 'draw' on a full board, or null while the game goes on */
export const winner = (board: Board): Result => {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a] as Mark, line };
  }
  return board.every(Boolean) ? 'draw' : null;
};

// A position's value never changes and there are only about 5.5k, so each is searched once per process:
// without this, Astolfo's first reply searches the whole tree and blocks the event loop for up to ~100 ms
const values = new Map<string, number>();

/** The board's value for the mark to move: negative when the last move won, more so the sooner it came */
const negamax = (board: Board, mark: Mark): number => {
  const key = board.map((cell) => cell ?? '.').join('') + mark;
  const known = values.get(key);
  if (known !== undefined) return known;
  const result = winner(board);
  const value =
    result === 'draw'
      ? 0
      : result
        ? -(1 + free(board).length)
        : Math.max(...free(board).map((cell) => -negamax(played(board, cell, mark), other(mark))));
  values.set(key, value);
  return value;
};

/** The best cell for `mark` (minimax; 9 cells is small enough to search it all) */
export const bestMove = (board: Board, mark: Mark): number => {
  let best = -Infinity;
  let move = -1;
  for (const cell of free(board)) {
    const value = -negamax(played(board, cell, mark), other(mark));
    if (value > best) [best, move] = [value, cell];
  }
  return move;
};

/** Astolfo's cell: easy plays at random, normal plays the best move except 1 move in 4, impossible never slips */
export const astolfoMove = (board: Board, difficulty: Difficulty, random = Math.random): number => {
  const cells = free(board);
  const slip = difficulty === 'easy' || (difficulty === 'normal' && random() < 0.25);
  return slip ? cells[Math.floor(random() * cells.length)] : bestMove(board, 'O');
};

/** The board as three rows of buttons; filled cells (and every cell once it's over) are disabled */
const grid = (board: Board, result: Result) =>
  [0, 1, 2].map((row) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      [0, 1, 2].map((col) => {
        const i = row * 3 + col;
        const cell = board[i];
        const button = new ButtonBuilder()
          .setCustomId(`ttt:${i}`)
          .setStyle(
            result && result !== 'draw' && result.line.includes(i) ? ButtonStyle.Success : ButtonStyle.Secondary
          )
          .setDisabled(Boolean(cell || result));
        return cell ? button.setEmoji(EMOJI[cell]) : button.setLabel('·');
      })
    )
  );

export default class TicTacToe extends BaseSlash {
  constructor() {
    super('tictactoe', 'Play a game of tic-tac-toe');
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
      .addStringOption((option) =>
        option
          .setName('difficulty')
          .setDescription('How hard I play, when you challenge me (default: normal)')
          .addChoices(
            { name: 'Easy', value: 'easy' },
            { name: 'Normal', value: 'normal' },
            { name: 'Impossible', value: 'impossible' }
          )
      )
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: Client, interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const opponent = interaction.options.get('opponent')?.user;
    const difficulty = (interaction.options.get('difficulty')?.value as Difficulty | undefined) ?? 'normal';
    const vsBot = opponent?.id === client.user?.id;
    const guildId = interaction.guildId;
    if (!guildId || !opponent || opponent.id === interaction.user.id || (opponent.bot && !vsBot)) {
      await InterActionUtils.send(interaction, { content: 'Please choose a valid user to challenge!' }, true);
      return;
    }

    const players: Record<Mark, User> = { X: interaction.user, O: opponent };
    const moves: Record<Mark, number[]> = { X: [], O: [] };
    let board: Board = Array(9).fill(null);
    let turn: Mark = 'X';
    let result: Result = null;

    const status = () => {
      if (result === 'draw') return `${EMOJI.X} ${players.X} vs ${EMOJI.O} ${players.O}: it's a draw!`;
      if (result) {
        const taunt = vsBot ? (result.mark === 'O' ? ' Better luck next time~' : ' No way... you beat me!') : '';
        return `${EMOJI.X} ${players.X} vs ${EMOJI.O} ${players.O}: ${players[result.mark]} wins!${taunt}`;
      }
      const intro = vsBot ? `${players.X}, you challenged me to tic-tac-toe (${difficulty})!` : `${players.O}, ${players.X} challenged you to tic-tac-toe!`;
      return `${intro}\n${EMOJI.X} ${players.X} vs ${EMOJI.O} ${players.O}. ${EMOJI[turn]} ${players[turn]}, your move.`;
    };

    const message = await InterActionUtils.send(interaction, { content: status(), components: grid(board, result) });
    // Discord refused the reply (send already ignored the error): there's no board to play on
    if (!message) return;

    // Collected on the reply itself: it only sees this board's buttons and needs no cached channel
    // (a private thread the bot hasn't joined would otherwise post a board nobody can play)
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      // A plain timer, restarted on each move: `idle` would also restart on clicks that play nothing
      time: 60_000,
    });

    const play = (mark: Mark, cell: number) => {
      board = played(board, cell, mark);
      moves[mark].push(cell);
      turn = other(mark);
      return winner(board);
    };

    collector.on('collect', async (i: ButtonInteraction) => {
      const cell = Number(i.customId.slice(4));
      // Decided before any await, so a double click can't play a move (or save the game) twice
      if (result || board[cell] !== null) return void i.deferUpdate().catch(() => undefined);
      if (i.user.id !== players[turn].id) {
        const notice = i.user.id === players[other(turn)].id ? "It's not your turn." : "This isn't your game.";
        return void i.reply({ content: notice, ephemeral: true }).catch(() => undefined);
      }
      collector.resetTimer();
      result = play(turn, cell);
      if (!result && vsBot) result = play('O', astolfoMove(board, difficulty));
      const finished = result;
      const view = { content: status(), components: grid(board, result) };
      if (finished) collector.stop('played');

      // update acknowledges and edits in one call; if Discord's 3s window was missed, edit the reply instead
      await i.update(view).catch(() => InterActionUtils.editReply(interaction, view).catch(() => undefined));
      if (!finished) return;

      const saved = await this.saveGameResult(client, guildId, finished, players, moves, vsBot, difficulty);
      // Only a win against another member earns XP
      if (saved && !vsBot && finished !== 'draw') {
        void awardAndAnnounce(client, guildId, players[finished.mark].id, ['GAME']);
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        await InterActionUtils.editReply(interaction, {
          content: `Game cancelled: ${players[turn]} didn't move for a minute.`,
          components: [],
        }).catch(() => undefined);
      }
    });
  }

  private async saveGameResult(
    client: Client,
    guildId: string,
    result: Exclude<Result, null>,
    players: Record<Mark, User>,
    moves: Record<Mark, number[]>,
    vsBot: boolean,
    difficulty: Difficulty
  ) {
    const scoreOf = (mark: Mark) => (result === 'draw' ? SCORING.TIE : result.mark === mark ? SCORING.WIN : SCORING.LOSS);
    // Against the bot only the member gets a row, the same as rock-paper-scissors; Astolfo's moves go in metadata
    const marks: Mark[] = vsBot ? ['X'] : ['X', 'O'];
    return client.dataSource.gameResults
      .create({
        data: {
          game_type: { connect: { id: vsBot ? GAME_TYPES.TIC_TAC_TOE_ASTOLFO : GAME_TYPES.TIC_TAC_TOE } },
          guild_id: guildId,
          ...(vsBot && { metadata: { astolfoMoves: moves.O.join(','), difficulty } }),
          players: {
            create: marks.map((mark) => ({ user_id: players[mark].id, result: scoreOf(mark), move: moves[mark].join(',') })),
          },
        },
      })
      .catch((err) => {
        Logger.error('Failed to save tic-tac-toe result', err);
      });
  }
}
