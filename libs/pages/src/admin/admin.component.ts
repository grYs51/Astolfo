import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { AdminApi } from '@nx-stolfo/data-access-admin';
import {
  AdminHealthComponent,
  AdminPeopleComponent,
  AdminSectionComponent,
  AdminServersComponent,
  AdminUsageComponent,
  AdminWebComponent,
} from '@nx-stolfo/ui-admin';
import { SkeletonLoaderComponent } from '@nx-stolfo/components';

const HEALTH_REFRESH_MS = 30_000;

/** Owner-only overview of the bot. OwnerGuard hides it; the API (isOwner) is the lock. */
@Component({
  selector: 'pages-admin',
  imports: [
    AdminSectionComponent,
    AdminHealthComponent,
    AdminServersComponent,
    AdminUsageComponent,
    AdminPeopleComponent,
    AdminWebComponent,
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

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const timer = setInterval(() => this.health.reload(), HEALTH_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
