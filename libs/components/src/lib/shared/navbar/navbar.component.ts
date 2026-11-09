import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'lib-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  loading = input<boolean>();
  name = input<string>();
  image = input<string>();
  loginUrl = input.required<string>();
  logoutUrl = input<string>();
  /** Shows the Admin link (the bot owner only) */
  isOwner = input<boolean>(false);

}
