import { levelUpCard, LevelUpCardData } from './level-up.card';
import { renderPng } from './render';
import { THEMES } from './themes';

const data: LevelUpCardData = { memberName: '<b>Astolfo</b>', serverName: 'Paladins & co', level: 7 };

describe('levelUpCard', () => {
  it('shows the level, the server and the escaped name', () => {
    const svg = levelUpCard(data, THEMES.dark);
    expect(svg).toContain('>Level 7<');
    expect(svg).toContain('on Paladins &amp; co');
    expect(svg).toContain('&lt;b&gt;Astolfo&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(levelUpCard(data, THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
