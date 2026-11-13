import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { DiscordMember, GeoguessGameResponse } from '@nx-stolfo/api-interfaces';
import { discordDirectory } from '../../../utils/discord-directory';
import { memberOrUnknown } from '../helpers';
import { getMapGame, guess, MapGame, RADIUS_KM } from '../../../../geo/map-games';

type Params = { serverId: string; gameId: string };

/** What one member may see: the answer and the other pins only once guessing has closed */
export const gameView = (game: MapGame, userId: string, token: string, members: Map<string, DiscordMember>): GeoguessGameResponse | undefined => {
  const round = game.current;
  if (!round) return undefined;
  const mine = round.guesses.get(userId);
  const closed = game.phase !== 'guessing';
  let place = 0;
  return {
    round: game.round,
    rounds: game.rounds,
    phase: game.phase,
    endsAt: round.endsAt,
    imageId: round.imageId,
    mapillaryToken: token,
    difficulty: round.difficulty,
    radiusKm: RADIUS_KM[round.difficulty],
    guessCount: round.guesses.size,
    myGuess: mine ? { lat: mine.lat, lon: mine.lon } : null,
    ...(closed &&
      round.ranked && {
        answer: round.answer,
        pins: round.ranked.map((g) => ({
          member: memberOrUnknown(members, g.userId),
          lat: g.lat,
          lon: g.lon,
          km: Math.round(g.km),
          place: g.inside ? ++place : null,
          xp: round.xp?.get(g.userId) ?? 0,
        })),
      }),
    scores: [...game.totals]
      .sort(([, a], [, b]) => b.xp - a.xp || b.inside - a.inside)
      .map(([id, t]) => ({ member: memberOrUnknown(members, id), ...t })),
  };
};

export const getGeoguessGame: RequestHandler<Params> = asyncHandler(async (req, res) => {
  const { serverId, gameId } = req.params;
  const userId = req.user?.id ?? '';
  const game = getMapGame(serverId, gameId);
  if (!game?.current) {
    res.status(404).json({ error: 'This game is over or never existed' });
    return;
  }
  // Opening the game counts as playing: from round 2 the round ends once everyone who opened it guessed
  if (game.phase === 'guessing') game.viewers.add(userId);
  const ids = new Set([...game.totals.keys(), ...(game.current.ranked ?? []).map((g) => g.userId)]);
  const members = await discordDirectory().members(serverId, [...ids]);
  res.send(gameView(game, userId, process.env.MAPILLARY_TOKEN ?? '', members));
});

const REFUSED = {
  closed: [409, 'This round is closed'],
  already: [409, 'You already guessed this round'],
  invalid: [400, 'lat and lon must be numbers on the map'],
} as const;

export const postGeoguessGuess: RequestHandler<Params> = asyncHandler(async (req, res) => {
  const { serverId, gameId } = req.params;
  const game = getMapGame(serverId, gameId);
  if (!game) {
    res.status(404).json({ error: 'This game is over or never existed' });
    return;
  }
  const result = guess(game, req.user?.id ?? '', req.body?.lat, req.body?.lon);
  if (result === 'ok') {
    res.status(204).end();
    return;
  }
  const [status, error] = REFUSED[result];
  res.status(status).json({ error });
});
