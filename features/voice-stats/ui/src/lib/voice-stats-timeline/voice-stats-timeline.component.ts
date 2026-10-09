import { ChangeDetectionStrategy, Component, input, computed, signal } from '@angular/core';
import { VoiceStatsTimeline } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { BarChart } from 'echarts/charts';
echarts.use([CanvasRenderer, TooltipComponent, GridComponent, BarChart]);

@Component({
  selector: 'feature-voice-stats-timeline',
  imports: [NgxEchartsDirective, HumanizeDurationPipe, SegmentedControlComponent],
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

  /** What the bars show */
  metric = signal<'voice' | 'messages'>('voice');
  protected readonly metricOptions: SegmentedControlOption<'voice' | 'messages'>[] = [
    { value: 'voice', label: 'Voice' },
    { value: 'messages', label: 'Messages' },
  ];

  // The API returns every bucket of the period (empty ones as zero), so
  // "no data" means nothing at all rather than an empty list
  hasActivity = computed(() =>
    this.timeline().timeline.some((bucket) =>
      this.metric() === 'voice' ? bucket.sessionCount > 0 : bucket.messageCount > 0
    )
  );

  /** Most messages in one bucket */
  peakMessages = computed(() =>
    Math.max(0, ...this.timeline().timeline.map((bucket) => bucket.messageCount))
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
    const messages = this.metric() === 'messages';
    // Voice values are hours (durations are stored in milliseconds). Bars
    // stack "everyone else" under the viewer's own share.
    const hours = (ms: number) => +(ms / 3_600_000).toFixed(2);
    const others = data.timeline.map((bucket) =>
      messages ? bucket.messageCount - bucket.myMessageCount : hours(bucket.totalDuration - bucket.myDuration)
    );
    const mine = data.timeline.map((bucket) =>
      messages ? bucket.myMessageCount : hours(bucket.myDuration)
    );

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: {
          color: '#f3f4f6',
        },
        formatter: (params: { dataIndex: number; axisValue: string }[]) => {
          const bucket = data.timeline[params[0].dataIndex];
          if (messages) {
            const yours = bucket.myMessageCount > 0 ? `You: ${bucket.myMessageCount}<br/>` : '';
            return `<strong>${params[0].axisValue}</strong><br/>Messages: ${bucket.messageCount}<br/>${yours}`;
          }
          const you = bucket.myDuration > 0
            ? `You: ${this.durationPipe.transform(bucket.myDuration, true)}<br/>`
            : '';
          return `
            <strong>${params[0].axisValue}</strong><br/>
            Everyone: ${this.durationPipe.transform(bucket.totalDuration, true)}<br/>
            ${you}
            ${bucket.uniqueUsers} people · ${bucket.sessionCount} sessions
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
        name: messages ? 'Messages' : 'Hours',
        nameTextStyle: {
          color: '#9ca3af',
        },
        axisLabel: {
          color: '#9ca3af',
          formatter: (value: number) => (messages ? `${value}` : `${value}h`),
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
          name: 'Everyone else',
          type: 'bar',
          stack: 'voice',
          data: others,
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
        {
          name: 'You',
          type: 'bar',
          stack: 'voice',
          data: mine,
          itemStyle: { color: '#f0abfc', borderRadius: [4, 4, 0, 0] },
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
