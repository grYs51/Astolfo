import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { VoiceStatsHeatmap } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
echarts.use([CanvasRenderer, TooltipComponent, VisualMapComponent, GridComponent]);

@Component({
  selector: 'feature-voice-stats-heatmap',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, ],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './voice-stats-heatmap.component.html',
  styleUrls: ['./voice-stats-heatmap.component.scss'],
})
export class VoiceStatsHeatmapComponent {
  heatmap = input.required<VoiceStatsHeatmap>();
  loading = input<boolean>(false);

  // Expose Math for template
  protected readonly Math = Math;

  // Days of week labels
  private readonly daysOfWeek = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ];

  // Hours of day (0-23)
  private readonly hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 || 12;
    const period = i < 12 ? 'AM' : 'PM';
    return `${hour}${period}`;
  });

  chartOption = computed(() => {
    const data = this.heatmap();

    // Transform data for ECharts: [dayOfWeek, hour, value]
    const chartData = data.heatmap.map((point) => [
      point.dayOfWeek,
      point.hour,
      point.value,
    ]);

    // Find max value for color scale
    const maxValue = data.stats.maxValue || 1;

    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const value = (params as { value: [number, number, number] }).value;
          const day = this.daysOfWeek[value[0]];
          const hour = this.hours[value[1]];
          const minutes = value[2];
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;

          // Find the data point for additional info
          const dataPoint = data.heatmap.find(
            (p) => p.dayOfWeek === value[0] && p.hour === value[1],
          );

          let tooltip = `<strong>${day} at ${hour}</strong><br/>`;
          tooltip += `Duration: ${hours}h ${mins}m<br/>`;
          if (dataPoint) {
            tooltip += `Sessions: ${dataPoint.sessionCount}<br/>`;
            tooltip += `Users: ${dataPoint.uniqueUsers}`;
          }
          return tooltip;
        },
      },
      grid: {
        height: '70%',
        top: '10%',
        left: '80px',
        right: '40px',
      },
      xAxis: {
        type: 'category',
        data: this.hours,
        splitArea: {
          show: true,
        },
        axisLabel: {
          interval: 1, // Show every hour
          rotate: 45,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'category',
        data: this.daysOfWeek,
        splitArea: {
          show: true,
        },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        inRange: {
          color: [
            '#313695', // Dark blue (low activity)
            '#4575b4',
            '#74add1',
            '#abd9e9',
            '#e0f3f8',
            '#ffffbf',
            '#fee090',
            '#fdae61',
            '#f46d43',
            '#d73027',
            '#a50026', // Dark red (high activity)
          ],
        },
        text: ['High Activity', 'Low Activity'],
        textStyle: {
          color: '#999',
        },
      },
      series: [
        {
          name: 'Voice Activity',
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

  // Peak time display
  peakTimeDisplay = computed(() => {
    const data = this.heatmap();
    const day = this.daysOfWeek[data.stats.peakDay];
    const hour = this.hours[data.stats.peakHour];
    return `${day} at ${hour}`;
  });

  totalHours = computed(() => {
    const minutes = this.heatmap().stats.totalMinutes;
    return Math.floor(minutes / 60);
  });

  avgMinutes = computed(() => {
    return this.heatmap().stats.avgValue;
  });
}
