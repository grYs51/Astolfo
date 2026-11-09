import { DashboardPeriod, DiscordMember } from './voice-stats.dto';

export type RpsMove = 'rock' | 'paper' | 'scissors';

export interface GameRecord {
  wins: number;
  losses: number;
  ties: number;
}

export interface GameLeaderboardEntry extends GameRecord {
  member: DiscordMember;
  games: number;
  /** wins / games, 0–1 */
  winRate: number;
}

/** Two players and how their games went (a's point of view) */
export interface GameMatchup {
  a: DiscordMember;
  b: DiscordMember;
  games: number;
  aWins: number;
  bWins: number;
  ties: number;
}

/** Rock-paper-scissors in a server (GET …/:serverId/games) */
export interface ServerGames {
  period: DashboardPeriod;
  /** Games and players, hidden members included */
  games: number;
  players: number;
  /** Best win rate first, at least 3 games, top 10 */
  leaderboard: GameLeaderboardEntry[];
  /** Most-played pairs, top 5 */
  matchups: GameMatchup[];
  vsAstolfo: AstolfoGames;
}

/** Games against the bot, which cheats, so they're kept out of the leaderboard and records above */
export interface AstolfoGames extends GameRecord {
  /** Games and players, hidden members included; wins, losses and ties are the members' */
  games: number;
  players: number;
  /** Best win rate against Astolfo first, at least 3 games, top 10 */
  leaderboard: GameLeaderboardEntry[];
}

/** One member's rock-paper-scissors record (GET …/:serverId/users/:userId/games) */
export interface UserGames extends GameRecord {
  period: DashboardPeriod;
  games: number;
  favouriteMove: RpsMove | null;
  /** The opponents' move that beat them most often */
  nemesisMove: RpsMove | null;
  /** Their record against the viewer; null on your own profile */
  headToHead: (GameRecord & { games: number }) | null;
  /** Their record against the bot (not counted above) */
  vsAstolfo: GameRecord & { games: number };
}
