import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { VoiceStatsTimeline } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { BarChart } from 'echarts/charts';
echarts.use([CanvasRenderer, TooltipComponent, GridComponent, BarChart]);

@Component({
  selector: 'feature-voice-stats-timeline',
  imports: [NgxEchartsDirective, HumanizeDurationPipe],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './voice-stats-timeline.component.html',
  styleUrl: './voice-stats-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class VoiceStatsTimelineComponent {
  timeline = input.required<VoiceStatsTimeline>();
  loading = input<boolean>(false);

  private readonly durationPipe = new HumanizeDurationPipe();

  // The API returns every bucket of the period (empty ones as zero), so
  // "no data" means no sessions at all rather than an empty list
  hasActivity = computed(() =>
    this.timeline().timeline.some((bucket) => bucket.sessionCount > 0)
  );

  stats = computed(() => {
    const data = this.timeline();
    if (data.timeline.length === 0) {
      return { totalMs: 0, totalSessions: 0, avgUsers: 0, peakMs: 0 };
    }

    const totalMs = data.timeline.reduce((sum, b) => sum + b.totalDuration, 0);
    const totalSessions = data.timeline.reduce((sum, b) => sum + b.sessionCount, 0);
    const avgUsers = Math.round(data.timeline.reduce((sum, b) => sum + b.uniqueUsers, 0) / data.timeline.length);
    const peakBucket = data.timeline.reduce((max, b) => b.totalDuration > max.totalDuration ? b : max, data.timeline[0]);

    return {
      totalMs,
      totalSessions,
      avgUsers,
      peakMs: peakBucket.totalDuration,
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
            Duration: ${this.durationPipe.transform(bucket.totalDuration, true)}<br/>
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
          formatter: (value: number) => `${value}h`,
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

  formatTimestamp(timestamp: string): string {
    const { granularity } = this.timeline();
    // The API buckets in the viewer's time zone (`tz` param) and returns
    // wall-clock strings ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'), so format the
    // parts directly — going through Date would shift them by the UTC offset
    const [datePart, time] = timestamp.split('T');
    const [, month, day] = datePart.split('-').map(Number);
    const label = `${month}/${day}`;

    if (granularity === 'hour') {
      // With the date: a week of hourly buckets would otherwise repeat the
      // same "14:00" labels
      return `${label} ${time}`;
    }
    return granularity === 'week' ? `Week of ${label}` : label;
  }
}
