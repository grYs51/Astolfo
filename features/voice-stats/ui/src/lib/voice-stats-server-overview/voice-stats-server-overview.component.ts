import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoiceStatsOverview } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent, SkeletonLoaderComponent } from '@nx-stolfo/components';
import { VoiceStatsActivityBreakdownComponent } from '../voice-stats-activity-breakdown/voice-stats-activity-breakdown.component';

@Component({
  selector: 'feature-voice-stats-server-overview',
  standalone: true,
  imports: [StatCardComponent, SkeletonLoaderComponent, VoiceStatsActivityBreakdownComponent],
  template: `
    @if (loading()) {
      <lib-skeleton-loader type="stat-grid" />
    } @else {
      @let stats = overview();
      @let serverData = stats.server;

      <!-- Headline stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
        <lib-stat-card
          label="Total Voice Time"
          [value]="serverData.totalDurationHours + 'h ' + serverData.totalDurationMinutes + 'm'"
          icon="🎙️"
          [subtitle]="serverData.totalSessions + ' total sessions'"
        />
        <lib-stat-card
          label="Active Users"
          [value]="serverData.activeUsers"
          icon="👥"
          subtitle="Unique members"
        />
        <lib-stat-card
          label="Live Now"
          [value]="serverData.activeSessions"
          icon="🔴"
          subtitle="Current sessions"
        />
        <lib-stat-card
          label="Top Channel"
          [value]="serverData.mostActiveChannel?.name || 'N/A'"
          icon="📊"
          [subtitle]="serverData.mostActiveChannelSessions + ' sessions'"
          valueSize="text-xl"
        />
      </div>

      <!-- Secondary insights -->
      <div class="mt-md grid grid-cols-1 md:grid-cols-3 gap-md">
        <lib-stat-card
          label="Avg Session Duration"
          [value]="getAverageSessionDuration(serverData.totalDuration, serverData.totalSessions)"
          valueSize="text-xl"
        />
        <lib-stat-card
          label="Avg Sessions / User"
          [value]="getSessionsPerUser(serverData.totalSessions, serverData.activeUsers)"
          valueSize="text-xl"
        />
        <lib-stat-card
          label="Top Channel Usage"
          [value]="getTopChannelPercentage(serverData.mostActiveChannelDuration, serverData.totalDuration) + '%'"
          subtitle="of total server time"
          valueSize="text-xl"
        />
      </div>

      <!-- Activity breakdown -->
      @if (stats.activityBreakdown && stats.activityBreakdown.length > 0) {
        <div class="mt-md">
          <feature-voice-stats-activity-breakdown [breakdown]="stats.activityBreakdown" />
        </div>
      }
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

  getAverageSessionDuration(totalDuration: number, totalSessions: number): string {
    if (totalSessions === 0) return '0m';
    const avgMs = totalDuration / totalSessions;
    const hours = Math.floor(avgMs / (1000 * 60 * 60));
    const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  getSessionsPerUser(totalSessions: number, activeUsers: number): string {
    if (activeUsers === 0) return '0';
    return (totalSessions / activeUsers).toFixed(1);
  }

  getTopChannelPercentage(channelDuration: number, totalDuration: number): number {
    if (totalDuration === 0) return 0;
    return Math.round((channelDuration / totalDuration) * 100);
  }
}
