import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoiceStatsOverview } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent, SkeletonLoaderComponent } from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

@Component({
  selector: 'feature-voice-stats-server-overview',
  standalone: true,
  imports: [StatCardComponent, SkeletonLoaderComponent, HumanizeDurationPipe],
  template: `
    @if (loading()) {
      <lib-skeleton-loader type="stat-grid" />
    } @else {
      @let serverData = overview().server;

      <!-- KPI strip -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-sm">
        <lib-stat-card
          label="Voice Time"
          [value]="serverData.totalDuration | humanizeDuration: true"
          [dense]="true"
        />
        <lib-stat-card
          label="Sessions"
          [value]="serverData.totalSessions"
          [dense]="true"
        />
        <lib-stat-card
          label="Active Users"
          [value]="serverData.activeUsers"
          [dense]="true"
        />
        <lib-stat-card
          label="Live Now"
          [value]="serverData.activeSessions"
          [dense]="true"
        />
        <lib-stat-card
          label="Avg Session"
          [value]="averageSessionMs(serverData.totalDuration, serverData.totalSessions) | humanizeDuration: true"
          [dense]="true"
        />
        <lib-stat-card
          label="Top Channel"
          [value]="serverData.mostActiveChannel?.name || 'N/A'"
          [dense]="true"
        />
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsServerOverviewComponent {
  overview = input.required<VoiceStatsOverview>();
  loading = input<boolean>(false);

  averageSessionMs(totalDuration: number, totalSessions: number): number {
    if (totalSessions === 0) return 0;
    return totalDuration / totalSessions;
  }
}
