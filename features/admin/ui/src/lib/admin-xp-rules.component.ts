import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { XpRules, XpRulesError } from '@nx-stolfo/data-access-admin';
import { GEOGUESS_GROUP, GeoguessSim, getRule, levelsPreview, MILESTONE_PATH, parseHours, saveBody, setRule, simulateGeoguess, XP_RULE_GROUPS } from './xp-rules-form';

/** The XP rules for every server, each number with its default beside it. The page saves. */
@Component({
  selector: 'feature-admin-xp-rules',
  imports: [DecimalPipe],
  template: `
    <form (submit)="$event.preventDefault(); save.emit(body())">
      <div class="grid gap-lg md:grid-cols-2">
        @for (group of groups; track group.title) {
          <fieldset class="space-y-sm">
            <legend class="text-sm font-semibold text-gray-100">{{ group.title }}</legend>
            <p class="text-xs text-gray-500">{{ group.hint }}</p>
            <div class="grid grid-cols-2 gap-sm">
              @for (field of group.fields; track field.path) {
                <div>
                  <label [for]="'xp-' + field.path" class="block text-xs text-gray-400">{{ field.label }}</label>
                  <input
                    [id]="'xp-' + field.path"
                    type="number"
                    min="0"
                    [step]="field.step"
                    class="input input-bordered input-sm w-full tabular-nums"
                    [class.input-error]="errorAt(field.path)"
                    [attr.aria-invalid]="errorAt(field.path) ? 'true' : null"
                    [attr.aria-describedby]="'xp-' + field.path + '-hint'"
                    [value]="get(draft(), field.path)"
                    (input)="set(field.path, $any($event.target).valueAsNumber)"
                  />
                  <p [id]="'xp-' + field.path + '-hint'" class="mt-0.5 text-xs" [class]="errorAt(field.path) ? 'text-error' : 'text-gray-500'">
                    {{ errorAt(field.path) ?? 'Default ' + get(defaults(), field.path) }}
                  </p>
                </div>
              }
            </div>
            @if (group.title === 'Levels') {
              <p class="text-xs text-gray-400" aria-live="polite">
                @for (l of preview(); track l.level) {
                  Level {{ l.level }}: <span class="tabular-nums text-gray-200">{{ l.xp | number }} XP</span>{{ $last ? '' : ' · ' }}
                }
              </p>
            }
            @if (group.title === geoguessGroup) {
              <fieldset class="space-y-sm rounded border border-gray-700 p-sm">
                <legend class="px-1 text-xs font-semibold text-gray-300">XP simulator (the rules being typed)</legend>
                <div class="grid grid-cols-2 gap-sm">
                  <div>
                    <label for="sim-difficulty" class="block text-xs text-gray-400">Difficulty</label>
                    <select id="sim-difficulty" class="select select-bordered select-sm w-full" [value]="sim().difficulty" (change)="setSim('difficulty', $any($event.target).value)">
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label for="sim-km" class="block text-xs text-gray-400">Distance (km)</label>
                    <input id="sim-km" type="number" min="0" class="input input-bordered input-sm w-full tabular-nums" [value]="sim().km" (input)="setSim('km', $any($event.target).valueAsNumber)" />
                  </div>
                  <div>
                    <label for="sim-players" class="block text-xs text-gray-400">Players in the round</label>
                    <input id="sim-players" type="number" min="1" class="input input-bordered input-sm w-full tabular-nums" [value]="sim().players" (input)="setSim('players', $any($event.target).valueAsNumber)" />
                  </div>
                  <div>
                    <label for="sim-earned" class="block text-xs text-gray-400">Trivia XP already earned today</label>
                    <input id="sim-earned" type="number" min="0" class="input input-bordered input-sm w-full tabular-nums" [value]="sim().earnedToday" (input)="setSim('earnedToday', $any($event.target).valueAsNumber)" />
                  </div>
                  <div>
                    <label for="sim-sent" class="block text-xs text-gray-400">Pin</label>
                    <select id="sim-sent" class="select select-bordered select-sm w-full" [value]="sim().unsent ? 'unsent' : 'clicked'" (change)="setSim('unsent', $any($event.target).value === 'unsent')">
                      <option value="clicked">Clicked Guess</option>
                      <option value="unsent">Unsent (timer ran out)</option>
                    </select>
                  </div>
                  <label class="flex items-center gap-xs self-end pb-1 text-xs text-gray-400">
                    <input type="checkbox" class="checkbox checkbox-sm" [checked]="sim().closest" (change)="setSim('closest', $any($event.target).checked)" />
                    Closest pin
                  </label>
                </div>
                <p class="text-xs text-gray-400" aria-live="polite">
                  <span class="tabular-nums text-gray-200">{{ simResult().xp }} XP</span> · {{ simResult().text }}
                </p>
              </fieldset>
            }
            @if (group.title === 'Thresholds') {
              <div>
                <label for="xp-milestones" class="block text-xs text-gray-400">Milestone hours (rising, comma separated)</label>
                <input
                  id="xp-milestones"
                  class="input input-bordered input-sm w-full tabular-nums"
                  [class.input-error]="errorAt(milestonePath)"
                  [attr.aria-invalid]="errorAt(milestonePath) ? 'true' : null"
                  aria-describedby="xp-milestones-hint"
                  [value]="draft().thresholds.milestoneHours.join(', ')"
                  (change)="set(milestonePath, parseHours($any($event.target).value))"
                />
                <p id="xp-milestones-hint" class="mt-0.5 text-xs" [class]="errorAt(milestonePath) ? 'text-error' : 'text-gray-500'">
                  {{ errorAt(milestonePath) ?? 'Default ' + defaults().thresholds.milestoneHours.join(', ') }}
                </p>
              </div>
            }
          </fieldset>
        }
      </div>

      <div class="mt-md flex flex-wrap items-center gap-sm">
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">Save</button>
        <button type="button" class="btn btn-ghost btn-sm" [disabled]="busy()" (click)="draft.set(defaults())">Reset to defaults</button>
        @if (error() && !error()!.field) {
          <span class="text-xs text-error">{{ error()!.error }}</span>
        }
      </div>
      @if (saved()) {
        <p class="mt-sm text-xs text-gray-400" role="status">
          New rules apply to new XP. Recalculate a server to apply them to its history.
        </p>
      }
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminXpRulesComponent {
  rules = input.required<XpRules>();
  defaults = input.required<XpRules>();
  busy = input(false);
  /** The API's 400; `field` names the input it belongs to */
  error = input<XpRulesError | null>(null);
  saved = input(false);
  /** null goes back to the defaults */
  save = output<XpRules | null>();

  protected readonly groups = XP_RULE_GROUPS;
  protected readonly milestonePath = MILESTONE_PATH;
  protected readonly geoguessGroup = GEOGUESS_GROUP;
  protected readonly get = getRule;
  protected readonly parseHours = parseHours;

  protected draft = linkedSignal(() => this.rules());
  protected preview = computed(() => levelsPreview(this.draft()));
  protected body = computed(() => saveBody(this.draft(), this.defaults()));
  protected sim = signal<GeoguessSim>({ difficulty: 'hard', km: 150, players: 4, closest: true, unsent: false, earnedToday: 0 });
  protected simResult = computed(() => simulateGeoguess(this.draft(), this.sim()));

  protected setSim<K extends keyof GeoguessSim>(key: K, value: GeoguessSim[K]) {
    this.sim.update((sim) => ({ ...sim, [key]: value }));
  }

  protected set(path: string, value: unknown) {
    this.draft.update((rules) => setRule(rules, path, value));
  }

  /** The error for a field, or for an item of the milestone list */
  protected errorAt(path: string) {
    const e = this.error();
    return e?.field && (e.field === path || e.field.startsWith(path + '.')) ? e.error : undefined;
  }
}
