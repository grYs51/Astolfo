import { ChangeDetectionStrategy, Component, input, linkedSignal, output, signal } from '@angular/core';

/** The maintenance notice (save or clear) and a broadcast to every digest channel. The page confirms and sends. */
@Component({
  selector: 'feature-admin-announcements',
  template: `
    <div class="grid gap-lg md:grid-cols-2">
      <form (submit)="$event.preventDefault(); saveNotice.emit(noticeDraft().trim())">
        <label for="admin-notice" class="text-sm font-semibold text-gray-100">Maintenance notice</label>
        <p class="mb-sm text-xs text-gray-500">One line shown as a banner on every dashboard page, the login page too.</p>
        <input
          id="admin-notice"
          class="input input-bordered input-sm w-full"
          maxlength="300"
          [value]="noticeDraft()"
          (input)="noticeDraft.set($any($event.target).value)"
        />
        <div class="mt-sm flex gap-sm">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !noticeDraft().trim()">Save</button>
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="busy() || !notice()" (click)="saveNotice.emit(null)">
            Clear
          </button>
        </div>
      </form>

      <form (submit)="$event.preventDefault(); broadcast.emit(broadcastDraft().trim())">
        <label for="admin-broadcast" class="text-sm font-semibold text-gray-100">Broadcast</label>
        <p class="mb-sm text-xs text-gray-500">
          Posted to the digest channel of the {{ digestServers() }} servers that turned the digest on. Mentions don't ping.
        </p>
        <textarea
          id="admin-broadcast"
          class="textarea textarea-bordered w-full"
          rows="3"
          maxlength="1000"
          [value]="broadcastDraft()"
          (input)="broadcastDraft.set($any($event.target).value)"
        ></textarea>
        <div class="mt-sm flex items-center justify-between gap-sm">
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            [disabled]="busy() || !broadcastDraft().trim() || digestServers() === 0"
          >
            Post
          </button>
          <span class="text-xs tabular-nums text-gray-500">{{ broadcastDraft().length }} / 1000</span>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAnnouncementsComponent {
  notice = input.required<string | null>();
  digestServers = input.required<number>();
  busy = input(false);
  /** null clears the notice */
  saveNotice = output<string | null>();
  broadcast = output<string>();

  protected noticeDraft = linkedSignal(() => this.notice() ?? '');
  protected broadcastDraft = signal('');
}
