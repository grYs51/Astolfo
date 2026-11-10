import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AdminServer, AdminServers } from '@nx-stolfo/data-access-admin';

type SortKey = 'name' | 'memberCount' | 'voiceHours30d' | 'messages30d' | 'lastActivity' | 'joinedAt';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Server' },
  { key: 'memberCount', label: 'Members', numeric: true },
  { key: 'voiceHours30d', label: 'Voice h (30d)', numeric: true },
  { key: 'messages30d', label: 'Messages (30d)', numeric: true },
  { key: 'lastActivity', label: 'Last activity' },
  { key: 'joinedAt', label: 'Joined' },
];

/** No voice and no messages in the last 30 days */
const isInactive = (server: AdminServer) => server.voiceHours30d === 0 && server.messages30d === 0;

@Component({
  selector: 'feature-admin-servers',
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            @for (column of columns; track column.key) {
              <th
                [class.text-right]="column.numeric"
                [attr.aria-sort]="sortKey() === column.key ? (descending() ? 'descending' : 'ascending') : null"
              >
                <button type="button" class="hover:text-gray-100" (click)="sortBy(column.key)">
                  {{ column.label }}
                  @if (sortKey() === column.key) {
                    <span aria-hidden="true">{{ descending() ? '↓' : '↑' }}</span>
                  }
                </button>
              </th>
            }
            <th>Settings</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (server of sorted(); track server.id) {
            <tr [class.opacity-60]="inactive(server)">
              <td>
                <div class="flex items-center gap-sm">
                  @if (server.icon) {
                    <img [src]="server.icon" alt="" class="h-6 w-6 rounded-full" />
                  }
                  <span class="font-medium text-gray-100">{{ server.name }}</span>
                  @if (inactive(server)) {
                    <span class="badge badge-sm badge-ghost">Inactive</span>
                  }
                </div>
              </td>
              <td class="text-right tabular-nums">{{ server.memberCount | number }}</td>
              <td class="text-right tabular-nums">{{ server.voiceHours30d | number: '1.0-1' }}</td>
              <td class="text-right tabular-nums">{{ server.messages30d | number }}</td>
              <td>{{ server.lastActivity ? (server.lastActivity | date: 'mediumDate') : 'Never' }}</td>
              <td>{{ server.joinedAt ? (server.joinedAt | date: 'mediumDate') : 'Unknown' }}</td>
              <td class="text-xs text-gray-400">{{ settings(server) }}</td>
              <td class="whitespace-nowrap text-right">
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  [disabled]="busy() || !server.digest"
                  [title]="server.digest ? 'Post the latest digest now' : 'No digest channel'"
                  [attr.aria-label]="'Post digest to ' + server.name"
                  (click)="postDigest.emit(server)"
                >
                  Post digest
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  [disabled]="busy()"
                  title="Rebuild the server's XP history with the current rules"
                  [attr.aria-label]="'Recalculate XP for ' + server.name"
                  (click)="recalculateXp.emit(server)"
                >
                  Recalculate XP
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs text-red-400"
                  [disabled]="busy()"
                  [attr.aria-label]="'Leave ' + server.name"
                  (click)="leave.emit(server)"
                >
                  Leave
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="py-lg text-center text-gray-400">The bot is in no server</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <h3 class="mb-xs mt-md text-sm font-semibold text-gray-100">Joins and leaves per week</h3>
    @if (servers().joinsPerWeek.length === 0) {
      <p class="text-sm text-gray-500">None recorded yet</p>
    } @else {
      <ul class="flex flex-wrap gap-sm text-xs">
        @for (week of servers().joinsPerWeek; track week.week) {
          <li class="rounded-md bg-base-200 px-sm py-xs text-gray-300">
            Week of {{ week.week | date: 'd MMM y' : 'UTC' }}:
            <span class="text-gray-100">{{ week.joins }} joined, {{ week.leaves }} left</span>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminServersComponent {
  servers = input.required<AdminServers>();
  /** An action is running: actions are disabled */
  busy = input(false);
  postDigest = output<AdminServer>();
  recalculateXp = output<AdminServer>();
  leave = output<AdminServer>();
  protected readonly columns = COLUMNS;
  protected readonly inactive = isInactive;
  protected sortKey = signal<SortKey>('voiceHours30d');
  protected descending = signal(true);

  protected sorted = computed(() => {
    const key = this.sortKey();
    const direction = this.descending() ? -1 : 1;
    return [...this.servers().servers].sort((a, b) => {
      const x = a[key] ?? '';
      const y = b[key] ?? '';
      return (x < y ? -1 : x > y ? 1 : 0) * direction;
    });
  });

  protected settings(server: AdminServer) {
    const all = [...(server.digest ? ['Digest'] : []), ...server.toggles];
    return all.length ? all.join(', ') : '–';
  }

  protected sortBy(key: SortKey) {
    if (this.sortKey() === key) {
      this.descending.update((d) => !d);
    } else {
      this.sortKey.set(key);
      this.descending.set(key !== 'name');
    }
  }
}
