import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import {
  ActiveServerStore,
  ActiveServerApi,
} from '@nx-stolfo/active-servers/data-access';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

@Component({
  selector: 'feature-active-servers-list',
  imports: [HumanizeDurationPipe],
  templateUrl: './active-servers-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ActiveServerStore, ActiveServerApi],
})
export class ActiveServersListComponent {
  backendUrl = inject(COMMON_BACKEND_API_URL);

  #store = inject(ActiveServerStore);

  guilds = computed(() => this.#store.value());

  isLoading = computed(() => this.#store.isLoading());

  error = computed(() => this.#store.error());
}
