import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-stat-card',
  imports: [CommonModule],
  template: `
    <div [class]="'bg-base-300 p-lg rounded-2xl ' + containerClass()">
      @if (icon()) {
        <div [class]="'text-4xl mb-md ' + iconColor()">
          {{ icon() }}
        </div>
      }
      <div>
        <p class="text-gray-400 text-sm font-medium mb-xs">{{ label() }}</p>
        <p [class]="'font-bold ' + valueSize()">{{ value() }}</p>
        @if (subtitle()) {
          <p class="text-gray-500 text-xs mt-xs">{{ subtitle() }}</p>
        }
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
