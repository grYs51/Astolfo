import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'lib-stat-card',
  template: `
    <div
      [class]="
        'rounded-xl bg-base-300 border border-white/5 ' +
        (dense() ? 'p-sm px-md ' : 'p-md ') +
        containerClass()
      "
    >
      <div class="flex items-start justify-between gap-sm">
        <p
          [class]="
            'font-medium uppercase tracking-wider text-gray-500 ' +
            (dense() ? 'text-[10px]' : 'text-xs')
          "
        >
          {{ label() }}
        </p>
        @if (icon() && !dense()) {
          <span
            [class]="
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base ' +
              iconColor()
            "
          >
            {{ icon() }}
          </span>
        }
      </div>
      <p
        [class]="
          'font-bold text-gray-100 leading-tight ' +
          (dense() ? 'mt-xs text-lg' : 'mt-sm ' + valueSize())
        "
      >
        {{ value() }}
      </p>
      @if (subtitle()) {
        <p class="mt-xs text-xs text-gray-500">{{ subtitle() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  icon = input<string>();
  subtitle = input<string>();
  iconColor = input<string>('text-primary-400');
  valueSize = input<string>('text-2xl');
  containerClass = input<string>('');
  /** Compact variant for KPI strips: tighter padding, smaller value, no icon chip. */
  dense = input<boolean>(false);
}
