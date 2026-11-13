import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps paths on this site', () => {
    expect(safeReturnUrl('/play/geoguess/1/abc')).toBe('/play/geoguess/1/abc');
    expect(safeReturnUrl('/overview?x=1')).toBe('/overview?x=1');
  });

  it('drops other sites, schemes and nothing', () => {
    for (const url of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'overview', '', null, undefined]) {
      expect(safeReturnUrl(url)).toBeNull();
    }
  });
});
