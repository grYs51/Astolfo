import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { VoiceStatsUserHeatmap } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { HeatmapChart } from 'echarts/charts';
import {
  HEATMAP_DAYS_OF_WEEK,
  HEATMAP_HOURS,
  HEATMAP_SEQUENTIAL_COLORS,
  buildHeatmapGrid,
  heatmapKey,
} from '../heatmap-grid';
echarts.use([CanvasRenderer, TooltipComponent, VisualMapComponent, GridComponent, HeatmapChart]);

type Mode = 'you' | 'compare';

const EMPTY_CELL = '#1b2030';

/**
 * "When you're on": the viewer's own voice time by hour × weekday, with an
 * optional comparison against the average member who was in voice then.
 */
@Component({
  selector: 'feature-voice-stats-user-heatmap',
  standalone: true,
  imports: [NgxEchartsDirective, SegmentedControlComponent],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './voice-stats-user-heatmap.component.html',
  styleUrls: ['./voice-stats-user-heatmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsUserHeatmapComponent {
  heatmap = input.required<VoiceStatsUserHeatmap>();
  loading = input<boolean>(false);

  protected mode = signal<Mode>('you');
  protected readonly modeOptions: SegmentedControlOption<Mode>[] = [
    { value: 'you', label: 'Just me' },
    { value: 'compare', label: 'vs server' },
  ];

  private readonly durationPipe = new HumanizeDurationPipe();
  private readonly daysOfWeek = HEATMAP_DAYS_OF_WEEK;
  private readonly hours = HEATMAP_HOURS;

  protected hasActivity = computed(() => this.heatmap().stats.user.totalMinutes > 0);

  peakTimeDisplay = computed(() => {
    const { peakDay, peakHour } = this.heatmap().stats.user;
    return `${this.daysOfWeek[peakDay]} at ${this.hours[peakHour]}`;
  });

  private cells = computed(() => {
    const map = new Map<string, { userValue: number; serverAvg: number; diff: number }>();
    for (const point of this.heatmap().userHeatmap) {
      map.set(heatmapKey(point.hour, point.dayOfWeek), {
        userValue: point.userValue,
        serverAvg: point.serverAverage,
        diff: point.difference,
      });
    }
    return map;
  });

  chartOption = computed(() => {
    const cells = this.cells();
    const compare = this.mode() === 'compare';

    // Hours without the viewer's activity are their own uncoloured series:
    // as a 0 they'd look like "no difference" in compare mode
    const grid = buildHeatmapGrid((hour, day) => {
      const cell = cells.get(heatmapKey(hour, day));
      if (!cell) return null;
      return compare ? cell.diff : cell.userValue;
    });
    const chartData = grid.filter(
      (d): d is [number, number, number] => d[2] !== null
    );
    const emptyCells = grid
      .filter((d) => d[2] === null)
      .map(([hour, day]) => [hour, day, 0]);

    const maxAbs = Math.max(...chartData.map((d) => Math.abs(d[2])), 1);

    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: { color: '#f3f4f6' },
        formatter: (params: { value: [number, number, number] }) => {
          const [hour, day] = params.value;
          const title = `<strong>${this.daysOfWeek[day]} at ${this.hours[hour]}</strong><br/>`;
          const cell = cells.get(heatmapKey(hour, day));
          if (!cell || cell.userValue === 0) return `${title}No activity`;

          let text = `${title}You: ${this.durationPipe.transform(cell.userValue * 60000, true)}`;
          if (compare) {
            text += `<br/>Average member: ${this.durationPipe.transform(cell.serverAvg * 60000, true)}`;
            text += `<br/><span style="color: ${cell.diff > 0 ? '#60a5fa' : '#f87171'}">`;
            text += `${cell.diff > 0 ? '+' : ''}${cell.diff}m ${cell.diff > 0 ? 'more' : 'less'}</span>`;
          }
          return text;
        },
      },
      grid: { height: '72%', top: '4%', left: '48px', right: '16px' },
      xAxis: {
        type: 'category',
        data: this.hours,
        axisLabel: { interval: 1, fontSize: 10, color: '#9ca3af' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      yAxis: {
        type: 'category',
        data: this.daysOfWeek,
        axisLabel: { color: '#9ca3af' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      visualMap: [
        compare
          ? {
              seriesIndex: 0,
              min: -maxAbs,
              max: maxAbs,
              calculable: true,
              orient: 'horizontal',
              left: 'center',
              bottom: '2%',
              textStyle: { color: '#9ca3af' },
              // Diverging: red (less than the average member) -> gray -> blue (more)
              inRange: { color: ['#dc2626', '#f87171', '#4b5563', '#60a5fa', '#2563eb'] },
            }
          : {
              seriesIndex: 0,
              min: 0,
              max: maxAbs,
              calculable: true,
              orient: 'horizontal',
              left: 'center',
              bottom: '2%',
              text: ['More', 'Less'],
              textStyle: { color: '#9ca3af' },
              inRange: { color: HEATMAP_SEQUENTIAL_COLORS },
            },
        {
          // ECharts requires a visualMap per heatmap series; this one just
          // paints the "no activity" cells a flat background colour
          show: false,
          seriesIndex: 1,
          min: 0,
          max: 1,
          inRange: { color: [EMPTY_CELL, EMPTY_CELL] },
        },
      ],
      series: [
        {
          name: compare ? 'You vs the average member' : 'Your voice time',
          type: 'heatmap',
          data: chartData,
          label: { show: false },
          itemStyle: { borderColor: '#141824', borderWidth: 2, borderRadius: 2 },
          emphasis: { itemStyle: { borderColor: '#e5e7eb', borderWidth: 1 } },
        },
        {
          name: 'No activity',
          type: 'heatmap',
          data: emptyCells,
          label: { show: false },
          itemStyle: { borderColor: '#141824', borderWidth: 2, borderRadius: 2 },
          emphasis: { disabled: true },
        },
      ],
    };
  });
}
