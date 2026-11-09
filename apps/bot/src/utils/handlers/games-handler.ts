import { client } from '../../client/instance';

export enum GAME_TYPES {
  ROCK_PAPER_SCISSORS = 'rock-paper-scissors',
  /** Against the bot, which cheats: kept apart so it stays out of the win rates */
  ROCK_PAPER_SCISSORS_ASTOLFO = 'rock-paper-scissors-astolfo',
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
