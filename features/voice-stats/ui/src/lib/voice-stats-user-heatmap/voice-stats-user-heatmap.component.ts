import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { VoiceStatsUserHeatmap } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent } from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { HeatmapChart } from 'echarts/charts';
import {
  HEATMAP_DAYS_OF_WEEK,
  HEATMAP_HOURS,
  buildHeatmapGrid,
  heatmapKey,
} from '../heatmap-grid';
echarts.use([CanvasRenderer, TooltipComponent, VisualMapComponent, GridComponent, HeatmapChart]);

@Component({
  selector: 'feature-voice-stats-user-heatmap',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, StatCardComponent, HumanizeDurationPipe],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './voice-stats-user-heatmap.component.html',
  styleUrls: ['./voice-stats-user-heatmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsUserHeatmapComponent {
  heatmap = input.required<VoiceStatsUserHeatmap>();
  loading = input<boolean>(false);

  private readonly durationPipe = new HumanizeDurationPipe();

  private readonly daysOfWeek = HEATMAP_DAYS_OF_WEEK;
  private readonly hours = HEATMAP_HOURS;

  peakTimeDisplay = computed(() => {
    const data = this.heatmap();
    const day = this.daysOfWeek[data.stats.user.peakDay];
    const hour = this.hours[data.stats.user.peakHour];
    return `${day} at ${hour}`;
  });

  comparisonText = computed(() => {
    const data = this.heatmap();
    const percentage = data.stats.comparison.userVsServerAvg;
    if (percentage > 150) return 'very active';
    if (percentage > 100) return 'above average';
    if (percentage > 75) return 'about average';
    return 'below average';
  });

  chartOption = computed(() => {
    const data = this.heatmap();

    // Create a complete grid with all cells (24 hours × 7 days)
    const dataMap = new Map<string, { userValue: number; serverAvg: number; diff: number }>();

    // Populate map with actual data
    data.userHeatmap.forEach((point) => {
      dataMap.set(heatmapKey(point.hour, point.dayOfWeek), {
        userValue: point.userValue,
        serverAvg: point.serverAverage,
        diff: point.difference,
      });
    });

    // Transform data for ECharts: [hour, dayOfWeek, difference]
    // Positive difference = user above average (green/blue)
    // Negative difference = user below average (red/orange)
    const chartData = buildHeatmapGrid(
      (hour, day) => dataMap.get(heatmapKey(hour, day))?.diff || 0
    );

    // Find min and max for color scale (centered at 0)
    const maxAbsValue = Math.max(
      ...chartData.map((d) => Math.abs(d[2])),
      1
    );

    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: {
          color: '#f3f4f6',
        },
        formatter: (params: { value: [number, number, number] }) => {
          const value = params.value;
          const hour = this.hours[value[0]];
          const day = this.daysOfWeek[value[1]];
          const difference = value[2];

          const cellData = dataMap.get(heatmapKey(value[0], value[1]));

          if (!cellData || cellData.userValue === 0) {
            return `<strong>${day} at ${hour}</strong><br/>No activity`;
          }

          let tooltip = `<strong>${day} at ${hour}</strong><br/>`;
          tooltip += `Your time: ${this.durationPipe.transform(cellData.userValue * 60000, true)}<br/>`;
          tooltip += `Server avg: ${this.durationPipe.transform(cellData.serverAvg * 60000, true)}<br/>`;
          tooltip += `<span style="color: ${difference > 0 ? '#10b981' : '#ef4444'}">`;
          tooltip += difference > 0 ? '+' : '';
          tooltip += `${difference}m ${difference > 0 ? 'above' : 'below'} avg</span>`;

          return tooltip;
        },
      },
      grid: {
        height: '72%',
        top: '4%',
        left: '48px',
        right: '16px',
      },
      xAxis: {
        type: 'category',
        data: this.hours,
        axisLabel: {
          interval: 1,
          fontSize: 10,
          color: '#9ca3af',
        },
        axisTick: { show: false },
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: this.daysOfWeek,
        axisLabel: {
          color: '#9ca3af',
        },
        axisTick: { show: false },
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
      },
      visualMap: {
        min: -maxAbsValue,
        max: maxAbsValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        textStyle: {
          color: '#9ca3af',
        },
        // Diverging: red pole (below avg) -> neutral gray midpoint -> blue pole (above avg)
        inRange: {
          color: ['#dc2626', '#f87171', '#4b5563', '#60a5fa', '#2563eb'],
        },
      },
      series: [
        {
          name: 'User vs Server',
          type: 'heatmap',
          data: chartData,
          label: {
            show: false,
          },
          itemStyle: {
            borderColor: '#141824',
            borderWidth: 2,
            borderRadius: 2,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#e5e7eb',
              borderWidth: 1,
            },
          },
        },
      ],
    };
  });
}
