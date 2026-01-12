import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'lib-button',
  imports: [CommonModule],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="getButtonClasses()"
      (click)="handleClick($event)">
      @if (loading()) {
        <span class="loading loading-spinner loading-sm mr-2"></span>
      } @else if (icon()) {
        <span class="mr-2">{{ icon() }}</span>
      }
      <ng-content></ng-content>
      @if (iconRight()) {
        <span class="ml-2">{{ iconRight() }}</span>
      }
    </button>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  type = input<'button' | 'submit' | 'reset'>('button');
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  icon = input<string>();
  iconRight = input<string>();
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  fullWidth = input<boolean>(false);
  outlined = input<boolean>(false);

  clicked = output<Event>();

  protected getButtonClasses(): string {
    const baseClasses = 'btn';

    // Size classes
    const sizeClasses: Record<ButtonSize, string> = {
      xs: 'btn-xs',
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
    };

    // Variant classes
    const variantClasses: Record<ButtonVariant, string> = this.outlined()
      ? {
          primary: 'btn-outline btn-primary',
          secondary: 'btn-outline btn-secondary',
          success: 'btn-outline btn-success',
          warning: 'btn-outline btn-warning',
          error: 'btn-outline btn-error',
          ghost: 'btn-ghost',
          link: 'btn-link',
        }
      : {
          primary: 'btn-primary',
          secondary: 'btn-secondary',
          success: 'btn-success',
          warning: 'btn-warning',
          error: 'btn-error',
          ghost: 'btn-ghost',
          link: 'btn-link',
        };

    const widthClass = this.fullWidth() ? 'w-full' : '';

    return `${baseClasses} ${sizeClasses[this.size()]} ${variantClasses[this.variant()]} ${widthClass}`;
  }

  protected handleClick(event: Event) {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}
