import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, DOCUMENT, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GeoguessApi } from '@nx-stolfo/data-access-geoguess';
import { countdown, GeoguessMapComponent, GeoguessViewerComponent, LatLon, memberName, ordinal } from '@nx-stolfo/ui-geoguess';

/** The page reloads the game this often while it runs */
const POLL_MS = 2000;

/**
 * A GeoGuess map game (/play/geoguess/:serverId/:gameId), started in Discord with `/geoguess mode:map`:
 * walk around the street, drop a pin, see how close everyone got. Full screen, outside the shell.
 */
@Component({
  selector: 'pages-geoguess',
  imports: [GeoguessViewerComponent, GeoguessMapComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GeoguessApi],
  template: `
    <div class="flex min-h-screen flex-col gap-md bg-base-100 p-md text-gray-100 lg:h-screen">
      @if (game(); as g) {
        <header class="flex flex-wrap items-baseline gap-x-md gap-y-xs">
          <h1 class="text-xl font-bold tracking-tight">🗺️ GeoGuess</h1>
          <span class="text-sm text-gray-400">Round {{ g.round }}/{{ g.rounds }} · {{ g.difficulty }} · within {{ g.radiusKm }} km counts</span>
          @if (g.phase === 'guessing') {
            <span class="ml-auto text-sm tabular-nums" aria-live="polite">
              {{ g.guessCount }} guessed · <strong class="text-lg">{{ timeLeft() }}</strong>
            </span>
          }
        </header>

        <main class="grid flex-1 gap-md lg:min-h-0 lg:grid-cols-2">
          <feature-geoguess-viewer class="h-[45vh] lg:h-full" [imageId]="g.imageId" [token]="g.mapillaryToken" />
          <div class="flex min-h-0 flex-col gap-sm">
            <feature-geoguess-map
              class="h-[45vh] lg:h-auto lg:flex-1"
              [pin]="g.myGuess ?? pending()"
              [locked]="g.phase !== 'guessing' || !!g.myGuess"
              [answer]="g.answer"
              [pins]="g.pins ?? []"
              (picked)="pending.set($event)"
            />

            @if (g.phase === 'guessing') {
              @if (g.myGuess) {
                <p class="text-sm text-gray-400">Pin sent. Waiting for the others…</p>
              } @else {
                <div class="flex items-center gap-sm">
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="!pending() || sending()"
                    (click)="send()"
                  >
                    Guess
                  </button>
                  <span class="text-sm text-gray-400">{{ pending() ? 'Happy with your pin?' : 'Click the map where you think this is.' }}</span>
                </div>
              }
              @if (error()) {
                <p class="text-sm text-error" role="alert">{{ error() }}</p>
              }
            } @else if (g.answer) {
              <section class="space-y-xs" aria-label="Round result">
                <h2 class="font-semibold">It was {{ g.answer.country }}</h2>
                @for (p of g.pins; track p.member.id) {
                  <div class="flex items-center gap-sm text-sm">
                    <span class="w-8 text-gray-400">{{ p.place ? ordinal(p.place) : '–' }}</span>
                    @if (p.member.avatar) {
                      <img class="h-6 w-6 rounded-full" [src]="p.member.avatar" alt="" />
                    } @else {
                      <span class="h-6 w-6 rounded-full bg-base-300"></span>
                    }
                    <span class="flex-1 truncate">{{ name(p.member) }}</span>
                    <span class="tabular-nums text-gray-400">{{ p.km }} km</span>
                    @if (p.xp) {
                      <span class="font-semibold text-primary">+{{ p.xp }} XP</span>
                    }
                  </div>
                } @empty {
                  <p class="text-sm text-gray-400">Nobody guessed.</p>
                }
                @if (g.phase === 'result' && g.round < g.rounds) {
                  <p class="text-sm text-gray-400">Next round in a few seconds…</p>
                }
              </section>
            }

            @if (g.phase === 'over') {
              <section class="space-y-xs" aria-label="Final scores">
                <h2 class="font-semibold">Final scores</h2>
                @for (s of g.scores; track s.member.id; let i = $index) {
                  <div class="flex items-center gap-sm text-sm">
                    <span class="w-8 text-gray-400">{{ ordinal(i + 1) }}</span>
                    <span class="flex-1 truncate">{{ name(s.member) }}</span>
                    <span class="text-gray-400">{{ s.inside }}/{{ g.rounds }} close</span>
                    <span class="font-semibold text-primary">+{{ s.xp }} XP</span>
                  </div>
                }
                <a [routerLink]="['/overview/detail', serverId()]" class="inline-block text-sm text-gray-400 hover:text-gray-200">
                  ← Back to the dashboard
                </a>
              </section>
            }
          </div>
        </main>
      } @else if (gameResource.error()) {
        <div class="m-auto max-w-md space-y-sm text-center">
          <p>{{ missing() ? 'This game is over or never existed.' : 'Couldn’t load the game. Try again in a moment.' }}</p>
          <a [routerLink]="['/overview']" class="text-sm text-gray-400 hover:text-gray-200">← Back to the dashboard</a>
        </div>
      } @else {
        <div class="h-full animate-pulse rounded-xl bg-base-300"></div>
      }
    </div>
  `,
})
export class GeoguessComponent {
  /** Route params */
  serverId = input.required<string>();
  gameId = input.required<string>();

  private api = inject(GeoguessApi);
  gameResource = this.api.fetchGame(() => this.serverId(), () => this.gameId());
  /** The last game seen: a failed reload mid-game keeps the page up instead of flashing an error */
  game = computed(() => (this.gameResource.hasValue() ? this.gameResource.value() : undefined));
  missing = computed(() => (this.gameResource.error() as HttpErrorResponse | undefined)?.status === 404);

  /** A pin placed but not sent yet */
  pending = signal<LatLon | null>(null);
  sending = signal(false);
  error = signal<string | null>(null);

  // shortcut: counts down on this device's clock, so a clock that's off by seconds shows the wrong time; send
  // the server's time with the game if players notice
  private now = signal(Date.now());
  timeLeft = computed(() => countdown(this.game()?.endsAt ?? 0, this.now()));

  name = memberName;
  ordinal = ordinal;

  constructor() {
    const document = inject(DOCUMENT);
    // The viewer and map styles are their own bundle, so only this page loads them
    const styles = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'geoguess.css' });
    document.head.appendChild(styles);

    let ticks = 0;
    const timer = setInterval(() => {
      this.now.set(Date.now());
      const phase = this.game()?.phase;
      if (++ticks % (POLL_MS / 1000) === 0 && phase !== 'over' && !this.missing()) this.gameResource.reload();
    }, 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      styles.remove();
    });

    // A new round starts with no pin placed
    let round = 0;
    effect(() => {
      const next = this.game()?.round ?? 0;
      if (next === round) return;
      round = next;
      this.pending.set(null);
      this.error.set(null);
    });
  }

  send() {
    const pin = this.pending();
    if (!pin) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.guess(this.serverId(), this.gameId(), pin).subscribe({
      next: () => {
        this.sending.set(false);
        this.gameResource.reload();
      },
      error: (e: HttpErrorResponse) => {
        this.sending.set(false);
        this.error.set(e.error?.error ?? 'Couldn’t send your pin. Try again.');
        this.gameResource.reload();
      },
    });
  }
}
