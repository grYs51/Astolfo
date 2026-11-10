import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { NoticeState } from '@nx-stolfo/common/api';
import { AdminApi, AdminServer, XpRules, XpRulesError } from '@nx-stolfo/data-access-admin';
import {
  AdminAnnouncementsComponent,
  AdminHealthComponent,
  AdminPeopleComponent,
  AdminSectionComponent,
  AdminServersComponent,
  AdminUsageComponent,
  AdminWebComponent,
  AdminXpRulesComponent,
} from '@nx-stolfo/ui-admin';
import { SkeletonLoaderComponent } from '@nx-stolfo/components';

const HEALTH_REFRESH_MS = 30_000;

/** Owner-only overview of the bot. OwnerGuard hides it; the API (isOwner) is the lock. */
@Component({
  selector: 'pages-admin',
  imports: [
    AdminAnnouncementsComponent,
    AdminSectionComponent,
    AdminHealthComponent,
    AdminServersComponent,
    AdminUsageComponent,
    AdminPeopleComponent,
    AdminWebComponent,
    AdminXpRulesComponent,
    SkeletonLoaderComponent,
  ],
  providers: [AdminApi],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private readonly api = inject(AdminApi);

  readonly health = this.api.fetchHealth();
  readonly servers = this.api.fetchServers();
  readonly usage = this.api.fetchUsage();
  readonly people = this.api.fetchPeople();
  readonly web = this.api.fetchWeb();
  readonly xpRules = this.api.fetchXpRules();
  /** The last XP rules save: its 400, or that it went through */
  readonly xpRulesError = signal<XpRulesError | null>(null);
  readonly xpRulesSaved = signal(false);
  // Shared with the banner, so a save or clear shows there at once
  readonly notice = inject(NoticeState).notice;

  /** Servers a broadcast reaches: those with a digest channel */
  readonly digestServers = computed(() => this.servers.value()?.servers.filter((s) => s.digest).length ?? 0);
  readonly busy = signal(false);
  readonly result = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const timer = setInterval(() => this.health.reload(), HEALTH_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  postDigest(server: AdminServer) {
    this.run(this.api.postDigest(server.id), () => `Posted the digest to ${server.name}`);
  }

  leave(server: AdminServer) {
    if (!confirm(`Leave ${server.name}? The bot stops tracking it and has to be invited again to come back.`)) return;
    this.run(this.api.leave(server.id), () => {
      // Not reload(): the bot drops the server from its cache only when Discord's GUILD_DELETE arrives
      this.servers.update((v) => v && { ...v, servers: v.servers.filter((s) => s.id !== server.id) });
      return `Left ${server.name}`;
    });
  }

  closeStuckSessions() {
    this.run(this.api.closeStuckSessions(), ({ closed }) => {
      this.health.reload();
      return `Closed ${closed} stuck voice session${closed === 1 ? '' : 's'}`;
    });
  }

  recalculateXp(server: AdminServer) {
    if (
      !confirm(
        `Recalculate XP for ${server.name}? Its XP history is rebuilt with the current rules, so levels can go down. Nothing is posted.`
      )
    )
      return;
    this.run(this.api.recalculateXp(server.id), () => `Recalculating XP for ${server.name} in the background. The bot log has the result.`);
  }

  saveXpRules(rules: XpRules | null) {
    this.xpRulesError.set(null);
    this.xpRulesSaved.set(false);
    this.run(
      this.api.setXpRules(rules),
      (saved) => {
        this.xpRules.set(saved);
        this.xpRulesSaved.set(true);
        return rules ? 'XP rules saved' : 'XP rules back to the defaults';
      },
      (error) => this.xpRulesError.set(error)
    );
  }

  saveNotice(text: string | null) {
    this.run(this.api.setNotice(text), (notice) => {
      this.notice.set(notice);
      return notice.text ? 'Notice saved' : 'Notice cleared';
    });
  }

  broadcast(text: string) {
    if (!confirm(`Post to ${this.digestServers()} servers?

${text}`)) return;
    this.run(this.api.broadcast(text), ({ queued }) =>
      `Posting to ${queued} server${queued === 1 ? '' : 's'} in the background. The bot log has the result.`
    );
  }

  /** One action at a time; the result (or the API's error) shows in the status toast */
  private run<T>(request: Observable<T>, done: (value: T) => string, failed?: (error: XpRulesError) => void) {
    this.busy.set(true);
    this.result.set(null);
    request.subscribe({
      next: (value) => {
        this.result.set({ ok: true, text: done(value) });
        this.busy.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (error.error?.error) failed?.(error.error);
        this.result.set({ ok: false, text: error.error?.error ?? "That didn't work. Try again." });
        this.busy.set(false);
      },
    });
  }
}
