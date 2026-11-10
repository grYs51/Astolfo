import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { VoiceSessionXp } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, MarkAreaComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { sessionChartOption } from './xp-session-chart';
echarts.use([CanvasRenderer, GridComponent, TooltipComponent, MarkPointComponent, MarkAreaComponent, LineChart]);

/** A voice session's XP multiplier over time: who joined and left, deafened stretches shaded */
@Component({
  selector: 'feature-voice-stats-xp-session-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `<div echarts [options]="option()" class="h-48" role="img" [attr.aria-label]="label()"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class XpSessionChartComponent {
  xp = input.required<VoiceSessionXp>();

  protected option = computed(() => sessionChartOption(this.xp().segments, this.xp().people));
  // The chart is a picture; this says what it shows
  protected label = computed(() => {
    const top = Math.max(...this.xp().segments.map((s) => s.multiplier));
    return `XP multiplier over the session, up to ${top}×, for ${this.xp().amount} XP`;
  });
}
