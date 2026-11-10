import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { DiscordMember, VoiceSessionXp } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, MarkAreaComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { AVATAR, sessionChartOption } from './xp-session-chart';
echarts.use([CanvasRenderer, GridComponent, TooltipComponent, MarkPointComponent, MarkAreaComponent, LineChart]);

/** Sharp on high-DPI screens */
const SIZE = AVATAR * 3;

/**
 * A member's avatar cut into a circle, as a data URL: ECharts draws image markers square. Without an
 * avatar, or when it can't be loaded (no CORS), their initial on a grey circle.
 */
const roundAvatar = (member: DiscordMember) =>
  new Promise<string>((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const initial = () => {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#f3f4f6';
      ctx.font = `bold ${SIZE / 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((member.displayName || member.username).charAt(0).toUpperCase(), SIZE / 2, SIZE / 2 + 1);
      resolve(canvas.toDataURL());
    };
    if (!member.avatar) return initial();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      try {
        resolve(canvas.toDataURL());
      } catch {
        initial();
      }
    };
    img.onerror = initial;
    img.src = member.avatar;
  });

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

  /** Round avatars by member id, once loaded */
  private avatars = signal<Record<string, string>>({});

  constructor() {
    // Only made after a click, so always in the browser
    effect(() => {
      const people = Object.entries(this.xp().people);
      void Promise.all(people.map(async ([id, member]) => [id, await roundAvatar(member)] as const)).then((loaded) =>
        this.avatars.set(Object.fromEntries(loaded))
      );
    });
  }

  protected option = computed(() => sessionChartOption(this.xp().segments, this.xp().people, this.avatars()));
  // The chart is a picture; this says what it shows
  protected label = computed(() => {
    const top = Math.max(...this.xp().segments.map((s) => s.multiplier));
    return `XP multiplier over the session, up to ${top}×, for ${this.xp().amount} XP`;
  });
}
