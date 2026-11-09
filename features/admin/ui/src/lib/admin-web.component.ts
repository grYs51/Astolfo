import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminWeb } from '@nx-stolfo/data-access-admin';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { dailyLineOption, echarts } from './charts';

@Component({
  selector: 'feature-admin-web',
  imports: [NgxEchartsDirective, DecimalPipe],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <div class="grid gap-md lg:grid-cols-3">
      <div class="lg:col-span-2">
        <h3 class="mb-xs text-sm font-semibold text-gray-100">Views and visitors per day</h3>
        <div echarts [options]="lineOption()" class="block h-[260px] w-full"></div>
      </div>
      <div>
        <h3 class="mb-xs text-sm font-semibold text-gray-100">Top pages, 90 days</h3>
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Page</th>
              <th class="text-right">Views</th>
              <th class="text-right">Visitors</th>
            </tr>
          </thead>
          <tbody>
            @for (page of web().topPages; track page.path) {
              <tr>
                <td class="font-mono text-xs text-gray-300">/{{ page.path }}</td>
                <td class="text-right tabular-nums">{{ page.views | number }}</td>
                <td class="text-right tabular-nums">{{ page.visitors | number }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="py-lg text-center text-gray-400">No page views yet</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminWebComponent {
  web = input.required<AdminWeb>();

  protected lineOption = computed(() => {
    const daily = this.web().daily;
    return dailyLineOption(
      daily.map((d) => d.day),
      [
        { name: 'Views', data: daily.map((d) => d.views) },
        { name: 'Visitors', data: daily.map((d) => d.visitors) },
      ]
    );
  });
}
