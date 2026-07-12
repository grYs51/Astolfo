import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { VoiceStatsTimeline } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { BarChart } from 'echarts/charts';
echarts.use([CanvasRenderer, TooltipComponent, GridComponent, BarChart]);

@Component({
  selector: 'feature-voice-stats-timeline',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './voice-stats-timeline.component.html',
  styleUrl: './voice-stats-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsTimelineComponent {
  timeline = input.required<VoiceStatsTimeline>();
  loading = input<boolean>(false);

  maxValue = computed(() => {
    const data = this.timeline();
    return Math.max(...data.timeline.map(t => t.totalDuration), 1);
  });

  stats = computed(() => {
    const data = this.timeline();
    if (data.timeline.length === 0) {
      return { totalHours: 0, totalSessions: 0, avgUsers: 0, peakHours: 0 };
    }

    const totalHours = data.timeline.reduce((sum, b) => sum + b.totalDurationHours, 0);
    const totalSessions = data.timeline.reduce((sum, b) => sum + b.sessionCount, 0);
    const avgUsers = Math.round(data.timeline.reduce((sum, b) => sum + b.uniqueUsers, 0) / data.timeline.length);
    const peakBucket = data.timeline.reduce((max, b) => b.totalDuration > max.totalDuration ? b : max, data.timeline[0]);

    return {
      totalHours,
      totalSessions,
      avgUsers,
      peakHours: peakBucket.totalDurationHours,
    };
  });

  chartOption = computed(() => {
    const data = this.timeline();

    const labels = data.timeline.map(bucket => this.formatTimestamp(bucket.timestamp));
    // Chart values are hours (durations are stored in milliseconds)
    const values = data.timeline.map(bucket => +(bucket.totalDuration / 3_600_000).toFixed(2));
    const sessions = data.timeline.map(bucket => bucket.sessionCount);
    const users = data.timeline.map(bucket => bucket.uniqueUsers);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: {
          color: '#f3f4f6',
        },
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const bucket = data.timeline[index];
          return `
            <strong>${params[0].axisValue}</strong><br/>
            Duration: ${bucket.totalDurationHours}h ${bucket.totalDurationMinutes}m<br/>
            Sessions: ${bucket.sessionCount}<br/>
            Users: ${bucket.uniqueUsers}
          `;
        },
      },
      grid: {
        left: '60px',
        right: '40px',
        top: '40px',
        bottom: '60px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: '#9ca3af',
          rotate: 45,
          fontSize: 11,
        },
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: 'Hours',
        nameTextStyle: {
          color: '#9ca3af',
        },
        axisLabel: {
          color: '#9ca3af',
          formatter: (value: number) => `${value.toFixed(0)}h`,
        },
        axisLine: {
          lineStyle: {
            color: '#374151',
          },
        },
        splitLine: {
          lineStyle: {
            color: '#374151',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Voice Time',
          type: 'bar',
          data: values,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#a855f7' }, // Primary purple
                { offset: 1, color: '#7c3aed' }, // Darker purple
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#c084fc' },
                  { offset: 1, color: '#a855f7' },
                ],
              },
            },
          },
        },
      ],
    };
  });

  getBarHeight(duration: number): number {
    return (duration / this.maxValue()) * 100;
  }

  formatTimestamp(timestamp: string): string {
    const data = this.timeline();
    if (data.granularity === 'hour') {
      return timestamp.split('T')[1].slice(0, 5);
    } else if (data.granularity === 'day') {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } else {
      return timestamp;
    }
  }
}
