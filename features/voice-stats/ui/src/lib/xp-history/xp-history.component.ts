import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { DiscordMember, XpHistoryEntry } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, MarkAreaComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { sessionChartOption } from './xp-session-chart';
echarts.use([CanvasRenderer, GridComponent, TooltipComponent, MarkPointComponent, MarkAreaComponent, LineChart]);

/**
 * A member's XP ledger, newest first. A voice row opens a step chart of its multiplier over the
 * session, with who joined and left and the deafened stretches shaded.
 */
@Component({
  selector: 'feature-voice-stats-xp-history',
  imports: [DatePipe, NgTemplateOutlet, HumanizeDurationPipe, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <section class="rounded-xl border border-white/5 bg-base-300 p-lg" aria-labelledby="xp-history-title">
      <h3 id="xp-history-title" class="text-base font-semibold text-gray-100">XP history</h3>

      <ng-template #row let-e>
        <span class="min-w-0 flex-1 truncate text-sm text-gray-300">{{ e.note }}</span>
        <span class="shrink-0 text-xs tabular-nums text-gray-500">{{ e.at | date: 'MMM d, HH:mm' }}</span>
        <span class="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-primary-300">+{{ e.amount }}</span>
      </ng-template>

      @if (entries().length === 0) {
        <p class="py-md text-center text-sm text-gray-400">
          No XP yet. Voice, messages, streaks and rock-paper-scissors wins all count.
        </p>
      } @else {
        <ul class="mt-sm divide-y divide-white/5">
          @for (e of entries(); track e.id) {
            <li class="py-xs">
              @if (e.segments?.length) {
                <button
                  type="button"
                  class="flex w-full items-center gap-md rounded-lg px-xs py-xs text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
                  [attr.aria-expanded]="open() === e.id"
                  [attr.aria-controls]="'xp-session-' + e.id"
                  (click)="toggle(e.id)"
                >
                  <svg
                    class="h-3 w-3 shrink-0 text-gray-500 transition-transform"
                    [class.rotate-90]="open() === e.id"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <ng-container *ngTemplateOutlet="row; context: { $implicit: e }" />
                </button>
                @if (open() === e.id && session(); as s) {
                  <div [id]="'xp-session-' + e.id" class="mt-xs rounded-lg bg-base-200 p-md">
                    <p class="text-sm text-gray-300">
                      {{ s.channel }} · {{ s.length | humanizeDuration: true }} ·
                      <strong class="font-semibold text-primary-300">{{ e.amount }} XP</strong>
                    </p>
                    <div echarts [options]="s.option" class="mt-sm h-64" role="img" [attr.aria-label]="s.summary"></div>
                  </div>
                }
              } @else {
                <div class="flex items-center gap-md px-xs py-xs pl-[1.75rem]">
                  <ng-container *ngTemplateOutlet="row; context: { $implicit: e }" />
                </div>
              }
            </li>
          }
        </ul>
        @if (hasMore()) {
          <button
            type="button"
            class="mt-sm w-full rounded-lg border border-white/10 px-md py-sm text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
            [disabled]="loading()"
            (click)="more.emit()"
          >
            {{ loading() ? 'Loading…' : 'Show older' }}
          </button>
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class XpHistoryComponent {
  entries = input.required<XpHistoryEntry[]>();
  /** Everyone named in the entries' segments */
  people = input<Record<string, DiscordMember>>({});
  hasMore = input(false);
  loading = input(false);
  more = output<void>();

  protected open = signal<string | null>(null);
  protected toggle = (id: string) => this.open.update((current) => (current === id ? null : id));

  protected session = computed(() => {
    const entry = this.entries().find((e) => e.id === this.open());
    const segments = entry?.segments;
    if (!entry || !segments?.length) return undefined;
    const length = segments[segments.length - 1].to - segments[0].from;
    return {
      channel: entry.channel ? `#${entry.channel.name}` : 'Voice',
      length,
      option: sessionChartOption(segments, this.people()),
      // The chart is a picture; the note says the same in words
      summary: entry.note,
    };
  });
}
