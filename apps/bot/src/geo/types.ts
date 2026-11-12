export interface GeoCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** REST Countries region: Africa, Americas, Asia, Europe or Oceania */
  region: string;
  /** Codes of the countries it shares a land border with */
  borders: string[];
}

/** One Mapillary photo in the pool */
export interface GeoPoolEntry {
  id: string;
  country: string;
}
