import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'lib-badge',
  imports: [CommonModule],
  template: `
    <span [class]="getBadgeClasses()">
      @if (icon()) {
        <span class="mr-1">{{ icon() }}</span>
      }
      {{ label() }}
      @if (removable()) {
        <button
          type="button"
          class="ml-1 hover:text-white transition-colors"
          (click)="handleRemove($event)"
        >
          ×
        </button>
      }
    </span>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  label = input.required<string>();
  variant = input<BadgeVariant>('neutral');
  size = input<BadgeSize>('sm');
  icon = input<string>();
  removable = input<boolean>(false);
  outlined = input<boolean>(false);
  pill = input<boolean>(false);

  protected getBadgeClasses(): string {
    const baseClasses = 'badge';

    // Size classes
    const sizeClasses: Record<BadgeSize, string> = {
      xs: 'badge-xs',
      sm: 'badge-sm',
      md: 'badge-md',
      lg: 'badge-lg',
    };

    // Variant classes
    const variantClasses: Record<BadgeVariant, string> = this.outlined()
      ? {
          primary: 'badge-outline badge-primary',
          success: 'badge-outline badge-success',
          warning: 'badge-outline badge-warning',
          error: 'badge-outline badge-error',
          info: 'badge-outline badge-info',
          neutral: 'badge-outline',
        }
      : {
          primary: 'badge-primary',
          success: 'badge-success',
          warning: 'badge-warning',
          error: 'badge-error',
          info: 'badge-info',
          neutral: 'badge-neutral',
        };

    // Border radius
    const radiusClass = this.pill() ? 'rounded-full' : 'rounded-md';

    return `${baseClasses} ${sizeClasses[this.size()]} ${variantClasses[this.variant()]} ${radiusClass}`;
  }

  protected handleRemove(event: Event) {
    event.stopPropagation();
    // Emit custom event for parent to handle
    const customEvent = new CustomEvent('badgeRemove', { bubbles: true });
    (event.target as HTMLElement).dispatchEvent(customEvent);
  }
}
