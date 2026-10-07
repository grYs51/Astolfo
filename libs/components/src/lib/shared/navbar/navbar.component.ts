import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'lib-navbar',
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  loading = input<boolean>();
  name = input<string>();
  image = input<string>();
  loginUrl = input.required<string>();
  logoutUrl = input<string>();

}
