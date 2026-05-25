import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { VoiceStatsHeatmap } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent } from '@nx-stolfo/components';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { HeatmapChart } from 'echarts/charts';
echarts.use([CanvasRenderer, TooltipComponent, VisualMapComponent, GridComponent, HeatmapChart]);

@Component({
  selector: 'feature-voice-stats-heatmap',
  imports: [CommonModule, NgxEchartsDirective, StatCardComponent],
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

    // Create a complete grid with all cells (24 hours × 7 days)
    const dataMap = new Map<string, number>();

    // Populate map with actual data
    data.heatmap.forEach((point) => {
      const key = `${point.hour}-${point.dayOfWeek}`;
      dataMap.set(key, point.value || 0);
    });

    // Transform data for ECharts: [hour, dayOfWeek, value]
    // Generate all 168 cells (24 hours × 7 days)
    const chartData: [number, number, number][] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        const key = `${hour}-${day}`;
        const value = dataMap.get(key) || 0;
        chartData.push([hour, day, value]);
      }
    }

    // Find max value for color scale
    const maxValue = Math.max(data.stats.maxValue || 1, 1); // Ensure at least 1 for color scale

    console.log('Heatmap data points:', chartData.length);
    console.log('Non-zero points:', chartData.filter(d => d[2] > 0).length);
    console.log('Max value:', maxValue);
    console.log('First 5 data points [hour, day, value]:', chartData.slice(0, 5));
    console.log('Raw backend data:', data.heatmap);

    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#1f2937', // bg-gray-800
        borderColor: '#374151', // border-gray-700
        borderWidth: 1,
        textStyle: {
          color: '#f3f4f6', // text-gray-100
        },
        formatter: (params: unknown) => {
          const value = (params as { value: [number, number, number] }).value;
          const hour = this.hours[value[0]]; // X-axis is hour
          const day = this.daysOfWeek[value[1]]; // Y-axis is day
          const minutes = value[2];
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;

          // Find the data point for additional info
          const dataPoint = data.heatmap.find(
            (p) => p.hour === value[0] && p.dayOfWeek === value[1],
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
          color: '#9ca3af', // text-gray-400
        },
        axisLine: {
          lineStyle: {
            color: '#374151', // border color
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
          color: '#9ca3af', // text-gray-400
        },
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
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
            '#2d1b4e', // Dark purple (low activity) - more visible than previous
            '#4a1f6f', // Purple
            '#6b2f8a', // Medium purple
            '#8b4fa6', // Light purple
            '#a855f7', // Primary purple
            '#c084fc', // Light primary
            '#d8b4fe', // Lighter
            '#e9d5ff', // Very light
            '#f3e8ff', // Almost white (high activity)
          ],
        },
        text: ['High Activity', 'Low Activity'],
        textStyle: {
          color: '#9ca3af', // text-gray-400
        },
        show: true, // Make sure visualMap is visible
      },
      series: [
        {
          name: 'Voice Activity',
          type: 'heatmap',
          data: chartData,
          label: {
            show: false,
          },
          itemStyle: {
            borderColor: '#1a1a2e',
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              borderColor: '#fff',
              borderWidth: 2,
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
