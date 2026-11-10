import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import { VoiceStatsApi, XpHistory } from '@nx-stolfo/data-access-voice-stats';
import { XpHistoryComponent } from '@nx-stolfo/ui-voice-stats';

/** A member's XP history, a page at a time: "Show older" appends the next page. Needs VoiceStatsApi from the page. */
@Component({
  selector: 'pages-xp-history',
  imports: [XpHistoryComponent],
  template: `
    @if (page.error()) {
      <div class="rounded-xl border border-error/30 bg-error/10 p-md text-sm text-error">Failed to load the XP history</div>
    } @else if (loaded(); as h) {
      <feature-voice-stats-xp-history
        [entries]="h.entries"
        [people]="h.people"
        [hasMore]="!!h.nextCursor"
        [loading]="page.isLoading()"
        (more)="cursor.set(h.nextCursor)"
      />
    } @else {
      <div class="h-72 rounded-xl border border-white/5 bg-base-300 animate-pulse"></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PagesXpHistoryComponent {
  guildId = input.required<string>();
  memberId = input.required<string | undefined>();

  private api = inject(VoiceStatsApi);

  /** The page to fetch; back to the first one for another member */
  protected cursor = linkedSignal<unknown, string | null>({
    source: () => [this.guildId(), this.memberId()],
    computation: () => null,
  });
  protected page = this.api.fetchUserXp(
    () => this.guildId(),
    () => this.memberId(),
    () => this.cursor()
  );

  /** Every page so far: a later page is appended, the first one starts over */
  protected loaded = linkedSignal<XpHistory | undefined, XpHistory | undefined>({
    source: () => (this.page.hasValue() ? this.page.value() : undefined),
    computation: (page, previous) => {
      const before = this.cursor() ? previous?.value : undefined;
      if (!page) return before;
      return before
        ? { ...page, entries: [...before.entries, ...page.entries], people: { ...before.people, ...page.people } }
        : page;
    },
  });
}
