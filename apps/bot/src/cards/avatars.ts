import { Logger } from '../utils/logger';
import { CardTheme } from './themes';
import { escapeXml, FONT_FAMILY } from './render';

const FETCH_TIMEOUT_MS = 3_000;

/**
 * Downloads an avatar or server icon as a data URI for a card (resvg doesn't
 * fetch URLs). Undefined when there's no URL or the fetch fails, so the card
 * falls back to an initial instead of failing the reply.
 */
export const fetchImage = async (url: string | null | undefined): Promise<string | undefined> => {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') ?? 'image/png';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch (error) {
    Logger.warn(`Card image fetch failed: ${url}`, error);
    return undefined;
  }
};

/** Discord CDN options for card images: static PNG, small */
export const CARD_IMAGE = { extension: 'png', forceStatic: true, size: 128 } as const;

/** A Discord CDN URL from the Discord directory in the CARD_IMAGE form (resvg can't read WebP or GIF) */
export const cardImageUrl = (url: string | null | undefined) =>
  url?.replace(/\.(webp|gif)$/, `.${CARD_IMAGE.extension}?size=${CARD_IMAGE.size}`);

/** A round image, or the first letter of the name on the accent colour */
export const avatarSvg = (opts: {
  id: string;
  x: number;
  y: number;
  size: number;
  name: string;
  image?: string;
  theme: CardTheme;
}) => {
  const { id, x, y, size, name, image, theme } = opts;
  const r = size / 2;
  if (image) {
    return (
      `<clipPath id="${id}"><circle cx="${x + r}" cy="${y + r}" r="${r}"/></clipPath>` +
      `<image href="${image}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`
    );
  }
  const initial = escapeXml([...name.trim()][0]?.toUpperCase() ?? '?');
  return (
    `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="${theme.accent}"/>` +
    `<text x="${x + r}" y="${y + r}" dy="0.35em" text-anchor="middle" font-family="${FONT_FAMILY}" font-weight="700" font-size="${Math.round(size * 0.45)}" fill="${theme.background}">${initial}</text>`
  );
};
