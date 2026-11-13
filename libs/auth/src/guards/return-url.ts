const KEY = 'auth:return-url';

/** A path on this site, or null: never another site (`//evil.example`, `/` + backslash) or a scheme */
export const safeReturnUrl = (url: string | null | undefined) =>
  url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : null;

// Storage can throw (blocked site data, private mode): then login lands on the dashboard as before
export const rememberReturnUrl = (url: string) => {
  try {
    if (safeReturnUrl(url)) sessionStorage.setItem(KEY, url);
  } catch {
    /* ignore */
  }
};

/** The page the visitor wanted before logging in, once */
export const takeReturnUrl = () => {
  try {
    const url = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safeReturnUrl(url);
  } catch {
    return null;
  }
};
