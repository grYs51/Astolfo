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

      <!-- Server Statistics Section -->
      <div class="mb-xl">
        <div class="flex items-center gap-md mb-md">
          <h2 class="text-2xl font-bold">Server Statistics</h2>
          <span class="px-sm py-xs bg-primary-500/20 text-primary-400 rounded-lg text-xs font-medium">
            Server-Wide Data
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
          <!-- Total Voice Time -->
          <lib-stat-card
            label="Total Voice Time"
            [value]="serverData.totalDurationHours + 'h ' + serverData.totalDurationMinutes + 'm'"
            icon="🎙️"
            [subtitle]="serverData.totalSessions + ' total sessions'"
            iconColor="text-blue-500"
          />

          <!-- Active Users -->
          <lib-stat-card
            label="Active Users"
            [value]="serverData.activeUsers"
            icon="👥"
            subtitle="Unique members"
            iconColor="text-green-500"
          />

          <!-- Live Sessions -->
          <lib-stat-card
            label="Live Now"
            [value]="serverData.activeSessions"
            icon="🔴"
            subtitle="Current sessions"
            iconColor="text-red-500"
          />

          <!-- Most Active Channel -->
          <lib-stat-card
            label="Top Channel"
            [value]="serverData.mostActiveChannelSessions"
            icon="📊"
            [subtitle]="serverData.mostActiveChannel?.name || 'N/A'"
            iconColor="text-purple-500"
          />
        </div>
      </div>

      <!-- Activity Breakdown Section -->
      @if (stats.activityBreakdown && stats.activityBreakdown.length > 0) {
        <div class="mb-xl">
          <feature-voice-stats-activity-breakdown
            [breakdown]="stats.activityBreakdown"
          />
        </div>
      }

      <!-- Additional Server Insights -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
        <!-- Average Session Duration -->
        <div class="bg-base-300 rounded-xl p-md">
          <div class="text-gray-400 text-sm mb-xs">Avg Session Duration</div>
          <div class="text-2xl font-bold">
            {{ getAverageSessionDuration(serverData.totalDuration, serverData.totalSessions) }}
          </div>
        </div>

        <!-- Sessions per User -->
        <div class="bg-base-300 rounded-xl p-md">
          <div class="text-gray-400 text-sm mb-xs">Avg Sessions/User</div>
          <div class="text-2xl font-bold">
            {{ getSessionsPerUser(serverData.totalSessions, serverData.activeUsers) }}
          </div>
        </div>

        <!-- Top Channel Activity -->
        <div class="bg-base-300 rounded-xl p-md">
          <div class="text-gray-400 text-sm mb-xs">Top Channel Usage</div>
          <div class="text-2xl font-bold">
            {{ getTopChannelPercentage(serverData.mostActiveChannelDuration, serverData.totalDuration) }}%
          </div>
          <div class="text-xs text-gray-500 mt-xs">
            of total server time
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
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
