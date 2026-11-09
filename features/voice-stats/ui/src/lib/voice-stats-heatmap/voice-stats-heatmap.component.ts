import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  VoiceStatsHeatmap,
  VoiceStatsHeatmapDataPoint,
} from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import {
  HEATMAP_HOURS,
  buildHeatmapGrid,
  heatmapKey,
  slotLabel,
  weekdayRow,
} from '../heatmap-grid';
import { HeatmapChartComponent } from '../heatmap-chart/heatmap-chart.component';

@Component({
  selector: 'feature-voice-stats-heatmap',
  imports: [HeatmapChartComponent],
  templateUrl: './voice-stats-heatmap.component.html',
  styleUrls: ['./voice-stats-heatmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class VoiceStatsHeatmapComponent {
  heatmap = input.required<VoiceStatsHeatmap>();
  loading = input<boolean>(false);

  private readonly durationPipe = new HumanizeDurationPipe();
  protected readonly hours = HEATMAP_HOURS;

  // Keep the full point per cell so the tooltip doesn't have to
  // re-scan the payload on every hover
  private points = computed(() => {
    const map = new Map<string, VoiceStatsHeatmapDataPoint>();
    for (const point of this.heatmap().heatmap) {
      map.set(heatmapKey(point.hour, weekdayRow(point.dayOfWeek)), point);
    }
    return map;
  });

  protected cells = computed(() => {
    const points = this.points();
    return buildHeatmapGrid((hour, day) => points.get(heatmapKey(hour, day))?.value ?? 0);
  });

  protected tooltip = (hour: number, day: number) => {
    const point = this.points().get(heatmapKey(hour, day));
    let tooltip = `<strong>${slotLabel(hour, day)}</strong><br/>`;
    tooltip += `Duration: ${this.durationPipe.transform((point?.value ?? 0) * 60000, true)}<br/>`;
    if (point) {
      tooltip += `Sessions: ${point.sessionCount}<br/>`;
      tooltip += `Users: ${point.uniqueUsers}`;
    }
    return tooltip;
  };

  peakTimeDisplay = computed(() => {
    const { peakDay, peakHour } = this.heatmap().stats;
    return slotLabel(peakHour, weekdayRow(peakDay));
  });
}
