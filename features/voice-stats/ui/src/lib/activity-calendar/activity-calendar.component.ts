import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ActivityCalendar, ActivityCalendarDay } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import { SegmentedControlComponent, SegmentedControlOption } from '@nx-stolfo/components';
import { weekdayRow } from '../heatmap-grid';
import { HeatmapChartComponent } from '../heatmap-chart/heatmap-chart.component';

type Metric = 'minutes' | 'messages';

const DAY_MS = 24 * 60 * 60 * 1000;
const toDate = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * Lays the days from `start` to `end` ('YYYY-MM-DD') out in Monday-first week
 * columns: `dates[column][row]` ('' outside the range) and a month label on
 * the first column of each month.
 */
export function calendarWeeks(start: string, end: string) {
  const first = toDate(start).getTime();
  const last = toDate(end).getTime();
  const monday = first - weekdayRow(toDate(start).getUTCDay()) * DAY_MS;
  const dates: string[][] = [];
  const months: string[] = [];
  for (let week = monday; week <= last; week += 7 * DAY_MS) {
    const column = Array.from({ length: 7 }, (_, row) => {
      const day = week + row * DAY_MS;
      return day < first || day > last ? '' : new Date(day).toISOString().slice(0, 10);
    });
    // Label the column holding the 1st (a label on the partial first month could collide with the next)
    const firstOfMonth = column.find((date) => date.endsWith('-01'));
    months.push(firstOfMonth ? toDate(firstOfMonth).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) : '');
    dates.push(column);
  }
  return { dates, months };
}

/** GitHub-style graph: one cell per day over the last 12 months, weeks as columns. */
@Component({
  selector: 'feature-voice-stats-activity-calendar',
  imports: [HeatmapChartComponent, SegmentedControlComponent, HumanizeDurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="rounded-xl border border-white/5 bg-base-300 p-lg">
      <div class="mb-sm flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h3 class="text-base font-semibold text-gray-100">Past year</h3>
          <!-- Local days with any activity; the voice streak counts UTC days with 10+ min -->
          <p class="text-xs text-gray-500">
            Days in your time zone · {{ activeDays() }} active {{ activeDays() === 1 ? 'day' : 'days' }} ·
            {{ totals().minutes * 60000 | humanizeDuration: true }} in voice ·
            {{ totals().messages }} {{ totals().messages === 1 ? 'message' : 'messages' }}
          </p>
        </div>
        <lib-segmented-control label="Show" [options]="metricOptions" [(value)]="metric" />
      </div>
      <!-- Full width; narrow screens scroll sideways rather than squash 53 weeks -->
      <div class="overflow-x-auto">
        <feature-voice-stats-heatmap-chart
          [cells]="cells()"
          [xLabels]="weeks().months"
          [tooltip]="tooltip"
          [square]="true"
          class="min-w-[720px]"
        />
      </div>
    </div>
  `,
})
export class ActivityCalendarComponent {
  calendar = input.required<ActivityCalendar>();

  readonly metricOptions: SegmentedControlOption<Metric>[] = [
    { value: 'minutes', label: 'Voice' },
    { value: 'messages', label: 'Messages' },
  ];
  metric = signal<Metric>('minutes');

  private readonly durationPipe = new HumanizeDurationPipe();

  activeDays = computed(() => this.calendar().days.length);
  totals = computed(() =>
    this.calendar().days.reduce(
      (sum, day) => ({ minutes: sum.minutes + day.minutes, messages: sum.messages + day.messages }),
      { minutes: 0, messages: 0 }
    )
  );

  private byDate = computed(() => new Map<string, ActivityCalendarDay>(this.calendar().days.map((day) => [day.date, day])));
  protected weeks = computed(() => calendarWeeks(this.calendar().start, this.calendar().end));

  // Days without any of the metric are uncoloured; days outside the range aren't drawn
  protected cells = computed(() => {
    const byDate = this.byDate();
    const metric = this.metric();
    return this.weeks().dates.flatMap((column, x) =>
      column.flatMap((date, y) => {
        if (!date) return [];
        const value = byDate.get(date)?.[metric] || null;
        return [[x, y, value] as [number, number, number | null]];
      })
    );
  });

  protected tooltip = (x: number, y: number) => {
    const date = this.weeks().dates[x][y];
    const day = this.byDate().get(date);
    const label = toDate(date).toLocaleDateString(undefined, {
      timeZone: 'UTC',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const voice = day?.minutes ? this.durationPipe.transform(day.minutes * 60000, true) : 'No time';
    const messages = day?.messages ?? 0;
    return `<strong>${label}</strong><br/>${voice} in voice<br/>${messages} ${messages === 1 ? 'message' : 'messages'}`;
  };
}
