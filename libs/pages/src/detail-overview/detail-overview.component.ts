import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  VoiceStatsServerOverviewComponent,
  VoiceStatsActivityBreakdownComponent,
  VoiceStatsLeaderboardComponent,
  VoiceStatsChannelsComponent,
  VoiceStatsTimelineComponent,
  VoiceStatsHeatmapComponent,
  VoiceStatsUserHeatmapComponent,
} from '@nx-stolfo/ui-voice-stats';
import {
  HeatmapPeriod,
  TimelineGranularity,
  TimelinePeriod,
  VoiceStatsApi,
  VoiceStatsPeriod,
} from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';

// Shared with the API, so a new period/granularity on one side breaks the
// build of the other instead of silently drifting
type Period = VoiceStatsPeriod;
type Granularity = TimelineGranularity;

@Component({
  selector: 'pages-detail-overview',
  imports: [
    VoiceStatsServerOverviewComponent,
    VoiceStatsActivityBreakdownComponent,
    VoiceStatsLeaderboardComponent,
    VoiceStatsChannelsComponent,
    VoiceStatsTimelineComponent,
    VoiceStatsHeatmapComponent,
    VoiceStatsUserHeatmapComponent,
    SegmentedControlComponent,
  ],
  templateUrl: './detail-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
})
export class DetailOverviewComponent {
  id = input.required<string>();

  private voiceStatsApi = inject(VoiceStatsApi);
  currentUser = inject(USER);

  readonly sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'heatmap', label: 'Weekly pattern' },
    { id: 'you', label: 'Your activity' },
  ];

  scrollTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly periodOptions: SegmentedControlOption<Period>[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All' },
  ];

  readonly timelinePeriodOptions: SegmentedControlOption<TimelinePeriod>[] = [
    { value: 'day', label: '24h' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  readonly granularityOptions: SegmentedControlOption<Granularity>[] = [
    { value: 'hour', label: 'Hourly' },
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
  ];

  readonly heatmapPeriodOptions: SegmentedControlOption<HeatmapPeriod>[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All time' },
  ];

  // Filter state — resources below refetch automatically on change
  selectedPeriod = signal<Period>('week');
  selectedTimelinePeriod = signal<TimelinePeriod>('month');
  selectedGranularity = signal<Granularity>('day');
  selectedHeatmapPeriod = signal<HeatmapPeriod>('month');
  selectedUserHeatmapPeriod = signal<HeatmapPeriod>('month');

  overviewResource = this.voiceStatsApi.fetchVoiceStatsOverview(() => this.id());

  /** Server name from the overview response; falls back while loading or if the bot can't see the guild */
  serverName = computed(
    () =>
      (this.overviewResource.hasValue() && this.overviewResource.value()?.guild.name) ||
      'Server'
  );

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
}
