import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

const DISMISSED_KEY = 'dismissedNotice';

// Storage can be missing or throw (private window, blocked site data): then the banner just shows again
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
};

/** The owner's maintenance notice. Dismissing hides that text only: a new notice shows again. Plain text, never HTML. */
@Component({
  selector: 'lib-notice-banner',
  template: `
    @if (visible()) {
      <div role="status" class="flex items-start justify-between gap-sm bg-warning px-md py-sm text-sm text-warning-content">
        <p class="mx-auto max-w-7xl flex-1">{{ text() }}</p>
        <button type="button" class="btn btn-ghost btn-xs" aria-label="Dismiss notice" (click)="dismiss()">✕</button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeBannerComponent {
  text = input<string | null>();

  private readonly dismissed = signal(readDismissed());
  protected readonly visible = computed(() => !!this.text() && this.text() !== this.dismissed());

  protected dismiss() {
    const text = this.text() ?? null;
    this.dismissed.set(text);
    try {
      if (text) localStorage.setItem(DISMISSED_KEY, text);
    } catch {
      // not remembered, see readDismissed
    }
  }
}
