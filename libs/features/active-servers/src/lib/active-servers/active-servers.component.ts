import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { ActiveServerStore } from '../data-access/active-server.store';
import { ActiveServerApi } from '../data-access/active-server.api';

@Component({
  selector: 'feature-active-servers',
  imports: [],
  templateUrl: './active-servers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ActiveServerStore, ActiveServerApi],
})
export class ActiveServersComponent {
  backendUrl = inject(COMMON_BACKEND_API_URL);

  #store = inject(ActiveServerStore);

  guilds = computed(() => this.#store.value());

  isLoading = computed(() => this.#store.isLoading());

  error = computed(() => this.#store.error());
}
