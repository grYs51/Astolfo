import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-navbar',
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  name = input<string>();
  image = input<string>();
  id = input<string>("kebab");
  loginUrl = input.required<string>();
  logoutUrl = input<string>();
}
