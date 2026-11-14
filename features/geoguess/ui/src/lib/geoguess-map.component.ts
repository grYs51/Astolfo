import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import type { LatLng, LayerGroup, Map as LeafletMap } from 'leaflet';
import type { GeoguessPin } from '@nx-stolfo/api-interfaces';
import { LatLon, memberName } from './geoguess-format';

const ACCENT = '#a855f7';
const ANSWER = '#22c55e';
const OTHER = '#9ca3af';
/** Size of a player's avatar marker on the result, in px */
const AVATAR = 36;

/** A round avatar (or the name's initial) ringed in the pin's colour; built as elements so names need no escaping */
const avatarIcon = (L: typeof import('leaflet'), p: GeoguessPin, color: string) => {
  const avatar = p.member.avatar;
  let el: HTMLElement;
  if (avatar) {
    el = Object.assign(document.createElement('img'), { src: avatar, alt: '' });
  } else {
    el = document.createElement('div');
    el.textContent = memberName(p.member).charAt(0).toUpperCase();
  }
  el.style.cssText = `width:${AVATAR}px;height:${AVATAR}px;border-radius:50%;border:3px solid ${color};box-sizing:border-box;background:#1f2937;color:#fff;display:grid;place-items:center;font-weight:700;object-fit:cover`;
  // className '' drops Leaflet's default white square behind div icons
  return L.divIcon({ html: el, className: '', iconSize: [AVATAR, AVATAR] });
};

/**
 * A world map: click to place your pin while the round is open. Once it's over it shows the answer, every pin
 * and a line from each pin to the answer.
 */
@Component({
  selector: 'feature-geoguess-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container class="h-full w-full overflow-hidden rounded-xl bg-base-300" aria-label="World map: click, or move with the arrow keys and press Enter, to place your guess"></div>`,
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
    let destroyed = false;
    // Leaflet touches window: load it in the browser only, after the first render
    afterNextRender(async () => {
      // Leaflet is CommonJS: the production build puts it all on `default` (only `export default`), the dev
      // server exposes the names directly. Take whichever is there.
      const mod: typeof import('leaflet') & { default?: typeof import('leaflet') } = await import('leaflet');
      const L = mod.default ?? mod;
      // Left the page while it loaded: don't start a map nobody will remove
      if (destroyed) return;
      const map = L.map(this.container().nativeElement, { worldCopyJump: true, minZoom: 1 }).setView([20, 0], 2);
      // Esri's street map labels every place in English; OpenStreetMap's tiles use the local language.
      // shortcut: Esri's keyless tile service, fine for a friendly server; move to an ArcGIS key if Esri starts refusing it.
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Powered by <a href="https://www.esri.com">Esri</a> | Sources: Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS, &copy; OpenStreetMap contributors',
      }).addTo(map);
      const pick = (at: LatLng) => {
        if (this.locked()) return;
        const { lat, lng } = at.wrap();
        this.picked.emit({ lat, lon: lng });
      };
      map.on('click', (e) => pick(e.latlng));
      // Keyboard: the arrow keys pan the map, Enter drops the pin at its centre
      map.on('keydown', (e) => e.originalEvent.key === 'Enter' && pick(map.getCenter()));
      this.leaflet.set({ L, map, layer: L.layerGroup().addTo(map) });
    });

    // Redraw every marker when anything changes: a handful of pins, so no diffing
    /** The answer the view was last fitted to: fit once per result, so polling doesn't undo the player's zoom */
    let fitted = '';
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
        if (fitted) map.setView([20, 0], 2);
        fitted = '';
        if (pin) dot(pin, ACCENT, 8).addTo(layer);
        return;
      }
      for (const p of pins) {
        const color = p.place ? ACCENT : OTHER;
        L.polyline([[p.lat, p.lon], [answer.lat, answer.lon]], { color, weight: 2, dashArray: '6 6' }).addTo(layer);
        L.marker([p.lat, p.lon], { icon: avatarIcon(L, p, color), title: memberName(p.member) })
          .bindTooltip(`${p.km} km`, { permanent: true, direction: 'bottom', offset: [0, AVATAR / 2] })
          .addTo(layer);
      }
      dot(answer, ANSWER, 14).bindTooltip('Here!', { permanent: true, direction: 'top' }).addTo(layer);
      if (fitted === `${answer.lat},${answer.lon}`) return;
      fitted = `${answer.lat},${answer.lon}`;
      map.fitBounds(L.latLngBounds([[answer.lat, answer.lon], ...pins.map((p) => [p.lat, p.lon] as [number, number])]).pad(0.2), { maxZoom: 8 });
    });

    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      this.leaflet()?.map.remove();
    });
  }
}
