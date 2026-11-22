import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { XpHistory } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { historyChartOption } from './xp-history-chart';
echarts.use([CanvasRenderer, GridComponent, TooltipComponent, MarkLineComponent, LineChart]);

/** A member's running XP total over the period, with the levels they reached in it */
@Component({
  selector: 'feature-voice-stats-xp-history-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `<div echarts [options]="option()" class="h-56" role="img" [attr.aria-label]="label()"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class XpHistoryChartComponent {
  history = input.required<XpHistory>();

  protected option = computed(() => historyChartOption(this.history()));
  // The chart is a picture; this says what it shows
  protected label = computed(() => {
    const { startXp, points, levels } = this.history();
    const end = points[points.length - 1]?.total ?? startXp;
    const reached = levels.length ? `, reaching ${levels.map((l) => `level ${l.level}`).join(', ')}` : '';
    return `XP over the period, from ${startXp.toLocaleString('en-GB')} to ${end.toLocaleString('en-GB')}${reached}`;
  });
}
