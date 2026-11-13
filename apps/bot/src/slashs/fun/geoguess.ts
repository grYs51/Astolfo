import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CacheType, ChatInputCommandInteraction, InteractionContextType, InteractionEditReplyOptions, SlashCommandBuilder } from 'discord.js';
import { DOWN_MESSAGE, nextGeoQuestion } from '../../geo/mapillary';
import { closeRound, createMapGame, endMapGame, MAP_ANSWER_MS, MapGame, playRound, RADIUS_KM, RankedGuess, rankGuesses } from '../../geo/map-games';
import { TriviaDifficulty, TriviaFetch, TriviaQuestion } from '../../trivia/opentdb';
import Client from '../../client/client';
import { InterActionUtils } from '../../utils/interaction-utils';
import { SCORING } from '../../utils/handlers/games-handler';
import { currentRules } from '../../xp/rules';
import { cardMembers } from '../../cards/members';
import { capitalise, ordinal, triviaQuestionCard, triviaResultCard } from '../../cards/trivia.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';
import { dashboardUrl } from '../../stats/messages';
import Trivia, { attributionLine, card, geoLinks, MAX_ROUNDS, photoFile, say, Score } from './trivia';

const MAP_QUESTION = 'Where is this?';
/** How often the "N guessed" count on the question is refreshed */
const COUNT_EVERY_MS = 10_000;

/** The map game of each running `/geoguess mode:map`; the command object is shared, so it can't be a field */
const mapGames = new WeakMap<ChatInputCommandInteraction, MapGame>();

