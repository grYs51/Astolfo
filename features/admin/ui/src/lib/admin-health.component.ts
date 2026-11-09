import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminHealth } from '@nx-stolfo/data-access-admin';
import { StatCardComponent } from '@nx-stolfo/components';

const MB = 1024 * 1024;

const uptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

@Component({
  selector: 'feature-admin-health',
  imports: [StatCardComponent, DecimalPipe],
  template: `
    @let h = health();
    <div class="grid grid-cols-2 gap-sm md:grid-cols-4">
      <lib-stat-card [dense]="true" label="Uptime" [value]="uptime()" [subtitle]="'Commit ' + h.commit" />
      <lib-stat-card
        [dense]="true"
        label="Gateway"
        [value]="h.gateway.status"
        [subtitle]="h.gateway.pingMs === null ? 'No heartbeat yet' : h.gateway.pingMs + ' ms ping'"
      />
      <lib-stat-card [dense]="true" label="Memory (RSS)" [value]="(h.memoryRssBytes / MB | number: '1.0-0') + ' MB'" />
      <lib-stat-card
        [dense]="true"
        label="Event loop lag (p99)"
        [value]="h.eventLoopLagSeconds === null ? '–' : (h.eventLoopLagSeconds * 1000 | number: '1.0-1') + ' ms'"
      />
      <lib-stat-card [dense]="true" label="In voice now" [value]="h.openVoiceSessions" subtitle="Open voice sessions" />
      <lib-stat-card [dense]="true" label="Current statuses" [value]="h.currentStatuses" />
      <lib-stat-card
        [dense]="true"
        label="Recovered at startup"
        [value]="h.danglingAtStartup.voiceSessions + h.danglingAtStartup.statuses"
        [subtitle]="h.danglingAtStartup.voiceSessions + ' voice sessions, ' + h.danglingAtStartup.statuses + ' statuses'"
      />
      <lib-stat-card [dense]="true" label="Database" [value]="(h.database.sizeBytes / MB | number: '1.0-1') + ' MB'" />
    </div>

    <details class="mt-md text-sm">
      <summary class="cursor-pointer text-gray-400 hover:text-gray-200">Rows per table (estimated)</summary>
      <table class="table table-xs mt-sm max-w-md">
        <tbody>
          @for (table of h.database.tables; track table.name) {
            <tr>
              <td class="text-gray-300">{{ table.name }}</td>
              <td class="text-right tabular-nums text-gray-100">{{ table.rows | number }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHealthComponent {
  health = input.required<AdminHealth>();
  protected readonly MB = MB;
  protected uptime = computed(() => uptime(this.health().uptimeSeconds));
}
