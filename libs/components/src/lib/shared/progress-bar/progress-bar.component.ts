import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-progress-bar',
  imports: [CommonModule],
  template: `
    <div [class]="'w-full ' + containerClass()">
      @if (showLabel()) {
        <div class="flex justify-between mb-xs text-sm">
          <span class="text-gray-400">{{ label() }}</span>
          @if (showPercentage()) {
            <span class="text-gray-300 font-medium">{{ percentage() }}%</span>
          }
        </div>
      }
      <div [class]="'w-full rounded-full overflow-hidden ' + height()">
        <div
          [class]="'h-full rounded-full transition-all duration-300 ' + barColor()"
          [style.width.%]="percentage()">
        </div>
      </div>
      @if (subtitle()) {
        <p class="text-gray-500 text-xs mt-xs">{{ subtitle() }}</p>
      }
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  percentage = input.required<number>();
  label = input<string>();
  subtitle = input<string>();
  showLabel = input<boolean>(true);
  showPercentage = input<boolean>(true);
  barColor = input<string>('bg-primary-500');
  height = input<string>('h-2 bg-gray-700');
  containerClass = input<string>('');
}