const playButton = (url: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Play on the dashboard').setURL(url));

const hasSpot = (fetched: TriviaFetch) => fetched.ok && fetched.question.geo?.lat !== undefined && fetched.question.geo.lon !== undefined;

/** The places with their distance, then who was too far; nobody is pinged */
export const mapResultText = (q: TriviaQuestion, ranked: RankedGuess[], xp: Map<string, number>, radiusKm: number) => {
  const head = `It was **${q.correct}**.${q.geo ? geoLinks(q.geo) : ''}`;
  if (!ranked.length) return `${head} Nobody guessed!`;
  const km = (g: RankedGuess) => `${Math.round(g.km)} km`;
  const inside = ranked.filter((g) => g.inside);
  const outside = ranked.filter((g) => !g.inside);
  const places = inside.length
    ? inside.map((g, i) => `${ordinal(i + 1)} <@${g.userId}> ${km(g)}${xp.get(g.userId) ? ` +${xp.get(g.userId)} XP` : ''}`).join(' · ')
    : `Nobody was within ${radiusKm} km.`;
  const far = outside.length ? `\nFurther than ${radiusKm} km: ${outside.map((g) => `<@${g.userId}> ${km(g)}`).join(' · ')}` : '';
  return `${head}\n${places}${far}`;
};

/**
 * Trivia with a street photo from Mapillary: which country is this? Everything else is trivia's: the
 * places, rounds, scoreboard, TRIVIA XP and its daily cap. Picking a neighbouring country is a near miss.
 * In map mode the guess is a pin on the dashboard instead, and the closest pins within a radius are the places.
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
          .setDescription('Hard puts neighbouring countries among the answers, or a smaller radius on the map (more XP)')
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
      .addStringOption((option) =>
        option
          .setName('mode')
          .setDescription('Buttons in Discord, or walk around the street and drop a pin on the dashboard')
          .setRequired(false)
          .setChoices({ name: 'Buttons', value: 'buttons' }, { name: 'Map (on the dashboard)', value: 'map' })
      )
      .setContexts(InteractionContextType.Guild);
  }

  protected override questions(interaction: ChatInputCommandInteraction<CacheType>): () => Promise<TriviaFetch> {
    const difficulty = (interaction.options.getString('difficulty') as TriviaDifficulty | null) ?? undefined;
    return () => nextGeoQuestion(difficulty);
  }

  override async slash(client: Client, interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    if (interaction.options.getString('mode') !== 'map') return super.slash(client, interaction);
    const game = createMapGame(interaction.guildId ?? '', interaction.options.getInteger('rounds') ?? 1);
    mapGames.set(interaction, game);
    try {
      await super.slash(client, interaction);
    } finally {
      endMapGame(game);
    }
  }

  /** A map round: the photo and a Play link in Discord, pins on the dashboard, the closest within the radius win */
  protected override async askQuestion(
    client: Client,
    interaction: ChatInputCommandInteraction<CacheType>,
    guildId: string,
    next: () => Promise<TriviaFetch>,
    roundLabel: string
  ): Promise<Map<string, Score> | undefined> {
    const game = mapGames.get(interaction);
    if (!game) return super.askQuestion(client, interaction, guildId, next, roundLabel);
    const url = dashboardUrl(`/play/geoguess/${guildId}/${game.id}`);
    if (!url) {
      await say(interaction, { content: "GeoGuess on the map needs the dashboard, and this bot doesn't have one set up." });
      return undefined;
    }
    let fetched = await next();
    // A photo without a location can't be scored on a map: try one more
    if (fetched.ok && !hasSpot(fetched)) fetched = await next();
    if (!fetched.ok || !hasSpot(fetched) || !interaction.channel) {
      await say(interaction, { content: fetched.ok ? DOWN_MESSAGE : fetched.message });
      return undefined;
    }
    const q = { ...fetched.question, question: MAP_QUESTION, answers: [] };
    const geo = q.geo as NonNullable<TriviaQuestion['geo']> & { lat: number; lon: number };
    const factor = currentRules().trivia[q.difficulty];
    const radiusKm = RADIUS_KM[q.difficulty];
    const secs = MAP_ANSWER_MS / 1000;
    const intro = `🗺️ GeoGuess on the map! ${roundLabel}${capitalise(q.difficulty)}: within ${radiusKm} km counts, ×${factor} XP, ${secs} seconds.`;
    const questionCard = await card(() => triviaQuestionCard({ ...q, factor, seconds: secs }, THEMES[DEFAULT_THEME]), 'trivia.png');
    // Without the card the text carries the photo's licence line, also after the "N guessed" edits
    const asked = (count: string) => `${intro}${count}${questionCard ? '' : attributionLine(q, false)}`;
    const button = playButton(url);
    const message = await say(interaction, {
      content: asked(''),
      allowedMentions: { parse: [] },
      files: [questionCard ?? photoFile(geo)],
      components: [button],
    });
    if (!message) return undefined;
    const edit = (options: InteractionEditReplyOptions) => InterActionUtils.editReply(interaction, { ...options, message });

    const answer = { country: q.correct, lat: geo.lat, lon: geo.lon };
    const closed = playRound(game, { imageId: geo.imageId, difficulty: q.difficulty, answer }, MAP_ANSWER_MS);
    let counted = 0;
    const counter = setInterval(() => {
      const n = game.current?.guesses.size ?? 0;
      if (n === counted) return;
      counted = n;
      void edit({ content: asked(` ${n} guessed so far.`) }).catch(() => undefined);
    }, COUNT_EVERY_MS);
    await closed;
    clearInterval(counter);

    const ranked = rankGuesses(game.current?.guesses ?? new Map(), answer, radiusKm);
    const inside = ranked.filter((g) => g.inside);
    const xp = await this.saveAndGrant(
      client,
      guildId,
      {
        question: MAP_QUESTION,
        category: q.category,
        difficulty: q.difficulty,
        correct: q.correct,
        // The pins within the radius, closest first: trivia's places, so the XP grant needs no change
        correctOrder: inside.map((g) => g.userId),
        answerMs: Object.fromEntries(ranked.map((g) => [g.userId, g.ms])),
        imageId: geo.imageId,
        country: geo.country,
        lat: geo.lat,
        lon: geo.lon,
        mode: 'map',
        radiusKm,
        km: Object.fromEntries(ranked.map((g) => [g.userId, Math.round(g.km)])),
      },
      ranked.map((g) => ({ user_id: g.userId, result: g.inside ? SCORING.WIN : SCORING.LOSS, move: `${g.lat.toFixed(4)},${g.lon.toFixed(4)}` })),
      inside.map((g) => g.userId)
    );
    closeRound(game, ranked, xp);

    const members = await cardMembers(
      interaction.guild,
      inside.slice(0, 5).map((g) => g.userId)
    ).catch(() => ({}) as Awaited<ReturnType<typeof cardMembers>>);
    const resultCard = await card(
      () =>
        triviaResultCard(
          {
            question: MAP_QUESTION,
            answers: [],
            correct: q.correct,
            picks: [],
            winners: inside.map((g) => ({ ...(members[g.userId] ?? { name: 'Unknown member' }), xp: xp.get(g.userId), km: g.km })),
            geo,
            map: { radiusKm, answered: ranked.length },
          },
          THEMES[DEFAULT_THEME]
        ),
      'trivia-result.png'
    );
    await edit({
      content: mapResultText(q, ranked, xp, radiusKm) + (resultCard ? '' : attributionLine(q)),
      allowedMentions: { parse: [] },
      files: resultCard ? [resultCard] : [],
      components: [button],
    });
    return new Map(ranked.map((g) => [g.userId, { xp: xp.get(g.userId) ?? 0, correct: g.inside ? 1 : 0, ms: g.inside ? g.ms : 0 }]));
  }
}
