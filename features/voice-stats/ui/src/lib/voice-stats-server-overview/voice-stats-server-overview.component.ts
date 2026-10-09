import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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

      <!-- KPI strip (h-full: equal-height cards whether or not they have a second line) -->
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-sm">
        <lib-stat-card
          label="Voice time"
          [value]="serverData.totalDuration | humanizeDuration: true"
          [subtitle]="change()"
          [dense]="true"
          containerClass="h-full"
        />
        <lib-stat-card
          label="Active members"
          [value]="serverData.activeUsers"
          [dense]="true"
          containerClass="h-full"
        />

        <!-- In voice now: who and where, not just a count -->
        <div class="h-full rounded-xl border border-white/5 bg-base-300 p-sm px-md">
          <p class="text-[10px] font-medium uppercase tracking-wider text-gray-500">In voice now</p>
          @if (overview().liveNow.length === 0) {
            <p class="mt-xs text-sm text-gray-400">Nobody right now</p>
          } @else {
            <div class="mt-xs flex items-center gap-sm">
              <div class="flex -space-x-2">
                @for (live of overview().liveNow.slice(0, 5); track live.member.id) {
                  @if (live.member.avatar) {
                    <img
                      [src]="live.member.avatar"
                      [alt]="live.member.displayName || live.member.username"
                      [title]="(live.member.displayName || live.member.username) + ' · ' + live.channel.name"
                      class="h-6 w-6 rounded-full ring-2 ring-base-300"
                    />
                  }
                }
              </div>
              <span class="text-lg font-bold leading-tight text-gray-100">{{ overview().liveNow.length }}</span>
            </div>
            <p class="mt-xs truncate text-xs text-gray-500" [title]="whoIsLive()">{{ whoIsLive() }}</p>
          }
        </div>

        <lib-stat-card
          label="Top channel"
          [value]="serverData.mostActiveChannel?.name || 'N/A'"
          [dense]="true"
          containerClass="h-full"
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
  /** e.g. "the month before"; the change line is hidden without a previous period */
  previousLabel = input<string>();

  /** "↑ 17% vs the month before" */
  protected change = computed(() => {
    const { totalDuration, previousTotalDuration } = this.overview().server;
    const label = this.previousLabel();
    if (previousTotalDuration === null || !label) return undefined;
    if (previousTotalDuration === 0) return totalDuration > 0 ? `New activity vs ${label}` : undefined;
    const pct = Math.round(((totalDuration - previousTotalDuration) / previousTotalDuration) * 100);
    if (pct === 0) return `Same as ${label}`;
    return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs ${label}`;
  });

  /** "Luna, Rex in Gaming · Otto in Lobby" */
  protected whoIsLive = computed(() => {
    const byChannel = new Map<string, string[]>();
    for (const live of this.overview().liveNow) {
      const names = byChannel.get(live.channel.name) ?? [];
      names.push(live.member.displayName || live.member.username);
      byChannel.set(live.channel.name, names);
    }
    return [...byChannel]
      .map(([channel, names]) => `${names.join(', ')} in ${channel}`)
      .join(' · ');
  });
}
