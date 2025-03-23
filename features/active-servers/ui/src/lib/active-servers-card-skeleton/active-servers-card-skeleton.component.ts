import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'feature-active-servers-card-skeleton',
  templateUrl: './active-servers-card-skeleton.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveServersCardSkeletonComponent {
  title = input.required<string>()

  description = input<string>()
}
