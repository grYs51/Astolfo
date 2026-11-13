import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink, UrlTree } from '@angular/router';
import { PresenceRhythmMember, ServerPresence } from '@nx-stolfo/data-access-voice-stats';
import {
  HEATMAP_HOURS,
  buildHeatmapGrid,
  heatmapKey,
  slotLabel,
  weekdayRow,
} from '../heatmap-grid';
import { HeatmapChartComponent } from '../heatmap-chart/heatmap-chart.component';

/**
 * Server pulse: average members online for each hour of the week, with the
 * night owls and early birds under it.
 */
@Component({
  selector: 'feature-voice-stats-server-pulse',
  imports: [HeatmapChartComponent, RouterLink, DecimalPipe, PercentPipe],
  templateUrl: './server-pulse.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ServerPulseComponent {
  presence = input.required<ServerPresence>();
  /** Router commands for a member's profile */
  memberLink = input<((memberId: string) => unknown[] | UrlTree) | undefined>(undefined);

  private averages = computed(
    () => new Map(this.presence().cells.map((c) => [heatmapKey(c.hour, weekdayRow(c.dayOfWeek)), c.avgOnline]))
  );

  protected isEmpty = computed(() => this.presence().cells.every((c) => c.avgOnline === 0));

  protected peak = computed(() => {
    const best = this.presence().cells.reduce((a, b) => (b.avgOnline > a.avgOnline ? b : a));
    return { label: slotLabel(best.hour, weekdayRow(best.dayOfWeek)), value: best.avgOnline };
  });

  protected groups = computed<{ title: string; hint: string; members: PresenceRhythmMember[] }[]>(() => [
    { title: 'Night owls', hint: 'of their online time between midnight and 5 AM', members: this.presence().nightOwls },
    { title: 'Early birds', hint: 'of their online time between 5 and 9 AM', members: this.presence().earlyBirds },
  ]);

  protected readonly hours = HEATMAP_HOURS;

  protected cells = computed(() => {
    const averages = this.averages();
    return buildHeatmapGrid((hour, day) => Math.round((averages.get(heatmapKey(hour, day)) ?? 0) * 10) / 10);
  });

  protected tooltip = (hour: number, day: number) =>
    `<strong>${slotLabel(hour, day)}</strong><br/>${(this.averages().get(heatmapKey(hour, day)) ?? 0).toFixed(1)} members online on average`;
}
