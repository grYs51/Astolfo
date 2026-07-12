import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadCrumb {
  path?: string;
  name: string;
}

export type BreadCrumbs = BreadCrumb[];

@Component({
  selector: 'lib-breadcrumbs',
  templateUrl: './breadcrumbs.component.html',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadCrumbsComponent {
  breadCrumbs = input<BreadCrumb[] | null>([]);
}
