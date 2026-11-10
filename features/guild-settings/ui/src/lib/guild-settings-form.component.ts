import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { GuildSettings } from '@nx-stolfo/data-access-guild-settings';

/** guild_configs messages are VarChar(200); the API enforces the same limit */
const MAX_MESSAGE = 200;

const value = (event: Event) => (event.target as HTMLInputElement).value;

/**
 * The server settings form. Edits a local copy and emits the whole object on
 * save; a new `settings` input (the saved result) resets the copy.
 */
@Component({
  selector: 'feature-guild-settings-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = draft();
    <form class="space-y-md" (submit)="$event.preventDefault(); save.emit(s)">
      <section class="rounded-xl border border-white/5 bg-base-300 p-lg space-y-md">
        <h2 class="text-base font-semibold text-gray-100">Chat commands</h2>
        <div class="max-w-xs">
          <label for="gs-prefix" class="block text-sm font-medium text-gray-300">Prefix</label>
          <input
            id="gs-prefix"
            class="input input-bordered mt-xs w-full bg-base-200 font-mono"
            autocomplete="off"
            spellcheck="false"
            aria-describedby="gs-prefix-help"
            [value]="s.prefix"
            (input)="set('prefix', value($event))"
          />
          <p id="gs-prefix-help" class="mt-xs text-xs text-gray-500">
            1 to 5 characters, no spaces. Commands then look like
            <code class="font-mono text-gray-300">{{ s.prefix || ',' }}help</code>.
          </p>
        </div>
      </section>

      <section class="rounded-xl border border-white/5 bg-base-300 p-lg space-y-md">
        <div>
          <h2 class="text-base font-semibold text-gray-100">Welcome and goodbye</h2>
          <p class="mt-xs text-sm text-gray-400">
            Both are posted in the welcome channel. Write
            <code class="font-mono text-gray-300">&#64;member</code> where the member goes.
          </p>
        </div>
        <div class="max-w-sm">
          <label for="gs-welcome-channel" class="block text-sm font-medium text-gray-300">
            Welcome channel
          </label>
          <select
            id="gs-welcome-channel"
            class="select select-bordered mt-xs w-full bg-base-200"
            (change)="set('welcomeChannelId', value($event) || null)"
          >
            <option value="" [selected]="!s.welcomeChannelId">None (no posts)</option>
            @for (c of welcomeOptions(); track c.id) {
              <option [value]="c.id" [selected]="c.id === s.welcomeChannelId">#{{ c.name }}</option>
            }
          </select>
          @if (!canEditMessages()) {
            <p class="mt-xs text-xs text-warning">
              You can’t post in this channel, so you can’t change its messages. Pick another channel
              to edit them.
            </p>
          }
        </div>
        <div>
          <label for="gs-welcome" class="block text-sm font-medium text-gray-300">Welcome message</label>
          <textarea
            id="gs-welcome"
            rows="2"
            class="textarea textarea-bordered mt-xs w-full bg-base-200"
            placeholder="Welcome @member"
            aria-describedby="gs-welcome-count"
            [disabled]="!canEditMessages()"
            [attr.maxlength]="maxMessage"
            [value]="s.welcomeMessage"
            (input)="set('welcomeMessage', value($event))"
          ></textarea>
          <p id="gs-welcome-count" class="mt-xs text-xs text-gray-500">
            {{ s.welcomeMessage.length }}/{{ maxMessage }}. Empty sends “Welcome &#64;member”.
          </p>
        </div>
        <div>
          <label for="gs-goodbye" class="block text-sm font-medium text-gray-300">Goodbye message</label>
          <textarea
            id="gs-goodbye"
            rows="2"
            class="textarea textarea-bordered mt-xs w-full bg-base-200"
            placeholder="Goodbye @member"
            aria-describedby="gs-goodbye-count"
            [disabled]="!canEditMessages()"
            [attr.maxlength]="maxMessage"
            [value]="s.goodbyeMessage"
            (input)="set('goodbyeMessage', value($event))"
          ></textarea>
          <p id="gs-goodbye-count" class="mt-xs text-xs text-gray-500">
            {{ s.goodbyeMessage.length }}/{{ maxMessage }}. Empty means no goodbye post.
          </p>
        </div>
      </section>

      @if (s.toggles.length) {
        <section class="rounded-xl border border-white/5 bg-base-300 p-lg space-y-md">
          <h2 class="text-base font-semibold text-gray-100">Features</h2>
          @for (t of s.toggles; track t.key) {
            <div class="flex items-center justify-between gap-md">
              <span [id]="'gs-toggle-' + t.key" class="text-sm text-gray-300">{{ t.label }}</span>
              <button
                type="button"
                role="switch"
                [attr.aria-labelledby]="'gs-toggle-' + t.key"
                [attr.aria-checked]="t.enabled"
                (click)="setToggle(t.key, !t.enabled)"
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
                [class.bg-primary-500]="t.enabled"
                [class.bg-base-100]="!t.enabled"
              >
                <span
                  class="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                  [class.translate-x-5]="t.enabled"
                  [class.translate-x-0.5]="!t.enabled"
                ></span>
              </button>
            </div>
          }
        </section>
      }

      <section class="rounded-xl border border-white/5 bg-base-300 p-lg space-y-md">
        <div>
          <h2 class="text-base font-semibold text-gray-100">Weekly recap</h2>
          <p class="mt-xs text-sm text-gray-400">
            A summary of last week, posted every Monday at 08:00 UTC.
          </p>
        </div>
        <div class="max-w-sm">
          <label for="gs-digest-channel" class="block text-sm font-medium text-gray-300">Channel</label>
          <select
            id="gs-digest-channel"
            class="select select-bordered mt-xs w-full bg-base-200"
            (change)="set('digestChannelId', value($event) || null)"
          >
            <option value="" [selected]="!s.digestChannelId">Off</option>
            @for (c of digestOptions(); track c.id) {
              <option [value]="c.id" [selected]="c.id === s.digestChannelId">#{{ c.name }}</option>
            }
          </select>
        </div>
      </section>

      <section class="rounded-xl border border-white/5 bg-base-300 p-lg space-y-md">
        <div>
          <h2 class="text-base font-semibold text-gray-100">Levels</h2>
          <p class="mt-xs text-sm text-gray-400">
            Members earn XP from voice, messages, streaks and game wins. Pick a channel to announce
            level-ups.
          </p>
        </div>
        <div class="max-w-sm">
          <label for="gs-level-up-channel" class="block text-sm font-medium text-gray-300">Level-up channel</label>
          <select
            id="gs-level-up-channel"
            class="select select-bordered mt-xs w-full bg-base-200"
            (change)="set('levelUpChannelId', value($event) || null)"
          >
            <option value="" [selected]="!s.levelUpChannelId">Off</option>
            @for (c of levelUpOptions(); track c.id) {
              <option [value]="c.id" [selected]="c.id === s.levelUpChannelId">#{{ c.name }}</option>
            }
          </select>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-md">
        <button type="submit" class="btn btn-primary" [disabled]="!dirty() || saving()">
          @if (saving()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          Save
        </button>
        <p role="status" aria-live="polite" class="text-sm">
          @if (error()) {
            <span class="text-error">{{ error() }}</span>
          } @else if (saved() && !dirty()) {
            <span class="text-success">Saved. The bot uses the new settings right away.</span>
          }
        </p>
      </div>
    </form>
  `,
})
export class GuildSettingsFormComponent {
  settings = input.required<GuildSettings>();
  saving = input(false);
  error = input<string | null>(null);
  /** The last save went through */
  saved = input(false);
  save = output<GuildSettings>();

  protected readonly maxMessage = MAX_MESSAGE;
  protected readonly value = value;

  protected draft = linkedSignal(() => this.settings());
  // A stored channel that's no longer offered only shows in the picker that stores it
  protected welcomeOptions = computed(() =>
    this.settings().channels.filter((c) => c.postable || c.id === this.settings().welcomeChannelId)
  );
  protected digestOptions = computed(() =>
    this.settings().channels.filter((c) => c.postable || c.id === this.settings().digestChannelId)
  );
  protected levelUpOptions = computed(() =>
    this.settings().channels.filter((c) => c.postable || c.id === this.settings().levelUpChannelId)
  );

  /** The bot posts the messages in the welcome channel; the API refuses edits for one the viewer can't post in */
  protected canEditMessages = computed(() => {
    const id = this.draft().welcomeChannelId;
    return !id || this.draft().channels.some((c) => c.id === id && c.postable);
  });

  /** Any edit replaces the draft object, so identity says whether it changed */
  protected dirty = computed(() => this.draft() !== this.settings());

  protected set<K extends keyof GuildSettings>(key: K, v: GuildSettings[K]) {
    this.draft.update((d) => ({ ...d, [key]: v }));
  }

  protected setToggle(key: string, enabled: boolean) {
    this.draft.update((d) => ({
      ...d,
      toggles: d.toggles.map((t) => (t.key === key ? { ...t, enabled } : t)),
    }));
  }
}
