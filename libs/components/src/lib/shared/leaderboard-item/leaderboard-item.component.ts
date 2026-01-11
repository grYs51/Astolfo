import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-leaderboard-item',
  imports: [CommonModule],
  template: `
    <div
      [class]="'bg-base-300 p-md rounded-xl flex items-center gap-md hover:bg-base-200 transition-colors cursor-pointer border-2 border-transparent hover:border-primary-500/30 ' + containerClass()"
      (click)="itemClick.emit()">

      <!-- Rank Badge -->
      <div [class]="getRankClass()">
        <span class="font-bold">{{ rank() }}</span>
      </div>

      <!-- Avatar/Icon -->
      @if (avatarUrl()) {
        <img
          [src]="avatarUrl()!"
          [alt]="title()"
          class="w-12 h-12 rounded-full object-cover"
        />
      } @else if (icon()) {
        <div class="w-12 h-12 rounded-full bg-base-100 flex items-center justify-center text-2xl">
          {{ icon() }}
        </div>
      }

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-100 truncate">{{ title() }}</h3>
        @if (subtitle()) {
          <p class="text-gray-400 text-sm">{{ subtitle() }}</p>
        }
      </div>

      <!-- Value -->
      <div class="text-right">
        <p class="font-bold text-lg text-primary-400">{{ value() }}</p>
        @if (secondaryValue()) {
          <p class="text-gray-500 text-xs">{{ secondaryValue() }}</p>
        }
      </div>
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderboardItemComponent {
  rank = input.required<number>();
  title = input.required<string>();
  value = input.required<string>();
  subtitle = input<string>();
  secondaryValue = input<string>();
  avatarUrl = input<string>();
  icon = input<string>();
  containerClass = input<string>('');

  itemClick = output<void>();

  getRankClass(): string {
    const rank = this.rank();
    const baseClass = 'flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm ';

    if (rank === 1) {
      return baseClass + 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-gray-900';
    } else if (rank === 2) {
      return baseClass + 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900';
    } else if (rank === 3) {
      return baseClass + 'bg-gradient-to-br from-orange-400 to-orange-600 text-white';
    }
    return baseClass + 'bg-base-100 text-gray-400';
  }
}
