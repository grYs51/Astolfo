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
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-sm">
        <lib-stat-card
          label="Voice time"
          [value]="serverData.totalDuration | humanizeDuration: true"
          [dense]="true"
        />
        <lib-stat-card
          label="Active members"
          [value]="serverData.activeUsers"
          [dense]="true"
        />
        <lib-stat-card
          label="In voice now"
          [value]="serverData.activeSessions"
          [dense]="true"
        />
        <lib-stat-card
          label="Top channel"
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
}
