import { saveReturnUrl, takeReturnUrl } from './return-url';

// The specs run in node: a Map stands in for the browser's sessionStorage
const store = new Map<string, string>();
Object.assign(globalThis, {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  },
});

describe('the return URL', () => {
  beforeEach(() => store.clear());

  it('comes back once for an in-app path', () => {
    saveReturnUrl('/play/geoguess/1/abc');
    expect(takeReturnUrl()).toBe('/play/geoguess/1/abc');
    expect(takeReturnUrl()).toBeNull();
  });

  it('never keeps another site, the root or the login page', () => {
    for (const url of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/', '/login']) {
      saveReturnUrl(url);
      expect(takeReturnUrl()).toBeNull();
    }
  });
});
