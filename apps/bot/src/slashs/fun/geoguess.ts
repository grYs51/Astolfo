import { CacheType, ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { nextGeoQuestion } from '../../geo/mapillary';
import { TriviaDifficulty, TriviaFetch } from '../../trivia/opentdb';
import Trivia, { MAX_ROUNDS } from './trivia';

/**
 * Trivia with a street photo from Mapillary: which country is this? Everything else is trivia's: the
 * places, rounds, scoreboard, TRIVIA XP and its daily cap. Picking a neighbouring country is a near miss.
 */
export default class GeoGuess extends Trivia {
  /** Longer than trivia: looking at the photo is the fun part */
  protected override answerMs = 30_000;
  protected override title = 'GeoGuess';

  constructor() {
    super('geoguess', 'Guess the country from a street photo: a neighbouring country still earns a little XP');
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName('difficulty')
          .setDescription('Hard puts neighbouring countries among the answers (and earns more XP)')
          .setRequired(false)
          .setChoices({ name: 'Easy', value: 'easy' }, { name: 'Medium', value: 'medium' }, { name: 'Hard', value: 'hard' })
      )
      .addIntegerOption((option) =>
        option
          .setName('rounds')
          .setDescription(`Photos in a row, with a scoreboard at the end (1–${MAX_ROUNDS})`)
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(MAX_ROUNDS)
      )
      .setContexts(InteractionContextType.Guild);
  }

  protected override questions(interaction: ChatInputCommandInteraction<CacheType>): () => Promise<TriviaFetch> {
    const difficulty = (interaction.options.getString('difficulty') as TriviaDifficulty | null) ?? undefined;
    return () => nextGeoQuestion(difficulty);
  }
}
