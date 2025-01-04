import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProfileStore } from '@nx-stolfo/auth';

@Component({
  imports: [RouterModule, JsonPipe, DatePipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'web';

  store = inject(ProfileStore, { optional: true });

  url = '';
}
