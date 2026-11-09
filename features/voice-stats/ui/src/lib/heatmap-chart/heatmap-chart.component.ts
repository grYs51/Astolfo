import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { HeatmapChart } from 'echarts/charts';
import { HEATMAP_DAYS_OF_WEEK, HEATMAP_SEQUENTIAL_COLORS } from '../heatmap-grid';
echarts.use([CanvasRenderer, TooltipComponent, VisualMapComponent, GridComponent, HeatmapChart]);

/** `[column, row, value]`; a `null` value is drawn as an uncoloured "nothing here" cell */
export type HeatmapCell = [x: number, y: number, value: number | null];

const EMPTY_CELL = '#1b2030';
// Red (below) -> gray -> blue (above)
const DIVERGING_COLORS = ['#dc2626', '#f87171', '#4b5563', '#60a5fa', '#2563eb'];
const AXIS = {
  axisTick: { show: false },
  axisLine: { lineStyle: { color: '#374151' } },
};
// Bottom leaves room under the axis labels for the legend and its handle values
const GRID = { top: 8, bottom: 88, left: 48, right: 16 };
// 2px gap in the card surface colour between cells
const CELL_STYLE = { borderColor: '#141824', borderWidth: 2, borderRadius: 2 };

/**
 * The dashboard's heatmap look: a grid of rounded cells (rows top to bottom,
 * Monday first by default), a draggable gradient legend and a dark tooltip.
 * The caller picks the resolution: hours × weekdays, weeks × weekdays, …
 * Size it with a height class on the element, or set `square` to get the
 * height from the width.
 */
@Component({
  selector: 'feature-voice-stats-heatmap-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Inline-size container so the square height can follow the width (cqw)
  host: { class: 'block', style: 'container-type: inline-size' },
  template: `<div echarts [options]="option()" [initOpts]="{ renderer: 'canvas' }" [style.height]="height()" class="block w-full"></div>`,
})
export class HeatmapChartComponent {
  /** Square cells: height = cell width × rows + the grid's vertical margins */
  square = input(false);
  cells = input.required<HeatmapCell[]>();
  xLabels = input.required<readonly string[]>();
  /** Labels to skip between shown ones (1 = every other) */
  xLabelInterval = input(0);
  /** Values above/below zero, coloured blue/red around a grey 0 */
  diverging = input(false);
  /** Legend ends of the sequential scale: [high, low] */
  legend = input<[string, string]>(['More', 'Less']);
  tooltip = input.required<(x: number, y: number) => string>();

  protected height = computed(() =>
    this.square()
      ? `calc((100cqw - ${GRID.left + GRID.right}px) * ${HEATMAP_DAYS_OF_WEEK.length} / ${this.xLabels().length} + ${GRID.top + GRID.bottom}px)`
      : '100%'
  );

  protected option = computed(() => {
    const cells = this.cells();
    const diverging = this.diverging();
    const tooltip = this.tooltip();
    const filled = cells.filter((c): c is [number, number, number] => c[2] !== null);
    const empty = cells.filter((c) => c[2] === null).map(([x, y]) => [x, y, 0]);
    const max = Math.max(...filled.map((c) => Math.abs(c[2])), 1);

    return {
      tooltip: {
        // On <body> so a scrolling/clipping parent (the calendar's overflow wrapper) can't cut it off
        appendTo: 'body',
        position: 'top',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: { color: '#f3f4f6' },
        formatter: (params: unknown) => {
          const [x, y] = (params as { value: [number, number] }).value;
          return tooltip(x, y);
        },
      },
      grid: GRID,
      xAxis: {
        type: 'category',
        data: this.xLabels(),
        axisLabel: { interval: this.xLabelInterval(), fontSize: 10, color: '#9ca3af' },
        ...AXIS,
      },
      yAxis: {
        type: 'category',
        data: HEATMAP_DAYS_OF_WEEK,
        // ECharts draws the first category at the bottom
        inverse: true,
        axisLabel: { color: '#9ca3af' },
        ...AXIS,
      },
      visualMap: [
        {
          seriesIndex: 0,
          min: diverging ? -max : 0,
          max,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          text: diverging ? undefined : this.legend(),
          textStyle: { color: '#9ca3af' },
          inRange: { color: diverging ? DIVERGING_COLORS : HEATMAP_SEQUENTIAL_COLORS },
        },
        {
          // ECharts requires a visualMap per heatmap series; this one just
          // paints the empty cells a flat background colour
          show: false,
          seriesIndex: 1,
          min: 0,
          max: 1,
          inRange: { color: [EMPTY_CELL, EMPTY_CELL] },
        },
      ],
      series: [
        {
          type: 'heatmap',
          data: filled,
          itemStyle: CELL_STYLE,
          emphasis: { itemStyle: { borderColor: '#e5e7eb', borderWidth: 1 } },
        },
        { type: 'heatmap', data: empty, itemStyle: CELL_STYLE, emphasis: { disabled: true } },
      ],
    };
  });
}
