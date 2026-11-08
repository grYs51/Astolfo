import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ActivityCalendar, ActivityCalendarDay } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import { SegmentedControlComponent, SegmentedControlOption } from '@nx-stolfo/components';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { HeatmapChart } from 'echarts/charts';
import { HEATMAP_SEQUENTIAL_COLORS } from '../heatmap-grid';
echarts.use([CanvasRenderer, CalendarComponent, TooltipComponent, VisualMapComponent, HeatmapChart]);

type Metric = 'minutes' | 'messages';

/** GitHub-style graph: one square per day over the last 12 months. */
@Component({
  selector: 'feature-voice-stats-activity-calendar',
  imports: [NgxEchartsDirective, SegmentedControlComponent, HumanizeDurationPipe],
  providers: [provideEchartsCore({ echarts })],
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
      <!-- Fixed-size squares like GitHub; narrow screens scroll sideways -->
      <div class="overflow-x-auto">
        <div echarts [options]="chartOption()" [initOpts]="{ renderer: 'canvas' }" class="h-[160px] w-[800px]"></div>
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

  chartOption = computed(() => {
    const { days, start, end } = this.calendar();
    const metric = this.metric();
    const byDate = new Map<string, ActivityCalendarDay>(days.map((day) => [day.date, day]));
    // Days without any of the metric keep the empty-square colour
    const data = days.filter((day) => day[metric] > 0).map((day) => [day.date, day[metric]]);
    // Quartiles of the active days, like GitHub, so one outlier day doesn't wash out the rest
    const values = data.map(([, value]) => value as number).sort((a, b) => a - b);
    const q = (p: number) => values[Math.floor(p * (values.length - 1))] ?? 1;
    const colors = [2, 4, 6, 8].map((i) => HEATMAP_SEQUENTIAL_COLORS[i]);

    return {
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6' },
        formatter: (params: unknown) => {
          const date = (params as { value: [string, number] }).value[0];
          const day = byDate.get(date);
          const label = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
            timeZone: 'UTC',
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          const voice = day?.minutes ? this.durationPipe.transform(day.minutes * 60000, true) : 'No time';
          const messages = day?.messages ?? 0;
          return `<strong>${label}</strong><br/>${voice} in voice<br/>${messages} ${messages === 1 ? 'message' : 'messages'}`;
        },
      },
      visualMap: {
        type: 'piecewise',
        pieces: [
          { gt: 0, lte: q(0.25), color: colors[0] },
          { gt: q(0.25), lte: q(0.5), color: colors[1] },
          { gt: q(0.5), lte: q(0.75), color: colors[2] },
          { gt: q(0.75), color: colors[3] },
        ],
        // A clickable legend would hide days from the calendar
        selectedMode: false,
        orient: 'horizontal',
        left: 36,
        bottom: 0,
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 3,
        showLabel: false,
        text: ['More', 'Less'],
        textStyle: { color: '#9ca3af', fontSize: 11 },
      },
      calendar: {
        range: [start, end],
        top: 24,
        left: 36,
        cellSize: 14,
        splitLine: { show: false },
        // 3px card-coloured border = the gap between squares
        itemStyle: { color: HEATMAP_SEQUENTIAL_COLORS[0], borderColor: '#141824', borderWidth: 3 },
        yearLabel: { show: false },
        dayLabel: { firstDay: 0, nameMap: ['', 'Mon', '', 'Wed', '', 'Fri', ''], color: '#9ca3af', fontSize: 10 },
        monthLabel: { color: '#9ca3af', fontSize: 10 },
      },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }],
    };
  });
}
