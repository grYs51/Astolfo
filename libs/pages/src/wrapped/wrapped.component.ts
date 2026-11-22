import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoiceStatsApi } from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import { SkeletonLoaderComponent, StatCardComponent } from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

const HOUR = 60 * 60 * 1000;
const FIRST_YEAR = 2020;
const thisYear = () => new Date().getUTCFullYear();

/** A member's year on a server (/overview/detail/:id/members/:memberId/wrapped?year=), the dashboard side of /wrapped. */
@Component({
  selector: 'pages-wrapped',
  imports: [RouterLink, StatCardComponent, SkeletonLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
  template: `
    <div class="mx-auto max-w-4xl px-md lg:px-lg py-md space-y-lg">
      <header class="space-y-sm">
        <a [routerLink]="backLink()" class="inline-flex items-center gap-xs text-sm text-gray-400 hover:text-gray-200">
          <span aria-hidden="true">←</span> {{ isSelf() ? 'Your stats' : name() }}
        </a>
        <div class="flex flex-wrap items-end justify-between gap-md">
          <div class="flex items-center gap-md">
            @if (wrapped()?.member?.avatar; as avatar) {
              <img [src]="avatar" alt="" class="h-12 w-12 rounded-full ring-1 ring-white/10" />
            }
            <div>
              <p class="text-xs font-medium uppercase tracking-widest text-gray-500">Server Wrapped</p>
              <h1 class="text-2xl font-bold tracking-tight text-gray-100">{{ isSelf() ? 'Your' : name() + '’s' }} {{ activeYear() }}</h1>
            </div>
          </div>
          <nav class="flex items-center gap-xs" aria-label="Year">
            @if (activeYear() > firstYear) {
              <a class="btn btn-ghost btn-sm" [routerLink]="[]" [queryParams]="{ year: activeYear() - 1 }">← {{ activeYear() - 1 }}</a>
            }
            @if (activeYear() < currentYear) {
              <a class="btn btn-ghost btn-sm" [routerLink]="[]" [queryParams]="{ year: activeYear() + 1 }">{{ activeYear() + 1 }} →</a>
            }
          </nav>
        </div>
      </header>

      @if (wrapped(); as w) {
        @if (w.voiceMs === 0 && w.messages === 0) {
          <p class="rounded-xl border border-white/5 bg-base-300 p-lg text-center text-gray-400">
            Nothing to wrap: no voice or chat on this server in {{ w.year }}.
          </p>
        } @else {
          <section class="flex flex-wrap items-end justify-between gap-md rounded-2xl border border-white/5 bg-base-300 p-lg">
            <div>
              <p class="text-sm text-gray-400">Time in voice</p>
              <p class="text-5xl font-bold text-primary-400">{{ hours(w.voiceMs) }}</p>
              <p class="mt-xs text-sm text-gray-500">{{ w.sessions.toLocaleString('en-GB') }} sessions</p>
            </div>
            @if (w.voiceRank; as rank) {
              <div class="text-right">
                <p class="text-4xl font-bold text-gray-100">Top {{ rank.topPercent }}%</p>
                <p class="mt-xs text-sm text-gray-500">#{{ rank.rank }} of {{ rank.members }} voice members</p>
              </div>
            }
          </section>

          <div class="grid grid-cols-1 gap-md sm:grid-cols-2">
            <lib-stat-card label="Longest session" [value]="w.longestSessionMs ? duration(w.longestSessionMs) : '–'" />
            <lib-stat-card label="Favourite channel" [value]="w.favouriteChannel ? '#' + w.favouriteChannel.name : '–'" />
            <lib-stat-card
              label="Top duo"
              [value]="w.topDuoMember ? w.topDuoMember.displayName || w.topDuoMember.username : '–'"
              [subtitle]="w.topDuo ? hours(w.topDuo.togetherMs) + ' together' : undefined"
            />
            <lib-stat-card
              label="Peak month"
              [value]="w.peakMonth ? month(w.peakMonth.month) : '–'"
              [subtitle]="w.peakMonth ? hours(w.peakMonth.voiceMs) + ' in voice' : undefined"
            />
            <lib-stat-card
              label="Longest streak"
              [value]="w.longestStreak ? w.longestStreak + (w.longestStreak === 1 ? ' day' : ' days') : '–'"
              [subtitle]="w.longestStreak ? 'in a row with 10+ min in voice' : undefined"
            />
            <lib-stat-card label="Messages sent" [value]="w.messages.toLocaleString('en-GB')" />
            <lib-stat-card
              label="Milestones"
              [value]="w.milestones.length ? milestones(w.milestones) : '–'"
              [subtitle]="w.milestones.length ? 'lifetime voice hours passed' : 'none this year'"
            />
            <lib-stat-card
              label="Level"
              [value]="w.xp.levelFrom === w.xp.levelTo ? 'Level ' + w.xp.levelTo : 'Level ' + w.xp.levelFrom + ' → ' + w.xp.levelTo"
              [subtitle]="w.xp.gained > 0 ? '+' + w.xp.gained.toLocaleString('en-GB') + ' XP' : 'no XP this year'"
            />
          </div>
          <p class="text-xs text-gray-500">
            {{ w.year }} in UTC; a session counts for the day it started and open sessions count live.
            Post it in Discord with <code>/wrapped</code>.
          </p>
        }
      } @else if (wrappedResource.error()) {
        <p class="rounded-xl border border-error/30 bg-error/10 p-md text-sm text-error">Couldn’t load this Wrapped. Try again later.</p>
      } @else {
        <lib-skeleton-loader type="stat-grid" />
      }
    </div>
  `,
})
export class WrappedComponent {
  /** Server id (route param) */
  id = input.required<string>();
  /** Member id (route param) */
  memberId = input.required<string>();
  /** `?year=2025`; this year when absent or out of range */
  year = input<string | undefined>();

  private api = inject(VoiceStatsApi);
  private currentUser = inject(USER);
  private durationPipe = new HumanizeDurationPipe();

  readonly firstYear = FIRST_YEAR;
  readonly currentYear = thisYear();
  activeYear = computed(() => {
    const year = Number(this.year());
    return Number.isInteger(year) && year >= FIRST_YEAR && year <= this.currentYear ? year : this.currentYear;
  });

  wrappedResource = this.api.fetchWrapped(
    () => this.id(),
    () => this.memberId(),
    () => this.activeYear()
  );
  wrapped = computed(() => (this.wrappedResource.hasValue() ? this.wrappedResource.value() : undefined));

  isSelf = computed(() => this.memberId() === this.currentUser()?.id);
  name = computed(() => {
    const member = this.wrapped()?.member;
    return member?.displayName || member?.username || 'This member';
  });
  backLink = computed(() =>
    this.isSelf() ? ['/overview/detail', this.id()] : ['/overview/detail', this.id(), 'members', this.memberId()]
  );

  /** "312 hours" for a year's worth; short totals keep minutes, like the card */
  hours = (ms: number) =>
    ms >= 10 * HOUR ? `${Math.round(ms / HOUR).toLocaleString('en-GB')} hours` : this.duration(ms);
  duration = (ms: number) => this.durationPipe.transform(ms, true);
  month = (month: number) =>
    new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  milestones = (hours: number[]) => hours.map((h) => `${h}h`).join(' · ');
}
