import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { VoiceStatsLeaderboard } from '@nx-stolfo/data-access-voice-stats';
import { LeaderboardItemComponent } from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import { NgTemplateOutlet } from '@angular/common';

type RankedEntry = VoiceStatsLeaderboard['leaderboard'][number] & { rank: number };

@Component({
  selector: 'feature-voice-stats-leaderboard',
  imports: [LeaderboardItemComponent, HumanizeDurationPipe, NgTemplateOutlet],
  templateUrl: './voice-stats-leaderboard.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsLeaderboardComponent {
  leaderboard = input.required<VoiceStatsLeaderboard>();
  loading = input<boolean>(false);
  /** Member to highlight (the viewer); pinned below the list if outside it */
  highlightId = input<string | undefined>(undefined);
  /** Rows shown; the response may hold more so the viewer's rank is known */
  limit = input(10);

  userClick = output<string>();

  private ranked = computed<RankedEntry[]>(() =>
    this.leaderboard().leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }))
  );

  protected top = computed(() => this.ranked().slice(0, this.limit()));

  /** The viewer's row when they're not in the visible top */
  protected pinned = computed(() => {
    const id = this.highlightId();
    const entry = id ? this.ranked().find((e) => e.member.id === id) : undefined;
    return entry && entry.rank > this.limit() ? entry : undefined;
  });

  protected isHighlighted = (entry: RankedEntry) =>
    entry.member.id === this.highlightId();

  protected plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? '' : 's'}`;

  protected readonly highlightClass = 'bg-primary-500/10 ring-1 ring-primary-500/30';
}
