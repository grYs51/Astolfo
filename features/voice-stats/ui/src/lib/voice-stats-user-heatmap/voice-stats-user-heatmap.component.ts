import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { VoiceStatsUserHeatmap } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent } from '@nx-stolfo/components';
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
  imports: [CommonModule, NgxEchartsDirective, StatCardComponent],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './voice-stats-user-heatmap.component.html',
  styleUrls: ['./voice-stats-user-heatmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsUserHeatmapComponent {
  heatmap = input.required<VoiceStatsUserHeatmap>();
  loading = input<boolean>(false);

  // Expose Math for template
  protected readonly Math = Math;

  private readonly daysOfWeek = HEATMAP_DAYS_OF_WEEK;
  private readonly hours = HEATMAP_HOURS;

  totalHours = computed(() => Math.floor(this.heatmap().stats.user.totalMinutes / 60));

  peakTimeDisplay = computed(() => {
    const data = this.heatmap();
    const day = this.daysOfWeek[data.stats.user.peakDay];
    const hour = this.hours[data.stats.user.peakHour];
    return `${day} ${hour}`;
  });

  avgMinutes = computed(() => this.heatmap().stats.user.avgValue);

  comparisonText = computed(() => {
    const data = this.heatmap();
    const percentage = data.stats.comparison.userVsServerAvg;
    if (percentage > 150) return 'Very Active';
    if (percentage > 100) return 'Above Average';
    if (percentage > 75) return 'Average';
    return 'Below Average';
  });

  comparisonColor = computed(() => {
    const data = this.heatmap();
    const percentage = data.stats.comparison.userVsServerAvg;
    if (percentage > 150) return 'text-purple-400';
    if (percentage > 100) return 'text-green-400';
    if (percentage > 75) return 'text-blue-400';
    return 'text-gray-400';
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

          const userHours = Math.floor(cellData.userValue / 60);
          const userMins = cellData.userValue % 60;
          const avgHours = Math.floor(cellData.serverAvg / 60);
          const avgMins = cellData.serverAvg % 60;

          let tooltip = `<strong>${day} at ${hour}</strong><br/>`;
          tooltip += `Your time: ${userHours}h ${userMins}m<br/>`;
          tooltip += `Server avg: ${avgHours}h ${avgMins}m<br/>`;
          tooltip += `<span style="color: ${difference > 0 ? '#10b981' : '#ef4444'}">`;
          tooltip += difference > 0 ? '+' : '';
          tooltip += `${difference}m ${difference > 0 ? 'above' : 'below'} avg</span>`;

          return tooltip;
        },
      },
      grid: {
        height: '70%',
        top: '10%',
        left: '80px',
        right: '40px',
        backgroundColor: 'transparent',
      },
      xAxis: {
        type: 'category',
        data: this.hours,
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)'],
          },
        },
        axisLabel: {
          interval: 1,
          rotate: 45,
          fontSize: 10,
          color: '#9ca3af',
        },
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: this.daysOfWeek,
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)'],
          },
        },
        axisLabel: {
          color: '#9ca3af',
        },
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
        bottom: '5%',
        textStyle: {
          color: '#9ca3af',
        },
        inRange: {
          // Red (below avg) -> Gray (at avg) -> Blue/Green (above avg)
          color: ['#ef4444', '#f97316', '#64748b', '#3b82f6', '#10b981'],
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
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  });
}
