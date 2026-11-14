import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, DOCUMENT, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { USER } from '@nx-stolfo/auth';
import { GeoguessApi, GeoguessGameResponse } from '@nx-stolfo/data-access-geoguess';
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
    <div class="flex min-h-screen flex-col gap-md bg-base-100 p-md text-gray-100 lg:h-screen" [style.--split]="split() + '%'">
      @if (game(); as g) {
        <header class="relative flex flex-wrap items-center gap-x-md gap-y-xs lg:min-h-14">
          <!-- While the timer follows the divider, the text on each side stops short of it (the pill is ~8rem wide)
               and wraps or truncates instead of running under it -->
          <div
            class="flex min-w-0 flex-wrap items-baseline gap-x-md"
            [class]="g.phase === 'guessing' ? 'lg:max-w-[calc(var(--split)-4.5rem)]' : ''"
          >
            <h1 class="text-xl font-bold tracking-tight">🗺️ GeoGuess</h1>
            <span class="max-w-full truncate text-sm text-gray-400">Round {{ g.round }}/{{ g.rounds }} · {{ g.difficulty }} · within {{ g.radiusKm }} km counts</span>
          </div>
          @if (g.phase === 'guessing') {
            <span class="ml-auto truncate text-sm text-gray-400 tabular-nums lg:max-w-[calc(100%-var(--split)-5.5rem)]" aria-live="polite">{{ g.guessCount }} guessed</span>
            <!-- Centred over the divider when side by side (the bar sits after the photo column and a 0.25rem gap),
                 its own centred row above the photo on a phone -->
            <div
              class="order-first flex w-full justify-center lg:absolute lg:left-[calc(var(--split)+0.5rem)] lg:top-1/2 lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2"
              role="timer"
              aria-label="Time left"
            >
              <span
                class="rounded-full border px-md py-xs font-mono text-3xl font-bold tabular-nums shadow"
                [class]="hurry() ? 'motion-safe:animate-pulse border-error bg-error/20 text-error' : 'border-base-300 bg-base-200'"
              >
                {{ timeLeft() }}
              </span>
            </div>
          }
        </header>

        <main
          #panes
          class="grid flex-1 gap-md lg:min-h-0 lg:grid-cols-[var(--split)_auto_minmax(0,1fr)] lg:gap-x-xs"
        >
          <div class="flex min-h-0 flex-col gap-xs">
            <feature-geoguess-viewer
              class="h-[45vh] lg:h-auto lg:flex-1"
              [imageId]="g.imageId"
              [token]="g.mapillaryToken"
              [credit]="g.phase !== 'guessing'"
            />
            @if (g.phase === 'guessing') {
              <!-- The licence asks for attribution; who took it waits for the result, a username can name the place -->
              <p class="text-xs text-gray-500">Photo on Mapillary · CC BY-SA 4.0 · the photographer is shown after the round</p>
            }
          </div>
          <!-- Drag (or arrow keys) to share the width between the photo and the map; side by side only -->
          <div
            role="separator"
            tabindex="0"
            aria-orientation="vertical"
            aria-label="Resize the photo and the map"
            aria-valuemin="20"
            aria-valuemax="80"
            [attr.aria-valuenow]="split()"
            class="hidden w-2 cursor-col-resize touch-none rounded bg-base-300 hover:bg-primary-500 focus-visible:bg-primary-500 focus-visible:outline-none lg:block"
            (pointerdown)="drag($event, panes)"
            (keydown)="nudge($event)"
          ></div>
          <div class="flex min-h-0 flex-col gap-sm">
            <feature-geoguess-map
              class="h-[45vh] lg:h-auto lg:flex-1"
              [pin]="g.myGuess ?? pending()"
              [locked]="g.phase !== 'guessing' || !!g.myGuess"
              [answer]="g.answer"
              [pins]="g.pins ?? []"
              [radiusKm]="g.radiusKm"
              [me]="meId()"
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
                <!-- Your own result first, big: no hunting for your name in the list -->
                <div
                  class="rounded-xl border p-sm"
                  [class]="mine()?.place ? 'border-primary-500 bg-primary-500/15' : 'border-base-300 bg-base-200'"
                >
                  @if (mine(); as me) {
                    <p class="text-2xl font-bold tabular-nums">You: {{ me.km }} km</p>
                    <p class="text-sm text-gray-300">
                      @if (me.place) {
                        {{ ordinal(me.place) }} place{{ me.xp ? ' · +' + me.xp + ' XP' : '' }}
                      } @else {
                        Outside {{ g.radiusKm }} km · no XP this round
                      }
                    </p>
                  } @else {
                    <p class="text-sm text-gray-300">You didn’t guess this round.</p>
                  }
                </div>
                <h2 class="font-semibold">It was {{ g.answer.country }}</h2>
                @for (p of g.pins; track p.member.id) {
                  <div class="-mx-xs flex items-center gap-sm rounded px-xs text-sm" [class.bg-base-200]="p.member.id === meId()" [class.font-semibold]="p.member.id === meId()">
                    <span class="w-8 text-gray-400">{{ p.place ? ordinal(p.place) : '–' }}</span>
                    @if (p.member.avatar) {
                      <img class="h-6 w-6 rounded-full" [src]="p.member.avatar" alt="" />
                    } @else {
                      <span class="h-6 w-6 rounded-full bg-base-300"></span>
                    }
                    <span class="flex-1 truncate">{{ name(p.member) }}{{ p.member.id === meId() ? ' (you)' : '' }}</span>
                    <span class="tabular-nums text-gray-400">{{ p.km }} km</span>
                    @if (p.xp) {
                      <span class="font-semibold text-primary-300">+{{ p.xp }} XP</span>
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
                  <div class="-mx-xs flex items-center gap-sm rounded px-xs text-sm" [class.bg-base-200]="s.member.id === meId()" [class.font-semibold]="s.member.id === meId()">
                    <span class="w-8 text-gray-400">{{ ordinal(i + 1) }}</span>
                    <span class="flex-1 truncate">{{ name(s.member) }}{{ s.member.id === meId() ? ' (you)' : '' }}</span>
                    <span class="text-gray-400">{{ s.inside }}/{{ g.round }} close</span>
                    <span class="font-semibold text-primary-300">+{{ s.xp }} XP</span>
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
  private user = inject(USER);
  gameResource = this.api.fetchGame(() => this.serverId(), () => this.gameId());
  missing = computed(() => (this.gameResource.error() as HttpErrorResponse | undefined)?.status === 404);
  /** The last game seen: a failed reload mid-game keeps the viewer, map and pin instead of tearing them down */
  game = linkedSignal<GeoguessGameResponse | undefined, GeoguessGameResponse | undefined>({
    source: () => (this.gameResource.hasValue() ? this.gameResource.value() : undefined),
    computation: (next, previous) => next ?? (this.missing() ? undefined : previous?.value),
  });

  meId = computed(() => this.user()?.id);
  /** Your pin on the round result, if you guessed */
  mine = computed(() => this.game()?.pins?.find((p) => p.member.id === this.meId()));

  /** A pin placed but not sent yet */
  pending = signal<LatLon | null>(null);
  sending = signal(false);
  error = signal<string | null>(null);

  // shortcut: counts down on this device's clock, so a clock that's off by seconds shows the wrong time; send
  // the server's time with the game if players notice
  private now = signal(Date.now());
  timeLeft = computed(() => countdown(this.game()?.endsAt ?? 0, this.now()));
  /** The last 10 seconds: the timer turns red and pulses */
  hurry = computed(() => (this.game()?.endsAt ?? 0) - this.now() <= 10_000);

  /** The photo's share of the width in %, when side by side */
  split = signal(50);

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

  drag(start: PointerEvent, main: HTMLElement) {
    const bar = start.target as HTMLElement;
    // Pointer capture doesn't stop the mouse from selecting the header and result text on the way
    start.preventDefault();
    // Capture keeps the moves coming while the pointer is over the viewer or map, which would take them
    bar.setPointerCapture(start.pointerId);
    const move = (e: PointerEvent) => {
      const box = main.getBoundingClientRect();
      this.setSplit(((e.clientX - box.left) / box.width) * 100);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('lostpointercapture', () => bar.removeEventListener('pointermove', move), { once: true });
  }

  nudge(e: KeyboardEvent) {
    const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key];
    if (!step) return;
    e.preventDefault();
    this.setSplit(this.split() + step);
  }

  private setSplit(percent: number) {
    this.split.set(Math.round(Math.min(80, Math.max(20, percent))));
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
