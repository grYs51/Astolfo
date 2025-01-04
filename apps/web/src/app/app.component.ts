import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IS_LOGGED_IN, ProfileStore } from '@nx-stolfo/auth';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';

@Component({
  imports: [RouterModule, DiscordImagePipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  store = inject(ProfileStore, { optional: true });

  isLoggedIn = inject(IS_LOGGED_IN);
}
