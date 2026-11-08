import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PresenceRhythmMember, ServerPresence } from '@nx-stolfo/data-access-voice-stats';
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

/**
 * Server pulse: average members online for each hour of the week, with the
 * night owls and early birds under it.
 */
@Component({
  selector: 'feature-voice-stats-server-pulse',
  imports: [NgxEchartsDirective, RouterLink, DecimalPipe, PercentPipe],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './server-pulse.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ServerPulseComponent {
  presence = input.required<ServerPresence>();
  /** Router commands for a member's profile */
  memberLink = input<((memberId: string) => unknown[]) | undefined>(undefined);

  private cells = computed(
    () => new Map(this.presence().cells.map((c) => [heatmapKey(c.hour, c.dayOfWeek), c.avgOnline]))
  );

  protected isEmpty = computed(() => this.presence().cells.every((c) => c.avgOnline === 0));

  protected peak = computed(() => {
    const best = this.presence().cells.reduce((a, b) => (b.avgOnline > a.avgOnline ? b : a));
    return { label: `${HEATMAP_DAYS_OF_WEEK[best.dayOfWeek]} at ${HEATMAP_HOURS[best.hour]}`, value: best.avgOnline };
  });

  protected groups = computed<{ title: string; hint: string; members: PresenceRhythmMember[] }[]>(() => [
    { title: 'Night owls', hint: 'of their online time between midnight and 5 AM', members: this.presence().nightOwls },
    { title: 'Early birds', hint: 'of their online time between 5 and 9 AM', members: this.presence().earlyBirds },
  ]);

  chartOption = computed(() => {
    const cells = this.cells();
    const max = Math.max(...cells.values(), 1);
    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: { color: '#f3f4f6' },
        formatter: (params: unknown) => {
          const [hour, day, value] = (params as { value: [number, number, number] }).value;
          return `<strong>${HEATMAP_DAYS_OF_WEEK[day]} at ${HEATMAP_HOURS[hour]}</strong><br/>${value.toFixed(1)} members online on average`;
        },
      },
      grid: { height: '72%', top: '4%', left: '48px', right: '16px' },
      xAxis: {
        type: 'category',
        data: HEATMAP_HOURS,
        axisLabel: { interval: 1, fontSize: 10, color: '#9ca3af' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      yAxis: {
        type: 'category',
        data: HEATMAP_DAYS_OF_WEEK,
        axisLabel: { color: '#9ca3af' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      visualMap: {
        min: 0,
        max,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        inRange: { color: HEATMAP_SEQUENTIAL_COLORS },
        text: ['More online', 'Fewer'],
        textStyle: { color: '#9ca3af' },
      },
      series: [
        {
          name: 'Members online',
          type: 'heatmap',
          data: buildHeatmapGrid((hour, day) => Math.round((cells.get(heatmapKey(hour, day)) ?? 0) * 10) / 10),
          itemStyle: { borderColor: '#141824', borderWidth: 2, borderRadius: 2 },
          emphasis: { itemStyle: { borderColor: '#e5e7eb', borderWidth: 1 } },
        },
      ],
    };
  });
}
