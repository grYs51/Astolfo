import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { VoiceStatsUser } from '@nx-stolfo/data-access-voice-stats';
import { ProgressBarComponent } from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

/** The viewer's top channels and most recent sessions (the "You" tab). */
@Component({
  selector: 'feature-voice-stats-user-profile',
  imports: [ProgressBarComponent, DatePipe, HumanizeDurationPipe],
  templateUrl: './voice-stats-user-profile.component.html',
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsUserProfileComponent {
  userStats = input.required<VoiceStatsUser>();
  loading = input<boolean>(false);

  protected topChannels = computed(() => this.userStats().channelBreakdown.slice(0, 3));
  protected recentSessions = computed(() => this.userStats().recentSessions.slice(0, 5));
}
