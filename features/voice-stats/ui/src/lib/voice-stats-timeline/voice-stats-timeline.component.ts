import { UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { VoiceStatsTimeline } from '@nx-stolfo/data-access-voice-stats';

@Component({
  selector: 'feature-voice-stats-timeline',
  imports: [UpperCasePipe],
  templateUrl: './voice-stats-timeline.component.html',
  styles: ``,
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
