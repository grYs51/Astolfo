import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuildSettings, GuildSettingsApi } from '@nx-stolfo/data-access-guild-settings';
import { GuildSettingsFormComponent } from '@nx-stolfo/ui-guild-settings';

/** Server settings (/overview/detail/:id/settings), for members with Manage Server. */
@Component({
  selector: 'pages-guild-settings',
  imports: [GuildSettingsFormComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GuildSettingsApi],
  template: `
    <div class="mx-auto max-w-3xl px-md lg:px-lg py-md space-y-lg">
      <header class="space-y-sm">
        <a
          [routerLink]="['/overview/detail', id()]"
          class="inline-flex items-center gap-xs text-sm text-gray-400 hover:text-gray-200"
        >
          <span aria-hidden="true">←</span> Back to the stats
        </a>
        <div>
          <p class="text-xs font-medium uppercase tracking-widest text-gray-500">Server</p>
          <h1 class="text-2xl font-bold tracking-tight text-gray-100">Settings</h1>
        </div>
      </header>

      @if (settingsResource.hasValue()) {
        <feature-guild-settings-form
          [settings]="settingsResource.value()"
          [saving]="saving()"
          [error]="error()"
          [saved]="saved()"
          (save)="save($event)"
        />
      } @else if (settingsResource.error()) {
        <div class="rounded-xl border border-error/30 bg-error/10 p-md text-sm text-error">
          @if (forbidden()) {
            Only members with Manage Server can change this server’s settings.
          } @else {
            Couldn’t load the settings. Try again later.
          }
        </div>
      } @else {
        <div class="h-96 animate-pulse rounded-xl bg-base-300"></div>
      }
    </div>
  `,
})
export class GuildSettingsComponent {
  /** Server id (route param) */
  id = input.required<string>();

  private api = inject(GuildSettingsApi);

  settingsResource = this.api.fetchSettings(() => this.id());
  forbidden = computed(
    () => (this.settingsResource.error() as HttpErrorResponse | undefined)?.status === 403
  );

  saving = signal(false);
  error = signal<string | null>(null);
  saved = signal(false);

  save(settings: GuildSettings) {
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    this.api.saveSettings(this.id(), settings).subscribe({
      next: (result) => {
        this.settingsResource.set(result);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (e: HttpErrorResponse) => {
        // A 400 carries the reason (bad prefix, channel the bot can't post in…)
        this.error.set(
          (e.status === 400 && e.error?.error) || 'Couldn’t save the settings. Try again.'
        );
        this.saving.set(false);
      },
    });
  }
}
