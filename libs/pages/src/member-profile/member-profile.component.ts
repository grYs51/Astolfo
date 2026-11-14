import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DashboardPeriod, VoiceStatsApi } from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import { SegmentedControlComponent } from '@nx-stolfo/components';
import { MemberActivityComponent } from '../member-activity/member-activity.component';
import { PERIOD_OPTIONS, parsePeriod, periodParam } from '../period';
import { CardDialogComponent } from '../card-dialog/card-dialog.component';

/** Another member's activity on a server (/overview/detail/:id/members/:memberId). */
@Component({
  selector: 'pages-member-profile',
  imports: [MemberActivityComponent, SegmentedControlComponent, RouterLink, CardDialogComponent],
  templateUrl: './member-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
})
export class MemberProfileComponent {
  /** Server id (route param) */
  id = input.required<string>();
  /** Member id (route param) */
  memberId = input.required<string>();
  /** `?period=week`; month when absent */
  period = input<string | undefined>();

  private api = inject(VoiceStatsApi);
  private currentUser = inject(USER);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly periodOptions = PERIOD_OPTIONS;
  activePeriod = computed(() => parsePeriod(this.period()));
  /** For links that keep the period */
  periodParam = computed(() => periodParam(this.activePeriod()));

  selectPeriod(period: DashboardPeriod) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { period: periodParam(period) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  userResource = this.api.fetchVoiceStatsUser(
    () => this.id(),
    () => this.memberId(),
    () => this.activePeriod()
  );
  heatmapResource = this.api.fetchVoiceStatsUserHeatmap(
    () => this.id(),
    () => this.memberId(),
    () => this.activePeriod()
  );
  presenceResource = this.api.fetchUserPresence(
    () => this.id(),
    () => this.memberId(),
    () => this.activePeriod()
  );
  gamesResource = this.api.fetchUserGames(
    () => this.id(),
    () => this.memberId(),
    () => this.activePeriod()
  );
  calendarResource = this.api.fetchUserActivityCalendar(
    () => this.id(),
    () => this.memberId()
  );
  // For the member's level rank
  private xpLeaderboardResource = this.api.fetchXpLeaderboard(() => this.id());
  private messagesResource = this.api.fetchServerMessages(
    () => this.id(),
    () => this.activePeriod()
  );
  private overviewResource = this.api.fetchVoiceStatsOverview(
    () => this.id(),
    () => this.activePeriod()
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
  xpLeaderboard = computed(() =>
    this.xpLeaderboardResource.hasValue() ? this.xpLeaderboardResource.value()?.leaderboard ?? [] : []
  );
  messageRank = computed(() =>
    this.messagesResource.hasValue()
      ? this.rankIn((this.messagesResource.value()?.topMembers ?? []).map((e) => e.member.id))
      : undefined
  );

  memberLink = (memberId: string) =>
    this.router.createUrlTree(
      memberId === this.currentUser()?.id
        ? ['/overview/detail', this.id()]
        : ['/overview/detail', this.id(), 'members', memberId],
      { queryParams: { period: this.periodParam() } }
    );
}
