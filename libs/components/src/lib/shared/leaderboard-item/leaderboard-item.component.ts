import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'lib-leaderboard-item',
  template: `
    <div
      [class]="
        'flex items-center gap-md rounded-lg px-sm py-sm cursor-pointer transition-colors hover:bg-white/5 ' +
        containerClass()
      "
      role="button"
      tabindex="0"
      (click)="itemClick.emit()"
      (keyup.enter)="itemClick.emit()"
    >
      <!-- Rank badge -->
      <div [class]="getRankClass()">
        {{ rank() }}
      </div>

      <!-- Avatar / icon -->
      @if (avatarUrl()) {
        <img
          [src]="avatarUrl()!"
          [alt]="title()"
          [width]="40"
          [height]="40"
          class="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        />
      } @else if (icon()) {
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-200 text-lg"
        >
          {{ icon() }}
        </div>
      }

      <!-- Content -->
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-gray-100">{{ title() }}</h3>
        @if (subtitle()) {
          <p class="text-xs text-gray-500">{{ subtitle() }}</p>
        }
      </div>

      <!-- Value -->
      <div class="text-right">
        <p class="text-sm font-bold text-primary-300">{{ value() }}</p>
        @if (secondaryValue()) {
          <p class="text-xs text-gray-500">{{ secondaryValue() }}</p>
        }
      </div>
    </div>
  `,
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
    const baseClass =
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ';

    if (rank === 1) {
      return baseClass + 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30';
    } else if (rank === 2) {
      return baseClass + 'bg-slate-300/10 text-slate-300 ring-1 ring-slate-300/30';
    } else if (rank === 3) {
      return baseClass + 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30';
    }
    return baseClass + 'bg-base-200 text-gray-500';
  }
}
