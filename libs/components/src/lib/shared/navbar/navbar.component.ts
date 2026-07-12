import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faConciergeBell } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'lib-navbar',
  templateUrl: './navbar.component.html',
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  loading = input<boolean>();
  name = input<string>();
  image = input<string>();
  loginUrl = input.required<string>();
  logoutUrl = input<string>();

  faConciergeBell = faConciergeBell;

}
