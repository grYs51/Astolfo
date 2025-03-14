import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment.development';
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor() {
    console.log(environment.production);
  }
}
