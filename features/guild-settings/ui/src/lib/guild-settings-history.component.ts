import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  GuildSettings,
  SettingChange,
  SettingsHistoryEntry,
} from '@nx-stolfo/data-access-guild-settings';

const LABELS: Record<string, string> = {
  prefix: 'Prefix',
  welcomeChannelId: 'Welcome channel',
  welcomeMessage: 'Welcome message',
  goodbyeMessage: 'Goodbye message',
  digestChannelId: 'Weekly recap channel',
};

/** The audit log: who changed which settings on this page, newest first */
@Component({
  selector: 'feature-guild-settings-history',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-labelledby="gs-history-title"
      class="rounded-xl border border-white/5 bg-base-300 p-lg space-y-md"
    >
      <div>
        <h2 id="gs-history-title" class="text-base font-semibold text-gray-100">Recent changes</h2>
        <p class="mt-xs text-sm text-gray-400">
          Saves on this page, newest first. Changes made with chat commands aren’t listed.
        </p>
      </div>

      @if (entries().length) {
        <ol class="divide-y divide-white/5">
          @for (entry of entries(); track entry.at) {
            <li class="flex gap-md py-sm first:pt-0 last:pb-0">
              @if (entry.member.avatar) {
                <img [src]="entry.member.avatar" alt="" class="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
              } @else {
                <span class="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-base-100" aria-hidden="true"></span>
              }
              <div class="min-w-0 flex-1">
                <p class="text-sm text-gray-300">
                  <span class="font-medium text-gray-100">
                    {{ entry.member.displayName || entry.member.username }}
                  </span>
                  <time class="ml-xs text-xs text-gray-500" [attr.datetime]="entry.at">
                    {{ entry.at | date: 'd MMM y, HH:mm' }}
                  </time>
                </p>
                <ul class="mt-xs space-y-0.5 text-sm text-gray-400">
                  @for (change of entry.changes; track change.field) {
                    <li class="break-words">
                      {{ label(change.field) }}:
                      <span class="text-gray-500">{{ show(change, change.from) }}</span>
                      <span aria-hidden="true"> → </span><span class="sr-only"> changed to </span>
                      <span class="text-gray-200">{{ show(change, change.to) }}</span>
                    </li>
                  }
                </ul>
              </div>
            </li>
          }
        </ol>
      } @else {
        <p class="text-sm text-gray-500">No changes yet.</p>
      }
    </section>
  `,
})
export class GuildSettingsHistoryComponent {
  entries = input.required<SettingsHistoryEntry[]>();
  /** For channel names and toggle labels */
  settings = input.required<GuildSettings>();

  private channelNames = computed(
    () => new Map(this.settings().channels.filter((c) => c.postable).map((c) => [c.id, c.name]))
  );
  private toggleLabels = computed(
    () => new Map(this.settings().toggles.map((t) => [`toggle:${t.key}`, t.label]))
  );

  protected label(field: string) {
    return LABELS[field] ?? this.toggleLabels().get(field) ?? field;
  }

  protected show(change: SettingChange, value: SettingChange['from']) {
    if (typeof value === 'boolean') return value ? 'on' : 'off';
    if (change.field.endsWith('ChannelId')) {
      if (value === null) return 'none';
      // Only channels the viewer can see get a name
      const name = this.channelNames().get(value);
      return name ? `#${name}` : 'a channel';
    }
    return value ? `“${value}”` : 'empty';
  }
}
