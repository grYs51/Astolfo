import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ComponentsComponent } from '@nx-stolfo/components';

@Component({
  imports: [RouterModule, ComponentsComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'web';
}
