import { client } from '../..';

export enum GAME_TYPES {
  ROCK_PAPER_SCISSORS = 'rock-paper-scissors',
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
