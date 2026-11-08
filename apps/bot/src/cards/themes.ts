/**
 * Colours for the image cards. Add a theme here and pick it with DEFAULT_THEME;
 * `yarn nx run bot:card-preview` renders every card in every theme to tmp/cards/.
 */
export interface CardTheme {
  background: string;
  /** Panels and rows on top of the background */
  surface: string;
  text: string;
  muted: string;
  accent: string;
  /** The empty part of a progress bar */
  track: string;
}

export const THEMES = {
  dark: {
    background: '#1E1F22',
    surface: '#2B2D31',
    text: '#F2F3F5',
    muted: '#B5BAC1',
    accent: '#5865F2',
    track: '#3F4147',
  },
  light: {
    background: '#F2F3F5',
    surface: '#FFFFFF',
    text: '#1E1F22',
    muted: '#5C5E66',
    accent: '#5865F2',
    track: '#E3E5E8',
  },
  stolfo: {
    background: '#24141E',
    surface: '#36202D',
    text: '#FFF0F7',
    muted: '#E3B8CF',
    accent: '#FF69B4',
    track: '#4D2E40',
  },
} satisfies Record<string, CardTheme>;

export type ThemeName = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeName = 'stolfo';
