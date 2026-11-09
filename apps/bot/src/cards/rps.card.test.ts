import { renderPng } from './render';
import { rpsCard, RpsCardData } from './rps.card';
import { THEMES } from './themes';

const data = (overrides: Partial<RpsCardData> = {}): RpsCardData => ({
  players: [
    { name: 'Astolfo', move: 'rock' },
    { name: '<b>Roland</b>', move: 'scissors' },
  ],
  winner: 0,
  ...overrides,
});

describe('rpsCard', () => {
  it('shows both moves and the winner', () => {
    const svg = rpsCard(data(), THEMES.dark);
    expect(svg).toContain('>Rock<');
    expect(svg).toContain('>Scissors<');
    expect(svg).toContain('>Astolfo wins!<');
    expect(svg.match(/stroke=/g)).toHaveLength(1); // only the winner's panel is outlined
  });

  it('can be won by the opponent', () => {
    const svg = rpsCard(data({ winner: 1 }), THEMES.dark);
    expect(svg).toContain('&lt;b&gt;Roland&lt;/b&gt; wins!');
  });

  it('says so on a tie, with no winner outlined', () => {
    const svg = rpsCard(data({ winner: undefined }), THEMES.light);
    expect(svg).toContain('It’s a tie!');
    expect(svg).not.toContain('stroke=');
  });

  it('escapes names', () => {
    expect(rpsCard(data(), THEMES.dark)).not.toContain('<b>');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(rpsCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
