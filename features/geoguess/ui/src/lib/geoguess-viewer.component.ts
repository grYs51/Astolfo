import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, viewChild } from '@angular/core';
import type { Viewer } from 'mapillary-js';

/** The Mapillary street viewer: look around and walk along the street from the round's photo */
@Component({
  selector: 'feature-geoguess-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container class="h-full w-full overflow-hidden rounded-xl bg-base-300"></div>`,
  host: { class: 'block' },
})
export class GeoguessViewerComponent {
  imageId = input.required<string>();
  token = input.required<string>();

  private container = viewChild.required<ElementRef<HTMLElement>>('container');
  private viewer?: Viewer;

  constructor() {
    // MapillaryJS touches window: load it in the browser only, after the first render
    afterNextRender(async () => {
      const { Viewer } = await import('mapillary-js');
      this.viewer = new Viewer({ accessToken: this.token(), container: this.container().nativeElement, imageId: this.imageId() });
    });
    effect(() => {
      const id = this.imageId();
      // A photo deleted since the pool was built rejects; the round goes on without walking around
      this.viewer?.moveTo(id).catch(() => undefined);
    });
    inject(DestroyRef).onDestroy(() => this.viewer?.remove());
  }
}
