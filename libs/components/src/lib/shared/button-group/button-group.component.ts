import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupSize = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'lib-button-group',
  imports: [CommonModule],
  template: `
    <div [class]="getGroupClasses()">
      <ng-content></ng-content>
    </div>
  `,
  styles: ``,
  styleUrls: ['../../../styles.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonGroupComponent {
  orientation = input<ButtonGroupOrientation>('horizontal');
  size = input<ButtonGroupSize>('md');
  fullWidth = input<boolean>(false);
  spacing = input<string>('gap-0');
  containerClass = input<string>('');

  protected getGroupClasses(): string {
    const baseClasses = 'join';

    const orientationClass = this.orientation() === 'vertical'
      ? 'join-vertical'
      : 'join-horizontal';
    const widthClass = this.fullWidth() ? 'w-full' : '';

    // Size classes affect the container
    const sizeClasses: Record<ButtonGroupSize, string> = {
      xs: '',
      sm: '',
      md: '',
      lg: '',
    };

    return `${baseClasses} ${orientationClass} ${sizeClasses[this.size()]} ${this.spacing()} ${widthClass} ${this.containerClass()}`;
  }
}
