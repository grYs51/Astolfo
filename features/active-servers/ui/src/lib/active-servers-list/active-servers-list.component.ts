import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import {
  ActiveServerApi,
  ActiveServerStore,
} from '@nx-stolfo/active-servers/data-access';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { ActiveServersCardComponent } from '../active-servers-card/active-servers-card.component';
import { ActiveServersCardSkeletonComponent } from '../active-servers-card-skeleton/active-servers-card-skeleton.component';

@Component({
  selector: 'feature-active-servers-list',
  imports: [ActiveServersCardComponent, ActiveServersCardSkeletonComponent],
  templateUrl: './active-servers-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ActiveServerStore, ActiveServerApi],
})
export class ActiveServersListComponent {
  selectedGuild = output<string>();

  backendUrl = inject(COMMON_BACKEND_API_URL);

  #store = inject(ActiveServerStore);

  guilds = computed(() => this.#store.value());

  isLoading = computed(() => this.#store.isLoading());

  error = computed(() => this.#store.error());
}
