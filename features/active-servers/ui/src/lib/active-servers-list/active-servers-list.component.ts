import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { guilds } from '@nx-stolfo/active-servers/data-access';
import { ActiveServersCardComponent } from '../active-servers-card/active-servers-card.component';
import { ActiveServersCardSkeletonComponent } from '../active-servers-card-skeleton/active-servers-card-skeleton.component';

/**
 * Presentational: the page owns the data (ActiveServerStore) and routing.
 * Each card is a real link, so it's keyboard-focusable, announced as a link
 * and can be opened in a new tab.
 */
@Component({
  selector: 'feature-active-servers-list',
  imports: [ActiveServersCardComponent, ActiveServersCardSkeletonComponent, RouterLink],
  templateUrl: './active-servers-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveServersListComponent {
  guilds = input<guilds | undefined>();
  loading = input(false);
  error = input<unknown>(null);
  /** Router commands for a server's detail page, e.g. `id => ['/overview/detail', id]` */
  linkFor = input.required<(guildId: string) => unknown[]>();
}
