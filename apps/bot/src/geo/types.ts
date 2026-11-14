/** The trivia category GeoGuess questions are saved under: /trivia-stats and the XP notes read it */
export const GEO_CATEGORY = 'GeoGuess';

export interface GeoCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** Region from mledoze/countries: Africa, Americas, Asia, Europe or Oceania */
  region: string;
  /** Codes of the countries it shares a land border with */
  borders: string[];
}

/** One Mapillary photo in the pool */
export interface GeoPoolEntry {
  id: string;
  country: string;
}
