import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, model } from '@angular/core';
import { HttpResourceRef } from '@angular/common/http';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { DiscordMember, XpHistory, XpLevel, XpRival, XpRivals, XpSourceTotal } from '@nx-stolfo/data-access-voice-stats';
import { signedXp, XpTileKey, xpTiles } from './xp-card';
import { XpHistoryChartComponent } from './xp-history-chart.component';

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
  imports: [DecimalPipe, NgTemplateOutlet, XpHistoryChartComponent],
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

      @if (history(); as h) {
        <div class="mt-md border-t border-white/5 pt-sm">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg py-xs text-left text-sm font-semibold text-gray-200 hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
            [attr.aria-expanded]="historyOpen()"
            aria-controls="xp-history"
            (click)="historyOpen.set(!historyOpen())"
          >
            XP history
            <svg class="h-4 w-4 text-gray-400 transition-transform" [class.rotate-180]="historyOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          @if (historyOpen()) {
            <div id="xp-history" class="mt-sm">
              @if (l.xp === 0) {
                <p class="text-sm text-gray-400">No XP yet: join a voice channel or say hi.</p>
              } @else {
                @if (rivalList().length) {
                  @let rival = compare();
                  <div class="relative mb-sm">
                    @if (rival) {
                      <span class="inline-flex items-center gap-xs rounded-full border border-white/10 bg-base-200 p-0.5 text-sm text-gray-300">
                        <ng-container *ngTemplateOutlet="avatar; context: { $implicit: rival.member }" />
                        <span class="px-xs">Compared with <strong class="font-semibold text-gray-100">{{ memberName(rival.member) }}</strong></span>
                        <button
                          type="button"
                          class="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-base-100 hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
                          [attr.aria-label]="'Stop comparing with ' + memberName(rival.member)"
                          (click)="compare.set(undefined)"
                        >
                          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    } @else {
                      <button
                        type="button"
                        class="inline-flex items-center gap-xs rounded-lg border border-white/10 bg-base-200 px-sm py-xs text-sm text-gray-300 hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
                        [attr.aria-expanded]="pickerOpen()"
                        aria-controls="xp-rivals"
                        (click)="pickerOpen.set(!pickerOpen())"
                        (keydown.escape)="pickerOpen.set(false)"
                      >
                        Compare with…
                        <svg class="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      @if (pickerOpen()) {
                        <ul
                          id="xp-rivals"
                          class="absolute z-10 mt-xs max-h-72 w-80 max-w-full overflow-y-auto rounded-lg border border-white/10 bg-base-200 p-xs shadow-lg"
                          aria-label="Members closest in XP"
                        >
                          @for (r of rivalList(); track r.member.id) {
                            <li>
                              <button
                                type="button"
                                class="flex w-full items-center gap-sm rounded-md px-sm py-xs text-left text-sm hover:bg-base-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
                                (click)="pick(r)"
                                (keydown.escape)="pickerOpen.set(false)"
                              >
                                <ng-container *ngTemplateOutlet="avatar; context: { $implicit: r.member }" />
                                <span class="min-w-0 flex-1 truncate text-gray-100">{{ memberName(r.member) }}</span>
                                <span class="text-xs tabular-nums text-gray-500">Lv {{ r.level }}</span>
                                <span class="w-20 text-right text-xs tabular-nums text-gray-300">{{ signed(r.difference) }}</span>
                              </button>
                            </li>
                          }
                        </ul>
                      }
                    }
                  </div>
                }
                @if (h.error()) {
                  <p class="text-sm text-error">Couldn't load the XP history.</p>
                } @else if (h.hasValue()) {
                  <feature-voice-stats-xp-history-chart [history]="h.value()" [names]="names()" />
                } @else {
                  <p class="text-sm text-gray-500">Loading…</p>
                }
              }
            </div>
          }
        </div>
      }
    </section>

    <ng-template #avatar let-member>
      @if (member.avatar) {
        <img [src]="member.avatar" alt="" class="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/10" />
      } @else {
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-base-100 text-xs font-semibold text-gray-300" aria-hidden="true">
          {{ memberName(member).charAt(0).toUpperCase() }}
        </span>
      }
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class XpCardComponent {
  level = input.required<XpLevel>();
  sources = input.required<XpSourceTotal[]>();
  /** The collapsible XP history; the owner fetches it once `historyOpen` turns true */
  history = input<HttpResourceRef<XpHistory | undefined>>();
  historyOpen = model(false);
  /** The member's name in the history's legend and hover ("You" on the You tab) */
  name = input('You');
  /** Members to compare the history with, closest in XP first; the picker is hidden without any */
  rivals = input<HttpResourceRef<XpRivals | undefined>>();
  /** The member drawn on top of the history; the owner refetches the history with them */
  compare = model<XpRival | undefined>();

  protected pickerOpen = linkedSignal({ source: this.historyOpen, computation: () => false });
  protected rivalList = computed(() => {
    const rivals = this.rivals();
    return rivals?.hasValue() ? rivals.value().rivals : [];
  });
  protected names = computed<[string, string]>(() => {
    const rival = this.compare();
    return [this.name(), rival ? this.memberName(rival.member) : ''];
  });
  protected readonly signed = signedXp;
  protected memberName = (member: DiscordMember) => member.displayName || member.username;

  protected pick(rival: XpRival) {
    this.compare.set(rival);
    this.pickerOpen.set(false);
  }

  protected readonly icons = ICONS;
  protected tiles = computed(() => xpTiles(this.sources()));
  protected toGo = computed(() => this.level().nextLevelXp - this.level().xp);
  protected pct = computed(() => {
    const { xp, levelXp, nextLevelXp } = this.level();
    return nextLevelXp > levelXp ? Math.round(((xp - levelXp) / (nextLevelXp - levelXp)) * 100) : 0;
  });
}
