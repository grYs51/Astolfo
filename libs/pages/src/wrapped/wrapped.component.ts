import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoiceStatsApi, VoiceStatsWrapped, WrappedRank, WrappedXpGroup } from '@nx-stolfo/data-access-voice-stats';
import { USER } from '@nx-stolfo/auth';
import { SegmentedControlComponent, SegmentedControlOption, SkeletonLoaderComponent } from '@nx-stolfo/components';
import { ActivityCalendarComponent, BarChartComponent } from '@nx-stolfo/ui-voice-stats';

const HOUR = 60 * 60 * 1000;
const FIRST_YEAR = 2020;
const thisYear = () => new Date().getUTCFullYear();
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2000, i, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
);
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}:00`);
const n = (value: number) => value.toLocaleString('en-GB');

type MonthMetric = 'voice' | 'messages' | 'xp';
interface Tile {
  label: string;
  value: string;
  sub?: string;
}

/**
 * "312 hours", "2.9 hours" under 10 h, "45 min" under an hour: the same rule as
 * the card (`formatHours` in apps/bot/src/cards/wrapped.card.ts).
 */
const hours = (ms: number) => {
  if (ms < HOUR) return `${Math.round(ms / 60_000)} min`;
  const h = ms < 10 * HOUR ? Math.round(ms / (HOUR / 10)) / 10 : Math.round(ms / HOUR);
  return `${n(h)} ${h === 1 ? 'hour' : 'hours'}`;
};

/** "Top 4%" only for the top half, like the card (`rankText`) */
const rankText = (r: WrappedRank, of: string) =>
  r.topPercent <= 50 ? { big: `Top ${r.topPercent}%`, sub: `#${r.rank} of ${r.members} ${of}` } : { big: `#${r.rank} of ${r.members}`, sub: of };

/**
 * A member's year on a server (/overview/detail/:id/members/:memberId/wrapped?year=),
 * the dashboard side of /wrapped, laid out like the card in the site's colours.
 */
