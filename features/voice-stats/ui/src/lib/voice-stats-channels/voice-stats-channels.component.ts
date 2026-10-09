import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { VoiceStatsChannels } from '@nx-stolfo/data-access-voice-stats';
import { ProgressBarComponent } from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

@Component({
  selector: 'feature-voice-stats-channels',
  imports: [ProgressBarComponent, HumanizeDurationPipe],
  templateUrl: './voice-stats-channels.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsChannelsComponent {
  channels = input.required<VoiceStatsChannels>();
  loading = input<boolean>(false);
  /** Show only the top N channels until "Show all" is clicked */
  limit = input<number | undefined>(undefined);

  protected expanded = signal(false);
  protected visibleChannels = computed(() => {
    const channels = this.channels().channels;
    const limit = this.limit();
    return limit && !this.expanded() ? channels.slice(0, limit) : channels;
  });
  protected hiddenCount = computed(
    () => this.channels().channels.length - this.visibleChannels().length
  );

  getChannelIcon(type: string): string {
    // The API sends discord.js ChannelType names ('GuildVoice', …), or
    // 'VOICE' for channels that no longer exist
    const icons: Record<string, string> = {
      guildvoice: '🎤',
      guildstagevoice: '🎭',
      voice: '🎤',
    };
    return icons[type.toLowerCase()] || '📢';
  }

  getChannelPercentage(duration: number): number {
    const data = this.channels();
    const total = data.channels.reduce((sum, ch) => sum + ch.totalDuration, 0);
    return total > 0 ? Math.round((duration / total) * 100) : 0;
  }
}
