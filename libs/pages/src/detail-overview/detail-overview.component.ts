import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  VoiceStatsServerOverviewComponent,
  VoiceStatsLeaderboardComponent,
  VoiceStatsChannelsComponent,
  VoiceStatsTimelineComponent,
  VoiceStatsHeatmapComponent,
  VoiceStatsUserHeatmapComponent,
  VoiceStatsUserProfileComponent,
} from '@nx-stolfo/ui-voice-stats';
import {
  DashboardPeriod,
  TimelineGranularity,
  VoiceActivityType,
  VoiceStatsApi,
} from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

type Tab = 'you' | 'server';

const PERIOD_PHRASE: Record<DashboardPeriod, string> = {
  week: 'in the past week',
  month: 'in the past month',
  year: 'in the past year',
  all: 'in total',
};

@Component({
  selector: 'pages-detail-overview',
  imports: [
    VoiceStatsServerOverviewComponent,
    VoiceStatsLeaderboardComponent,
    VoiceStatsChannelsComponent,
    VoiceStatsTimelineComponent,
    VoiceStatsHeatmapComponent,
    VoiceStatsUserHeatmapComponent,
    VoiceStatsUserProfileComponent,
    SegmentedControlComponent,
    HumanizeDurationPipe,
  ],
  templateUrl: './detail-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
})
export class DetailOverviewComponent {
  /** Route param */
  id = input.required<string>();
  /** `?tab=server` (query params are bound to inputs too) */
  tab = input<string | undefined>();

  private voiceStatsApi = inject(VoiceStatsApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);
  currentUser = inject(USER);

  // ── Tabs: you first, then the group ──────────────────────────────────────
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'you', label: 'You' },
    { id: 'server', label: 'Server' },
  ];
  activeTab = computed<Tab>(() => (this.tab() === 'server' ? 'server' : 'you'));

  selectTab(tab: Tab) {
    // In the URL so a refresh or a shared link keeps the tab
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'you' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Arrow keys move between tabs (WAI-ARIA tabs pattern) */
  switchTab() {
    const next: Tab = this.activeTab() === 'you' ? 'server' : 'you';
    this.selectTab(next);
    this.document.getElementById(`tab-${next}`)?.focus();
  }

  // ── One period for the whole page ────────────────────────────────────────
  readonly periodOptions: SegmentedControlOption<DashboardPeriod>[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All time' },
  ];
  period = signal<DashboardPeriod>('month');
  periodPhrase = computed(() => PERIOD_PHRASE[this.period()]);
  /** Daily bars for a week or month, weekly bars beyond that */
  private granularity = computed<TimelineGranularity>(() =>
    this.period() === 'week' || this.period() === 'month' ? 'day' : 'week'
  );

  private userId = computed(() => this.currentUser()?.id);

  // ── Data (resources refetch when id/period/user change) ──────────────────
  overviewResource = this.voiceStatsApi.fetchVoiceStatsOverview(
    () => this.id(),
    () => this.period()
  );
  // Enough rows to find the viewer's rank; the list shows the top 10
  leaderboardResource = this.voiceStatsApi.fetchVoiceStatsLeaderboard(
    () => this.id(),
    () => this.period(),
    () => 100
  );
  channelsResource = this.voiceStatsApi.fetchVoiceStatsChannels(
    () => this.id(),
    () => this.period()
  );
  timelineResource = this.voiceStatsApi.fetchVoiceStatsTimeline(
    () => this.id(),
    () => this.period(),
    () => this.granularity()
  );
  heatmapResource = this.voiceStatsApi.fetchVoiceStatsHeatmap(
    () => this.id(),
    () => this.period()
  );
  userResource = this.voiceStatsApi.fetchVoiceStatsUser(
    () => this.id(),
    () => this.userId(),
    () => this.period()
  );
  userHeatmapResource = this.voiceStatsApi.fetchVoiceStatsUserHeatmap(
    () => this.id(),
    () => this.userId(),
    () => this.period()
  );

  /** Server name from the overview response; falls back while loading or if the bot can't see the guild */
  serverName = computed(
    () =>
      (this.overviewResource.hasValue() && this.overviewResource.value()?.guild.name) ||
      'Server'
  );

  // ── "You" summary ────────────────────────────────────────────────────────
  private leaderboardEntries = computed(() =>
    this.leaderboardResource.hasValue()
      ? this.leaderboardResource.value()?.leaderboard ?? []
      : []
  );
  memberCount = computed(() => this.leaderboardEntries().length);
  myRank = computed(() => {
    const index = this.leaderboardEntries().findIndex(
      (entry) => entry.member.id === this.userId()
    );
    return index >= 0 ? index + 1 : undefined;
  });

  // ── "Server" fun facts (replaces the activity-type donut) ────────────────
  funFacts = computed(() => {
    if (!this.overviewResource.hasValue()) return [];
    const breakdown = this.overviewResource.value()?.activityBreakdown ?? [];
    const duration = (...types: VoiceActivityType[]) =>
      breakdown
        .filter((item) => types.includes(item.type))
        .reduce((sum, item) => sum + item.duration, 0);

    const voice = duration(VoiceActivityType.VOICE);
    if (voice === 0) return [];
    const share = (ms: number) => Math.round((ms / voice) * 100);

    // Deafening also mutes, so the muted share includes deafened time
    return [
      { pct: share(duration(VoiceActivityType.MUTED, VoiceActivityType.SERVER_MUTED)), text: 'of voice time with the mic muted' },
      { pct: share(duration(VoiceActivityType.DEAF, VoiceActivityType.SERVER_DEAF)), text: 'deafened' },
      { pct: share(duration(VoiceActivityType.STREAMING)), text: 'streaming' },
      { pct: share(duration(VoiceActivityType.VIDEO)), text: 'with the camera on' },
    ].filter((fact) => fact.pct > 0);
  });
}
