import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ActivityTypeBreakdown, VoiceActivityType } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { PieChart } from 'echarts/charts';

echarts.use([CanvasRenderer, TooltipComponent, LegendComponent, GridComponent, PieChart]);

@Component({
  selector: 'feature-voice-stats-activity-breakdown',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, HumanizeDurationPipe],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="activity-breakdown rounded-xl bg-base-300 border border-white/5 p-lg">
      <h3 class="text-base font-semibold text-gray-100 mb-md">Activity type breakdown</h3>

      @if (breakdown().length === 0) {
        <div class="text-center text-gray-500 py-xl">
          <p>No activity data available</p>
        </div>
      } @else {
        <div class="flex flex-col gap-sm">
          <!-- Donut -->
          <div echarts [options]="chartOption()" class="w-full h-48"></div>

          <!-- Stats list -->
          <div class="divide-y divide-white/5">
            @for (item of breakdown(); track item.type) {
              <div class="flex items-center gap-sm py-sm">
                <span
                  class="h-3 w-3 shrink-0 rounded-sm"
                  [style.background-color]="getActivityColor(item.type)"
                ></span>
                <span class="flex-1 truncate text-sm font-medium text-gray-200">
                  {{ getActivityLabel(item.type) }}
                </span>
                <span class="text-right text-sm font-semibold text-gray-100">
                  {{ item.duration | humanizeDuration: true }}
                </span>
                <span class="w-10 text-right text-xs text-gray-400">{{ item.percentage }}%</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class VoiceStatsActivityBreakdownComponent {
  breakdown = input.required<ActivityTypeBreakdown[]>();

  private readonly durationPipe = new HumanizeDurationPipe();

  chartOption = computed(() => {
    const data = this.breakdown();

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: {
          color: '#f3f4f6',
        },
        formatter: (params: { value: number; name: string; percent: number; data: { sessionCount: number } }) => {
          return `
            <strong>${params.name}</strong><br/>
            Duration: ${this.durationPipe.transform(params.value, true)}<br/>
            Sessions: ${params.data.sessionCount}<br/>
            Percentage: ${params.percent.toFixed(1)}%
          `;
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: '0',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: {
          color: '#9ca3af',
        },
      },
      series: [
        {
          name: 'Activity Type',
          type: 'pie',
          radius: ['55%', '80%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#141824',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            scaleSize: 4,
          },
          data: data.map(item => ({
            name: this.getActivityLabel(item.type),
            value: item.duration,
            sessionCount: item.sessionCount,
            itemStyle: {
              color: this.getActivityColor(item.type),
            },
          })),
        },
      ],
    };
  });

  getActivityIcon(type: VoiceActivityType | string): string {
    const iconMap: Record<string, string> = {
      [VoiceActivityType.VOICE]: '🎤',
      [VoiceActivityType.DEAF]: '🔇',
      [VoiceActivityType.SERVER_DEAF]: '🔕',
      [VoiceActivityType.MUTED]: '🔈',
      [VoiceActivityType.SERVER_MUTED]: '🔇',
      [VoiceActivityType.STREAMING]: '📺',
      [VoiceActivityType.VIDEO]: '📹',
    };
    return iconMap[type] || '🎙️';
  }

  getActivityLabel(type: VoiceActivityType | string): string {
    const labelMap: Record<string, string> = {
      [VoiceActivityType.VOICE]: 'Voice',
      [VoiceActivityType.DEAF]: 'Deafened',
      [VoiceActivityType.SERVER_DEAF]: 'Server Deafened',
      [VoiceActivityType.MUTED]: 'Muted',
      [VoiceActivityType.SERVER_MUTED]: 'Server Muted',
      [VoiceActivityType.STREAMING]: 'Streaming',
      [VoiceActivityType.VIDEO]: 'Video',
    };
    return labelMap[type] || type;
  }

  getActivityColor(type: VoiceActivityType | string): string {
    const colorMap: Record<string, string> = {
      [VoiceActivityType.VOICE]: '#3b82f6', // blue
      [VoiceActivityType.DEAF]: '#6b7280', // gray
      [VoiceActivityType.SERVER_DEAF]: '#4b5563', // dark gray
      [VoiceActivityType.MUTED]: '#f59e0b', // amber
      [VoiceActivityType.SERVER_MUTED]: '#d97706', // dark amber
      [VoiceActivityType.STREAMING]: '#8b5cf6', // purple
      [VoiceActivityType.VIDEO]: '#ec4899', // pink
    };
    return colorMap[type] || '#6366f1';
  }
}
