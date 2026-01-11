import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-skeleton-loader',
  imports: [CommonModule],
  template: `
    <div [class]="'animate-pulse ' + containerClass()">
      @if (type() === 'card') {
        <div [class]="'rounded-2xl bg-base-200 ' + height()"></div>
      } @else if (type() === 'text') {
        <div class="space-y-sm">
          <div class="h-4 bg-base-200 rounded w-3/4"></div>
          <div class="h-4 bg-base-200 rounded w-1/2"></div>
        </div>
      } @else if (type() === 'circle') {
        <div [class]="'rounded-full bg-base-200 ' + width() + ' ' + height()"></div>
      } @else if (type() === 'stat-grid') {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
          @for (i of [1,2,3,4]; track i) {
            <div class="h-32 rounded-2xl bg-base-200"></div>
          }
        </div>
      } @else if (type() === 'list') {
        <div class="space-y-sm">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="h-20 rounded-xl bg-base-200"></div>
          }
        </div>
      }
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonLoaderComponent {
  type = input<'card' | 'text' | 'circle' | 'stat-grid' | 'list'>('card');
  height = input<string>('h-32');
  width = input<string>('w-32');
  containerClass = input<string>('');
}
