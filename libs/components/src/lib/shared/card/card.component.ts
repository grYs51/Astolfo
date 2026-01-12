import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-card',
  imports: [CommonModule],
  template: `
    <div [class]="'card bg-base-300 ' + padding() + ' ' + containerClass()">
      <div class="card-body p-0">
        @if (title() || headerContent()) {
          <div [class]="'flex justify-between items-center ' + (title() ? 'mb-lg' : '')">
            @if (title()) {
              <h2 [class]="'card-title font-bold text-base-content ' + titleSize()">{{ title() }}</h2>
            }
            @if (headerContent()) {
              <div class="header-content">
                <ng-content select="[header]"></ng-content>
              </div>
            }
          </div>
        }

        <div class="text-base-content">
          <ng-content></ng-content>
        </div>
      @if (footerContent()) {
        <div class="mt-lg">
          <ng-content select="[footer]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  title = input<string>();
  titleSize = input<string>('text-2xl');
  padding = input<string>('p-lg');
  containerClass = input<string>('');
  headerContent = input<boolean>(false);
  footerContent = input<boolean>(false);
}
