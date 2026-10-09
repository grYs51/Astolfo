import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardPeriod, VoiceStatsApi } from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';
import { MemberActivityComponent } from '../member-activity/member-activity.component';

/** Another member's activity on a server (/overview/detail/:id/members/:memberId). */
@Component({
  selector: 'pages-member-profile',
  imports: [MemberActivityComponent, SegmentedControlComponent, RouterLink],
  templateUrl: './member-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
})
export class MemberProfileComponent {
  /** Server id (route param) */
  id = input.required<string>();
  /** Member id (route param) */
  memberId = input.required<string>();

  private api = inject(VoiceStatsApi);
  private currentUser = inject(USER);

  readonly periodOptions: SegmentedControlOption<DashboardPeriod>[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All time' },
  ];
  period = signal<DashboardPeriod>('month');

  userResource = this.api.fetchVoiceStatsUser(
    () => this.id(),
    () => this.memberId(),
    () => this.period()
  );
  heatmapResource = this.api.fetchVoiceStatsUserHeatmap(
    () => this.id(),
    () => this.memberId(),
    () => this.period()
  );
  // For the member's ranks and the server name in the back link
  private leaderboardResource = this.api.fetchVoiceStatsLeaderboard(
    () => this.id(),
    () => this.period(),
    () => 100
  );
  private messagesResource = this.api.fetchServerMessages(
    () => this.id(),
    () => this.period()
  );
  private overviewResource = this.api.fetchVoiceStatsOverview(
    () => this.id(),
    () => this.period()
  );

  /** Viewing your own profile reads in the first person */
  isSelf = computed(() => this.memberId() === this.currentUser()?.id);

  member = computed(() =>
    this.userResource.hasValue() ? this.userResource.value()?.member : undefined
  );
  name = computed(() => {
    const member = this.member();
    return member?.displayName || member?.username || 'This member';
  });
  serverName = computed(
    () =>
      (this.overviewResource.hasValue() && this.overviewResource.value()?.guild.name) ||
      'Server'
  );

  private rankIn = (ids: string[]) => {
    const index = ids.indexOf(this.memberId());
    return index >= 0 ? index + 1 : undefined;
  };
  private voiceIds = computed(() =>
    this.leaderboardResource.hasValue()
      ? (this.leaderboardResource.value()?.leaderboard ?? []).map((e) => e.member.id)
      : []
  );
  voiceRank = computed(() => this.rankIn(this.voiceIds()));
  memberCount = computed(() => this.voiceIds().length);
  messageRank = computed(() =>
    this.messagesResource.hasValue()
      ? this.rankIn((this.messagesResource.value()?.topMembers ?? []).map((e) => e.member.id))
      : undefined
  );

  memberLink = (memberId: string) =>
    memberId === this.currentUser()?.id
      ? ['/overview/detail', this.id()]
      : ['/overview/detail', this.id(), 'members', memberId];
}
