import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
}

@Component({
  selector: 'lib-segmented-control',
  template: `
    <div
      class="inline-flex items-center gap-xs rounded-lg bg-base-100/60 border border-white/5 p-xs"
      role="tablist"
    >
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="value() === option.value"
          (click)="value.set(option.value)"
          class="px-sm py-xs rounded-md text-xs font-medium transition-colors"
          [class]="
            value() === option.value
              ? 'bg-primary-500/90 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          "
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedControlComponent<T extends string = string> {
  options = input.required<SegmentedControlOption<T>[]>();
  value = model.required<T>();
}
