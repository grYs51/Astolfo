import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { guild } from '@nx-stolfo/active-servers/data-access';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

@Component({
  selector: 'feature-active-servers-card',
  imports: [HumanizeDurationPipe],
  templateUrl: './active-servers-card.component.html',
  styles: `
    // example of how to dynamically use tailwind classes
    // .isSelected {
    //   padding: theme('spacing.md');
    //   border: theme('borderWidth.2') solid;
    //   border-color: theme('colors.neutral-600');
    // }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveServersCardComponent {
  guild = input.required<guild>();
}
