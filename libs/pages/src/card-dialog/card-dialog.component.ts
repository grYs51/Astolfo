import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { DashboardPeriod, VoiceStatsApi } from '@nx-stolfo/data-access-voice-stats';
import type { StatsCardSection, StatsCardTheme } from '@nx-stolfo/api-interfaces';
import { SegmentedControlComponent, SegmentedControlOption } from '@nx-stolfo/components';
import { PERIOD_PHRASE } from '../member-activity/member-activity.component';

/** In the order the card draws them */
const SECTIONS: { value: StatsCardSection; label: string }[] = [
  { value: 'totals', label: 'Totals and rank' },
  { value: 'streak', label: 'Streak and milestone' },
  { value: 'habits', label: 'Voice habits' },
  { value: 'calendar', label: 'Past year' },
  { value: 'heatmap', label: 'Weekly heatmap' },
  { value: 'companions', label: 'Hangs out most with' },
];

/**
 * A "Card" button and the dialog it opens: a live preview of a member's stats
 * card with the theme and sections the viewer picks, to download or copy.
 * Needs VoiceStatsApi from the page.
 */
@Component({
  selector: 'pages-card-dialog',
  imports: [SegmentedControlComponent],
  templateUrl: './card-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDialogComponent {
  guildId = input.required<string>();
  memberId = input.required<string>();
  period = input.required<DashboardPeriod>();
  /** For the file name */
  name = input('stats');

  private api = inject(VoiceStatsApi);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly sectionOptions = SECTIONS;
  readonly themeOptions: SegmentedControlOption<StatsCardTheme>[] = [
    { value: 'stolfo', label: 'Astolfo' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ];
  theme = signal<StatsCardTheme>('stolfo');
  sections = signal<StatsCardSection[]>(SECTIONS.map((s) => s.value));
  protected open = signal(false);
  protected periodPhrase = computed(() => PERIOD_PHRASE[this.period()]);

  private options = computed(() =>
    this.open() && this.sections().length
      ? { guildId: this.guildId(), userId: this.memberId(), period: this.period(), theme: this.theme(), sections: this.sections() }
      : undefined
  );
  // Every change is a render on the server (and counts towards its limit): wait until the clicking stops
  private debounced = toSignal(toObservable(this.options).pipe(debounceTime(400)), { initialValue: undefined });
  protected card = this.api.fetchStatsCard(this.debounced);

  /** Object URL of the last card, kept while the next one loads */
  protected imageUrl = signal<string | undefined>(undefined);
  protected fileName = computed(() => `${this.name().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'member'}-stats.png`);
  // Not while a change waits out the debounce: the card on screen is the one before it
  protected ready = computed(
    () => this.debounced() === this.options() && this.card.hasValue() && !this.card.isLoading() && !!this.imageUrl()
  );
  protected errorText = computed(() => {
    const error = this.card.error();
    if (!error) return undefined;
    return error instanceof HttpErrorResponse && error.status === 429
      ? 'That’s a lot of cards. Wait a minute and try again.'
      : 'Couldn’t draw the card. Try again in a moment.';
  });

  /** Set after the first render: the server has no clipboard */
  protected canCopy = signal(false);
  protected copyState = signal<'idle' | 'copied' | 'failed'>('idle');

  constructor() {
    afterNextRender(() => this.canCopy.set(typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write));
    // The resource drops its value while the next card loads, so the old URL is revoked only once a new one replaces it
    effect(() => {
      const blob = this.card.hasValue() ? this.card.value() : undefined;
      if (!blob) return;
      const previous = untracked(this.imageUrl);
      this.imageUrl.set(URL.createObjectURL(blob));
      if (previous) URL.revokeObjectURL(previous);
      this.copyState.set('idle');
    });
    inject(DestroyRef).onDestroy(() => {
      const url = this.imageUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  show() {
    this.open.set(true);
    this.dialog().nativeElement.showModal();
  }

  protected closed() {
    this.open.set(false);
    this.copyState.set('idle');
  }

  protected toggle(section: StatsCardSection) {
    this.sections.update((on) =>
      on.includes(section)
        ? on.filter((s) => s !== section)
        : SECTIONS.map((s) => s.value).filter((s) => s === section || on.includes(s))
    );
  }

  protected async copy() {
    const blob = this.card.hasValue() ? this.card.value() : undefined;
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.copyState.set('copied');
    } catch {
      this.copyState.set('failed');
    }
  }
}
