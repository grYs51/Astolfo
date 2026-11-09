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
import {
  HEATMAP_HOURS,
  buildHeatmapGrid,
  heatmapKey,
  slotLabel,
  weekdayRow,
} from '../heatmap-grid';
import { HeatmapChartComponent } from '../heatmap-chart/heatmap-chart.component';

type Mode = 'you' | 'compare';

/**
 * "When you're on": the viewer's own voice time by hour × weekday, with an
 * optional comparison against the average member who was in voice then.
 */
@Component({
  selector: 'feature-voice-stats-user-heatmap',
  standalone: true,
  imports: [HeatmapChartComponent, SegmentedControlComponent],
  templateUrl: './voice-stats-user-heatmap.component.html',
  styleUrls: ['./voice-stats-user-heatmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsUserHeatmapComponent {
  heatmap = input.required<VoiceStatsUserHeatmap>();
  loading = input<boolean>(false);
  /** Another member's display name; empty for the viewer themselves */
  name = input<string | undefined>(undefined);

  protected mode = signal<Mode>('you');
  protected readonly modeOptions: SegmentedControlOption<Mode>[] = [
    { value: 'you', label: 'Just me' },
    { value: 'compare', label: 'vs server' },
  ];

  private readonly durationPipe = new HumanizeDurationPipe();
  protected readonly hours = HEATMAP_HOURS;

  protected hasActivity = computed(() => this.heatmap().stats.user.totalMinutes > 0);

  peakTimeDisplay = computed(() => {
    const { peakDay, peakHour } = this.heatmap().stats.user;
    return slotLabel(peakHour, weekdayRow(peakDay));
  });

  private points = computed(() => {
    const map = new Map<string, { userValue: number; serverAvg: number; diff: number }>();
    for (const point of this.heatmap().userHeatmap) {
      map.set(heatmapKey(point.hour, weekdayRow(point.dayOfWeek)), {
        userValue: point.userValue,
        serverAvg: point.serverAverage,
        diff: point.difference,
      });
    }
    return map;
  });

  // Hours without the viewer's activity stay uncoloured (null): as a 0
  // they'd look like "no difference" in compare mode
  protected cells = computed(() => {
    const points = this.points();
    const compare = this.mode() === 'compare';
    return buildHeatmapGrid((hour, day) => {
      const point = points.get(heatmapKey(hour, day));
      if (!point) return null;
      return compare ? point.diff : point.userValue;
    });
  });

  protected tooltip = (hour: number, day: number) => {
    const title = `<strong>${slotLabel(hour, day)}</strong><br/>`;
    const point = this.points().get(heatmapKey(hour, day));
    if (!point || point.userValue === 0) return `${title}No activity`;

    let text = `${title}You: ${this.durationPipe.transform(point.userValue * 60000, true)}`;
    if (this.mode() === 'compare') {
      text += `<br/>Average member: ${this.durationPipe.transform(point.serverAvg * 60000, true)}`;
      text += `<br/><span style="color: ${point.diff > 0 ? '#60a5fa' : '#f87171'}">`;
      text += `${point.diff > 0 ? '+' : ''}${point.diff}m ${point.diff > 0 ? 'more' : 'less'}</span>`;
    }
    return text;
  };
}
