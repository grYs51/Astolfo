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
  VoiceStatsOverviewComponent,
  VoiceStatsLeaderboardComponent,
  VoiceStatsChannelsComponent,
  VoiceStatsTimelineComponent,
  VoiceStatsHeatmapComponent,
} from '@nx-stolfo/ui-voice-stats';
import { VoiceStatsApi } from '@nx-stolfo/data-access-voice-stats';

@Component({
  selector: 'pages-detail-overview',
  imports: [
    CommonModule,
    VoiceStatsOverviewComponent,
    VoiceStatsLeaderboardComponent,
    VoiceStatsChannelsComponent,
    VoiceStatsTimelineComponent,
    VoiceStatsHeatmapComponent,
  ],
  templateUrl: './detail-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
})
export class DetailOverviewComponent {
  id = input.required<string>();

  private voiceStatsApi = inject(VoiceStatsApi);

  // State for filters (signals)
  selectedPeriod = signal<'day' | 'week' | 'month' | 'all'>('week');
  selectedTimelinePeriod = signal<'day' | 'week' | 'month' | 'year'>('month');
  selectedGranularity = signal<'hour' | 'day' | 'week'>('day');
  selectedHeatmapPeriod = signal<'week' | 'month' | 'year' | 'all'>('month');

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

  // Computed loading states
  isLoading = computed(
    () =>
      this.overviewResource.isLoading() ||
      this.leaderboardResource.isLoading() ||
      this.channelsResource.isLoading() ||
      this.timelineResource.isLoading() ||
      this.heatmapResource.isLoading(),
  );

  onUserClick(userId: string) {
    console.log('User clicked:', userId);
    // TODO: Navigate to user detail page or show user profile modal
  }

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
}
