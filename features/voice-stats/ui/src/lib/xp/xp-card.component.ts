import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { XpLevel, XpSourceTotal } from '@nx-stolfo/data-access-voice-stats';
import { XpTileKey, xpTiles } from './xp-card';

/** Icon paths (24×24, stroked) per tile */
const ICONS: Record<XpTileKey, string[]> = {
  voice: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  messages: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  streak: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  games: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M18 2H6v7a6 6 0 0 0 12 0V2Z', 'M12 15v4'],
  trivia: ['M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z'],
  bonuses: ['M12 3l1.9 5.8L20 10l-5 3.6L16.2 20 12 16.5 7.8 20 9 13.6 4 10l6.1-1.2Z'],
};

/** Level, total XP and what earned it, one tile per kind of XP (all time) */
@Component({
  selector: 'feature-voice-stats-xp-card',
  imports: [DecimalPipe],
  template: `
    @let l = level();
    <section class="rounded-xl border border-white/5 bg-base-300 p-lg" aria-labelledby="xp-card-title">
      <div class="flex flex-wrap items-center gap-md">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-lg font-bold tabular-nums text-primary-200 ring-1 ring-inset ring-primary-400/30"
          aria-hidden="true"
        >
          {{ l.level }}
        </span>
        <div class="min-w-0 flex-1">
          <h3 id="xp-card-title" class="text-base font-semibold text-gray-100">
            Level {{ l.level }}
            <span class="text-xs font-normal text-gray-500">· all time</span>
          </h3>
          <div
            class="mt-xs h-1.5 overflow-hidden rounded-full bg-base-100"
            role="progressbar"
            [attr.aria-valuenow]="pct()"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-label]="toGo() + ' XP to level ' + (l.level + 1)"
          >
            <div class="h-full rounded-full bg-primary-400" [style.width.%]="pct()"></div>
          </div>
          <p class="mt-xs text-xs tabular-nums text-gray-500">{{ toGo() | number }} XP to level {{ l.level + 1 }}</p>
        </div>
        <p class="text-right">
          <span class="block text-2xl font-bold tabular-nums text-gray-100">{{ l.xp | number }}</span>
          <span class="text-xs text-gray-500">XP</span>
        </p>
      </div>

      <dl class="mt-md grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        @for (tile of tiles(); track tile.key) {
          <div class="rounded-lg border border-white/5 bg-base-200 p-sm text-center" [title]="tile.hint">
            <dt class="flex items-center justify-center gap-xs text-xs text-gray-400">
              <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                @for (d of icons[tile.key]; track $index) {
                  <path [attr.d]="d" />
                }
              </svg>
              {{ tile.label }}
            </dt>
            <dd class="mt-xs text-lg font-semibold tabular-nums text-gray-100">{{ tile.count | number }}</dd>
            <dd class="text-xs tabular-nums" [class]="tile.xp ? 'text-primary-300' : 'text-gray-500'">+{{ tile.xp | number }} XP</dd>
          </div>
        }
      </dl>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class XpCardComponent {
  level = input.required<XpLevel>();
  sources = input.required<XpSourceTotal[]>();

  protected readonly icons = ICONS;
  protected tiles = computed(() => xpTiles(this.sources()));
  protected toGo = computed(() => this.level().nextLevelXp - this.level().xp);
  protected pct = computed(() => {
    const { xp, levelXp, nextLevelXp } = this.level();
    return nextLevelXp > levelXp ? Math.round(((xp - levelXp) / (nextLevelXp - levelXp)) * 100) : 0;
  });
}
