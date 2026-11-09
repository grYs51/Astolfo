import { avatarSvg, cardImageUrl, fetchImage } from './avatars';
import { THEMES } from './themes';

jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn() } }));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as never;
});

describe('cardImageUrl', () => {
  it('asks the Discord CDN for a small static PNG', () => {
    expect(cardImageUrl('https://cdn.discordapp.com/avatars/1/abc.webp')).toBe('https://cdn.discordapp.com/avatars/1/abc.png?size=128');
    expect(cardImageUrl('https://cdn.discordapp.com/avatars/1/a_abc.gif')).toBe('https://cdn.discordapp.com/avatars/1/a_abc.png?size=128');
    expect(cardImageUrl('https://cdn.discordapp.com/avatars/1/abc.webp?size=1024')).toBe('https://cdn.discordapp.com/avatars/1/abc.png?size=128');
    expect(cardImageUrl('https://cdn.discordapp.com/embed/avatars/3.png')).toBe('https://cdn.discordapp.com/embed/avatars/3.png');
    expect(cardImageUrl(null)).toBeUndefined();
  });
});

describe('fetchImage', () => {
  it('returns a data URI with the response type', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    );
    expect(await fetchImage('https://cdn/a.png')).toBe('data:image/png;base64,AQID');
  });

  it('returns undefined without a URL, on an HTTP error or when the fetch fails', async () => {
    expect(await fetchImage(undefined)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }));
    expect(await fetchImage('https://cdn/a.png')).toBeUndefined();

    fetchMock.mockRejectedValue(new Error('timeout'));
    expect(await fetchImage('https://cdn/a.png')).toBeUndefined();
  });
});

describe('avatarSvg', () => {
  const base = { id: 'a', x: 0, y: 0, size: 40, theme: THEMES.dark };

  it('clips the image to a circle', () => {
    const svg = avatarSvg({ ...base, name: 'Astolfo', image: 'data:image/png;base64,AQID' });
    expect(svg).toContain('<clipPath id="a">');
    expect(svg).toContain('href="data:image/png;base64,AQID"');
  });

  it('draws the escaped first letter without an image', () => {
    expect(avatarSvg({ ...base, name: ' roland' })).toContain('>R</text>');
    expect(avatarSvg({ ...base, name: '<x>' })).toContain('>&lt;</text>');
  });
});
