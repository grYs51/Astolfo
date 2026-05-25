import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ActivityTypeBreakdown, VoiceActivityType } from '@nx-stolfo/data-access-voice-stats';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { PieChart } from 'echarts/charts';

echarts.use([CanvasRenderer, TooltipComponent, LegendComponent, GridComponent, PieChart]);

@Component({
  selector: 'feature-voice-stats-activity-breakdown',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <div class="activity-breakdown bg-base-300 rounded-2xl p-lg">
      <h3 class="text-xl font-semibold mb-md">Activity Type Breakdown</h3>

      @if (breakdown().length === 0) {
        <div class="text-center text-gray-400 py-xl">
          <p>No activity data available</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          <!-- Pie Chart -->
          <div class="flex items-center justify-center">
            <div echarts [options]="chartOption()" class="w-full h-80"></div>
          </div>

          <!-- Stats List -->
          <div class="space-y-md">
            @for (item of breakdown(); track item.type) {
              <div class="bg-base-200 rounded-xl p-md">
                <div class="flex items-center justify-between mb-sm">
                  <div class="flex items-center gap-sm">
                    <span class="text-2xl">{{ getActivityIcon(item.type) }}</span>
                    <span class="font-semibold">{{ getActivityLabel(item.type) }}</span>
                  </div>
                  <span class="text-sm text-gray-400">{{ item.percentage }}%</span>
                </div>

                <div class="grid grid-cols-2 gap-sm text-sm">
                  <div>
                    <span class="text-gray-400">Duration:</span>
                    <span class="ml-xs font-medium">{{ item.durationHours }}h {{ item.durationMinutes }}m</span>
                  </div>
                  <div>
                    <span class="text-gray-400">Sessions:</span>
                    <span class="ml-xs font-medium">{{ item.sessionCount }}</span>
                  </div>
                </div>
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
        formatter: (params: { value: [number, number, number]; name: string; percent: number; data: { hours: number; minutes: number; sessionCount: number } }) => {
          return `
            <strong>${params.name}</strong><br/>
            Duration: ${params.data.hours}h ${params.data.minutes}m<br/>
            Sessions: ${params.data.sessionCount}<br/>
            Percentage: ${params.percent.toFixed(1)}%
          `;
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: '0',
        textStyle: {
          color: '#9ca3af',
        },
      },
      series: [
        {
          name: 'Activity Type',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#111827',
            borderWidth: 2,
          },
          label: {
            show: true,
            color: '#f3f4f6',
            formatter: '{b}: {d}%',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          data: data.map(item => ({
            name: this.getActivityLabel(item.type),
            value: item.duration,
            hours: item.durationHours,
            minutes: item.durationMinutes,
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
