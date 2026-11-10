import type { XpSource, XpSourceTotal } from '@nx-stolfo/data-access-voice-stats';

export type XpTileKey = 'voice' | 'messages' | 'streak' | 'games' | 'trivia' | 'bonuses';

/** The card's tiles and the sources each one adds up; the five bonuses share one tile */
const TILES: { key: XpTileKey; label: string; hint: string; sources: XpSource[] }[] = [
  { key: 'voice', label: 'Voice sessions', hint: 'More with more people, staying longer, camera or screen share; a quarter while deafened', sources: ['VOICE'] },
  { key: 'messages', label: 'Messages', hint: 'One message a minute counts', sources: ['MESSAGE'] },
  { key: 'streak', label: 'Streak days', hint: 'A day with 10+ minutes in voice, when the day before had too', sources: ['STREAK'] },
  { key: 'trivia', label: 'Trivia', hint: 'Right answers to /trivia; the quickest earn the most, harder questions more', sources: ['TRIVIA'] },
  { key: 'games', label: 'Games won', hint: 'Rock paper scissors and tic-tac-toe against another member; more for a win streak', sources: ['GAME'] },
  {
    key: 'bonuses',
    label: 'Bonuses',
    hint: 'Starting a call, reconnecting after 30+ days, welcoming a newcomer, voice-hour milestones, a weekly top 3',
    sources: ['STARTER', 'RECONNECT', 'WELCOME', 'MILESTONE', 'WEEKLY'],
  },
];

/** One tile per kind of XP, in a fixed order, zeros included so the card always has the same shape */
export const xpTiles = (sources: XpSourceTotal[]) =>
  TILES.map(({ sources: kinds, ...tile }) => {
    const rows = sources.filter((s) => kinds.includes(s.source));
    return {
      ...tile,
      count: rows.reduce((sum, s) => sum + s.count, 0),
      xp: rows.reduce((sum, s) => sum + s.xp, 0),
    };
  });
