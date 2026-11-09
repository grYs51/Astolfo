import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { BarChart, LineChart } from 'echarts/charts';
echarts.use([CanvasRenderer, GridComponent, LegendComponent, TooltipComponent, BarChart, LineChart]);

export { echarts };

// Categorical order, validated on the #141824 surface (dataviz validate_palette.js: all checks pass)
export const SERIES_COLORS = ['#a855f7', '#0d9488'] as const;

const AXIS = { color: '#9ca3af', fontSize: 11 };
const LINE = { lineStyle: { color: '#374151' } };

const tooltip = {
  trigger: 'axis',
  backgroundColor: '#1f2937',
  borderColor: '#374151',
  borderWidth: 1,
  textStyle: { color: '#f3f4f6' },
};

/** `2026-11-09` → `9 Nov` */
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** One or two daily series on one axis; two get a legend */
export const dailyLineOption = (days: string[], series: { name: string; data: number[] }[]) => ({
  tooltip,
  legend: series.length > 1 ? { top: 0, right: 0, textStyle: AXIS, icon: 'roundRect' } : undefined,
  grid: { left: 8, right: 16, top: series.length > 1 ? 32 : 12, bottom: 8, containLabel: true },
  xAxis: {
    type: 'category',
    data: days.map(shortDay),
    boundaryGap: false,
    axisLabel: AXIS,
    axisLine: LINE,
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: AXIS,
    splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
  },
  series: series.map((s, i) => ({
    name: s.name,
    type: 'line',
    data: s.data,
    showSymbol: false,
    symbolSize: 8,
    lineStyle: { width: 2, color: SERIES_COLORS[i] },
    itemStyle: { color: SERIES_COLORS[i] },
  })),
});

/** Horizontal bars, biggest on top */
export const rankedBarOption = (rows: { name: string; value: number }[], valueName: string) => ({
  tooltip: { ...tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => `<strong>${p.name}</strong><br/>${p.value} ${valueName}` },
  grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
  xAxis: { type: 'value', minInterval: 1, axisLabel: AXIS, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
  yAxis: {
    type: 'category',
    data: rows.map((r) => r.name).reverse(),
    axisLabel: AXIS,
    axisLine: LINE,
    axisTick: { show: false },
  },
  series: [
    {
      type: 'bar',
      data: rows.map((r) => r.value).reverse(),
      barMaxWidth: 16,
      itemStyle: { color: SERIES_COLORS[0], borderRadius: [0, 4, 4, 0] },
    },
  ],
});
