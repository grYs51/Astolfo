import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { AdminUsage } from '@nx-stolfo/data-access-admin';
import { StatCardComponent } from '@nx-stolfo/components';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { dailyLineOption, echarts, rankedBarOption } from './charts';

@Component({
  selector: 'feature-admin-usage',
  imports: [NgxEchartsDirective, StatCardComponent, DecimalPipe, PercentPipe],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <div class="grid grid-cols-2 gap-sm md:grid-cols-4">
      <lib-stat-card [dense]="true" label="Prefix commands (30d)" [value]="totals().prefix" />
      <lib-stat-card [dense]="true" label="Slash commands (30d)" [value]="totals().slash" />
      <lib-stat-card [dense]="true" label="Command errors (30d)" [value]="totals().errors" />
      <lib-stat-card [dense]="true" label="Unused commands" [value]="unused().length" [subtitle]="unused().join(', ')" />
    </div>

    <div class="mt-md grid gap-md lg:grid-cols-2">
      <div>
        <h3 class="mb-xs text-sm font-semibold text-gray-100">Uses per command, last 30 days</h3>
        @if (used().length === 0) {
          <p class="py-lg text-center text-sm text-gray-500">No commands used in the last 30 days</p>
        } @else {
          <div echarts [options]="barOption()" class="block w-full" [style.height.px]="40 + used().length * 24"></div>
        }
      </div>
      <div>
        <h3 class="mb-xs text-sm font-semibold text-gray-100">Commands per day</h3>
        <div echarts [options]="lineOption()" class="block h-[260px] w-full"></div>
        <p class="text-xs text-gray-500">Counted from daily snapshots of the running totals, so the first tracked day shows zero</p>
      </div>
    </div>

    <h3 class="mb-xs mt-md text-sm font-semibold text-gray-100">API routes</h3>
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Route</th>
            <th class="text-right">Requests</th>
            <th class="text-right">5xx rate</th>
            <th class="text-right" title="Since the last restart, histogram bucket upper bound">p95</th>
          </tr>
        </thead>
        <tbody>
          @for (route of usage().routes.slice(0, 15); track route.method + route.route) {
            <tr>
              <td class="font-mono text-xs text-gray-300">{{ route.method }} {{ route.route }}</td>
              <td class="text-right tabular-nums">{{ route.requests | number }}</td>
              <td class="text-right tabular-nums" [class.text-red-400]="route.errorRate > 0.01">
                {{ route.errorRate | percent: '1.0-1' }}
              </td>
              <td class="text-right tabular-nums">{{ route.p95Ms === null ? '–' : '≤ ' + route.p95Ms + ' ms' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4" class="py-lg text-center text-gray-400">No requests counted yet</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsageComponent {
  usage = input.required<AdminUsage>();

  protected totals = computed(() =>
    this.usage().daily.reduce(
      (sum, day) => ({ prefix: sum.prefix + day.prefix, slash: sum.slash + day.slash, errors: sum.errors + day.errors }),
      { prefix: 0, slash: 0, errors: 0 }
    )
  );

  protected unused = computed(() => this.usage().commands.filter((c) => c.total === 0).map((c) => c.name));

  protected used = computed(() =>
    this.usage()
      .commands.filter((c) => c.last30d > 0)
      .sort((a, b) => b.last30d - a.last30d)
  );

  protected barOption = computed(() =>
    rankedBarOption(
      this.used().map((c) => ({ name: c.kind === 'slash' ? `/${c.name}` : c.name, value: c.last30d })),
      'uses'
    )
  );

  protected lineOption = computed(() => {
    const daily = this.usage().daily;
    return dailyLineOption(
      daily.map((d) => d.day),
      [
        { name: 'Slash', data: daily.map((d) => d.slash) },
        { name: 'Prefix', data: daily.map((d) => d.prefix) },
      ]
    );
  });
}
