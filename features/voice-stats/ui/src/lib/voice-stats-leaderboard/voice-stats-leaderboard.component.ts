import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DiscordMember } from '@nx-stolfo/data-access-voice-stats';
import { LeaderboardItemComponent } from '@nx-stolfo/components';

/** One ranked member; the caller formats value/subtitle (voice time, messages, …) */
export interface LeaderboardRow {
  member: DiscordMember;
  value: string;
  subtitle: string;
  /** Under the value */
  secondaryValue?: string;
  /** The API's rank, for a paged list; the position otherwise */
  rank?: number;
  /** Places moved, positive is up: drawn as ▲/▼ next to the name */
  rankChange?: number;
  /** Drawn as a "new" badge instead of an arrow */
  isNew?: boolean;
}

type RankedRow = LeaderboardRow & { rank: number };

/**
 * Ranked member list. Rows arrive sorted; the viewer's row is highlighted and
 * pinned below the list when outside the visible top. Header actions (e.g. a
 * metric toggle) can be projected with the `leaderboard-actions` attribute.
 */
@Component({
  selector: 'feature-voice-stats-leaderboard',
  imports: [LeaderboardItemComponent, NgTemplateOutlet],
  templateUrl: './voice-stats-leaderboard.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsLeaderboardComponent {
  rows = input.required<LeaderboardRow[]>();
  loading = input<boolean>(false);
  title = input('Leaderboard');
  emptyText = input('No activity yet');
  /** Member to highlight (the viewer); pinned below the list if outside it */
  highlightId = input<string | undefined>(undefined);
  /** Rows shown; `rows` may hold more so the viewer's rank is known */
  limit = input(10);
  /** Rows are clickable (emit userClick) */
  interactive = input(false);

  userClick = output<string>();

  private ranked = computed<RankedRow[]>(() =>
    this.rows().map((row, index) => ({ ...row, rank: row.rank ?? index + 1 }))
  );

  protected top = computed(() => this.ranked().slice(0, this.limit()));

  /** The viewer's row when they're not in the visible rows */
  protected pinned = computed(() => {
    const id = this.highlightId();
    const row = id ? this.ranked().find((r) => r.member.id === id) : undefined;
    return row && !this.top().includes(row) ? row : undefined;
  });

  protected isHighlighted = (row: RankedRow) => row.member.id === this.highlightId();

  protected readonly highlightClass = 'bg-primary-500/10 ring-1 ring-primary-500/30';
}
