import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoiceStatsApi, VoiceStatsWrapped } from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import {
  ProgressBarComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
  SkeletonLoaderComponent,
  StatCardComponent,
} from '@nx-stolfo/components';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import { ActivityCalendarComponent, BarChartComponent } from '@nx-stolfo/ui-voice-stats';

const HOUR = 60 * 60 * 1000;
const FIRST_YEAR = 2020;
const thisYear = () => new Date().getUTCFullYear();
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2000, i, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
);
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}:00`);

type MonthMetric = 'voice' | 'messages';

/** A member's year on a server (/overview/detail/:id/members/:memberId/wrapped?year=), the dashboard side of /wrapped. */
@Component({
  selector: 'pages-wrapped',
  imports: [
    RouterLink,
    StatCardComponent,
    SkeletonLoaderComponent,
    SegmentedControlComponent,
    ProgressBarComponent,
    BarChartComponent,
    ActivityCalendarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
  template: `
    <div class="mx-auto max-w-5xl px-md lg:px-lg py-md space-y-lg">
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

          <div class="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            <lib-stat-card label="Longest session" [value]="w.longestSessionMs ? duration(w.longestSessionMs) : '–'" />
            <lib-stat-card label="Favourite channel" [value]="w.topChannels[0] ? '#' + w.topChannels[0].channel.name : '–'" />
            <lib-stat-card
              label="Top duo"
              [value]="w.buddies[0] ? memberName(w.buddies[0].member) : '–'"
              [subtitle]="w.buddies[0] ? hours(w.buddies[0].togetherMs) + ' together' : undefined"
            />
            <lib-stat-card
              label="Peak month"
              [value]="w.peakMonth ? months[w.peakMonth.month - 1] : '–'"
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
            <lib-stat-card
              label="Games won"
              [value]="(w.games.rockPaperScissors + w.games.ticTacToe + w.games.trivia).toLocaleString('en-GB')"
              [subtitle]="w.games.rockPaperScissors + ' rock paper scissors · ' + w.games.ticTacToe + ' tic-tac-toe · ' + w.games.trivia + ' trivia right'"
            />
          </div>

          <section class="rounded-xl border border-white/5 bg-base-300 p-lg">
            <div class="mb-sm flex flex-wrap items-start justify-between gap-sm">
              <div>
                <h3 class="text-base font-semibold text-gray-100">By month</h3>
                @if (w.peakMonth) {
                  <p class="text-xs text-gray-500">Most voice in {{ months[w.peakMonth.month - 1] }}</p>
                }
              </div>
              <lib-segmented-control label="Show" [options]="monthMetricOptions" [(value)]="monthMetric" />
            </div>
            <feature-voice-stats-bar-chart
              [labels]="monthLabels"
              [values]="monthValues()"
              [highlight]="monthPeak()"
              [axisFormat]="monthMetric() === 'voice' ? hourAxis : countAxis"
              [tooltip]="monthTooltip"
            />
          </section>

          @if (w.buddies.length) {
            <section class="space-y-sm">
              <h3 class="text-base font-semibold text-gray-100">Buddies</h3>
              <div class="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-5">
                @for (b of w.buddies; track b.member.id) {
                  <a
                    [routerLink]="memberLink(b.member.id)"
                    class="flex flex-col items-center gap-xs rounded-xl border border-white/5 bg-base-300 p-md text-center hover:border-primary-400/40"
                  >
                    @if (b.member.avatar) {
                      <img [src]="b.member.avatar" alt="" class="h-14 w-14 rounded-full ring-1 ring-white/10" />
                    } @else {
                      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-xl font-bold text-gray-900" aria-hidden="true">
                        {{ memberName(b.member).charAt(0).toUpperCase() }}
                      </span>
                    }
                    <span class="w-full truncate text-sm font-semibold text-gray-100">{{ memberName(b.member) }}</span>
                    <span class="text-xs text-gray-500">{{ hours(b.togetherMs) }} together</span>
                  </a>
                }
              </div>
            </section>
          }

          <div class="grid grid-cols-1 gap-md lg:grid-cols-2">
            <section class="rounded-xl border border-white/5 bg-base-300 p-lg">
              <h3 class="mb-md text-base font-semibold text-gray-100">Top channels</h3>
              @for (c of w.topChannels; track c.channel.id) {
                <lib-progress-bar
                  class="mb-md block"
                  [label]="'#' + c.channel.name"
                  [percentage]="share(c.voiceMs, w.topChannels[0].voiceMs)"
                  [showPercentage]="false"
                  [subtitle]="hours(c.voiceMs)"
                />
              } @empty {
                <p class="text-sm text-gray-500">No voice this year.</p>
              }
            </section>
            <section class="rounded-xl border border-white/5 bg-base-300 p-lg">
              <h3 class="text-base font-semibold text-gray-100">
                {{ w.persona ? w.persona.label + ' · busiest at ' + w.persona.peakHour + ':00' : 'Time of day' }}
              </h3>
              <p class="text-xs text-gray-500">Voice time per hour, UTC</p>
              <feature-voice-stats-bar-chart
                [labels]="hourLabels"
                [values]="hourValues()"
                [highlight]="w.persona?.peakHour ?? -1"
                [labelInterval]="5"
                [axisFormat]="hourAxis"
                [tooltip]="hourTooltip"
              />
            </section>
          </div>

          <feature-voice-stats-activity-calendar [calendar]="w.days" [year]="w.year" />

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
  readonly months = MONTHS;
  readonly monthLabels = MONTHS.map((m) => m.slice(0, 3));
  readonly hourLabels = HOUR_LABELS;
  readonly monthMetricOptions: SegmentedControlOption<MonthMetric>[] = [
    { value: 'voice', label: 'Voice' },
    { value: 'messages', label: 'Messages' },
  ];
  monthMetric = signal<MonthMetric>('voice');

  activeYear = computed(() => {
    const year = Number(this.year());
    return Number.isInteger(year) && year >= FIRST_YEAR && year <= this.currentYear ? year : this.currentYear;
  });

  wrappedResource = this.api.fetchWrapped(
    () => this.id(),
    () => this.memberId(),
    () => this.activeYear()
  );
  wrapped = computed<VoiceStatsWrapped | undefined>(() =>
    this.wrappedResource.hasValue() ? this.wrappedResource.value() : undefined
  );

  isSelf = computed(() => this.memberId() === this.currentUser()?.id);
  name = computed(() => {
    const member = this.wrapped()?.member;
    return member ? this.memberName(member) : 'This member';
  });
  backLink = computed(() => this.memberLink(this.memberId()));
  memberLink = (memberId: string) =>
    memberId === this.currentUser()?.id ? ['/overview/detail', this.id()] : ['/overview/detail', this.id(), 'members', memberId];

  monthValues = computed(() =>
    (this.wrapped()?.months ?? []).map((m) => (this.monthMetric() === 'voice' ? +(m.voiceMs / HOUR).toFixed(1) : m.messages))
  );
  monthPeak = computed(() => {
    const values = this.monthValues();
    const max = Math.max(0, ...values);
    return max > 0 ? values.indexOf(max) : -1;
  });
  monthTooltip = (i: number) => {
    const m = this.wrapped()?.months[i];
    return m ? `<strong>${MONTHS[i]}</strong><br/>${this.hours(m.voiceMs)} in voice<br/>${m.messages.toLocaleString('en-GB')} messages` : '';
  };
  hourTooltip = (h: number) => `<strong>${h}:00–${h + 1}:00 UTC</strong><br/>${this.hours((this.wrapped()?.hours[h] ?? 0) * 60_000)} in voice`;
  /** Voice hours per UTC hour of the day */
  hourValues = computed(() => (this.wrapped()?.hours ?? []).map((minutes) => +(minutes / 60).toFixed(1)));
  hourAxis = (value: number) => `${value}h`;
  countAxis = (value: number) => `${value}`;

  memberName = (member: { displayName: string | null; username: string }) => member.displayName || member.username;
  /** "312 hours" for a year's worth; short totals keep minutes, like the card */
  hours = (ms: number) =>
    ms >= 10 * HOUR ? `${Math.round(ms / HOUR).toLocaleString('en-GB')} hours` : this.duration(ms);
  duration = (ms: number) => this.durationPipe.transform(ms, true);
  share = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
  milestones = (hours: number[]) => hours.map((h) => `${h}h`).join(' · ');
}
