import { duoCard, DuoCardData } from './duo.card';
import { renderPng } from './render';
import { THEMES } from './themes';

const H = 60 * 60 * 1000;

const data = (overrides: Partial<DuoCardData> = {}): DuoCardData => ({
  duo: { togetherMs: 3 * H, aVoiceMs: 12 * H, bVoiceMs: 4 * H, topChannelId: 'vc1' },
  period: 'month',
  members: [{ name: 'Astolfo' }, { name: '<b>Roland</b>' }],
  serverName: 'Paladins',
  topChannelName: 'general & chill',
  ...overrides,
});

describe('duoCard', () => {
  it('shows the time together, both shares and the top channel', () => {
    const svg = duoCard(data(), THEMES.dark);
    expect(svg).toContain('>3h<');
    expect(svg).toContain('together in voice over the past month');
    expect(svg).toContain('Share of Astolfo’s voice time');
    expect(svg).toContain('>25%<');
    expect(svg).toContain('of 12h');
    expect(svg).toContain('>75%<');
    expect(svg).toContain('Most time together in #general &amp; chill');
  });

  it('escapes names', () => {
    const svg = duoCard(data(), THEMES.dark);
    expect(svg).toContain('&lt;b&gt;Roland&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('says so when there was no time together', () => {
    const svg = duoCard(data({ duo: { togetherMs: 0, aVoiceMs: H, bVoiceMs: 0 }, period: 'week' }), THEMES.light);
    expect(svg).toContain('No time together over the past week.');
    expect(svg).not.toContain('Share of');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(duoCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
