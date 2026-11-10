import XpSlash, { xpEmbed } from './xp';

test('level, the bar to the next one and the recent rows', () => {
  const at = new Date('2026-11-10T12:00:00Z');
  const embed = xpEmbed('Kai', { xp: 1250, level: 5, levelXp: 1000, nextLevelXp: 1500 }, [
    { amount: 70, note: '60 min in #general: 60 min with 2 others', created_at: at },
  ]).toJSON();
  expect(embed.title).toBe('Kai · level 5');
  expect(embed.description).toContain('▰▰▰▰▰▰▱▱▱▱▱▱ 250 / 500 XP');
  expect(embed.description).toContain('**1,250 XP** in total, 250 to level 6');
  expect(embed.description).toContain('`+70` 60 min in #general: 60 min with 2 others · <t:' + at.getTime() / 1000 + ':R>');
});

test('no XP yet', () => {
  expect(xpEmbed('Kai', { xp: 0, level: 0, levelXp: 0, nextLevelXp: 100 }, []).toJSON().description).toContain('No XP yet');
});

test('the command definition passes Discord’s validation', () => {
  expect(new XpSlash().createInteraction().toJSON().options?.map((o) => o.name)).toEqual(['user']);
});
