import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoiceStatsUser } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent, ProgressBarComponent } from '@nx-stolfo/components';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'feature-voice-stats-user-profile',
  imports: [StatCardComponent, ProgressBarComponent, DatePipe],
  templateUrl: './voice-stats-user-profile.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsUserProfileComponent {
  userStats = input.required<VoiceStatsUser>();
  loading = input<boolean>(false);
}
