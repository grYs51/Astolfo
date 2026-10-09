import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { VoiceStatsUser } from '@nx-stolfo/data-access-voice-stats';
import {
  ProgressBarComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

/** The viewer's top channels and most recent sessions (the "You" tab). */
@Component({
  selector: 'feature-voice-stats-user-profile',
  imports: [ProgressBarComponent, DatePipe, HumanizeDurationPipe, SegmentedControlComponent],
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

  protected channelView = signal<'voice' | 'text'>('voice');
  protected readonly channelViewOptions: SegmentedControlOption<'voice' | 'text'>[] = [
    { value: 'voice', label: 'Voice' },
    { value: 'text', label: 'Text' },
  ];
  protected textShare = (count: number) =>
    Math.round((count / Math.max(1, this.userStats().messages.count)) * 100);
}
