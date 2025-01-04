import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProfileStore } from '@nx-stolfo/auth';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';

@Component({
  imports: [RouterModule, JsonPipe, DatePipe, DiscordImagePipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'web';

  store = inject(ProfileStore, { optional: true });

  url = '';
}