@Component({
  selector: 'pages-wrapped',
  imports: [RouterLink, SkeletonLoaderComponent, SegmentedControlComponent, BarChartComponent, ActivityCalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VoiceStatsApi],
  template: `
    <div class="mx-auto max-w-[800px] px-md py-md space-y-md">
      <nav class="flex items-center justify-between gap-md text-sm" aria-label="Wrapped">
        <a [routerLink]="backLink()" class="text-gray-400 hover:text-gray-200"><span aria-hidden="true">←</span> {{ isSelf() ? 'Your stats' : name() }}</a>
        <span class="flex gap-xs">
          @if (activeYear() > firstYear) {
            <a class="btn btn-ghost btn-sm" [routerLink]="[]" [queryParams]="{ year: activeYear() - 1 }">← {{ activeYear() - 1 }}</a>
          }
          @if (activeYear() < currentYear) {
            <a class="btn btn-ghost btn-sm" [routerLink]="[]" [queryParams]="{ year: activeYear() + 1 }">{{ activeYear() + 1 }} →</a>
          }
        </span>
      </nav>

      <!-- Header: avatar, title, "name on server", like the card -->
      <header class="flex items-center gap-md">
        @if (wrapped()?.member?.avatar; as avatar) {
          <img [src]="avatar" alt="" class="h-[72px] w-[72px] rounded-full" />
        } @else {
          <span class="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-500 text-3xl font-bold text-gray-900" aria-hidden="true">
            {{ name().charAt(0).toUpperCase() }}
          </span>
        }
        <div class="min-w-0">
          <h1 class="text-3xl font-bold text-gray-100">{{ activeYear() }} Wrapped</h1>
          <p class="truncate text-gray-400">{{ name() }}{{ wrapped() ? ' on ' + wrapped()!.serverName : '' }}</p>
        </div>
      </header>

      @if (wrapped(); as w) {
        @if (w.voiceMs === 0 && w.messages === 0) {
          <p class="rounded-2xl bg-base-300 p-lg text-center text-gray-400">Nothing to wrap: no voice or chat on this server in {{ w.year }}.</p>
        } @else {
          <!-- Hero: hours left, rank right -->
          <section class="flex flex-wrap items-end justify-between gap-md rounded-2xl bg-base-300 px-lg py-md">
            <div>
              <p class="text-gray-400">Time in voice</p>
              <p class="text-5xl font-bold leading-tight text-primary-400">{{ hours(w.voiceMs) }}</p>
              <p class="text-sm text-gray-400">{{ n(w.sessions) }} sessions</p>
            </div>
            @if (voiceRank(); as r) {
              <div class="ml-auto text-right">
                <p class="text-4xl font-bold text-gray-100">{{ r.big }}</p>
                <p class="text-sm text-gray-400">{{ r.sub }}</p>
              </div>
            }
          </section>

          <!-- Tiles, two a row -->
          <div class="grid grid-cols-1 gap-md sm:grid-cols-2">
            @for (t of tiles(); track t.label) {
              <div class="min-h-[104px] rounded-2xl bg-base-300 px-lg py-md">
                <p class="text-sm text-gray-400">{{ t.label }}</p>
                <p class="line-clamp-2 font-bold leading-tight text-gray-100" [class]="t.value.length > 20 ? 'text-xl' : 'text-3xl'">{{ t.value }}</p>
                @if (t.sub) {
                  <p class="text-sm text-gray-400">{{ t.sub }}</p>
                }
              </div>
            }
          </div>

          <!-- XP -->
          <section class="rounded-2xl bg-base-300 px-lg py-md">
            <div class="flex flex-wrap items-end justify-between gap-md">
              <div>
                <p class="text-gray-400">XP earned</p>
                <p class="text-5xl font-bold leading-tight text-primary-400">{{ n(w.xp.gained) }} XP</p>
                <p class="text-gray-400">{{ levelLine(w) }}</p>
              </div>
              @if (xpRank(); as r) {
                <div class="ml-auto text-right">
                  <p class="text-3xl font-bold text-gray-100">{{ r.big }}</p>
                  <p class="text-sm text-gray-400">{{ r.sub }}</p>
                </div>
              }
            </div>
            @if (w.xp.gained > 0) {
              <div class="mt-md flex h-3 w-full overflow-hidden rounded-full bg-gray-700" role="img" [attr.aria-label]="sourceSummary(w)">
                @for (s of w.xp.sources; track s.group) {
                  <div class="h-full" [style.width.%]="s.share * 100" [style.background-color]="xpColors[s.group]"></div>
                }
              </div>
              <ul class="mt-sm flex flex-wrap gap-x-lg gap-y-xs text-sm text-gray-200">
                @for (s of w.xp.sources; track s.group) {
                  <li class="flex items-center gap-xs" [title]="n(s.xp) + ' XP'">
                    <span class="h-2.5 w-2.5 rounded-full" [style.background-color]="xpColors[s.group]" aria-hidden="true"></span>
                    {{ xpLabels[s.group] }} {{ percent(s.share) }}
                  </li>
                }
              </ul>
              @if (xpExtras(w); as extras) {
                <p class="mt-sm text-sm text-gray-400">{{ extras }}</p>
              }
            }
          </section>

          <!-- Monthly bars; the toggle sits in the heading row -->
          <section>
            <div class="mb-xs flex items-center justify-between gap-sm">
              <h2 class="text-sm text-gray-400">{{ monthHeading() }}</h2>
              <lib-segmented-control label="Show" [options]="monthMetricOptions" [(value)]="monthMetric" class="scale-90 origin-right" />
            </div>
            <div class="rounded-2xl bg-base-300 px-md py-sm">
              <feature-voice-stats-bar-chart
                [labels]="monthInitials"
                [values]="monthValues()"
                [highlight]="monthPeak()"
                [peakLabel]="monthPeakLabel()"
                [tooltip]="monthTooltip"
              />
            </div>
          </section>

          @if (w.buddies.length) {
            <section>
              <h2 class="mb-xs text-sm text-gray-400">Buddies · most time together in voice</h2>
              <div class="grid grid-cols-3 gap-y-md rounded-2xl bg-base-300 px-sm py-md sm:grid-cols-5">
                @for (b of w.buddies; track b.member.id) {
                  <a [routerLink]="memberLink(b.member.id)" class="group flex min-w-0 flex-col items-center gap-xs px-xs text-center">
                    @if (b.member.avatar) {
                      <img [src]="b.member.avatar" alt="" class="h-14 w-14 rounded-full ring-2 ring-transparent group-hover:ring-primary-400" />
                    } @else {
                      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-xl font-bold text-gray-900 ring-2 ring-transparent group-hover:ring-primary-400" aria-hidden="true">
                        {{ memberName(b.member).charAt(0).toUpperCase() }}
                      </span>
                    }
                    <span class="w-full truncate text-sm font-bold text-gray-100 group-hover:underline">{{ memberName(b.member) }}</span>
                    <span class="text-xs text-gray-400">{{ hours(b.togetherMs) }}</span>
                  </a>
                }
              </div>
            </section>
          }

          <div class="grid grid-cols-1 gap-md sm:grid-cols-2">
            <section class="flex flex-col">
              <h2 class="mb-xs text-sm text-gray-400">Top channels</h2>
              <div class="flex-1 space-y-md rounded-2xl bg-base-300 px-lg py-md">
                @for (c of w.topChannels; track c.channel.id; let first = $first) {
                  <div>
                    <div class="flex items-baseline justify-between gap-sm text-sm">
                      <span class="truncate text-gray-100">#{{ c.channel.name }}</span>
                      <span class="shrink-0 text-xs text-gray-400">{{ hours(c.voiceMs) }}</span>
                    </div>
                    <div class="mt-xs h-2 w-full rounded-full bg-gray-700">
                      <div class="h-2 rounded-full bg-primary-500" [class.opacity-60]="!first" [style.width.%]="share(c.voiceMs, w.topChannels[0].voiceMs)"></div>
                    </div>
                  </div>
                } @empty {
                  <p class="text-sm text-gray-400">No voice this year</p>
                }
              </div>
            </section>
            <section class="flex flex-col">
              <h2 class="mb-xs text-sm text-gray-400">Time of day ({{ tz }})</h2>
              <div class="flex-1 rounded-2xl bg-base-300 px-lg py-md">
                <p class="font-bold text-gray-100">
                  {{ w.persona ? w.persona.label + ' · busiest at ' + w.persona.peakHour + ':00' : 'No voice this year' }}
                </p>
                <feature-voice-stats-bar-chart
                  class="h-28"
                  [labels]="hourLabels"
                  [values]="w.hours"
                  [highlight]="w.persona?.peakHour ?? -1"
                  [labelEvery]="6"
                  barWidth="50%"
                  [tooltip]="hourTooltip"
                />
              </div>
            </section>
          </div>

          <feature-voice-stats-activity-calendar [calendar]="w.days" [year]="w.year" />

          <footer class="space-y-xs text-sm text-gray-400">
            <p>{{ w.serverName }} · {{ w.year }}</p>
            <p class="text-xs text-gray-500">The year and its days and hours in {{ tz }}; open sessions count live. Post it in Discord with <code>/wrapped</code>.</p>
          </footer>
        }
      } @else if (wrappedResource.error()) {
        <p class="rounded-2xl border border-error/30 bg-error/10 p-md text-sm text-error">Couldn’t load this Wrapped. Try again later.</p>
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

  readonly firstYear = FIRST_YEAR;
  readonly currentYear = thisYear();
  readonly monthInitials = MONTHS.map((m) => m[0]);
  readonly hourLabels = HOUR_LABELS;
  readonly monthMetricOptions: SegmentedControlOption<MonthMetric>[] = [
    { value: 'voice', label: 'Voice' },
    { value: 'messages', label: 'Messages' },
    { value: 'xp', label: 'XP' },
  ];
  monthMetric = signal<MonthMetric>('voice');
  /** The site's palette: primary for voice, then the habit colours */
  readonly xpColors: Record<WrappedXpGroup, string> = {
    voice: '#a855f7',
    messages: '#38bdf8',
    games: '#34d399',
    streaks: '#fbbf24',
    bonuses: '#9ca3af',
  };
  readonly xpLabels: Record<WrappedXpGroup, string> = { voice: 'Voice', messages: 'Messages', games: 'Games', streaks: 'Streaks', bonuses: 'Bonuses' };

  readonly n = n;
  readonly hours = hours;
  /** The viewer's time zone: the API cuts the year, months, days and hours in it (fetchWrapped sends it) */
  readonly tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  voiceRank = computed(() => {
    const rank = this.wrapped()?.voiceRank;
    return rank ? rankText(rank, 'voice members') : undefined;
  });
  xpRank = computed(() => {
    const rank = this.wrapped()?.xp.rank;
    return rank ? rankText(rank, 'by XP earned') : undefined;
  });

  /** The card's tiles, same order */
  tiles = computed<Tile[]>(() => {
    const w = this.wrapped();
    if (!w) return [];
    const duo = w.buddies[0];
    const games = w.games.rockPaperScissors + w.games.ticTacToe + w.games.trivia;
    return [
      { label: 'Longest session', value: w.longestSessionMs ? hours(w.longestSessionMs) : '–' },
      { label: 'Favourite channel', value: w.topChannels[0] ? `#${w.topChannels[0].channel.name}` : '–' },
      { label: 'Top duo', value: duo ? this.memberName(duo.member) : '–', sub: duo ? `${hours(duo.togetherMs)} together` : undefined },
      {
        label: 'Peak month',
        value: w.peakMonth ? MONTHS[w.peakMonth.month - 1] : '–',
        sub: w.peakMonth ? `${hours(w.peakMonth.voiceMs)} in voice` : undefined,
      },
      {
        label: 'Longest streak',
        value: w.longestStreak ? `${w.longestStreak} ${w.longestStreak === 1 ? 'day' : 'days'}` : '–',
        sub: w.longestStreak ? 'in a row with 10+ min in voice' : undefined,
      },
      { label: 'Messages sent', value: n(w.messages) },
      {
        label: 'Milestones',
        value: w.milestones.length ? w.milestones.map((h) => `${h}h`).join(' · ') : '–',
        sub: w.milestones.length ? 'lifetime voice hours passed' : 'none this year',
      },
      {
        label: 'Games won',
        value: games ? n(games) : '–',
        sub: games
          ? [
              w.games.rockPaperScissors ? `${n(w.games.rockPaperScissors)} rock paper scissors` : '',
              w.games.ticTacToe ? `${n(w.games.ticTacToe)} tic-tac-toe` : '',
              w.games.trivia ? `${n(w.games.trivia)} trivia` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : 'none this year',
      },
    ];
  });

  levelLine = (w: VoiceStatsWrapped) =>
    w.xp.levelUps > 0
      ? `Level ${w.xp.levelFrom} → ${w.xp.levelTo} · ${w.xp.levelUps} ${w.xp.levelUps === 1 ? 'level-up' : 'level-ups'}`
      : w.xp.gained > 0 || w.xp.levelTo > 0 // level 0 below the first level, though XP was earned
        ? `Level ${w.xp.levelTo}`
        : 'No XP yet';
  xpExtras = (w: VoiceStatsWrapped) =>
    [
      w.xp.bestDay ? `Best day ${this.shortDate(w.xp.bestDay.date)} · ${n(w.xp.bestDay.xp)} XP` : '',
      w.xp.weeklyTop3 ? `${w.xp.weeklyTop3 === 1 ? 'Once' : `${w.xp.weeklyTop3}×`} in the weekly top 3` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  sourceSummary = (w: VoiceStatsWrapped) =>
    'XP by source: ' + w.xp.sources.map((s) => `${this.xpLabels[s.group]} ${this.percent(s.share)}`).join(', ');

  private monthRaw = computed(() =>
    (this.wrapped()?.months ?? []).map((m) => {
      const metric = this.monthMetric();
      return metric === 'voice' ? m.voiceMs : metric === 'messages' ? m.messages : m.xp;
    })
  );
  monthValues = computed(() => this.monthRaw().map((v) => (this.monthMetric() === 'voice' ? v / HOUR : v)));
  monthPeak = computed(() => {
    const values = this.monthRaw();
    const max = Math.max(0, ...values);
    return max > 0 ? values.indexOf(max) : -1;
  });
  monthPeakLabel = computed(() => {
    const peak = this.monthPeak();
    if (peak < 0) return undefined;
    const value = this.monthRaw()[peak];
    const metric = this.monthMetric();
    return metric === 'voice' ? hours(value) : metric === 'messages' ? `${n(value)} messages` : `${n(value)} XP`;
  });
  monthHeading = computed(() => {
    const what = { voice: 'Voice', messages: 'Messages', xp: 'XP' }[this.monthMetric()];
    const peak = this.monthPeak();
    return peak >= 0 ? `${what} by month · most in ${MONTHS[peak]}` : `${what} by month`;
  });
  monthTooltip = (i: number) => {
    const m = this.wrapped()?.months[i];
    return m ? `<strong>${MONTHS[i]}</strong><br/>${hours(m.voiceMs)} in voice<br/>${n(m.messages)} messages<br/>${n(m.xp)} XP` : '';
  };
  hourTooltip = (h: number) => `<strong>${h}:00–${h + 1}:00 ${this.tz}</strong><br/>${hours((this.wrapped()?.hours[h] ?? 0) * 60_000)} in voice`;

  memberName = (member: { displayName: string | null; username: string }) => member.displayName || member.username;
  share = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
  percent = (share: number) => `${Math.round(share * 100)}%`;
  shortDate = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
