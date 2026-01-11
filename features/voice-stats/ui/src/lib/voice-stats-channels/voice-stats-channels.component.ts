import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoiceStatsChannels } from '@nx-stolfo/data-access-voice-stats';
import { ProgressBarComponent } from '@nx-stolfo/components';

@Component({
  selector: 'feature-voice-stats-channels',
  imports: [ProgressBarComponent],
  templateUrl: './voice-stats-channels.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsChannelsComponent {
  channels = input.required<VoiceStatsChannels>();
  loading = input<boolean>(false);

  getChannelIcon(type: string): string {
    const icons: Record<string, string> = {
      voice: '🎤',
      stage: '🎭',
      afk: '😴',
      music: '🎵',
    };
    return icons[type.toLowerCase()] || '📢';
  }

  getChannelPercentage(duration: number): number {
    const data = this.channels();
    const total = data.channels.reduce((sum, ch) => sum + ch.totalDuration, 0);
    return total > 0 ? Math.round((duration / total) * 100) : 0;
  }
}
