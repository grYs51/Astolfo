import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { XpHistory } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { historyChartOption } from './xp-history-chart';
echarts.use([CanvasRenderer, GridComponent, LegendComponent, TooltipComponent, MarkLineComponent, LineChart]);

/** A member's running XP total over the period, with the levels they reached in it, and optionally another member's */
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
  /** The legend and hover names: the member, then the compared one */
  names = input<[string, string]>(['You', 'Them']);

  protected option = computed(() => historyChartOption(this.history(), this.names()));
  // The chart is a picture; this says what it shows
  protected label = computed(() => {
    const history = this.history();
    const xp = (n: number) => n.toLocaleString('en-GB');
    const levels = history.levels.map((l) => `level ${l.level}`).join(', ');
    const { compare } = history;
    if (!compare) return `XP over the period, from ${xp(history.startXp)} to ${xp(history.endXp)}${levels ? `, reaching ${levels}` : ''}`;
    const [mine, theirs] = this.names();
    return `XP over the period: ${mine} from ${xp(history.startXp)} to ${xp(history.endXp)}, ${theirs} from ${xp(compare.startXp)} to ${xp(compare.endXp)}${levels ? `, with lines at ${levels}` : ''}`;
  });
}
