import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import { GeoguessGameResponse, GeoguessGuessRequest } from '@nx-stolfo/api-interfaces';

/** A GeoGuess map game started with `/geoguess mode:map`; the API answers 404 once it's forgotten */
export class GeoguessApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);
  private http = inject(HttpClient);

  /** The current round; the page reloads it to follow the game */
  fetchGame(guildId: () => string, gameId: () => string) {
    return this.get<GeoguessGameResponse>(() => `/features/servers/${guildId()}/geoguess/${gameId()}`);
  }

  /** One pin per round (one-off request, not a resource) */
  guess(guildId: string, gameId: string, pin: GeoguessGuessRequest) {
    return this.http.post<void>(`${this.host}/features/servers/${guildId}/geoguess/${gameId}/guess`, pin);
  }
}
