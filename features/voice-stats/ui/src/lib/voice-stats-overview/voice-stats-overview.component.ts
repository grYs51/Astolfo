import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoiceStatsOverview } from '@nx-stolfo/data-access-voice-stats';
import { StatCardComponent, SkeletonLoaderComponent } from '@nx-stolfo/components';

@Component({
  selector: 'feature-voice-stats-overview',
  imports: [StatCardComponent, SkeletonLoaderComponent],
  templateUrl: './voice-stats-overview.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStatsOverviewComponent {
  overview = input.required<VoiceStatsOverview>();
  loading = input<boolean>(false);
}
