import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { HttpResourceRef } from '@angular/common/http';
import {
  ActivityCalendar,
  DashboardPeriod,
  DiscordMember,
  UserGames,
  UserPresence,
  VoiceStatsLeaderboardEntry,
  VoiceStatsUser,
  VoiceStatsUserHeatmap,
} from '@nx-stolfo/data-access-voice-stats';
import {
  ActivityCalendarComponent,
  GameRecordComponent,
  HEATMAP_SEQUENTIAL_COLORS,
  OnlineTimeComponent,
  VoiceStatsUserHeatmapComponent,
  VoiceStatsUserProfileComponent,
  XpCardComponent,
} from '@nx-stolfo/ui-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

export const PERIOD_PHRASE: Record<DashboardPeriod, string> = {
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

/** Labels for the this-period vs previous-period bars; none for 'all' */
const COMPARE_LABELS: Record<DashboardPeriod, [string, string] | undefined> = {
  week: ['Past week', 'Week before'],
  month: ['Past month', 'Month before'],
  year: ['Past year', 'Year before'],
  all: undefined,
};

/** Most pips the streak row draws; longer streaks are scaled down to fit */
const MAX_STREAK_PIPS = 14;

/** Segments in a habit meter, so each one is 20% */
const METER_PARTS = 5;

const HOUR_MS = 3_600_000;

/** Milestone squares in the activity calendar's colours: hours done, the hour in progress, hours to go */
const HOUR_SQUARE_COLORS = {
  done: HEATMAP_SEQUENTIAL_COLORS[6],
  partial: HEATMAP_SEQUENTIAL_COLORS[3],
  empty: HEATMAP_SEQUENTIAL_COLORS[0],
};

const memberName = (member: DiscordMember) => member.displayName || member.username;

/**
 * One member's activity: summary (headline, breakdowns, rank race, streak and milestone),
 * "when they're on" heatmap, companions and channels. Used for the viewer
 * ("You" tab, `name` empty) and for other members' profile pages. The owning
 * page passes in the resources so it can reuse them (e.g. for a header)
 * without fetching twice.
 */
@Component({
  selector: 'pages-member-activity',
  imports: [
    ActivityCalendarComponent,
    VoiceStatsUserHeatmapComponent,
    VoiceStatsUserProfileComponent,
    OnlineTimeComponent,
    GameRecordComponent,
    HumanizeDurationPipe,
    XpCardComponent,
  ],
  templateUrl: './member-activity.component.html',
  styles: `
    /* The one motion moment: bars grow in from the left when they first render */
    .grow-in {
      transform-origin: left;
      animation: grow-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes grow-in {
      from {
        transform: scaleX(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .grow-in {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-md' },
})
export class MemberActivityComponent {
  userResource = input.required<HttpResourceRef<VoiceStatsUser | undefined>>();
  heatmapResource = input.required<HttpResourceRef<VoiceStatsUserHeatmap | undefined>>();
  presenceResource = input.required<HttpResourceRef<UserPresence | undefined>>();
  gamesResource = input.required<HttpResourceRef<UserGames | undefined>>();
  /** Last 12 months, whatever the period */
  calendarResource = input.required<HttpResourceRef<ActivityCalendar | undefined>>();
  period = input.required<DashboardPeriod>();
  /** Another member's display name; empty for the viewer themselves */
  name = input<string | undefined>(undefined);
  /** The period's voice leaderboard, longest first (for the rank race) */
  voiceLeaderboard = input<VoiceStatsLeaderboardEntry[]>([]);
  messageRank = input<number | undefined>(undefined);
  /** Router commands for a member's profile (companions become links) */
  memberLink = input<((memberId: string) => unknown[]) | undefined>(undefined);

  private readonly durationPipe = new HumanizeDurationPipe();

  protected self = computed(() => !this.name());
  protected periodPhrase = computed(() => PERIOD_PHRASE[this.period()]);
  protected previousLabel = computed(() => PREVIOUS_LABEL[this.period()]);

  protected stats = computed(() => {
    const resource = this.userResource();
    return resource.hasValue() ? resource.value() : undefined;
  });

  /** This period against the one before, as two bars */
  protected compare = computed(() => {
    // Same cases as the headline: no bars when there's nothing to compare
    if (!this.change()) return undefined;
    const labels = COMPARE_LABELS[this.period()];
    const summary = this.stats()?.summary;
    const previous = summary?.previousTotalDuration;
    if (!labels || !summary || previous == null) return undefined;
    const max = Math.max(summary.totalDuration, previous, 1);
    return [
      { label: labels[0], value: summary.totalDuration, current: true },
      { label: labels[1], value: previous, current: false },
    ].map((bar) => ({ ...bar, pct: (bar.value / max) * 100 }));
  });

  /** Voice time against the previous period, for the "2h more than the month before" headline */
  protected change = computed(() => {
    const label = this.previousLabel();
    const summary = this.stats()?.summary;
    if (!label || !summary || summary.previousTotalDuration === null) return undefined;
    // No voice in either period: nothing to compare, the plain sentence reads better
    if (summary.totalDuration === 0 && summary.previousTotalDuration === 0) return undefined;
    const diff = summary.totalDuration - summary.previousTotalDuration;
    return {
      label,
      up: diff > 0,
      // Less than a minute either way reads as "the same"
      same: Math.abs(diff) < 60_000,
      amount: Math.abs(diff),
    };
  });

  /** The members just above and below on the voice leaderboard */
  protected race = computed(() => {
    const board = this.voiceLeaderboard();
    const id = this.stats()?.userId;
    const index = board.findIndex((entry) => entry.member.id === id);
    if (index < 0) return undefined;
    const start = Math.max(0, Math.min(index - 1, board.length - 3));
    const rows = board.slice(start, start + 3);
    const max = Math.max(rows[0].totalDuration, 1);
    const you = board[index];
    const ahead = board[index - 1];
    const behind = board[index + 1];
    return {
      rank: index + 1,
      count: board.length,
      rows: rows.map((entry, i) => ({
        id: entry.member.id,
        rank: start + i + 1,
        name: entry.member.id === id && this.self() ? 'You' : memberName(entry.member),
        avatar: entry.member.avatar,
        duration: entry.totalDuration,
        pct: (entry.totalDuration / max) * 100,
        subject: entry.member.id === id,
      })),
      // What it takes to move up, or the lead when already on top
      ahead: ahead && { name: memberName(ahead.member), gap: ahead.totalDuration - you.totalDuration },
      lead:
        !ahead && behind
          ? { name: memberName(behind.member), gap: you.totalDuration - behind.totalDuration }
          : undefined,
    };
  });

  /** Muted, camera, streaming and online as shares, each drawn as a 5-part (20% each) bar */
  protected meters = computed(() => {
    const habits = this.stats()?.habits;
    const presence = this.presenceResource();
    const online = presence.hasValue() ? presence.value() : undefined;
    const meter = (label: string, color: string, share: number, ms: number, note: string) => ({
      label,
      color,
      pct: Math.round(share * 100),
      note: `${this.durationPipe.transform(ms, true)} ${note}`,
      // How full each fifth is, 0–100
      parts: Array.from({ length: METER_PARTS }, (_, i) =>
        Math.min(1, Math.max(0, share * METER_PARTS - i)) * 100
      ),
    });
    // muted includes self-deafened time but not server deafen, so take the larger
    const muted = habits ? Math.max(habits.muted, habits.deafened) : 0;
    return [
      ...(habits && habits.voice > 0
        ? [
            meter('Muted', 'bg-warning', muted / habits.voice, muted, 'of voice'),
            meter('Camera', 'bg-primary-400', habits.video / habits.voice, habits.video, 'of voice'),
            meter('Streaming', 'bg-accent', habits.streaming / habits.voice, habits.streaming, 'of voice'),
          ]
        : []),
      // byHour holds each hour's online share, so their mean is the share of the whole period
      ...(online
        ? [
            meter(
              'Online',
              'bg-success',
              online.byHour.reduce((sum, share) => sum + share, 0) / (online.byHour.length || 1),
              online.online + online.idle + online.dnd,
              'in total'
            ),
          ]
        : []),
    ];
  });

  /** The remaining numbers, leaving out anything that is zero */
  protected extras = computed(() => {
    const stats = this.stats();
    if (!stats) return [];
    const { summary, messages } = stats;
    const rank = this.messageRank();
    const sent = `${messages.count} ${messages.count === 1 ? 'message' : 'messages'}`;
    return [
      summary.sessionCount > 0 && { label: 'Sessions', value: `${summary.sessionCount}` },
      summary.sessionCount > 0 && {
        label: 'Average session',
        value: this.durationPipe.transform(summary.averageSessionDuration, true),
      },
      // The headline no longer carries the message count, so it always shows here
      messages.count > 0 && (rank ? { label: 'In chat', value: `#${rank}`, sub: sent } : { label: 'In chat', value: sent }),
    ].filter((item): item is { label: string; value: string; sub?: string } => !!item);
  });

  /** Current streak against the best one, as pips (scaled down past MAX_STREAK_PIPS) */
  protected streak = computed(() => {
    const streak = this.stats()?.streak;
    if (!streak || streak.longest === 0) return undefined;
    const pips = Math.min(streak.longest, MAX_STREAK_PIPS);
    const filled = Math.round((streak.current / streak.longest) * pips);
    return {
      ...streak,
      pips: Array.from({ length: pips }, (_, i) => i < filled),
    };
  });

  /** Next lifetime milestone with how far along it is (from 0h) */
  protected milestone = computed(() => {
    const stats = this.stats();
    const next = stats?.nextMilestone;
    if (!next) return undefined;
    const hoursDone = (next.hours * HOUR_MS - next.remainingMs) / HOUR_MS;
    const done = Math.floor(hoursDone);
    return {
      hours: next.hours,
      done,
      // Hours and minutes, never rolled up into days: the milestone counts hours
      toGo: `${Math.floor(next.remainingMs / HOUR_MS)}h ${Math.floor((next.remainingMs % HOUR_MS) / 60_000)}m`,
      // One square per hour, sized for the ranking column; wider rows for the bigger milestones (1000 = 20 rows of 50)
      columns: next.hours <= 50 ? 10 : next.hours <= 250 ? 25 : 50,
      squares: Array.from({ length: next.hours }, (_, i) =>
        i < done ? HOUR_SQUARE_COLORS.done : i === done && hoursDone > done ? HOUR_SQUARE_COLORS.partial : HOUR_SQUARE_COLORS.empty
      ),
    };
  });
}
