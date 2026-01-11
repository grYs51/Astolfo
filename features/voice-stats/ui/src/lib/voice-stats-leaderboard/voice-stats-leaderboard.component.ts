import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { VoiceStatsLeaderboard } from '@nx-stolfo/data-access-voice-stats';
import { LeaderboardItemComponent } from '@nx-stolfo/components';
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'feature-voice-stats-leaderboard',
  imports: [LeaderboardItemComponent, UpperCasePipe],
  templateUrl: './voice-stats-leaderboard.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsLeaderboardComponent {
  leaderboard = input.required<VoiceStatsLeaderboard>();
  loading = input<boolean>(false);

  userClick = output<string>();
}
