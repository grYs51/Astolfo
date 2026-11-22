import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { BarChart } from 'echarts/charts';
echarts.use([CanvasRenderer, TooltipComponent, GridComponent, BarChart]);

const BAR = '#a855f7';
const BAR_DIM = 'rgba(168, 85, 247, 0.45)';

/**
 * One series of bars with the dashboard's dark look, one bar picked out in
 * full colour (e.g. the peak month). Size it with a height class on the element.
 */
@Component({
  selector: 'feature-voice-stats-bar-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-56' },
  template: `<div echarts [options]="option()" class="block h-full w-full"></div>`,
})
export class BarChartComponent {
  labels = input.required<readonly string[]>();
  values = input.required<readonly number[]>();
  /** The bar drawn in full colour; -1 for none */
  highlight = input(-1);
  /** Axis label for a value */
  axisFormat = input<(value: number) => string>((value) => `${value}`);
  /** Tooltip for a bar */
  tooltip = input.required<(index: number) => string>();
  /** Labels to skip between shown ones (1 = every other); by default ECharts skips what doesn't fit */
  labelInterval = input<number | 'auto'>('auto');

  protected option = computed(() => ({
    grid: { top: 16, bottom: 28, left: 48, right: 8 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6' },
      formatter: (params: { dataIndex: number }[]) => this.tooltip()(params[0].dataIndex),
    },
    xAxis: {
      type: 'category',
      data: this.labels(),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', interval: this.labelInterval() },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9ca3af', formatter: this.axisFormat() },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: this.values().map((value, i) => ({
          value,
          itemStyle: { color: i === this.highlight() ? BAR : BAR_DIM, borderRadius: [4, 4, 0, 0] },
        })),
      },
    ],
  }));
}
