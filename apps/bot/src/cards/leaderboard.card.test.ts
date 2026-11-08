import { leaderboardCard, LeaderboardCardData } from './leaderboard.card';
import { renderPng } from './render';
import { THEMES } from './themes';

const data = (overrides: Partial<LeaderboardCardData> = {}): LeaderboardCardData => ({
  serverName: 'Paladins',
  title: 'Most active',
  subtitle: 'Last 7 days',
  footer: 'Page 1/1',
  empty: 'No one was in voice',
  rows: [
    { rank: 1, name: 'Astolfo', value: '17h 45m', fraction: 1 },
    { rank: 2, name: '<script>&"Bradamante"', value: '9h 2m', fraction: 0.5 },
    { rank: 3, name: 'Roland', value: '30s', fraction: 0 },
  ],
  ...overrides,
});

describe('leaderboardCard', () => {
  it('draws a row per entry with its rank, name and value', () => {
    const svg = leaderboardCard(data(), THEMES.dark);
    expect(svg.match(/<rect x="32" y="\d+" width="736" height="56"/g)).toHaveLength(3);
    expect(svg).toContain('>Astolfo<');
    expect(svg).toContain('>17h 45m<');
    expect(svg).toContain('>3<');
  });

  it('escapes names', () => {
    const svg = leaderboardCard(data(), THEMES.dark);
    expect(svg).toContain('&lt;script&gt;&amp;&quot;Bradamante&quot;');
    expect(svg).not.toContain('<script>');
  });

  it('draws the bar only for entries with a value', () => {
    const svg = leaderboardCard(data(), THEMES.dark);
    expect(svg.match(new RegExp(`fill="${THEMES.dark.accent}"/>`, 'g'))?.length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('width="460" height="8"');
    expect(svg).toContain('width="230" height="8"');
  });

  it('shows the empty text when there are no rows', () => {
    const svg = leaderboardCard(data({ rows: [] }), THEMES.light);
    expect(svg).toContain('No one was in voice');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(leaderboardCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
