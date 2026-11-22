import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { BarChart } from 'echarts/charts';
echarts.use([CanvasRenderer, TooltipComponent, GridComponent, BarChart]);

const BAR = '#a855f7';
const BAR_DIM = 'rgba(168, 85, 247, 0.4)';
const EMPTY = '#374151';

/**
 * Bars in the image cards' style (Server Wrapped): no y-axis or gridlines,
 * rounded bars, one picked out in full colour with its value above it, the
 * rest dimmed. Size it with a height class on the element.
 */
@Component({
  selector: 'feature-voice-stats-bar-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-40' },
  template: `<div echarts [options]="option()" class="block h-full w-full"></div>`,
})
export class BarChartComponent {
  labels = input.required<readonly string[]>();
  values = input.required<readonly number[]>();
  /** The bar drawn in full colour, with `peakLabel` above it; -1 for none */
  highlight = input(-1);
  /** Text above the highlighted bar */
  peakLabel = input<string>();
  /** Tooltip for a bar */
  tooltip = input.required<(index: number) => string>();
  /** Show every nth label (6 for hours: 0:00, 6:00, 12:00, 18:00) */
  labelEvery = input(1);
  /** Bar width as a share of its slot */
  barWidth = input('64%');

  protected option = computed(() => {
    const max = Math.max(0, ...this.values());
    const every = this.labelEvery();
    return {
      grid: { top: 24, bottom: 24, left: 4, right: 4 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6' },
        formatter: (params: { dataIndex: number }[]) => this.tooltip()(params[0].dataIndex),
      },
      xAxis: {
        type: 'category',
        data: this.labels(),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: '#9ca3af',
          interval: (index: number) => index % every === 0,
          // Like the card: the highlighted bar's label in full colour
          formatter: (label: string, index: number) => (index === this.highlight() ? `{peak|${label}}` : label),
          rich: { peak: { color: '#f3f4f6', fontWeight: 'bold' } },
        },
      },
      yAxis: { type: 'value', show: false, max: max > 0 ? max : 1 },
      series: [
        {
          type: 'bar',
          barWidth: this.barWidth(),
          // Empty slots show a thin line, like the card
          data: this.values().map((value, i) => ({
            value: value > 0 ? value : max * 0.02 || 0.02,
            itemStyle: {
              color: value <= 0 ? EMPTY : i === this.highlight() ? BAR : BAR_DIM,
              borderRadius: [4, 4, 4, 4],
            },
            label:
              i === this.highlight() && this.peakLabel()
                ? { show: true, position: 'top', color: '#f3f4f6', fontWeight: 'bold', formatter: this.peakLabel() }
                : { show: false },
          })),
        },
      ],
    };
  });
}
