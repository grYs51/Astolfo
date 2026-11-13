/**
 * Where to go after logging in. Kept in sessionStorage because the Discord
 * login leaves the app and comes back to the site root. Same tab, same
 * origin, so it survives the round trip. Storage can be missing or throw
 * (private mode, blocked site data): then the user lands on the home page.
 */
const KEY = 'astolfo.returnUrl';

export const saveReturnUrl = (url: string) => {
  // Only in-app paths; "/" is where the login lands anyway
  if (!url.startsWith('/') || url.startsWith('//') || url === '/' || url.startsWith('/login')) return;
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    // no storage: skip
  }
};

/** Reads and clears the saved URL */
export const takeReturnUrl = (): string | null => {
  try {
    const url = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return url;
  } catch {
    return null;
  }
};
