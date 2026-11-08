import { renderAsync } from '@resvg/resvg-js';
import { readdirSync } from 'fs';
import path from 'path';

/**
 * SVG → PNG for the image cards. resvg sees only the fonts shipped in
 * assets/fonts (the Alpine image has none) and never fetches URLs, so
 * images go in as data URIs.
 */

const FONT_DIR = path.join(__dirname, '../assets/fonts');
// Read on first render, not at import: a packaging slip then breaks the image option, not the bot's startup
let fontFiles: string[] | undefined;
const fonts = () =>
  (fontFiles ??= readdirSync(FONT_DIR)
    .filter((file) => file.endsWith('.ttf'))
    .map((file) => path.join(FONT_DIR, file)));

export const FONT_FAMILY = 'Inter';

/** Renders off the main thread, so a card doesn't block the gateway */
export const renderPng = async (svg: string): Promise<Buffer> => {
  // shortcut: Inter has no emoji or CJK glyphs, so those show as blanks; ship a fallback font when names need them
  const image = await renderAsync(svg, {
    font: { fontFiles: fonts(), loadSystemFonts: false, defaultFontFamily: FONT_FAMILY },
  });
  return image.asPng();
};

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Every member, server or channel name goes through this before it lands in
 * an SVG. Characters XML doesn't allow (control characters, U+FFFE/U+FFFF)
 * are dropped: resvg rejects the whole card over one of them.
 */
export const escapeXml = (text: string) =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);

/** Cuts long names so they don't run into the next column */
export const truncate = (text: string, max: number) => {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
};
