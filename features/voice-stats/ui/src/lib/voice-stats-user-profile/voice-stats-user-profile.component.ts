import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VoiceStatsUser } from '@nx-stolfo/data-access-voice-stats';
import {
  ProgressBarComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

/**
 * A member's companions, top channels and (on their own page) recent
 * sessions. `name` switches the headings from "you" to third person.
 */
@Component({
  selector: 'feature-voice-stats-user-profile',
  imports: [
    ProgressBarComponent,
    DatePipe,
    HumanizeDurationPipe,
    SegmentedControlComponent,
    RouterLink,
  ],
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
  /** Another member's display name; empty for the viewer themselves */
  name = input<string | undefined>(undefined);
  /** Recent sessions show exact times, so only on the viewer's own page */
  showRecent = input(true);
  /** Router commands for a member's profile; companions become links */
  memberLink = input<((memberId: string) => unknown[]) | undefined>(undefined);

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
