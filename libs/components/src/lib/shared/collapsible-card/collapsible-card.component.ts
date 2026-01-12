import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-collapsible-card',
  imports: [CommonModule],
  template: `
    <div [class]="'card bg-base-300 ' + padding() + ' ' + containerClass()">
      <div class="card-body p-0">
        <!-- Header with toggle -->
        <div
          class="flex justify-between items-center cursor-pointer"
          (click)="toggle()">
          <div class="flex items-center gap-md">
            @if (icon()) {
              <span [class]="'text-2xl ' + iconColor()">{{ icon() }}</span>
            }
            <h2 [class]="'card-title font-bold text-base-content ' + titleSize()">{{ title() }}</h2>
          </div>

          <div class="flex items-center gap-md">
            @if (badge()) {
              <span class="badge badge-neutral">
                {{ badge() }}
              </span>
            }
            <button
              type="button"
              class="transition-transform duration-300 text-base-content/60 hover:text-base-content"
              [class.rotate-180]="isExpanded()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        @if (subtitle()) {
          <p class="text-sm text-base-content/60 mt-xs">{{ subtitle() }}</p>
        }

        <!-- Collapsible Content -->
        <div
          class="overflow-hidden transition-all duration-300 ease-in-out"
          [style.max-height]="isExpanded() ? '2000px' : '0'"
          [style.opacity]="isExpanded() ? '1' : '0'">
          <div [class]="contentPadding()">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollapsibleCardComponent {
  title = input.required<string>();
  subtitle = input<string>();
  icon = input<string>();
  iconColor = input<string>('text-primary-500');
  badge = input<string>();
  titleSize = input<string>('text-2xl');
  padding = input<string>('p-lg');
  contentPadding = input<string>('mt-lg');
  containerClass = input<string>('');
  defaultExpanded = input<boolean>(true);

  protected isExpanded = signal(this.defaultExpanded());

  protected toggle() {
    this.isExpanded.update(v => !v);
  }
}
