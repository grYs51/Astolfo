import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One admin page section: title, hint, refresh button, loading and error states */
@Component({
  selector: 'feature-admin-section',
  template: `
    <section class="rounded-xl border border-white/5 bg-base-300 p-lg" [attr.aria-labelledby]="id() + '-title'">
      <div class="mb-md flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h2 [id]="id() + '-title'" class="text-lg font-semibold text-gray-100">{{ title() }}</h2>
          @if (hint()) {
            <p class="text-xs text-gray-500">{{ hint() }}</p>
          }
        </div>
        <button type="button" class="btn btn-ghost btn-xs" [disabled]="loading()" (click)="refresh.emit()">
          @if (loading()) {
            <span class="loading loading-spinner loading-xs"></span>
          }
          Refresh
        </button>
      </div>
      @if (error()) {
        <p class="py-lg text-center text-sm text-red-400" role="alert">Couldn't load this section</p>
      } @else {
        <ng-content />
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSectionComponent {
  id = input.required<string>();
  title = input.required<string>();
  hint = input<string>();
  loading = input(false);
  error = input(false);
  refresh = output<void>();
}
