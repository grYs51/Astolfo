import { client } from '../../client/instance';

export enum GAME_TYPES {
  ROCK_PAPER_SCISSORS = 'rock-paper-scissors',
  /** Against the bot, which cheats: kept apart so it stays out of the win rates */
  ROCK_PAPER_SCISSORS_ASTOLFO = 'rock-paper-scissors-astolfo',
  TIC_TAC_TOE = 'tic-tac-toe',
  /** Against the bot: kept apart so it never earns XP */
  TIC_TAC_TOE_ASTOLFO = 'tic-tac-toe-astolfo',
  /** One question to the channel: a row per member who answered; the order of correct answers is in metadata */
  TRIVIA = 'trivia',
}

export enum SCORING {
  WIN = 1,
  LOSS = 0,
  TIE = 2,
}

const games: { id: GAME_TYPES; name: string }[] = [
  {
    id: GAME_TYPES.ROCK_PAPER_SCISSORS,
    name: 'Rock Paper Scissors',
  },
  {
    id: GAME_TYPES.ROCK_PAPER_SCISSORS_ASTOLFO,
    name: 'Rock Paper Scissors vs Astolfo',
  },
  { id: GAME_TYPES.TIC_TAC_TOE, name: 'Tic-Tac-Toe' },
  { id: GAME_TYPES.TIC_TAC_TOE_ASTOLFO, name: 'Tic-Tac-Toe vs Astolfo' },
  { id: GAME_TYPES.TRIVIA, name: 'Trivia' },
];

export const saveGamesToDb = async () => {
  for (const game of games) {
    await client.dataSource.gameTypes.upsert({
      where: { id: game.id },
      update: {},
      create: game,
    });
  }
};
