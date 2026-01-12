import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-stat-card',
  imports: [CommonModule],
  template: `
    <div class="card bg-base-300 p-lg">
      <div class="card-body p-0">
        @if (icon()) {
          <div [class]="'text-4xl mb-md ' + iconColor()">
            {{ icon() }}
          </div>
        }
        <div>
          <p class="text-base-content/60 text-sm font-medium mb-xs">{{ label() }}</p>
          <p [class]="'font-bold text-base-content ' + valueSize()">{{ value() }}</p>
          @if (subtitle()) {
            <p class="text-base-content/50 text-xs mt-xs">{{ subtitle() }}</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  icon = input<string>();
  subtitle = input<string>();
  iconColor = input<string>('text-primary-500');
  valueSize = input<string>('text-3xl');
  containerClass = input<string>('');
}
