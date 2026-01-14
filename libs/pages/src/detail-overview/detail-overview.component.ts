import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  VoiceStatsServerOverviewComponent,
  VoiceStatsLeaderboardComponent,
  VoiceStatsChannelsComponent,
  VoiceStatsTimelineComponent,
  VoiceStatsHeatmapComponent,
  VoiceStatsUserHeatmapComponent,
} from '@nx-stolfo/ui-voice-stats';
import { VoiceStatsApi } from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';

@Component({
  selector: 'pages-detail-overview',
  imports: [
    CommonModule,
    VoiceStatsServerOverviewComponent,
    VoiceStatsLeaderboardComponent,
    VoiceStatsChannelsComponent,
    VoiceStatsTimelineComponent,
    VoiceStatsHeatmapComponent,
    VoiceStatsUserHeatmapComponent,
  ],
  templateUrl: './detail-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
})
export class DetailOverviewComponent {
  id = input.required<string>();

  private voiceStatsApi = inject(VoiceStatsApi);
  currentUser = inject(USER);

  // State for filters (signals)
  selectedPeriod = signal<'day' | 'week' | 'month' | 'all'>('week');
  selectedTimelinePeriod = signal<'day' | 'week' | 'month' | 'year'>('month');
  selectedGranularity = signal<'hour' | 'day' | 'week'>('day');
  selectedHeatmapPeriod = signal<'week' | 'month' | 'year' | 'all'>('month');
  selectedUserHeatmapPeriod = signal<'week' | 'month' | 'year' | 'all'>('month');

  // Reactive resources - automatically refetch when signals change!
  overviewResource = this.voiceStatsApi.fetchVoiceStatsOverview(() => this.id());

  leaderboardResource = this.voiceStatsApi.fetchVoiceStatsLeaderboard(
    () => this.id(),
    () => this.selectedPeriod(),
    () => 10
  );

  channelsResource = this.voiceStatsApi.fetchVoiceStatsChannels(() => this.id());

  timelineResource = this.voiceStatsApi.fetchVoiceStatsTimeline(
    () => this.id(),
    () => this.selectedTimelinePeriod(),
    () => this.selectedGranularity()
  );

  heatmapResource = this.voiceStatsApi.fetchVoiceStatsHeatmap(
    () => this.id(),
    () => this.selectedHeatmapPeriod()
  );

  // User heatmap - shows current user's activity vs server average
  userHeatmapResource = this.voiceStatsApi.fetchVoiceStatsUserHeatmap(
    () => this.id(),
    () => this.currentUser()?.id || '',
    () => this.selectedUserHeatmapPeriod()
  );

  // Computed loading states
  isLoading = computed(
    () =>
      this.overviewResource.isLoading() ||
      this.leaderboardResource.isLoading() ||
      this.channelsResource.isLoading() ||
      this.timelineResource.isLoading() ||
      this.heatmapResource.isLoading(),
  );

  setPeriod(period: 'day' | 'week' | 'month' | 'all') {
    this.selectedPeriod.set(period);
    // Resource automatically refetches!
  }

  setTimelinePeriod(period: 'day' | 'week' | 'month' | 'year') {
    this.selectedTimelinePeriod.set(period);
    // Resource automatically refetches!
  }

  setGranularity(granularity: 'hour' | 'day' | 'week') {
    this.selectedGranularity.set(granularity);
    // Resource automatically refetches!
  }

  setHeatmapPeriod(period: 'week' | 'month' | 'year' | 'all') {
    this.selectedHeatmapPeriod.set(period);
    // Resource automatically refetches!
  }

  setUserHeatmapPeriod(period: 'week' | 'month' | 'year' | 'all') {
    this.selectedUserHeatmapPeriod.set(period);
    // Resource automatically refetches!
  }
}
