import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import type { GeoguessPin } from '@nx-stolfo/api-interfaces';
import { LatLon, memberName } from './geoguess-format';

const ACCENT = '#a855f7';
const ANSWER = '#22c55e';
const OTHER = '#9ca3af';

/**
 * A world map: click to place your pin while the round is open. Once it's over it shows the answer, every pin
 * and a line from each pin to the answer.
 */
@Component({
  selector: 'feature-geoguess-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container class="h-full w-full overflow-hidden rounded-xl bg-base-300" aria-label="World map: click to place your guess"></div>`,
  host: { class: 'block' },
})
export class GeoguessMapComponent {
  /** Your pin: placed but not sent yet, or sent */
  pin = input<LatLon | null>(null);
  /** No more clicks: you guessed, or the round is over */
  locked = input(false);
  answer = input<LatLon | undefined>(undefined);
  pins = input<GeoguessPin[]>([]);
  picked = output<LatLon>();

  private container = viewChild.required<ElementRef<HTMLElement>>('container');
  /** Leaflet once loaded; a signal so the drawing effect runs again when it arrives */
  private leaflet = signal<{ L: typeof import('leaflet'); map: LeafletMap; layer: LayerGroup } | undefined>(undefined);

  constructor() {
    // Leaflet touches window: load it in the browser only, after the first render
    afterNextRender(async () => {
      const L = await import('leaflet');
      const map = L.map(this.container().nativeElement, { worldCopyJump: true, minZoom: 1 }).setView([20, 0], 2);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on('click', (e) => {
        if (this.locked()) return;
        const { lat, lng } = e.latlng.wrap();
        this.picked.emit({ lat, lon: lng });
      });
      this.leaflet.set({ L, map, layer: L.layerGroup().addTo(map) });
    });

    // Redraw every marker when anything changes: a handful of pins, so no diffing
    let zoomedIn = false;
    effect(() => {
      const leaflet = this.leaflet();
      const pin = this.pin();
      const answer = this.answer();
      const pins = this.pins();
      if (!leaflet) return;
      const { L, map, layer } = leaflet;
      layer.clearLayers();
      // Circle markers need no icon images, which bundlers lose
      const dot = (at: LatLon, color: string, radius: number) => L.circleMarker([at.lat, at.lon], { radius, color, fillColor: color, fillOpacity: 0.9, weight: 2 });
      if (!answer) {
        // A new round: back to the whole world, or the last answer would be a hint
        if (zoomedIn) map.setView([20, 0], 2);
        zoomedIn = false;
        if (pin) dot(pin, ACCENT, 8).addTo(layer);
        return;
      }
      zoomedIn = true;
      for (const p of pins) {
        L.polyline([[p.lat, p.lon], [answer.lat, answer.lon]], { color: OTHER, weight: 1, dashArray: '4 4' }).addTo(layer);
        dot(p, p.place ? ACCENT : OTHER, 7)
          .bindTooltip(`${memberName(p.member)} · ${p.km} km`)
          .addTo(layer);
      }
      dot(answer, ANSWER, 10).bindTooltip('Here!', { permanent: true, direction: 'top' }).addTo(layer);
      map.fitBounds(L.latLngBounds([[answer.lat, answer.lon], ...pins.map((p) => [p.lat, p.lon] as [number, number])]).pad(0.2), { maxZoom: 8 });
    });

    inject(DestroyRef).onDestroy(() => this.leaflet()?.map.remove());
  }
}
