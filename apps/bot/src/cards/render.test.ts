import { escapeXml, renderPng, truncate } from './render';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('renderPng', () => {
  it('renders an SVG with text to a PNG', async () => {
    const png = await renderPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="28" font-family="Inter">Hi</text></svg>'
    );
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });
});

describe('escapeXml', () => {
  it('escapes every XML special character', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;'
    );
  });

  it('drops characters XML does not allow, so the card still renders', async () => {
    const name = 'A\u0000s\u0001t\u000Bo￾l\tfo';
    expect(escapeXml(name)).toBe('Astol\tfo');
    const png = await renderPng(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="28">${escapeXml(name)}</text></svg>`
    );
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });
});

describe('truncate', () => {
  it('keeps short text and cuts long text with an ellipsis', () => {
    expect(truncate('Astolfo', 10)).toBe('Astolfo');
    expect(truncate('Astolfo the paladin', 8)).toBe('Astolfo…');
  });

  it('does not split emoji', () => {
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…');
  });
});
