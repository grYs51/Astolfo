import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { HttpErrorResponse, HttpResourceRef } from '@angular/common/http';
import {
  DashboardPeriod,
  VoiceStatsUser,
  VoiceStatsUserHeatmap,
} from '@nx-stolfo/data-access-voice-stats';
import {
  VoiceStatsUserHeatmapComponent,
  VoiceStatsUserProfileComponent,
} from '@nx-stolfo/ui-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

const PERIOD_PHRASE: Record<DashboardPeriod, string> = {
  week: 'in the past week',
  month: 'in the past month',
  year: 'in the past year',
  all: 'in total',
};

/** The period just before the selected one; none for 'all' */
const PREVIOUS_LABEL: Record<DashboardPeriod, string | undefined> = {
  week: 'the week before',
  month: 'the month before',
  year: 'the year before',
  all: undefined,
};

/**
 * One member's activity: summary sentence, "when they're on" heatmap,
 * companions and channels. Used for the viewer ("You" tab, `name` empty) and
 * for other members' profile pages. The owning page passes in the resources
 * so it can reuse them (e.g. for a header) without fetching twice.
 */
@Component({
  selector: 'pages-member-activity',
  imports: [
    VoiceStatsUserHeatmapComponent,
    VoiceStatsUserProfileComponent,
    HumanizeDurationPipe,
  ],
  templateUrl: './member-activity.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-md' },
})
export class MemberActivityComponent {
  userResource = input.required<HttpResourceRef<VoiceStatsUser | undefined>>();
  heatmapResource = input.required<HttpResourceRef<VoiceStatsUserHeatmap | undefined>>();
  period = input.required<DashboardPeriod>();
  /** Another member's display name; empty for the viewer themselves */
  name = input<string | undefined>(undefined);
  voiceRank = input<number | undefined>(undefined);
  messageRank = input<number | undefined>(undefined);
  memberCount = input<number | undefined>(undefined);
  /** Router commands for a member's profile (companions become links) */
  memberLink = input<((memberId: string) => unknown[]) | undefined>(undefined);

  private readonly durationPipe = new HumanizeDurationPipe();

  protected self = computed(() => !this.name());
  protected periodPhrase = computed(() => PERIOD_PHRASE[this.period()]);

  /** The member hides their stats from the viewer (API answers 403) */
  protected isPrivate = computed(() => {
    const error = this.userResource().error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  /** "↑ 2h 10m more than the month before" */
  protected change = computed(() => {
    const label = PREVIOUS_LABEL[this.period()];
    const resource = this.userResource();
    if (!label || !resource.hasValue()) return undefined;
    const { totalDuration, previousTotalDuration } = resource.value()!.summary;
    if (previousTotalDuration === null) return undefined;
    const diff = totalDuration - previousTotalDuration;
    // Less than a minute either way reads as "the same"
    if (Math.abs(diff) < 60_000) return { up: false, text: `About the same as ${label}` };
    const amount = this.durationPipe.transform(Math.abs(diff), true);
    return diff > 0
      ? { up: true, text: `↑ ${amount} more than ${label}` }
      : { up: false, text: `↓ ${amount} less than ${label}` };
  });
}
