import { xpTiles } from './xp-card';

describe('xpTiles', () => {
  it('one tile per kind, the bonuses added up, zeros for what has none', () => {
    const tiles = xpTiles([
      { source: 'VOICE', count: 12, xp: 840 },
      { source: 'MESSAGE', count: 30, xp: 60 },
      { source: 'STARTER', count: 2, xp: 30 },
      { source: 'MILESTONE', count: 1, xp: 100 },
    ]);
    expect(tiles.map((t) => [t.key, t.count, t.xp])).toEqual([
      ['voice', 12, 840],
      ['messages', 30, 60],
      ['streak', 0, 0],
      ['games', 0, 0],
      ['bonuses', 3, 130],
    ]);
  });
});
